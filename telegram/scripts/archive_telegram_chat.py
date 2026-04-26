#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import shutil
import socket
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from project_paths import remap_legacy_path, resolve_project_root, to_project_ref

try:
    from telethon import TelegramClient
except ModuleNotFoundError:
    print(
        "Telethon is not installed. Run scripts/bootstrap_telegram_export_env.sh first.",
        file=sys.stderr,
    )
    raise SystemExit(2)


def isoformat_or_none(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat()


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


def normalize_chat_ref(raw: str) -> int | str:
    value = raw.strip()
    try:
        return int(value)
    except ValueError:
        return value


def display_name(entity: Any) -> str:
    title = getattr(entity, "title", None)
    if title:
        return str(title)

    first_name = getattr(entity, "first_name", "") or ""
    last_name = getattr(entity, "last_name", "") or ""
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    if full_name:
        return full_name

    username = getattr(entity, "username", None)
    if username:
        return f"@{username}"

    entity_id = getattr(entity, "id", None)
    if entity_id is not None:
        return str(entity_id)

    return "unknown"


def dialog_kind(entity: Any, is_group: bool = False, is_channel: bool = False) -> str:
    if is_channel:
        return "channel"
    if is_group:
        return "group"
    if getattr(entity, "broadcast", False):
        return "channel"
    if getattr(entity, "megagroup", False):
        return "group"
    return type(entity).__name__.lower()


class TelegramArchive:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.project_root = resolve_project_root(__file__)
        self.root = remap_legacy_path(args.root, self.project_root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.runs_dir = self.root / "runs"
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        self.dialogs_dir = self.root / "dialogs"
        self.dialogs_dir.mkdir(parents=True, exist_ok=True)
        self.catalog_path = self.root / "catalog.json"
        self.session_path = remap_legacy_path(args.session_path, self.project_root)
        self.session_path.parent.mkdir(parents=True, exist_ok=True)
        self.retention_days = max(0, int(args.retention_days))
        self.retention_cutoff_at = None
        self.retention_cutoff_date = None
        if self.retention_days > 0:
            self.retention_cutoff_at = datetime.now(timezone.utc) - timedelta(
                days=self.retention_days
            )
            self.retention_cutoff_date = self.retention_cutoff_at.date()

    def read_json(self, path: Path, default: dict[str, Any]) -> dict[str, Any]:
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))

    def write_text_atomic(self, path: Path, content: str) -> None:
        tmp = path.with_name(f"{path.name}.{os.getpid()}.{random.randint(1000,999999)}.tmp")
        tmp.write_text(content, encoding="utf-8")
        os.replace(tmp, path)

    def write_json_atomic(self, path: Path, payload: dict[str, Any]) -> None:
        self.write_text_atomic(
            path,
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        )

    def path_ref(self, path: Path) -> str:
        return to_project_ref(path, self.project_root)

    def dialog_root_for(self, chat_id: int, kind: str) -> Path:
        root = self.dialogs_dir / f"{kind}_{chat_id}"
        root.mkdir(parents=True, exist_ok=True)
        return root

    def prune_media_dir(self, media_dir: Path) -> int:
        if self.retention_cutoff_date is None or not media_dir.exists():
            return 0

        removed_dirs = 0
        for year_dir in media_dir.iterdir():
            if not year_dir.is_dir() or not year_dir.name.isdigit():
                continue
            for month_dir in year_dir.iterdir():
                if not month_dir.is_dir() or not month_dir.name.isdigit():
                    continue
                for day_dir in month_dir.iterdir():
                    if not day_dir.is_dir() or not day_dir.name.isdigit():
                        continue
                    try:
                        day_value = datetime(
                            int(year_dir.name),
                            int(month_dir.name),
                            int(day_dir.name),
                            tzinfo=timezone.utc,
                        ).date()
                    except ValueError:
                        continue
                    if day_value < self.retention_cutoff_date:
                        shutil.rmtree(day_dir)
                        removed_dirs += 1
                if month_dir.exists() and not any(month_dir.iterdir()):
                    month_dir.rmdir()
            if year_dir.exists() and not any(year_dir.iterdir()):
                year_dir.rmdir()
        return removed_dirs

    def prune_dialog_contents(self, dialog_root: Path, state: dict[str, Any] | None) -> dict[str, Any]:
        messages_path = dialog_root / "messages.jsonl"
        media_dir = dialog_root / "media"
        summary = {
            "retention_days": self.retention_days,
            "retention_cutoff_at": isoformat_or_none(self.retention_cutoff_at),
            "retention_cutoff_date": self.retention_cutoff_date.isoformat() if self.retention_cutoff_date else None,
            "pruned_message_count": 0,
            "pruned_media_dir_count": 0,
            "retained_message_count": state.get("retained_message_count") if state else None,
            "skipped": False,
        }

        if self.retention_cutoff_at is None or not messages_path.exists():
            return summary

        oldest_retained = parse_datetime_or_none(state.get("oldest_retained_date")) if state else None
        if oldest_retained and oldest_retained >= self.retention_cutoff_at:
            if state is not None:
                state["retention_days"] = self.retention_days
                state["retention_cutoff_at"] = isoformat_or_none(self.retention_cutoff_at)
                state["retention_cutoff_date"] = self.retention_cutoff_date.isoformat()
                state["last_pruned_at"] = datetime.now(timezone.utc).isoformat()
                state["last_pruned_removed_count"] = 0
            summary["skipped"] = True
            return summary

        tmp_path = messages_path.with_name(
            f"{messages_path.name}.{os.getpid()}.{random.randint(1000,999999)}.tmp"
        )
        kept_count = 0
        pruned_count = 0
        oldest_kept: datetime | None = None
        newest_kept: datetime | None = None

        with messages_path.open("r", encoding="utf-8") as src, tmp_path.open(
            "w", encoding="utf-8", newline="\n"
        ) as dst:
            for line in src:
                parsed_date: datetime | None = None
                keep_line = True
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    payload = None

                if payload is not None:
                    parsed_date = parse_datetime_or_none(payload.get("date"))
                    if parsed_date is not None and parsed_date < self.retention_cutoff_at:
                        keep_line = False

                if keep_line:
                    dst.write(line)
                    kept_count += 1
                    if parsed_date is not None:
                        if oldest_kept is None:
                            oldest_kept = parsed_date
                        newest_kept = parsed_date
                else:
                    pruned_count += 1

        if pruned_count > 0:
            os.replace(tmp_path, messages_path)
        else:
            tmp_path.unlink(missing_ok=True)

        pruned_media_dir_count = self.prune_media_dir(media_dir)
        summary["pruned_message_count"] = pruned_count
        summary["pruned_media_dir_count"] = pruned_media_dir_count
        summary["retained_message_count"] = kept_count

        if state is not None:
            state["retention_days"] = self.retention_days
            state["retention_cutoff_at"] = isoformat_or_none(self.retention_cutoff_at)
            state["retention_cutoff_date"] = self.retention_cutoff_date.isoformat()
            state["last_pruned_at"] = datetime.now(timezone.utc).isoformat()
            state["last_pruned_removed_count"] = pruned_count
            state["retained_message_count"] = kept_count
            state["oldest_retained_date"] = isoformat_or_none(oldest_kept)
            state["newest_retained_date"] = isoformat_or_none(newest_kept)

        return summary

    async def maybe_download_media(
        self,
        client: TelegramClient,
        message: Any,
        media_dir: Path,
    ) -> str | None:
        if not self.args.download_media or getattr(message, "media", None) is None:
            return None

        message_date = message.date or datetime.now(timezone.utc)
        target_dir = media_dir / message_date.strftime("%Y/%m/%d")
        target_dir.mkdir(parents=True, exist_ok=True)
        download_target = target_dir / f"{message.id}"
        result = await client.download_media(message, file=str(download_target))
        if not result:
            return None

        try:
            return str(Path(result).resolve().relative_to(media_dir.parent))
        except ValueError:
            return str(result)

    def serialize_message(
        self,
        message: Any,
        chat_id: int,
        chat_title: str,
        kind: str,
        username: str | None,
        media_path: str | None,
    ) -> dict[str, Any]:
        reply_to = getattr(message, "reply_to", None)
        message_file = getattr(message, "file", None)
        replies = getattr(message, "replies", None)

        return {
            "message_id": message.id,
            "date": isoformat_or_none(getattr(message, "date", None)),
            "edit_date": isoformat_or_none(getattr(message, "edit_date", None)),
            "chat_id": chat_id,
            "chat_title": chat_title,
            "chat_kind": kind,
            "chat_username": username,
            "sender_id": getattr(message, "sender_id", None),
            "text": getattr(message, "message", None) or "",
            "raw_text": getattr(message, "raw_text", None) or "",
            "out": bool(getattr(message, "out", False)),
            "reply_to_msg_id": getattr(reply_to, "reply_to_msg_id", None) if reply_to else None,
            "grouped_id": getattr(message, "grouped_id", None),
            "post_author": getattr(message, "post_author", None),
            "via_bot_id": getattr(message, "via_bot_id", None),
            "service_action": type(getattr(message, "action", None)).__name__ if getattr(message, "action", None) else None,
            "views": getattr(message, "views", None),
            "forwards": getattr(message, "forwards", None),
            "reply_count": getattr(replies, "replies", None) if replies else None,
            "has_media": getattr(message, "media", None) is not None,
            "media_kind": type(getattr(message, "media", None)).__name__ if getattr(message, "media", None) else None,
            "media_path": media_path,
            "file_name": getattr(message_file, "name", None) if message_file else None,
            "mime_type": getattr(message_file, "mime_type", None) if message_file else None,
            "file_size": getattr(message_file, "size", None) if message_file else None,
        }

    async def export_dialog(
        self,
        client: TelegramClient,
        entity: Any,
        *,
        chat_ref: str,
        kind: str,
        chat_title: str,
        username: str | None,
    ) -> dict[str, Any]:
        chat_id = int(getattr(entity, "id"))
        dialog_root = self.dialog_root_for(chat_id, kind)
        runs_dir = dialog_root / "runs"
        media_dir = dialog_root / "media"
        messages_path = dialog_root / "messages.jsonl"
        state_path = dialog_root / "state.json"
        runs_dir.mkdir(parents=True, exist_ok=True)

        state = self.read_json(
            state_path,
            {
                "chat_ref": chat_ref,
                "chat_id": chat_id,
                "chat_kind": kind,
                "chat_title": chat_title,
                "chat_username": username,
                "last_message_id": 0,
                "total_messages_exported": 0,
                "run_count": 0,
                "last_run_at": None,
            },
        )

        existing_chat_id = state.get("chat_id")
        if existing_chat_id is not None and int(existing_chat_id) != chat_id:
            raise RuntimeError(
                f"{state_path} already belongs to chat_id={existing_chat_id} and cannot be reused for {chat_id}."
            )

        export_started_at = datetime.now(timezone.utc)
        last_message_id = int(state.get("last_message_id") or 0)
        exported_count = 0
        downloaded_media_count = 0
        first_exported_id: int | None = None
        newest_exported_id = last_message_id

        def record_message_ids(message: Any) -> None:
            nonlocal first_exported_id, newest_exported_id
            if first_exported_id is None:
                first_exported_id = int(message.id)
            newest_exported_id = max(newest_exported_id, int(message.id))

        async def write_message(handle: Any, message: Any) -> None:
            nonlocal exported_count, downloaded_media_count
            if message is None or getattr(message, "id", None) is None:
                return
            media_path = await self.maybe_download_media(client, message, media_dir)
            if media_path:
                downloaded_media_count += 1
            record_message_ids(message)
            payload = self.serialize_message(
                message,
                chat_id,
                chat_title,
                kind,
                username,
                media_path,
            )
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
            exported_count += 1

        with messages_path.open("a", encoding="utf-8", newline="\n") as handle:
            if last_message_id > 0:
                async for message in client.iter_messages(entity, min_id=last_message_id, reverse=True):
                    await write_message(handle, message)
            elif self.args.limit:
                recent_messages: list[Any] = []
                async for message in client.iter_messages(entity, limit=self.args.limit):
                    recent_messages.append(message)
                for message in reversed(recent_messages):
                    await write_message(handle, message)
            else:
                async for message in client.iter_messages(entity, reverse=True):
                    await write_message(handle, message)

        finished_at = datetime.now(timezone.utc)
        new_state = {
            **state,
            "chat_ref": chat_ref,
            "chat_id": chat_id,
            "chat_kind": kind,
            "chat_title": chat_title,
            "chat_username": username,
            "download_media": bool(self.args.download_media),
            "host": socket.gethostname(),
            "last_message_id": newest_exported_id,
            "last_run_at": finished_at.isoformat(),
            "last_run_exported_count": exported_count,
            "messages_file": self.path_ref(messages_path),
            "root": self.path_ref(dialog_root),
            "run_count": int(state.get("run_count") or 0) + 1,
            "session_file": self.path_ref(Path(f"{self.session_path}.session")),
            "total_messages_exported": int(state.get("total_messages_exported") or 0) + exported_count,
        }
        prune_summary = self.prune_dialog_contents(dialog_root, new_state)
        self.write_json_atomic(state_path, new_state)

        run_stamp = export_started_at.strftime("%Y%m%dT%H%M%SZ")
        run_summary = {
            "chat_id": chat_id,
            "chat_kind": kind,
            "chat_ref": chat_ref,
            "chat_title": chat_title,
            "chat_username": username,
            "downloaded_media_count": downloaded_media_count,
            "export_finished_at": finished_at.isoformat(),
            "export_started_at": export_started_at.isoformat(),
            "exported_count": exported_count,
            "first_exported_id": first_exported_id,
            "host": socket.gethostname(),
            "last_message_id_after": newest_exported_id,
            "last_message_id_before": last_message_id,
            "limit": self.args.limit,
            "messages_file": self.path_ref(messages_path),
            "root": self.path_ref(dialog_root),
            "retention": prune_summary,
        }
        self.write_json_atomic(runs_dir / f"{run_stamp}.json", run_summary)
        return run_summary

    async def export_all_dialogs(self, client: TelegramClient) -> int:
        export_started_at = datetime.now(timezone.utc)
        discovered: list[dict[str, Any]] = []
        summaries: list[dict[str, Any]] = []
        visited_roots: set[Path] = set()

        async for dialog in client.iter_dialogs():
            if not (getattr(dialog, "is_group", False) or getattr(dialog, "is_channel", False)):
                continue

            entity = dialog.entity
            kind = dialog_kind(
                entity,
                is_group=bool(getattr(dialog, "is_group", False)),
                is_channel=bool(getattr(dialog, "is_channel", False)),
            )
            chat_id = int(getattr(entity, "id"))
            username = getattr(entity, "username", None)
            chat_title = dialog.name or display_name(entity)
            chat_ref = username or str(chat_id)
            discovered.append(
                {
                    "chat_id": chat_id,
                    "chat_kind": kind,
                    "chat_title": chat_title,
                    "chat_username": username,
                    "dialog_root": self.path_ref(self.dialog_root_for(chat_id, kind)),
                }
            )
            visited_roots.add(self.dialog_root_for(chat_id, kind))
            summary = await self.export_dialog(
                client,
                entity,
                chat_ref=chat_ref,
                kind=kind,
                chat_title=chat_title,
                username=username,
            )
            summaries.append(summary)
            print(
                f"{kind}:{chat_title} exported {summary['exported_count']} new message(s), "
                f"pruned {summary['retention']['pruned_message_count']} old message(s) into {summary['root']}"
            )

        extra_pruned_messages = 0
        for messages_path in sorted(self.dialogs_dir.glob("*/messages.jsonl")):
            dialog_root = messages_path.parent
            if dialog_root in visited_roots:
                continue
            state_path = dialog_root / "state.json"
            extra_state = self.read_json(state_path, {}) if state_path.exists() else {}
            prune_summary = self.prune_dialog_contents(dialog_root, extra_state)
            extra_pruned_messages += int(prune_summary["pruned_message_count"])
            if extra_state:
                self.write_json_atomic(state_path, extra_state)
            if prune_summary["pruned_message_count"] > 0:
                print(
                    f"pruned {prune_summary['pruned_message_count']} old message(s) from stale dialog {dialog_root}"
                )

        finished_at = datetime.now(timezone.utc)
        catalog = {
            "updated_at": finished_at.isoformat(),
            "total_dialogs": len(discovered),
            "dialogs": sorted(discovered, key=lambda item: (item["chat_kind"], item["chat_title"].lower(), item["chat_id"])),
        }
        self.write_json_atomic(self.catalog_path, catalog)

        total_exported = sum(int(item["exported_count"]) for item in summaries)
        total_media = sum(int(item["downloaded_media_count"]) for item in summaries)
        total_pruned_messages = (
            sum(int(item["retention"]["pruned_message_count"]) for item in summaries)
            + extra_pruned_messages
        )
        run_stamp = export_started_at.strftime("%Y%m%dT%H%M%SZ")
        root_run = {
            "mode": "all_dialogs",
            "export_started_at": export_started_at.isoformat(),
            "export_finished_at": finished_at.isoformat(),
            "total_dialogs": len(discovered),
            "total_exported_messages": total_exported,
            "total_downloaded_media": total_media,
            "total_pruned_messages": total_pruned_messages,
            "retention_days": self.retention_days,
            "retention_cutoff_at": isoformat_or_none(self.retention_cutoff_at),
            "retention_cutoff_date": self.retention_cutoff_date.isoformat() if self.retention_cutoff_date else None,
            "dialogs": summaries,
        }
        self.write_json_atomic(self.runs_dir / f"{run_stamp}.json", root_run)

        print(
            f"Archived {len(discovered)} dialog(s), exported {total_exported} new message(s), "
            f"pruned {total_pruned_messages} old message(s), "
            f"catalog saved to {self.catalog_path}"
        )
        return 0

    async def list_dialogs(self, client: TelegramClient) -> int:
        index = 0
        async for dialog in client.iter_dialogs():
            if not (getattr(dialog, "is_group", False) or getattr(dialog, "is_channel", False)):
                continue
            entity = dialog.entity
            index += 1
            print(
                f"{index}\t{dialog.name or display_name(entity)}\tid={getattr(entity, 'id', None)}\t"
                f"username={getattr(entity, 'username', None)}\tgroup={bool(getattr(dialog, 'is_group', False))}\t"
                f"channel={bool(getattr(dialog, 'is_channel', False))}"
            )
        print(f"TOTAL={index}")
        return 0

    async def export(self) -> int:
        chat_ref = normalize_chat_ref(self.args.chat)

        async with TelegramClient(str(self.session_path), int(self.args.api_id), self.args.api_hash) as client:
            if self.args.login:
                await client.start(phone=self.args.phone or None)
                me = await client.get_me()
                print(f"Telegram login complete for {display_name(me)}")
                print(f"Session saved to {self.session_path}.session")
                return 0

            if not await client.is_user_authorized():
                print(
                    "Telegram session is not authorized. Run scripts/run_telegram_export.sh --login first.",
                    file=sys.stderr,
                )
                return 2

            if self.args.list_dialogs:
                return await self.list_dialogs(client)

            if self.args.all_dialogs:
                return await self.export_all_dialogs(client)

            entity = await client.get_entity(chat_ref)
            kind = dialog_kind(entity)
            username = getattr(entity, "username", None)
            chat_title = display_name(entity)
            summary = await self.export_dialog(
                client,
                entity,
                chat_ref=self.args.chat,
                kind=kind,
                chat_title=chat_title,
                username=username,
            )
            print(
                f"Exported {summary['exported_count']} message(s) from {chat_title}, "
                f"pruned {summary['retention']['pruned_message_count']} old message(s) into "
                f"{summary['messages_file']}"
            )
            return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Incrementally archive Telegram chats into local JSONL exports."
    )
    parser.add_argument("--root", required=True, help="Directory where export data will live.")
    parser.add_argument("--session-path", required=True, help="Base path for the Telethon user session.")
    parser.add_argument("--chat", required=True, help="Telegram chat username, invite link, numeric ID, or a placeholder for login mode.")
    parser.add_argument("--api-id", required=True, help="Telegram API ID.")
    parser.add_argument("--api-hash", required=True, help="Telegram API hash.")
    parser.add_argument("--phone", help="Phone number for first-time interactive login.")
    parser.add_argument("--download-media", action="store_true", help="Download message media into each dialog's media/ folder.")
    parser.add_argument("--limit", type=int, help="Optional limit for a manual preview run.")
    parser.add_argument("--login", action="store_true", help="Perform the one-time interactive Telegram login.")
    parser.add_argument("--all-dialogs", action="store_true", help="Archive all accessible groups/channels and automatically include new ones in future runs.")
    parser.add_argument("--list-dialogs", action="store_true", help="List accessible groups/channels and exit.")
    parser.add_argument("--retention-days", type=int, default=7, help="Delete archived messages older than this many days. Use 0 to disable pruning.")
    return parser


async def async_main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    archive = TelegramArchive(args)
    return await archive.export()


def main() -> int:
    try:
        return asyncio.run(async_main())
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
