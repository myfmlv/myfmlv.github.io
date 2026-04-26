#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, time, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))

from project_env import load_project_env
from project_paths import resolve_project_root

load_project_env(__file__)
PROJECT_ROOT = resolve_project_root(__file__)
ANALYSIS_ROOT = PROJECT_ROOT / "data" / "analysis" / "telegram" / "main"
LATEST_REPORT_PATH = ANALYSIS_ROOT / "reports" / "latest.md"
PIPELINE_PATH = ANALYSIS_ROOT / "worker" / "run_briefing_pipeline.py"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_briefing as gb  # noqa: E402

SCHEDULE_SLOTS = ["08:20", "12:40", "17:10"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Safely render the current Telegram briefing for cron delivery.")
    parser.add_argument("--slot", required=True, choices=SCHEDULE_SLOTS, help="Expected briefing slot in KST.")
    parser.add_argument("--now-kst", help="Override current time in ISO format for testing.")
    parser.add_argument("--skip-pipeline", action="store_true", help="Skip running the pipeline and only validate latest.md.")
    return parser.parse_args()


def resolve_now_kst(raw: str | None) -> datetime:
    if raw:
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=gb.KST)
        return parsed.astimezone(gb.KST)
    return datetime.now(gb.KST)


def expected_window_end(now_kst: datetime, slot: str) -> datetime:
    hour, minute = (int(part) for part in slot.split(":"))
    candidate = datetime.combine(now_kst.date(), time(hour, minute), tzinfo=gb.KST)
    if now_kst + timedelta(minutes=5) < candidate:
        candidate -= timedelta(days=1)
    return candidate


def validate_latest_markdown(markdown_text: str, slot: str, expected_end: datetime) -> tuple[bool, str | None]:
    concept = gb.slot_concept(slot)
    expected_title = f"# {concept['title']}"
    expected_time = f"- 기준 시각: {expected_end.strftime('%Y-%m-%d %H:%M KST')}"

    if expected_title not in markdown_text:
        return False, f"title mismatch: expected {expected_title!r}"
    if expected_time not in markdown_text:
        return False, f"timestamp mismatch: expected {expected_time!r}"
    if "\n## " not in markdown_text:
        return False, "missing first section marker"
    return True, None


def extract_delivery_body(markdown_text: str) -> str:
    marker = "\n## "
    idx = markdown_text.find(marker)
    if idx == -1:
        raise ValueError("first ## section not found")
    return markdown_text[idx + 1 :].strip()


def run_pipeline() -> tuple[int, str, str]:
    env = os.environ.copy()
    env.setdefault("TELEGRAM_PROJECT_ROOT", str(PROJECT_ROOT))
    result = subprocess.run(
        ["python3", str(PIPELINE_PATH)],
        cwd=PROJECT_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    return result.returncode, result.stdout, result.stderr


def emit_silent(reason: str) -> int:
    print(reason, file=sys.stderr)
    print("[SILENT]")
    return 0


def main() -> int:
    args = parse_args()
    now_kst = resolve_now_kst(args.now_kst)

    if not args.skip_pipeline:
        returncode, stdout, stderr = run_pipeline()
        if stdout.strip():
            print(stdout.strip(), file=sys.stderr)
        if returncode != 0:
            detail = stderr.strip() or f"pipeline exited with status {returncode}"
            return emit_silent(f"pipeline failed for slot {args.slot}: {detail}")
        if stderr.strip():
            print(stderr.strip(), file=sys.stderr)

    if not LATEST_REPORT_PATH.exists():
        return emit_silent(f"latest report missing: {LATEST_REPORT_PATH}")

    markdown_text = LATEST_REPORT_PATH.read_text(encoding="utf-8")
    expected_end = expected_window_end(now_kst, args.slot)
    ok, reason = validate_latest_markdown(markdown_text, args.slot, expected_end)
    if not ok:
        return emit_silent(f"latest report validation failed for slot {args.slot}: {reason}")

    try:
        print(extract_delivery_body(markdown_text))
    except ValueError as exc:
        return emit_silent(f"latest report body extraction failed for slot {args.slot}: {exc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
