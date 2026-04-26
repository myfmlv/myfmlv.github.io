#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
import os
import re
import shutil
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

KST = timezone(timedelta(hours=9), name="KST")
DEFAULT_SCHEDULE_KST: tuple[str, ...] = ("08:20", "12:40", "17:10")


@dataclass(frozen=True)
class SlotWindow:
    start: datetime
    end: datetime
    slot: str


def at_kst(base_date: datetime, hour: int, minute: int) -> datetime:
    return datetime(base_date.year, base_date.month, base_date.day, hour, minute, tzinfo=KST)


def normalize_schedule_kst(schedule_kst: Sequence[str] | None = None) -> list[str]:
    raw_schedule = list(schedule_kst or DEFAULT_SCHEDULE_KST)
    normalized: list[tuple[int, int, str]] = []
    seen: set[str] = set()
    for item in raw_schedule:
        slot = str(item or "").strip()
        if not re.match(r"^\d{2}:\d{2}$", slot):
            continue
        hour, minute = (int(part) for part in slot.split(":", 1))
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            continue
        canonical = f"{hour:02d}:{minute:02d}"
        if canonical in seen:
            continue
        seen.add(canonical)
        normalized.append((hour, minute, canonical))
    normalized.sort(key=lambda item: (item[0], item[1]))
    return [item[2] for item in normalized] or list(DEFAULT_SCHEDULE_KST)


def previous_business_day(base_date: datetime) -> datetime:
    cursor = base_date - timedelta(days=1)
    while cursor.weekday() >= 5:
        cursor -= timedelta(days=1)
    return cursor


def requested_windows_for_date(
    base_date: datetime,
    schedule_kst: Sequence[str] | None = None,
) -> list[SlotWindow]:
    slots = normalize_schedule_kst(schedule_kst)
    previous_date = previous_business_day(base_date)
    windows: list[SlotWindow] = []
    previous_end: datetime | None = None
    last_slot_hour, last_slot_minute = (int(part) for part in slots[-1].split(":", 1))
    carry_start = at_kst(previous_date, last_slot_hour, last_slot_minute)
    for index, slot in enumerate(slots):
        hour, minute = (int(part) for part in slot.split(":", 1))
        end = at_kst(base_date, hour, minute)
        start = carry_start if index == 0 else previous_end
        if start is None:
            raise RuntimeError("slot window invariant violated: missing previous_end")
        windows.append(SlotWindow(start=start, end=end, slot=slot))
        previous_end = end
    return windows


def resolve_slot_window(now_kst: datetime, schedule_kst: Sequence[str] | None = None) -> SlotWindow:
    normalized_schedule = normalize_schedule_kst(schedule_kst)
    candidates: list[SlotWindow] = []
    for day_offset in range(-7, 1):
        base = now_kst + timedelta(days=day_offset)
        if base.weekday() >= 5:
            continue
        candidates.extend(requested_windows_for_date(base, normalized_schedule))
    candidates.sort(key=lambda window: window.end)
    past_windows = [window for window in candidates if window.end <= now_kst]
    if past_windows:
        return past_windows[-1]
    return SlotWindow(start=now_kst - timedelta(hours=12), end=now_kst, slot="fallback-12h")


def parse_datetime_or_none(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def filter_records_to_window(records: Iterable[Mapping[str, Any]], window: SlotWindow) -> list[dict[str, Any]]:
    start_utc = window.start.astimezone(timezone.utc)
    end_utc = window.end.astimezone(timezone.utc)
    kept: list[dict[str, Any]] = []
    for record in records:
        parsed = parse_datetime_or_none(str(record.get("date") or "") or None)
        if parsed is None:
            continue
        if start_utc <= parsed < end_utc:
            kept.append(dict(record))
    return kept


def resolve_resume_min_id(state: Mapping[str, Any], window: SlotWindow) -> int:
    last_message_id = int(state.get("last_message_id") or 0)
    if last_message_id <= 0:
        return 0

    previous_window_end_raw = state.get("slot_window_end")
    if not previous_window_end_raw:
        return last_message_id

    try:
        previous_window_end = datetime.fromisoformat(str(previous_window_end_raw))
    except ValueError:
        return last_message_id

    if previous_window_end.tzinfo is None:
        previous_window_end = previous_window_end.replace(tzinfo=timezone.utc)

    previous_window_end_utc = previous_window_end.astimezone(timezone.utc)
    current_window_start_utc = window.start.astimezone(timezone.utc)
    if previous_window_end_utc <= current_window_start_utc:
        return last_message_id
    return 0



def build_bounded_iter_messages_kwargs(last_message_id: int, window: SlotWindow) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "offset_date": window.end.astimezone(timezone.utc),
        "reverse": False,
    }
    if int(last_message_id or 0) > 0:
        kwargs["min_id"] = int(last_message_id)
    return kwargs


def slot_date_label(window: SlotWindow) -> str:
    return window.end.astimezone(KST).strftime("%Y-%m-%d")


def slot_time_label(window: SlotWindow) -> str:
    return window.end.astimezone(KST).strftime("%H%M")


def _json_dumps(payload: Any, *, pretty: bool = False) -> str:
    if pretty:
        return json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    return json.dumps(payload, ensure_ascii=False) + "\n"


def run_async(awaitable: Any) -> Any:
    return asyncio.run(awaitable)


async def export_channel_for_slot(
    *,
    archive: Any,
    client: Any,
    entity: Any,
    window: SlotWindow,
    chat_ref: str,
    kind: str,
    chat_title: str,
    username: str | None,
    chat_slug: str,
    limit: int | None = None,
) -> dict[str, Any]:
    chat_id = int(getattr(entity, "id"))
    dialog_root = archive.dialog_root_for(chat_id, kind)
    dialog_root.mkdir(parents=True, exist_ok=True)
    state_path = dialog_root / "state.json"
    state = archive.read_json(state_path, default={})
    resume_min_id = resolve_resume_min_id(state, window)
    iter_kwargs = build_bounded_iter_messages_kwargs(resume_min_id, window)
    if limit is not None:
        iter_kwargs["limit"] = int(limit)

    media_dir = dialog_root / "media"
    records: list[dict[str, Any]] = []
    serialized_count = 0
    max_seen_message_id = int(state.get("last_seen_message_id") or state.get("last_message_id") or 0)
    max_committable_message_id = int(state.get("last_message_id") or 0)

    async for message in client.iter_messages(entity, **iter_kwargs):
        serialized_count += 1
        message_id = int(getattr(message, "id", 0) or 0)
        if message_id > max_seen_message_id:
            max_seen_message_id = message_id

        media_path = None
        if getattr(archive.args, "download_media", False):
            media_dir.mkdir(parents=True, exist_ok=True)
            await archive.maybe_download_media(client, message, media_dir)
            media_path = getattr(message, "downloaded_media_path", None)

        serialized = archive.serialize_message(
            message,
            chat_id=chat_id,
            chat_title=chat_title,
            kind=kind,
            username=username,
            media_path=archive.path_ref(Path(media_path)) if media_path else None,
        )
        if filter_records_to_window([serialized], window):
            records.append(serialized)
            if message_id > max_committable_message_id:
                max_committable_message_id = message_id

    pending_state = dict(state)
    pending_state.update(
        {
            "chat_id": chat_id,
            "chat_ref": chat_ref,
            "chat_slug": chat_slug,
            "chat_title": chat_title,
            "chat_username": username,
            "chat_kind": kind,
            "last_message_id": max_committable_message_id,
            "last_seen_message_id": max_seen_message_id,
            "last_run_started_at": datetime.now(timezone.utc).isoformat(),
            "slot_window_start": window.start.astimezone(timezone.utc).isoformat(),
            "slot_window_end": window.end.astimezone(timezone.utc).isoformat(),
        }
    )
    if records:
        pending_state["latest_message_date"] = str(records[-1].get("date") or "") or pending_state.get("latest_message_date")

    return {
        "chat_id": chat_id,
        "chat_slug": chat_slug,
        "chat_title": chat_title,
        "chat_kind": kind,
        "chat_username": username,
        "state_path": state_path,
        "records": records,
        "exported_count": len(records),
        "serialized_count": serialized_count,
        "pending_state": pending_state,
        "iter_messages_kwargs": iter_kwargs,
    }


def append_records_to_archive(archive: Any, exports: Iterable[Mapping[str, Any]]) -> int:
    appended = 0
    for export in exports:
        records = [dict(row) for row in export.get("records") or []]
        if not records:
            continue
        dialog_root = archive.dialog_root_for(int(export["chat_id"]), str(export.get("chat_kind") or "channel"))
        dialog_root.mkdir(parents=True, exist_ok=True)
        messages_path = dialog_root / "messages.jsonl"
        with messages_path.open("a", encoding="utf-8", newline="\n") as handle:
            for row in records:
                handle.write(_json_dumps(row))
                appended += 1
    return appended


def update_archive_catalog(archive: Any, exports: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    dialogs = []
    for export in exports:
        dialogs.append(
            {
                "chat_id": int(export["chat_id"]),
                "chat_kind": str(export.get("chat_kind") or "channel"),
                "chat_title": str(export.get("chat_title") or export.get("chat_slug") or export["chat_id"]),
                "chat_username": export.get("chat_username"),
                "dialog_root": archive.path_ref(archive.dialog_root_for(int(export["chat_id"]), str(export.get("chat_kind") or "channel"))),
            }
        )
    dialogs.sort(key=lambda item: (item["chat_kind"], item["chat_title"].lower(), item["chat_id"]))
    catalog = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_dialogs": len(dialogs),
        "dialogs": dialogs,
    }
    archive.write_json_atomic(Path(archive.catalog_path), catalog)
    return catalog


def commit_slot_state_updates(archive: Any, updates: Iterable[Mapping[str, Any]]) -> int:
    written = 0
    for update in updates:
        state_path = Path(update["state_path"])
        pending_state = dict(update.get("pending_state") or {})
        archive.write_json_atomic(state_path, pending_state)
        written += 1
    return written


def _project_root() -> Path:
    root = Path(__file__).resolve().parents[5]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    return root


def load_runtime_config(project_root: str | Path | None = None) -> dict[str, Any]:
    root = Path(project_root).expanduser() if project_root else _project_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    from project_env import load_project_env

    resolved_root = load_project_env(root)
    export_root = os.environ.get("TELEGRAM_EXPORT_ROOT") or str(resolved_root / "data/archives/export")
    session_path = os.environ.get("TELEGRAM_SESSION_PATH") or str(
        resolved_root / "data/archives/session/main_archive"
    )
    retention_days = int(os.environ.get("TELEGRAM_RETENTION_DAYS") or 7)
    return {
        "project_root": resolved_root,
        "export_root": export_root,
        "session_path": session_path,
        "api_id": os.environ.get("TELEGRAM_API_ID") or "",
        "api_hash": os.environ.get("TELEGRAM_API_HASH") or "",
        "download_media": str(os.environ.get("TELEGRAM_DOWNLOAD_MEDIA") or "0").strip() == "1",
        "retention_days": retention_days,
    }


def load_selected_channel_targets(project_root: str | Path | None = None) -> list[dict[str, Any]]:
    root = Path(project_root).expanduser() if project_root else _project_root()
    worker_dir = root / "data/analysis/telegram/main/worker"
    rankings_path = worker_dir / "channel_rankings.json"
    if str(worker_dir) not in sys.path:
        sys.path.insert(0, str(worker_dir))
    from channel_selection import selected_channel_slugs

    selected = selected_channel_slugs()
    rankings = json.loads(rankings_path.read_text(encoding="utf-8")) if rankings_path.exists() else {}
    rows = list(rankings.get("channels") or [])
    if selected is not None:
        rows = [row for row in rows if str(row.get("chat_slug") or "").strip() in selected]
    rows.sort(key=lambda row: str(row.get("chat_slug") or ""))
    targets: list[dict[str, Any]] = []
    for row in rows:
        chat_slug = str(row.get("chat_slug") or "").strip()
        if not chat_slug:
            continue
        chat_ref = str(row.get("chat_username") or "").strip() or str(row.get("chat_id") or "").strip()
        if not chat_ref:
            continue
        targets.append(
            {
                "chat_slug": chat_slug,
                "chat_id": int(row.get("chat_id") or 0),
                "chat_ref": chat_ref,
                "chat_title": str(row.get("chat_title") or chat_slug),
                "chat_username": str(row.get("chat_username") or "").strip() or None,
                "chat_kind": str(row.get("chat_kind") or "channel"),
            }
        )
    return targets


def import_archive_module(project_root: str | Path | None = None) -> Any:
    root = Path(project_root).expanduser() if project_root else _project_root()
    module_path = root / "scripts" / "archive_telegram_chat.py"
    spec = importlib.util.spec_from_file_location("telegram_archive_runtime", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"unable to import archive module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def clone_runtime_session(session_path: str | Path, project_root: str | Path | None = None) -> tuple[Path, Path]:
    root = Path(project_root).expanduser() if project_root else _project_root()
    source = Path(session_path).expanduser()
    session_file = Path(f"{source}.session")
    if not session_file.exists():
        raise FileNotFoundError(f"missing Telegram session file: {session_file}")
    runtime_dir = root / "tmp" / "telegram-export-session"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp(prefix="slot_export_", dir=runtime_dir))
    runtime_base = temp_dir / "runtime_archive"
    shutil.copy2(session_file, Path(f"{runtime_base}.session"))
    journal_file = Path(f"{source}.session-journal")
    if journal_file.exists():
        shutil.copy2(journal_file, Path(f"{runtime_base}.session-journal"))
    return runtime_base, temp_dir


async def export_selected_channels_for_slot(
    *,
    now_kst: datetime | None = None,
    window: SlotWindow | None = None,
    project_root: str | Path | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    runtime = load_runtime_config(project_root)
    if not runtime["api_id"] or not runtime["api_hash"]:
        raise RuntimeError("TELEGRAM_API_ID / TELEGRAM_API_HASH are required for slot export")
    if window is None:
        resolved_now = (now_kst or datetime.now(KST)).astimezone(KST)
        window = resolve_slot_window(resolved_now)

    archive_module = import_archive_module(runtime["project_root"])
    runtime_session_base, temp_dir = clone_runtime_session(runtime["session_path"], runtime["project_root"])
    args = argparse.Namespace(
        root=runtime["export_root"],
        session_path=str(runtime_session_base),
        chat="all",
        api_id=str(runtime["api_id"]),
        api_hash=str(runtime["api_hash"]),
        phone=None,
        download_media=bool(runtime["download_media"]),
        limit=limit,
        login=False,
        all_dialogs=False,
        list_dialogs=False,
        retention_days=int(runtime["retention_days"]),
    )
    archive = archive_module.TelegramArchive(args)
    targets = load_selected_channel_targets(runtime["project_root"])
    results: list[dict[str, Any]] = []
    try:
        async with archive_module.TelegramClient(str(archive.session_path), int(args.api_id), args.api_hash) as client:
            if not await client.is_user_authorized():
                raise RuntimeError("Telegram session is not authorized")
            for target in targets:
                entity = await client.get_entity(target["chat_ref"])
                results.append(
                    await export_channel_for_slot(
                        archive=archive,
                        client=client,
                        entity=entity,
                        window=window,
                        chat_ref=target["chat_ref"],
                        kind=target["chat_kind"],
                        chat_title=target["chat_title"],
                        username=target["chat_username"],
                        chat_slug=target["chat_slug"],
                        limit=limit,
                    )
                )
        appended_records = append_records_to_archive(archive, results)
        catalog = update_archive_catalog(archive, results)
        written_states = commit_slot_state_updates(archive, results)
        snapshot_dir = write_slot_snapshot(
            root_dir=archive.root,
            window=window,
            channel_exports={result["chat_slug"]: result["records"] for result in results},
            market_snapshot={},
        )
        return {
            "window": window,
            "targets": len(targets),
            "written_states": written_states,
            "appended_records": appended_records,
            "catalog_dialogs": int(catalog.get("total_dialogs") or 0),
            "snapshot_dir": str(snapshot_dir),
            "channel_message_counts": {result["chat_slug"]: result["exported_count"] for result in results},
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def write_slot_snapshot(
    *,
    root_dir: str | Path,
    window: SlotWindow,
    channel_exports: Mapping[str, Iterable[Mapping[str, Any]]],
    market_snapshot: Mapping[str, Any] | None = None,
    attempt: int = 1,
    generated_at: datetime | None = None,
) -> Path:
    base_dir = Path(root_dir).expanduser() / "slot_snapshots" / slot_date_label(window) / slot_time_label(window)
    base_dir.mkdir(parents=True, exist_ok=True)

    generated = (generated_at or datetime.now(KST)).astimezone(KST)
    files: dict[str, str] = {}
    channel_message_counts: dict[str, int] = {}

    for channel_slug in sorted(channel_exports):
        path = base_dir / f"{channel_slug}.jsonl"
        records = [dict(row) for row in channel_exports[channel_slug]]
        with path.open("w", encoding="utf-8", newline="\n") as handle:
            for row in records:
                handle.write(_json_dumps(row))
        files[channel_slug] = path.name
        channel_message_counts[channel_slug] = len(records)

    market_path = base_dir / "market_snapshot.json"
    market_path.write_text(
        _json_dumps(dict(market_snapshot or {}), pretty=True),
        encoding="utf-8",
    )

    manifest = {
        "slot": window.slot,
        "slot_date": slot_date_label(window),
        "slot_label": slot_time_label(window),
        "slot_start": window.start.astimezone(KST).isoformat(),
        "slot_end": window.end.astimezone(KST).isoformat(),
        "generated_at": generated.isoformat(),
        "channels_expected": len(channel_exports),
        "channels_written": len(files),
        "channel_message_counts": channel_message_counts,
        "attempt": int(attempt),
        "files": files,
        "market_snapshot_file": market_path.name,
    }
    (base_dir / "manifest.json").write_text(
        _json_dumps(manifest, pretty=True),
        encoding="utf-8",
    )
    return base_dir


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export selected Telegram channels for the latest completed briefing slot.")
    parser.add_argument("--now-kst", help="Override current KST time in ISO format for deterministic runs.")
    parser.add_argument("--slot", help="Explicit slot label to export (e.g. 08:20, 12:40, 17:10).")
    parser.add_argument("--limit", type=int, help="Optional hard cap forwarded to Telethon iter_messages.")
    parser.add_argument("--project-root", help="Project root override.")
    return parser.parse_args(argv)


def resolve_cli_window(args: argparse.Namespace) -> SlotWindow:
    if args.slot:
        now_kst = datetime.now(KST)
        if args.now_kst:
            now_kst = datetime.fromisoformat(str(args.now_kst).replace("Z", "+00:00")).astimezone(KST)
        for window in requested_windows_for_date(now_kst, DEFAULT_SCHEDULE_KST):
            if window.slot == str(args.slot):
                return window
        raise SystemExit(f"unsupported slot: {args.slot}")
    if args.now_kst:
        return resolve_slot_window(datetime.fromisoformat(str(args.now_kst).replace("Z", "+00:00")).astimezone(KST))
    return resolve_slot_window(datetime.now(KST))


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    window = resolve_cli_window(args)
    result = run_async(
        export_selected_channels_for_slot(
            window=window,
            project_root=args.project_root,
            limit=args.limit,
        )
    )
    print(_json_dumps(
        {
            "slot": result["window"].slot,
            "targets": result["targets"],
            "written_states": result["written_states"],
            "appended_records": result.get("appended_records", 0),
            "catalog_dialogs": result.get("catalog_dialogs", 0),
            "snapshot_dir": result["snapshot_dir"],
            "channel_message_counts": result["channel_message_counts"],
        },
        pretty=True,
    ).strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
