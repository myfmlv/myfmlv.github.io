#!/usr/bin/env python3
from __future__ import annotations

import importlib
import sys
import unittest
from datetime import datetime
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))


class CronDeliveryGuardTests(unittest.TestCase):
    def setUp(self) -> None:
        sys.modules.pop("render_cron_briefing", None)
        import render_cron_briefing  # noqa: F401
        self.mod = importlib.reload(sys.modules["render_cron_briefing"])

    def test_validate_latest_markdown_accepts_matching_close_wrap(self) -> None:
        expected_end = datetime(2026, 4, 21, 17, 10, tzinfo=self.mod.gb.KST)
        markdown = "\n".join(
            [
                "# 텔레그램 클로즈 랩",
                "- 기준 시각: 2026-04-21 17:10 KST",
                "",
                "## 체제 변화",
                "- 마감 요약",
            ]
        )
        ok, reason = self.mod.validate_latest_markdown(markdown, "17:10", expected_end)
        self.assertTrue(ok)
        self.assertIsNone(reason)

    def test_validate_latest_markdown_rejects_stale_preopen_content_for_close_slot(self) -> None:
        expected_end = datetime(2026, 4, 21, 17, 10, tzinfo=self.mod.gb.KST)
        markdown = "\n".join(
            [
                "# 텔레그램 프리오픈 브리핑",
                "- 기준 시각: 2026-04-21 08:20 KST",
                "",
                "## 체제 변화",
                "- stale",
            ]
        )
        ok, reason = self.mod.validate_latest_markdown(markdown, "17:10", expected_end)
        self.assertFalse(ok)
        self.assertIn("title mismatch", reason)

    def test_extract_delivery_body_returns_text_from_first_section(self) -> None:
        markdown = "\n".join(
            [
                "# 텔레그램 미드데이 펄스",
                "- 기준 시각: 2026-04-21 12:40 KST",
                "",
                "## 체제 변화",
                "- 본문",
                "",
                "## 체크할 숫자 3개",
                "- 숫자",
            ]
        )
        body = self.mod.extract_delivery_body(markdown)
        self.assertEqual(body, "## 체제 변화\n- 본문\n\n## 체크할 숫자 3개\n- 숫자")


if __name__ == "__main__":
    unittest.main()
