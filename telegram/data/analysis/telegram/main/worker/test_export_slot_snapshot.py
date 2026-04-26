#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib
import json
import sys
import tempfile
import unittest
from unittest import mock
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

WORKER_DIR = Path(__file__).resolve().parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))


class FakeClient:
    def __init__(self, messages: list[object]) -> None:
        self.messages = messages
        self.calls: list[dict[str, object]] = []

    async def iter_messages(self, entity: object, **kwargs: object):
        self.calls.append({"entity": entity, **kwargs})
        for message in self.messages:
            yield message


class FakeArchive:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.root = Path(args.root)
        self.dialogs_dir = self.root / "dialogs"
        self.catalog_path = self.root / "catalog.json"
        self.session_path = Path(args.session_path)
        self.serialized_ids: list[int] = []
        self.writes: list[tuple[Path, dict[str, object]]] = []

    def dialog_root_for(self, chat_id: int, kind: str) -> Path:
        path = self.dialogs_dir / f"{kind}_{chat_id}"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def read_json(self, path: Path, default: dict[str, object]) -> dict[str, object]:
        if not path.exists():
            return dict(default)
        return json.loads(path.read_text(encoding="utf-8"))

    def write_json_atomic(self, path: Path, payload: dict[str, object]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.writes.append((path, payload))

    def path_ref(self, path: Path) -> str:
        return str(path)

    def write_text_atomic(self, path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    async def maybe_download_media(self, client: object, message: object, media_dir: Path) -> None:
        return None

    def serialize_message(
        self,
        message: object,
        chat_id: int,
        chat_title: str,
        kind: str,
        username: str | None,
        media_path: str | None,
    ) -> dict[str, object]:
        self.serialized_ids.append(int(message.id))
        return {
            "message_id": int(message.id),
            "date": getattr(message, "date", None).isoformat() if getattr(message, "date", None) else None,
            "chat_id": chat_id,
            "chat_title": chat_title,
            "chat_kind": kind,
            "chat_username": username,
            "text": getattr(message, "message", "") or "",
            "media_path": media_path,
        }


class ExportSlotSnapshotTests(unittest.TestCase):
    def setUp(self) -> None:
        sys.modules.pop("export_slot_snapshot", None)
        import export_slot_snapshot  # noqa: F401

        self.mod = importlib.reload(sys.modules["export_slot_snapshot"])

    def test_requested_windows_for_date_uses_previous_business_day_for_preopen(self) -> None:
        base_date = datetime(2026, 4, 20, 0, 0, tzinfo=self.mod.KST)  # Monday
        windows = self.mod.requested_windows_for_date(base_date)

        self.assertEqual(len(windows), 3)
        self.assertEqual(windows[0].slot, "08:20")
        self.assertEqual(windows[0].start, datetime(2026, 4, 17, 17, 10, tzinfo=self.mod.KST))
        self.assertEqual(windows[0].end, datetime(2026, 4, 20, 8, 20, tzinfo=self.mod.KST))
        self.assertEqual(windows[1].start, windows[0].end)
        self.assertEqual(windows[2].end, datetime(2026, 4, 20, 17, 10, tzinfo=self.mod.KST))

    def test_resolve_slot_window_returns_latest_completed_slot(self) -> None:
        now_kst = datetime(2026, 4, 21, 13, 0, tzinfo=self.mod.KST)
        window = self.mod.resolve_slot_window(now_kst)

        self.assertEqual(window.slot, "12:40")
        self.assertEqual(window.start, datetime(2026, 4, 21, 8, 20, tzinfo=self.mod.KST))
        self.assertEqual(window.end, datetime(2026, 4, 21, 12, 40, tzinfo=self.mod.KST))

    def test_filter_records_to_window_keeps_only_inclusive_start_exclusive_end(self) -> None:
        window = self.mod.SlotWindow(
            slot="12:40",
            start=datetime(2026, 4, 21, 8, 20, tzinfo=self.mod.KST),
            end=datetime(2026, 4, 21, 12, 40, tzinfo=self.mod.KST),
        )
        rows = [
            {"message_id": 1, "date": "2026-04-20T23:20:00+00:00"},  # 08:20 KST
            {"message_id": 2, "date": "2026-04-21T03:39:59+00:00"},
            {"message_id": 3, "date": "2026-04-21T03:40:00+00:00"},  # 12:40 KST
            {"message_id": 4, "date": None},
        ]

        filtered = self.mod.filter_records_to_window(rows, window)
        self.assertEqual([row["message_id"] for row in filtered], [1, 2])

    def test_build_bounded_iter_messages_kwargs_includes_slot_end_and_min_id(self) -> None:
        window = self.mod.SlotWindow(
            slot="08:20",
            start=datetime(2026, 4, 21, 8, 20, tzinfo=self.mod.KST),
            end=datetime(2026, 4, 21, 12, 40, tzinfo=self.mod.KST),
        )

        kwargs = self.mod.build_bounded_iter_messages_kwargs(last_message_id=123, window=window)
        self.assertEqual(kwargs["min_id"], 123)
        self.assertFalse(kwargs["reverse"])
        self.assertEqual(kwargs["offset_date"], datetime(2026, 4, 21, 3, 40, tzinfo=timezone.utc))

        kwargs_without_state = self.mod.build_bounded_iter_messages_kwargs(last_message_id=0, window=window)
        self.assertNotIn("min_id", kwargs_without_state)

    def test_resolve_resume_min_id_only_reuses_state_for_strictly_newer_window(self) -> None:
        window = self.mod.SlotWindow(
            slot="17:10",
            start=datetime(2026, 4, 21, 12, 40, tzinfo=self.mod.KST),
            end=datetime(2026, 4, 21, 17, 10, tzinfo=self.mod.KST),
        )

        self.assertEqual(
            self.mod.resolve_resume_min_id(
                {"last_message_id": 777, "slot_window_end": "2026-04-21T03:40:00+00:00"},
                window,
            ),
            777,
        )
        self.assertEqual(
            self.mod.resolve_resume_min_id(
                {"last_message_id": 777, "slot_window_end": "2026-04-21T08:10:00+00:00"},
                window,
            ),
            0,
        )
        self.assertEqual(
            self.mod.resolve_resume_min_id(
                {"last_message_id": 777, "slot_window_end": "2026-04-21T14:55:14+00:00"},
                window,
            ),
            0,
        )

    def test_load_runtime_config_defaults_to_flat_archives_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            fake_project_env = SimpleNamespace(load_project_env=lambda candidate: root)
            with mock.patch.dict(self.mod.os.environ, {}, clear=True):
                with mock.patch.dict(sys.modules, {"project_env": fake_project_env}):
                    config = self.mod.load_runtime_config(project_root=root)

            self.assertEqual(config["export_root"], str(root / "data/archives/export"))
            self.assertEqual(config["session_path"], str(root / "data/archives/session/main_archive"))

    def test_write_slot_snapshot_writes_manifest_and_channel_jsonl_files(self) -> None:
        window = self.mod.SlotWindow(
            slot="08:20",
            start=datetime(2026, 4, 21, 8, 20, tzinfo=self.mod.KST),
            end=datetime(2026, 4, 21, 12, 40, tzinfo=self.mod.KST),
        )
        channel_exports = {
            "alpha_channel": [
                {"message_id": 1, "date": "2026-04-21T00:00:00+00:00", "text": "one"},
                {"message_id": 2, "date": "2026-04-21T01:00:00+00:00", "text": "two"},
            ],
            "beta_channel": [],
        }
        market_snapshot = {"fx": {"usdkrw": 1382.4}}

        with tempfile.TemporaryDirectory() as tmp_dir:
            output = self.mod.write_slot_snapshot(
                root_dir=Path(tmp_dir),
                window=window,
                channel_exports=channel_exports,
                market_snapshot=market_snapshot,
                attempt=2,
                generated_at=datetime(2026, 4, 21, 12, 45, tzinfo=self.mod.KST),
            )

            slot_dir = Path(tmp_dir) / "slot_snapshots" / "2026-04-21" / "1240"
            self.assertEqual(output, slot_dir)
            self.assertTrue(slot_dir.exists())

            alpha_path = slot_dir / "alpha_channel.jsonl"
            beta_path = slot_dir / "beta_channel.jsonl"
            manifest_path = slot_dir / "manifest.json"
            market_path = slot_dir / "market_snapshot.json"
            self.assertTrue(alpha_path.exists())
            self.assertTrue(beta_path.exists())
            self.assertTrue(manifest_path.exists())
            self.assertTrue(market_path.exists())

            alpha_lines = alpha_path.read_text(encoding="utf-8").splitlines()
            self.assertEqual(len(alpha_lines), 2)
            self.assertEqual(json.loads(alpha_lines[0])["message_id"], 1)
            self.assertEqual(beta_path.read_text(encoding="utf-8"), "")
            self.assertEqual(json.loads(market_path.read_text(encoding="utf-8"))["fx"]["usdkrw"], 1382.4)

            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(manifest["slot"], "08:20")
            self.assertEqual(manifest["slot_label"], "1240")
            self.assertEqual(manifest["channels_expected"], 2)
            self.assertEqual(manifest["channels_written"], 2)
            self.assertEqual(manifest["attempt"], 2)
            self.assertEqual(manifest["channel_message_counts"], {"alpha_channel": 2, "beta_channel": 0})
            self.assertEqual(manifest["files"]["alpha_channel"], "alpha_channel.jsonl")

    def test_export_channel_for_slot_bridges_iter_messages_and_defers_state_commit(self) -> None:
        window = self.mod.SlotWindow(
            slot="12:40",
            start=datetime(2026, 4, 21, 8, 20, tzinfo=self.mod.KST),
            end=datetime(2026, 4, 21, 12, 40, tzinfo=self.mod.KST),
        )
        entity = SimpleNamespace(id=1192351807)
        messages = [
            SimpleNamespace(id=100, date=datetime(2026, 4, 20, 23, 19, tzinfo=timezone.utc), message="too early"),
            SimpleNamespace(id=101, date=datetime(2026, 4, 20, 23, 20, tzinfo=timezone.utc), message="in window 1"),
            SimpleNamespace(id=102, date=datetime(2026, 4, 21, 1, 0, tzinfo=timezone.utc), message="in window 2"),
            SimpleNamespace(id=103, date=datetime(2026, 4, 21, 3, 40, tzinfo=timezone.utc), message="too late"),
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            archive = FakeArchive(argparse.Namespace(root=tmp_dir, session_path=str(Path(tmp_dir) / "session" / "stub"), download_media=False))
            dialog_root = archive.dialog_root_for(1192351807, "channel")
            state_path = dialog_root / "state.json"
            state_path.write_text(json.dumps({"last_message_id": 99}), encoding="utf-8")
            client = FakeClient(messages)

            result = self.mod.run_async(
                self.mod.export_channel_for_slot(
                    archive=archive,
                    client=client,
                    entity=entity,
                    window=window,
                    chat_ref="bumgore",
                    kind="channel",
                    chat_title="시장 이야기 by 제이슨",
                    username="bumgore",
                    chat_slug="시장_이야기_by_제이슨__1192351807",
                )
            )

            self.assertEqual([row["message_id"] for row in result["records"]], [101, 102])
            self.assertEqual(result["pending_state"]["last_message_id"], 102)
            self.assertEqual(result["exported_count"], 2)
            self.assertEqual(client.calls[0]["min_id"], 99)
            self.assertFalse(client.calls[0]["reverse"])
            self.assertEqual(client.calls[0]["offset_date"], datetime(2026, 4, 21, 3, 40, tzinfo=timezone.utc))
            self.assertEqual(json.loads(state_path.read_text(encoding="utf-8"))["last_message_id"], 99)
            self.assertEqual(archive.serialized_ids, [100, 101, 102, 103])
            self.assertEqual(archive.writes, [])

    def test_export_channel_for_slot_drops_min_id_when_rerunning_same_slot(self) -> None:
        window = self.mod.SlotWindow(
            slot="17:10",
            start=datetime(2026, 4, 21, 12, 40, tzinfo=self.mod.KST),
            end=datetime(2026, 4, 21, 17, 10, tzinfo=self.mod.KST),
        )
        entity = SimpleNamespace(id=1306052516)
        messages = [
            SimpleNamespace(id=60899, date=datetime(2026, 4, 21, 7, 6, 39, tzinfo=timezone.utc), message="in window"),
            SimpleNamespace(id=60910, date=datetime(2026, 4, 21, 14, 55, 14, tzinfo=timezone.utc), message="after window"),
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            archive = FakeArchive(argparse.Namespace(root=tmp_dir, session_path=str(Path(tmp_dir) / "session" / "stub"), download_media=False))
            dialog_root = archive.dialog_root_for(1306052516, "channel")
            state_path = dialog_root / "state.json"
            state_path.write_text(
                json.dumps({"last_message_id": 60910, "last_seen_message_id": 60910, "slot_window_end": "2026-04-21T08:10:00+00:00"}),
                encoding="utf-8",
            )
            client = FakeClient(messages)

            result = self.mod.run_async(
                self.mod.export_channel_for_slot(
                    archive=archive,
                    client=client,
                    entity=entity,
                    window=window,
                    chat_ref="HANAchina",
                    kind="channel",
                    chat_title="하나 중국/신흥국 전략 김경환",
                    username="HANAchina",
                    chat_slug="하나_중국_신흥국_전략_김경환__1306052516",
                )
            )

            self.assertNotIn("min_id", client.calls[0])
            self.assertEqual([row["message_id"] for row in result["records"]], [60899])
            self.assertEqual(result["pending_state"]["last_message_id"], 60910)

    def test_commit_slot_state_updates_writes_each_pending_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            archive = FakeArchive(argparse.Namespace(root=tmp_dir, session_path=str(Path(tmp_dir) / "session" / "stub"), download_media=False))
            first_path = archive.dialog_root_for(1, "channel") / "state.json"
            second_path = archive.dialog_root_for(2, "channel") / "state.json"

            written = self.mod.commit_slot_state_updates(
                archive,
                [
                    {"state_path": first_path, "pending_state": {"last_message_id": 123, "chat_id": 1}},
                    {"state_path": second_path, "pending_state": {"last_message_id": 456, "chat_id": 2}},
                ],
            )

            self.assertEqual(written, 2)
            self.assertEqual(json.loads(first_path.read_text(encoding="utf-8"))["last_message_id"], 123)
            self.assertEqual(json.loads(second_path.read_text(encoding="utf-8"))["last_message_id"], 456)
            self.assertEqual(len(archive.writes), 2)

    def test_export_selected_channels_for_slot_appends_messages_updates_catalog_and_commits_slot_state(self) -> None:
        window = self.mod.SlotWindow(
            slot="12:40",
            start=datetime(2026, 4, 21, 8, 20, tzinfo=self.mod.KST),
            end=datetime(2026, 4, 21, 12, 40, tzinfo=self.mod.KST),
        )
        target = {
            "chat_slug": "시장_이야기_by_제이슨__1192351807",
            "chat_id": 1192351807,
            "chat_ref": "bumgore",
            "chat_title": "시장 이야기 by 제이슨",
            "chat_username": "bumgore",
            "chat_kind": "channel",
        }
        messages = [
            SimpleNamespace(id=100, date=datetime(2026, 4, 20, 23, 19, tzinfo=timezone.utc), message="too early"),
            SimpleNamespace(id=101, date=datetime(2026, 4, 20, 23, 20, tzinfo=timezone.utc), message="in window 1"),
            SimpleNamespace(id=102, date=datetime(2026, 4, 21, 1, 0, tzinfo=timezone.utc), message="in window 2"),
            SimpleNamespace(id=103, date=datetime(2026, 4, 21, 3, 40, tzinfo=timezone.utc), message="too late"),
        ]

        class FakeTelethonClient:
            def __init__(self, session_path: str, api_id: int, api_hash: str) -> None:
                self.inner = FakeClient(messages)
                self.session_path = session_path
                self.api_id = api_id
                self.api_hash = api_hash

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

            async def is_user_authorized(self) -> bool:
                return True

            async def get_entity(self, chat_ref: str):
                return SimpleNamespace(id=1192351807, chat_ref=chat_ref)

            async def iter_messages(self, entity: object, **kwargs: object):
                async for item in self.inner.iter_messages(entity, **kwargs):
                    yield item

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            session_base = root / "session" / "main_archive"
            session_base.parent.mkdir(parents=True, exist_ok=True)
            Path(f"{session_base}.session").write_text("stub-session", encoding="utf-8")

            runtime = {
                "project_root": root,
                "export_root": str(root / "export"),
                "session_path": str(session_base),
                "api_id": "12345",
                "api_hash": "hash",
                "download_media": False,
                "retention_days": 7,
            }

            self.mod.load_runtime_config = lambda project_root=None: runtime
            self.mod.import_archive_module = lambda project_root=None: SimpleNamespace(
                TelegramArchive=FakeArchive,
                TelegramClient=FakeTelethonClient,
            )
            self.mod.load_selected_channel_targets = lambda project_root=None: [dict(target)]

            result = self.mod.run_async(
                self.mod.export_selected_channels_for_slot(
                    window=window,
                    project_root=root,
                )
            )

            dialog_root = root / "export" / "dialogs" / "channel_1192351807"
            messages_path = dialog_root / "messages.jsonl"
            state_path = dialog_root / "state.json"
            catalog_path = root / "export" / "catalog.json"

            self.assertTrue(messages_path.exists())
            lines = messages_path.read_text(encoding="utf-8").splitlines()
            self.assertEqual([json.loads(line)["message_id"] for line in lines], [101, 102])
            self.assertEqual(json.loads(state_path.read_text(encoding="utf-8"))["last_message_id"], 102)
            self.assertTrue(catalog_path.exists())
            catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
            self.assertEqual(catalog["total_dialogs"], 1)
            self.assertEqual(catalog["dialogs"][0]["chat_id"], 1192351807)
            self.assertEqual(result["channel_message_counts"], {target["chat_slug"]: 2})


if __name__ == "__main__":
    unittest.main()
