#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path

from channel_selection import load_channel_rankings, selected_channel_slugs


ROOT = Path(
    os.environ.get("TELEGRAM_ANALYSIS_ROOT")
    or os.environ.get("OPENCLAW_TELEGRAM_MAIN_ROOT")
    or Path(__file__).resolve().parents[1]
).expanduser()
ARCHIVE_EXPORT_DIR = ROOT.parents[2] / "archives" / "telegram" / "main" / "export"
NORMALIZED_DIR = ROOT / "normalized"


def dialog_dir_for(slug: str) -> Path:
    chat_id = slug.rsplit("__", 1)[-1]
    return ARCHIVE_EXPORT_DIR / "dialogs" / f"channel_{chat_id}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Prune Telegram channel storage using the current channel selection policy.")
    parser.add_argument("--apply", action="store_true", help="Actually delete files instead of printing the plan.")
    args = parser.parse_args()

    selected = selected_channel_slugs()
    rankings = load_channel_rankings()
    rows = list(rankings.get("channels") or [])
    if not rows:
        raise RuntimeError("channel_rankings.json is missing or empty. Run rank_channels.py first.")

    if selected is None:
        raise RuntimeError("selection mode is allow_all; switch channel_selection.json to ranked or manual_keep before pruning.")

    removable = [row for row in rows if str(row.get("chat_slug") or "").strip() not in selected]
    plan = []
    for row in removable:
        slug = str(row.get("chat_slug") or "").strip()
        if not slug:
            continue
        plan.append(
            {
                "chat_slug": slug,
                "chat_title": row.get("chat_title"),
                "quality_score": row.get("quality_score"),
                "normalized_file": str(NORMALIZED_DIR / f"{slug}.normalized.jsonl"),
                "dialog_dir": str(dialog_dir_for(slug)),
            }
        )

    if not args.apply:
        print(json.dumps({"drop_candidates": plan}, ensure_ascii=False, indent=2))
        return 0

    for item in plan:
        normalized_path = Path(item["normalized_file"])
        dialog_dir = Path(item["dialog_dir"])
        if normalized_path.exists():
            normalized_path.unlink()
        if dialog_dir.exists():
            shutil.rmtree(dialog_dir)
    print(json.dumps({"deleted_channel_count": len(plan)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
