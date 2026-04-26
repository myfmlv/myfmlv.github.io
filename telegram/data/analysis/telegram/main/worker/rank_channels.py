#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(
    os.environ.get("TELEGRAM_ANALYSIS_ROOT")
    or os.environ.get("OPENCLAW_TELEGRAM_MAIN_ROOT")
    or Path(__file__).resolve().parents[1]
).expanduser()
NORMALIZED_DIR = ROOT / "normalized"
WORKER_DIR = ROOT / "worker"
CATALOG_PATH = NORMALIZED_DIR / "dialogs.normalized.catalog.json"
EVALUATIONS_PATH = WORKER_DIR / "channel_evaluations.json"
RANKINGS_JSON_PATH = WORKER_DIR / "channel_rankings.json"
RANKINGS_MD_PATH = WORKER_DIR / "channel_rankings.md"


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def status_weight(status: str | None) -> float:
    mapping = {
        "core": 18.0,
        "keep": 16.0,
        "watch": 8.0,
        "drop": -35.0,
    }
    return mapping.get((status or "").strip().lower(), 0.0)


def recommendation_for(score: float) -> str:
    if score >= 72:
        return "keep"
    if score >= 60:
        return "review"
    return "drop"


def compute_channel_rows() -> list[dict]:
    catalog = list(load_json(CATALOG_PATH).get("dialogs") or [])
    evaluations = load_json(EVALUATIONS_PATH).get("channels") or {}
    now_utc = datetime.now(timezone.utc)
    channels: list[dict] = []

    for item in catalog:
        normalized_file = ROOT / str(item.get("normalized_file") or "")
        if not normalized_file.exists():
            continue

        normalized_record_count = 0
        total_text_length = 0
        total_views = 0
        total_forwards = 0
        url_count = 0
        longest_text = 0
        latest_ts: datetime | None = None

        with normalized_file.open(encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                row = json.loads(line)
                normalized_record_count += 1
                text_length = int(row.get("text_length") or len(row.get("text") or ""))
                total_text_length += text_length
                total_views += int(row.get("views") or 0)
                total_forwards += int(row.get("forwards") or 0)
                url_count += 1 if row.get("has_url") else 0
                longest_text = max(longest_text, text_length)
                timestamp_utc = str(row.get("timestamp_utc") or "").strip()
                if timestamp_utc:
                    dt = datetime.fromisoformat(timestamp_utc)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if latest_ts is None or dt > latest_ts:
                        latest_ts = dt

        if normalized_record_count == 0:
            continue

        avg_text_length = total_text_length / normalized_record_count
        avg_views = total_views / normalized_record_count
        avg_forwards = total_forwards / normalized_record_count
        url_ratio = url_count / normalized_record_count
        days_since_latest = (
            (now_utc - latest_ts).total_seconds() / 86400 if latest_ts is not None else 999.0
        )

        eval_row = evaluations.get(item.get("chat_slug") or "", {})
        manual_status = str(eval_row.get("status") or "").strip().lower() or None

        volume_score = min(20.0, math.log10(normalized_record_count + 1) * 10.0)
        recency_score = clamp(18.0 - (days_since_latest * 2.5), 0.0, 18.0)
        engagement_score = min(20.0, math.log10(avg_views + 1.0) * 8.0)
        substance_score = min(14.0, avg_text_length / 25.0)
        forward_score = min(10.0, math.log10(avg_forwards + 1.0) * 6.0)
        quality_score = clamp(
            volume_score
            + recency_score
            + engagement_score
            + substance_score
            + forward_score
            + status_weight(manual_status),
            0.0,
            100.0,
        )

        channels.append(
            {
                "chat_id": item.get("chat_id"),
                "chat_slug": item.get("chat_slug"),
                "chat_title": item.get("chat_title"),
                "chat_username": item.get("chat_username"),
                "chat_kind": item.get("chat_kind"),
                "normalized_file": item.get("normalized_file"),
                "source_message_count": int(item.get("source_message_count") or 0),
                "normalized_record_count": normalized_record_count,
                "avg_text_length": round(avg_text_length, 1),
                "longest_text_length": longest_text,
                "avg_views": round(avg_views, 1),
                "avg_forwards": round(avg_forwards, 1),
                "url_ratio": round(url_ratio, 3),
                "latest_timestamp_utc": latest_ts.isoformat() if latest_ts else None,
                "days_since_latest": round(days_since_latest, 2),
                "manual_status": manual_status,
                "quality_score": round(quality_score, 1),
                "recommendation": recommendation_for(quality_score),
                "evaluation_notes": eval_row.get("notes") or [],
                "domain_strengths": eval_row.get("domain_strengths") or [],
            }
        )

    channels.sort(
        key=lambda row: (
            float(row.get("quality_score") or 0),
            int(row.get("normalized_record_count") or 0),
            str(row.get("chat_title") or ""),
        ),
        reverse=True,
    )
    return channels


def render_markdown(channels: list[dict]) -> str:
    lines = [
        "# Telegram Channel Rankings",
        "",
        f"- generated_at_utc: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        f"- channel_count: {len(channels)}",
        "",
        "| rank | score | recommendation | messages | avg_views | latest_utc | title |",
        "| --- | ---: | --- | ---: | ---: | --- | --- |",
    ]
    for idx, row in enumerate(channels, start=1):
        lines.append(
            "| {rank} | {score:.1f} | {rec} | {count} | {views:.1f} | {latest} | {title} |".format(
                rank=idx,
                score=float(row.get("quality_score") or 0),
                rec=row.get("recommendation") or "",
                count=int(row.get("normalized_record_count") or 0),
                views=float(row.get("avg_views") or 0),
                latest=row.get("latest_timestamp_utc") or "-",
                title=str(row.get("chat_title") or "").replace("|", "/"),
            )
        )
    return "\n".join(lines).strip() + "\n"


def main() -> int:
    channels = compute_channel_rows()
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "channel_count": len(channels),
        "channels": channels,
    }
    RANKINGS_JSON_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    RANKINGS_MD_PATH.write_text(render_markdown(channels), encoding="utf-8")
    print(str(RANKINGS_JSON_PATH))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
