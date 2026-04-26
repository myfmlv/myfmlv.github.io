#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 4:
        print('usage: llm_briefing_bridge.py <prompt-file> <model> <reasoning>', file=sys.stderr)
        return 2
    prompt_file = Path(sys.argv[1])
    model = sys.argv[2]
    reasoning = sys.argv[3]
    prompt = prompt_file.read_text(encoding='utf-8')

    cmd = [
        'codex',
        'exec',
        '--skip-git-repo-check',
        '--dangerously-bypass-approvals-and-sandbox',
        '--ephemeral',
        '-C',
        str(prompt_file.parent),
        '-m',
        model,
        '-c',
        f'model_reasoning_effort="{reasoning}"',
        prompt,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        return result.returncode
    print(result.stdout.strip())
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
