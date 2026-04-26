#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="${TELEGRAM_PROJECT_ROOT:-${OPENCLAW_WORKSPACE_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}}"
ENV_FILE="$WORKSPACE/data/archives/telegram_archive.env"
VENV_DIR="$WORKSPACE/.venv-telegram-export"
PYTHON_BIN="$VENV_DIR/bin/python"
SCRIPT="$WORKSPACE/scripts/archive_telegram_chat.py"
DEFAULT_EXPORT_ROOT="$WORKSPACE/data/archives/export"
DEFAULT_SESSION_PATH="$WORKSPACE/data/archives/session/main_archive"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  echo "Copy telegram_archive.env.example to telegram_archive.env and fill in the values."
  exit 2
fi

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Missing $PYTHON_BIN"
  echo "Run scripts/bootstrap_telegram_export_env.sh first."
  exit 2
fi

set -a
source "$ENV_FILE"
set +a

EXPORT_ROOT="${TELEGRAM_EXPORT_ROOT:-$DEFAULT_EXPORT_ROOT}"
SESSION_PATH="${TELEGRAM_SESSION_PATH:-$DEFAULT_SESSION_PATH}"
ARCHIVE_MODE="${TELEGRAM_ARCHIVE_MODE:-single}"
RETENTION_DAYS="${TELEGRAM_RETENTION_DAYS:-7}"
RUNTIME_SESSION_PATH="$SESSION_PATH"
LOCK_DIR="$WORKSPACE/tmp/telegram-export.lock"
LOGIN_MODE=0

for arg in "$@"; do
  if [ "$arg" = "--login" ]; then
    LOGIN_MODE=1
    break
  fi
done

mkdir -p "$WORKSPACE/data/archives/session" "$EXPORT_ROOT" "$WORKSPACE/logs" "$WORKSPACE/tmp"

cleanup() {
  rm -rf "$LOCK_DIR"
  if [ "$LOGIN_MODE" -ne 1 ] && [ "$RUNTIME_SESSION_PATH" != "$SESSION_PATH" ]; then
    rm -f "${RUNTIME_SESSION_PATH}.session" "${RUNTIME_SESSION_PATH}.session-journal"
  fi
}

if [ -d "$LOCK_DIR" ]; then
  ACTIVE_PID=""
  if [ -f "$LOCK_DIR/pid" ]; then
    ACTIVE_PID="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  fi

  if [ -n "$ACTIVE_PID" ] && kill -0 "$ACTIVE_PID" 2>/dev/null; then
    echo "Another Telegram export run is already active; skipping."
    exit 0
  fi

  rm -rf "$LOCK_DIR"
fi

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another Telegram export run is already active; skipping."
  exit 0
fi

echo "$$" > "$LOCK_DIR/pid"

trap cleanup EXIT INT TERM

if [ -z "${TELEGRAM_API_ID:-}" ] || [ -z "${TELEGRAM_API_HASH:-}" ]; then
  echo "TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in $ENV_FILE"
  exit 2
fi

if [ "$LOGIN_MODE" -ne 1 ] && [ "$ARCHIVE_MODE" != "all" ] && [ -z "${TELEGRAM_CHAT:-}" ]; then
  echo "TELEGRAM_CHAT must be set in $ENV_FILE for export runs"
  exit 2
fi

EXTRA_ARGS=()

if [ -n "${TELEGRAM_PHONE:-}" ]; then
  EXTRA_ARGS+=(--phone "$TELEGRAM_PHONE")
fi

if [ "${TELEGRAM_DOWNLOAD_MEDIA:-0}" = "1" ]; then
  EXTRA_ARGS+=(--download-media)
fi

if [ "$ARCHIVE_MODE" = "all" ]; then
  EXTRA_ARGS+=(--all-dialogs)
fi

if [ "$LOGIN_MODE" -ne 1 ]; then
  if [ ! -f "${SESSION_PATH}.session" ]; then
    echo "Missing ${SESSION_PATH}.session"
    echo "Run scripts/run_telegram_export.sh --login first."
    exit 2
  fi

  RUNTIME_DIR="$WORKSPACE/tmp/telegram-export-session"
  mkdir -p "$RUNTIME_DIR"
  RUNTIME_SESSION_PATH="$RUNTIME_DIR/test_archive_run_$$"
  cp "${SESSION_PATH}.session" "${RUNTIME_SESSION_PATH}.session"
  if [ -f "${SESSION_PATH}.session-journal" ]; then
    cp "${SESSION_PATH}.session-journal" "${RUNTIME_SESSION_PATH}.session-journal"
  fi
fi

"$PYTHON_BIN" "$SCRIPT" \
  --root "$EXPORT_ROOT" \
  --session-path "$RUNTIME_SESSION_PATH" \
  --chat "${TELEGRAM_CHAT:-all}" \
  --api-id "$TELEGRAM_API_ID" \
  --api-hash "$TELEGRAM_API_HASH" \
  --retention-days "$RETENTION_DAYS" \
  "${EXTRA_ARGS[@]}" \
  "$@"
