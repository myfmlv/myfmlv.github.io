#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))

from project_env import load_project_env
from project_paths import resolve_project_root

load_project_env(__file__)
WORKSPACE_ROOT = resolve_project_root(__file__)
ROOT = WORKSPACE_ROOT
EXPORT_VENV_PYTHON = ROOT / '.venv-telegram-export' / 'bin' / 'python'
SCRIPTS = [
    'data/analysis/telegram/main/worker/export_slot_snapshot.py',
    'data/analysis/telegram/main/worker/normalize_export.py',
    'data/analysis/telegram/main/worker/fetch_market_snapshot_nokey.py',
    'data/analysis/telegram/main/worker/fetch_treasury_nokey.py',
    'data/analysis/telegram/main/worker/generate_briefing.py',
]


def iter_pipeline_scripts() -> list[str]:
    if str(os.environ.get('RUN_BRIEFING_SKIP_SLOT_EXPORT', '')).strip() == '1':
        return [script for script in SCRIPTS if not script.endswith('export_slot_snapshot.py')]
    return list(SCRIPTS)


def python_for_script(script: str) -> str:
    if script.endswith('export_slot_snapshot.py') and EXPORT_VENV_PYTHON.exists():
        return str(EXPORT_VENV_PYTHON)
    return 'python3'


def main() -> int:
    for script in iter_pipeline_scripts():
        result = subprocess.run([python_for_script(script), script], cwd=ROOT, capture_output=True, text=True)
        print(f'## {script}')
        if result.stdout:
            print(result.stdout.strip())
        if result.returncode != 0:
            if result.stderr:
                print(result.stderr.strip())
            return result.returncode
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
