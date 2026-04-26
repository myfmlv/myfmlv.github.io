#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from project_env import load_project_env
from project_paths import resolve_project_root

load_project_env(__file__)
PROJECT_ROOT = resolve_project_root(__file__)
ANALYSIS_ROOT = PROJECT_ROOT / "data" / "analysis" / "telegram" / "main"
WORKER_DIR = ANALYSIS_ROOT / "worker"
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

import generate_briefing as gb  # noqa: E402


def run(args: list[str], *, capture_output: bool = False) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault("TELEGRAM_PROJECT_ROOT", str(PROJECT_ROOT))
    env.setdefault("TELEGRAM_ANALYSIS_ROOT", str(ANALYSIS_ROOT))
    result = subprocess.run(
        args,
        cwd=PROJECT_ROOT,
        env=env,
        text=True,
        capture_output=capture_output,
    )
    if result.returncode != 0:
        if capture_output:
            if result.stdout.strip():
                print(result.stdout.strip(), file=sys.stderr)
            if result.stderr.strip():
                print(result.stderr.strip(), file=sys.stderr)
        raise SystemExit(result.returncode)
    return result


def resolve_now_kst(raw: str | None) -> datetime:
    if raw:
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=gb.KST)
        return parsed.astimezone(gb.KST)
    return datetime.now(gb.KST)


def resolve_briefing_slot(slot_override: str | None, now_kst: datetime) -> str:
    if slot_override:
        return slot_override
    state = gb.load_state()
    return gb.resolve_briefing_window(now_kst, state.get("schedule_kst") or []).slot


def render_briefing_body(slot: str, now_kst: datetime) -> str | None:
    command = [
        "python3",
        str(WORKER_DIR / "render_cron_briefing.py"),
        "--slot",
        slot,
        "--now-kst",
        now_kst.isoformat(),
    ]
    result = run(command, capture_output=True)
    if result.stderr.strip():
        print(result.stderr.strip(), file=sys.stderr)

    body = result.stdout.strip()
    if body == "[SILENT]":
        return None
    if not body:
        raise RuntimeError(f"rendered briefing body is empty for slot {slot}")
    return body


def write_temp_report(body: str, slot: str) -> Path:
    tmp_dir = PROJECT_ROOT / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        suffix=".md",
        prefix=f"telegram_delivery_{slot.replace(':', '')}_",
        dir=tmp_dir,
        delete=False,
    ) as handle:
        handle.write(body.rstrip() + "\n")
        return Path(handle.name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a Telegram briefing/digest pipeline and deliver the output.")
    parser.add_argument(
        "mode",
        choices=["briefing", "weekly", "monthly", "latest"],
        help="What to deliver.",
    )
    parser.add_argument("--prefix", default="", help="Optional prefix for the sent message.")
    parser.add_argument("--dry-run", action="store_true", help="Render the final payload without posting.")
    parser.add_argument("--slot", help="Expected KST slot for briefing delivery. Auto-detected when omitted.")
    parser.add_argument("--now-kst", help="Override current KST time in ISO format for testing.")
    args = parser.parse_args()

    report_path: Path
    temp_report_path: Path | None = None
    if args.mode == "briefing":
        now_kst = resolve_now_kst(args.now_kst)
        slot = resolve_briefing_slot(args.slot, now_kst)
        body = render_briefing_body(slot, now_kst)
        if body is None:
            print(f"briefing delivery skipped for slot {slot}", file=sys.stderr)
            return 0
        temp_report_path = write_temp_report(body, slot)
        report_path = temp_report_path
    elif args.mode == "weekly":
        run(["python3", str(WORKER_DIR / "generate_briefing_digest.py"), "weekly"])
        report_path = ANALYSIS_ROOT / "reports" / "digests" / "latest_weekly.md"
    elif args.mode == "monthly":
        run(["python3", str(WORKER_DIR / "generate_briefing_digest.py"), "monthly"])
        report_path = ANALYSIS_ROOT / "reports" / "digests" / "latest_monthly.md"
    else:
        report_path = ANALYSIS_ROOT / "reports" / "latest.md"

    command = ["python3", str(WORKER_DIR / "send_latest_briefing.py"), "--report", str(report_path)]
    if args.prefix:
        command.extend(["--prefix", args.prefix])
    if args.dry_run:
        command.append("--dry-run")
    try:
        run(command)
        return 0
    finally:
        if temp_report_path is not None:
            temp_report_path.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
