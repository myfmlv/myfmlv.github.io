from __future__ import annotations

import os
from pathlib import Path


PROJECT_MARKERS = (
    "scripts/run_telegram_export.sh",
    "data/analysis/telegram/main/worker/run_briefing_pipeline.py",
)
LEGACY_ROOT_ENV_VARS = (
    "TELEGRAM_PROJECT_ROOT",
    "OPENCLAW_WORKSPACE_ROOT",
)
LEGACY_PROJECT_ROOTS = (
    "/Users/Park/Documents/Telegram",
    "/Users/Park/Documents/01_Projects/Telegram",
    "/Users/Park/Documents/DBbot",
    "/Users/Park/Documents/01_Projects/Naver_Blog",
)


def _normalized(path: Path) -> Path:
    return path.expanduser()


def _looks_like_project_root(path: Path) -> bool:
    candidate = _normalized(path)
    return all((candidate / marker).exists() for marker in PROJECT_MARKERS)


def resolve_project_root(anchor: str | Path | None = None) -> Path:
    candidates: list[Path] = []

    for env_name in LEGACY_ROOT_ENV_VARS:
        env_value = os.environ.get(env_name)
        if env_value:
            candidates.append(Path(env_value))

    candidates.append(Path.cwd())

    if anchor is not None:
        anchor_path = _normalized(Path(anchor))
        if anchor_path.is_file():
            anchor_path = anchor_path.parent
        candidates.append(anchor_path)
        candidates.extend(anchor_path.parents)

    for candidate in candidates:
        if _looks_like_project_root(candidate):
            return _normalized(candidate)

    if anchor is not None:
        anchor_path = _normalized(Path(anchor))
        if anchor_path.is_file():
            return anchor_path.parent
        return anchor_path

    return _normalized(Path.cwd())


def remap_legacy_path(path: str | Path, project_root: str | Path | None = None) -> Path:
    root = resolve_project_root(project_root)
    candidate = _normalized(Path(path))

    if not candidate.is_absolute():
        return root / candidate

    for legacy_root in LEGACY_PROJECT_ROOTS:
        legacy_path = Path(legacy_root).expanduser()
        if candidate == legacy_path:
            return root
        try:
            relative = candidate.relative_to(legacy_path)
        except ValueError:
            continue
        return root / relative

    return candidate


def to_project_ref(path: str | Path, project_root: str | Path | None = None) -> str:
    root = resolve_project_root(project_root)
    candidate = remap_legacy_path(path, root)
    try:
        return str(candidate.relative_to(root)).replace("\\", "/")
    except ValueError:
        return str(candidate)
