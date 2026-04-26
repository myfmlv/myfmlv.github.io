#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path


ROOT = Path(
    os.environ.get("TELEGRAM_ANALYSIS_ROOT")
    or os.environ.get("OPENCLAW_TELEGRAM_MAIN_ROOT")
    or Path(__file__).resolve().parents[1]
).expanduser()
WORKER_DIR = ROOT / "worker"
SELECTION_PATH = WORKER_DIR / "channel_selection.json"
RANKINGS_PATH = WORKER_DIR / "channel_rankings.json"


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_channel_selection() -> dict:
    payload = load_json(SELECTION_PATH)
    if not payload:
        return {
            "mode": "allow_all",
            "min_quality_score": 0,
            "max_channels": 0,
            "manual_keep_chat_slugs": [],
            "manual_drop_chat_slugs": [],
        }
    payload.setdefault("mode", "allow_all")
    payload.setdefault("min_quality_score", 0)
    payload.setdefault("max_channels", 0)
    payload.setdefault("manual_keep_chat_slugs", [])
    payload.setdefault("manual_drop_chat_slugs", [])
    return payload


def load_channel_rankings() -> dict:
    return load_json(RANKINGS_PATH)


def selected_channel_slugs() -> set[str] | None:
    selection = load_channel_selection()
    rankings = load_channel_rankings()
    mode = str(selection.get("mode") or "allow_all").strip().lower()
    manual_keep = {
        str(item).strip()
        for item in (selection.get("manual_keep_chat_slugs") or [])
        if str(item).strip()
    }
    manual_drop = {
        str(item).strip()
        for item in (selection.get("manual_drop_chat_slugs") or [])
        if str(item).strip()
    }

    if mode == "allow_all" and not manual_drop:
        return None

    ranking_rows = list(rankings.get("channels") or [])
    ranking_rows.sort(
        key=lambda item: (
            float(item.get("quality_score") or 0),
            int(item.get("normalized_record_count") or 0),
            str(item.get("chat_title") or ""),
        ),
        reverse=True,
    )

    if mode == "manual_keep":
        selected = set(manual_keep)
    elif mode == "ranked":
        min_quality_score = float(selection.get("min_quality_score") or 0)
        max_channels = int(selection.get("max_channels") or 0)
        ranked_slugs = []
        for row in ranking_rows:
            slug = str(row.get("chat_slug") or "").strip()
            if not slug or slug in manual_drop:
                continue
            if float(row.get("quality_score") or 0) < min_quality_score:
                continue
            ranked_slugs.append(slug)
        if max_channels > 0:
            ranked_slugs = ranked_slugs[:max_channels]
        selected = set(ranked_slugs) | manual_keep
    else:
        all_ranked = {
            str(row.get("chat_slug") or "").strip()
            for row in ranking_rows
            if str(row.get("chat_slug") or "").strip()
        }
        selected = (all_ranked | manual_keep) if all_ranked else set(manual_keep)

    selected -= manual_drop
    return selected or None
