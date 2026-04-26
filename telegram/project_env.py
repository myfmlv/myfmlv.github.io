from __future__ import annotations

import os
import shlex
from pathlib import Path

from project_paths import resolve_project_root


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        try:
            parsed = shlex.split(value, comments=False, posix=True)
        except ValueError:
            parsed = [value]
        values[key] = parsed[0] if len(parsed) == 1 else " ".join(parsed)
    return values


def load_project_env(anchor: str | Path | None = None) -> Path:
    project_root = resolve_project_root(anchor)
    env_paths = (
        project_root / ".env",
        project_root / ".env.nim",
        project_root / "data" / "archives" / "telegram_archive.env",
        project_root / "data" / "archives" / "telegram" / "main" / "telegram_archive.env",
    )
    for env_path in env_paths:
        for key, value in _parse_env_file(env_path).items():
            os.environ.setdefault(key, value)
    return project_root
