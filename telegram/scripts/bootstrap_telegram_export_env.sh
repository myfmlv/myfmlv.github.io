#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="${TELEGRAM_PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
VENV_DIR="$WORKSPACE/.venv-telegram-export"
REQ_FILE="$WORKSPACE/scripts/requirements-telegram-export.txt"

/usr/bin/python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$REQ_FILE"

echo "Telegram export venv is ready at $VENV_DIR"
