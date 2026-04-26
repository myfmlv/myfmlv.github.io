#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))

from project_env import load_project_env
from project_paths import resolve_project_root

load_project_env(__file__)
PROJECT_ROOT = resolve_project_root(__file__)
ROOT = Path(
    os.environ.get("TELEGRAM_ANALYSIS_ROOT")
    or os.environ.get("OPENCLAW_TELEGRAM_MAIN_ROOT")
    or PROJECT_ROOT / "data" / "analysis" / "telegram" / "main"
).expanduser()
LATEST_REPORT_PATH = ROOT / "reports" / "latest.md"
DEFAULT_CHAT_ID = os.environ.get("TELEGRAM_BOT_CHAT_ID", "").strip()
DEFAULT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
MAX_TELEGRAM_MESSAGE_LEN = 3500


def build_body(markdown_path: Path, prefix: str | None) -> str:
    text = markdown_path.read_text(encoding="utf-8")
    body = text.strip()
    if "## " in text:
        body = "## " + text.split("## ", 1)[1].strip()
    if prefix:
        body = prefix.rstrip() + "\n" + body
    return body.strip()


def telegram_api(method: str, token: str, payload: dict[str, str]) -> dict:
    data = urlencode(payload).encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded; charset=utf-8"},
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def split_message(text: str, limit: int = MAX_TELEGRAM_MESSAGE_LEN) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    remaining = text.strip()
    while remaining:
        if len(remaining) <= limit:
            chunks.append(remaining)
            break
        split_at = remaining.rfind("\n\n", 0, limit)
        if split_at < limit // 2:
            split_at = remaining.rfind("\n", 0, limit)
        if split_at < limit // 2:
            split_at = remaining.rfind(" ", 0, limit)
        if split_at < limit // 2:
            split_at = limit
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    return [chunk for chunk in chunks if chunk]


def send_message(token: str, chat_id: str, text: str) -> list[dict]:
    payloads: list[dict] = []
    for chunk in split_message(text):
        payloads.append(
            telegram_api(
                "sendMessage",
                token,
                {
                    "chat_id": chat_id,
                    "text": chunk,
                    "disable_web_page_preview": "true",
                },
            )
        )
    return payloads


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send the latest Telegram briefing via Telegram Bot API.")
    parser.add_argument("--report", type=Path, default=LATEST_REPORT_PATH, help="Markdown report to send.")
    parser.add_argument("--chat-id", default=DEFAULT_CHAT_ID, help="Telegram chat id.")
    parser.add_argument("--token", default=DEFAULT_TOKEN, help="Telegram bot token.")
    parser.add_argument("--prefix", default="", help="Optional prefix line(s) to prepend before the briefing body.")
    parser.add_argument("--dry-run", action="store_true", help="Print the payload without posting.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.report.exists():
        raise FileNotFoundError(f"report not found: {args.report}")

    body = build_body(args.report, args.prefix or None)
    if not body:
        raise RuntimeError("briefing body is empty")

    if args.dry_run:
        print(body)
        return 0

    if not args.token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required")
    if not args.chat_id:
        raise RuntimeError("TELEGRAM_BOT_CHAT_ID is required")

    try:
        payloads = send_message(args.token, args.chat_id, body)
    except HTTPError as exc:
        raise RuntimeError(f"telegram send failed with HTTP {exc.code}") from exc
    except URLError as exc:
        raise RuntimeError(f"telegram send failed: {exc.reason}") from exc

    if any(payload.get("ok") is not True for payload in payloads):
        raise RuntimeError(f"delivery did not succeed: {payloads}")

    print(json.dumps(payloads, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
