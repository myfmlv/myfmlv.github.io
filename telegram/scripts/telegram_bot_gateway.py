#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from project_env import load_project_env
from project_paths import resolve_project_root

load_project_env(__file__)
PROJECT_ROOT = resolve_project_root(__file__)
ANALYSIS_ROOT = PROJECT_ROOT / "data" / "analysis" / "telegram" / "main"
LATEST_REPORT = ANALYSIS_ROOT / "reports" / "latest.md"
WEEKLY_DIGEST = ANALYSIS_ROOT / "reports" / "digests" / "latest_weekly.md"
MONTHLY_DIGEST = ANALYSIS_ROOT / "reports" / "digests" / "latest_monthly.md"
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
ALLOWED_CHAT_ID = os.environ.get("TELEGRAM_BOT_CHAT_ID", "").strip()
POLL_TIMEOUT_SECONDS = int(os.environ.get("TELEGRAM_BOT_POLL_TIMEOUT_SECONDS", "30"))
SLEEP_SECONDS = float(os.environ.get("TELEGRAM_BOT_LOOP_SLEEP_SECONDS", "1"))
MAX_TELEGRAM_MESSAGE_LEN = 3500


def telegram_api(method: str, payload: dict[str, str | int]) -> dict:
    if not TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required")
    data = urlencode(payload).encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{TOKEN}/{method}",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded; charset=utf-8"},
    )
    with urlopen(request, timeout=POLL_TIMEOUT_SECONDS + 10) as response:
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


def send_message(chat_id: str, text: str) -> None:
    for chunk in split_message(text):
        telegram_api(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": chunk,
                "disable_web_page_preview": "true",
            },
        )


def latest_briefing_body(path: Path) -> str:
    text = path.read_text(encoding="utf-8").strip()
    if "## " in text:
        return "## " + text.split("## ", 1)[1].strip()
    return text


def run_command(args: list[str]) -> str:
    env = os.environ.copy()
    env.setdefault("TELEGRAM_PROJECT_ROOT", str(PROJECT_ROOT))
    env.setdefault("TELEGRAM_ANALYSIS_ROOT", str(ANALYSIS_ROOT))
    result = subprocess.run(
        args,
        cwd=PROJECT_ROOT,
        env=env,
        text=True,
        capture_output=True,
    )
    output = (result.stdout or result.stderr).strip()
    if result.returncode != 0:
        raise RuntimeError(output or f"command failed: {' '.join(args)}")
    return output


def command_help() -> str:
    return (
        "사용 가능한 명령어:\n"
        "/briefing - export 정규화부터 최신 브리핑 생성 후 전송\n"
        "/digest weekly - 최신 주간 다이제스트 생성 후 전송\n"
        "/digest monthly - 최신 월간 다이제스트 생성 후 전송\n"
        "/export - 텔레그램 아카이브만 새로 내려받기\n"
        "/latest - 저장된 최신 브리핑만 다시 전송\n"
        "/status - 주요 파일 경로와 존재 여부 확인\n"
        "/help - 도움말"
    )


def command_status() -> str:
    rows = [
        f"project_root={PROJECT_ROOT}",
        f"analysis_root={ANALYSIS_ROOT}",
        f"latest_report={'yes' if LATEST_REPORT.exists() else 'no'}",
        f"weekly_digest={'yes' if WEEKLY_DIGEST.exists() else 'no'}",
        f"monthly_digest={'yes' if MONTHLY_DIGEST.exists() else 'no'}",
    ]
    return "\n".join(rows)


def handle_text(text: str) -> str:
    command = text.strip()
    lowered = command.lower()

    if lowered in {"/help", "help", "도움말"}:
        return command_help()
    if lowered in {"/status", "status"}:
        return command_status()
    if lowered in {"/latest", "latest", "브리핑"}:
        if not LATEST_REPORT.exists():
            return "아직 latest briefing 파일이 없습니다."
        return latest_briefing_body(LATEST_REPORT)
    if lowered in {"/export", "export"}:
        output = run_command(["zsh", "scripts/run_telegram_export.sh"])
        return output or "export completed"
    if lowered in {"/briefing", "briefing", "요약", "브리핑 생성"}:
        run_command(["python3", "data/analysis/telegram/main/worker/run_briefing_pipeline.py"])
        return latest_briefing_body(LATEST_REPORT)
    if lowered in {"/digest weekly", "digest weekly", "주간"}:
        run_command(["python3", "data/analysis/telegram/main/worker/generate_briefing_digest.py", "weekly"])
        return WEEKLY_DIGEST.read_text(encoding="utf-8").strip()
    if lowered in {"/digest monthly", "digest monthly", "월간"}:
        run_command(["python3", "data/analysis/telegram/main/worker/generate_briefing_digest.py", "monthly"])
        return MONTHLY_DIGEST.read_text(encoding="utf-8").strip()
    return "알 수 없는 명령입니다. /help 를 보내면 명령 목록을 볼 수 있습니다."


def extract_chat_and_text(update: dict) -> tuple[str | None, str | None]:
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    text = message.get("text")
    if chat_id is None or text is None:
        return None, None
    return str(chat_id), str(text)


def poll_updates(offset: int | None) -> list[dict]:
    payload: dict[str, str | int] = {
        "timeout": POLL_TIMEOUT_SECONDS,
        "allowed_updates": json.dumps(["message", "edited_message"]),
    }
    if offset is not None:
        payload["offset"] = offset
    result = telegram_api("getUpdates", payload)
    if result.get("ok") is not True:
        raise RuntimeError(f"getUpdates failed: {result}")
    return list(result.get("result") or [])


def main() -> int:
    parser = argparse.ArgumentParser(description="Minimal Telegram bot gateway for the local briefing pipeline.")
    parser.add_argument("--once", action="store_true", help="Poll once and exit.")
    args = parser.parse_args()

    if not TOKEN:
        print("TELEGRAM_BOT_TOKEN is required", file=sys.stderr)
        return 2

    offset: int | None = None
    while True:
        try:
            updates = poll_updates(offset)
            for update in updates:
                offset = int(update["update_id"]) + 1
                chat_id, text = extract_chat_and_text(update)
                if not chat_id or not text:
                    continue
                if ALLOWED_CHAT_ID and chat_id != ALLOWED_CHAT_ID:
                    continue
                try:
                    send_message(chat_id, handle_text(text))
                except Exception as exc:  # noqa: BLE001
                    send_message(chat_id, f"실행 실패: {exc}")
        except (HTTPError, URLError, RuntimeError) as exc:
            print(f"telegram gateway error: {exc}", file=sys.stderr)
            time.sleep(max(SLEEP_SECONDS, 3))
        if args.once:
            return 0
        time.sleep(SLEEP_SECONDS)


if __name__ == "__main__":
    raise SystemExit(main())
