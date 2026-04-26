#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))

from briefing_llm import resolve_backend_config, run_structured_json
from project_env import load_project_env

load_project_env(__file__)
ROOT = Path(
    os.environ.get("TELEGRAM_ANALYSIS_ROOT")
    or os.environ.get("OPENCLAW_TELEGRAM_MAIN_ROOT")
    or Path(__file__).resolve().parents[1]
).expanduser()
BRIEFINGS_DIR = ROOT / "reports" / "briefings"
BUNDLES_DIR = ROOT / "reports" / "bundles"
DIGESTS_DIR = ROOT / "reports" / "digests"
KST = timezone(timedelta(hours=9))

USE_LLM_DIGEST = os.environ.get("TELEGRAM_DIGEST_USE_LLM", "0") == "1"
DIGEST_ANALYSIS_CONFIG = resolve_backend_config(
    backend_env="TELEGRAM_DIGEST_LLM_BACKEND",
    model_env="TELEGRAM_DIGEST_ANALYSIS_MODEL",
    reasoning_env="TELEGRAM_DIGEST_ANALYSIS_REASONING_EFFORT",
    default_model="gpt-5.4-mini",
)
DIGEST_SYNTHESIS_CONFIG = resolve_backend_config(
    backend_env="TELEGRAM_DIGEST_LLM_BACKEND",
    model_env="TELEGRAM_DIGEST_SYNTHESIS_MODEL",
    reasoning_env="TELEGRAM_DIGEST_SYNTHESIS_REASONING_EFFORT",
    default_model="gpt-5.4",
)
DIGEST_ANALYSIS_MODEL = DIGEST_ANALYSIS_CONFIG.model
DIGEST_SYNTHESIS_MODEL = DIGEST_SYNTHESIS_CONFIG.model
DIGEST_ANALYSIS_REASONING_EFFORT = DIGEST_ANALYSIS_CONFIG.reasoning_effort
DIGEST_SYNTHESIS_REASONING_EFFORT = DIGEST_SYNTHESIS_CONFIG.reasoning_effort
DIGEST_CHUNK_MAX_CHARS = int(os.environ.get("TELEGRAM_DIGEST_CHUNK_MAX_CHARS", "16000"))
MAX_PERIOD_SUMMARY_ITEMS = int(os.environ.get("TELEGRAM_DIGEST_SUMMARY_ITEMS", "5"))
MAX_THEME_ITEMS = int(os.environ.get("TELEGRAM_DIGEST_THEME_ITEMS", "6"))
MAX_HOUSE_VIEW_ITEMS = int(os.environ.get("TELEGRAM_DIGEST_HOUSE_VIEW_ITEMS", "4"))
MAX_TIMELINE_ITEMS = int(os.environ.get("TELEGRAM_DIGEST_TIMELINE_ITEMS", "10"))
MAX_WATCH_ITEMS = int(os.environ.get("TELEGRAM_DIGEST_WATCH_ITEMS", "5"))

BRIEFING_FILE_RE = re.compile(r"(?P<stamp>\d{4}-\d{2}-\d{2}_\d{4})_kst\.md$")
CHANNEL_HEADER_RE = re.compile(r"^## Channel:\s*(?P<name>.+)$")
COUNT_RE = re.compile(r"^(?P<label>channel_count|message_count):\s*(?P<value>\d+)$")


@dataclass
class Briefing:
    generated_at: datetime
    path: Path
    bundle_path: Path | None
    capture_range: str
    summary: list[str]
    themes: list[str]
    house_view: list[str]
    watch: list[str]
    bundle_channel_count: int
    bundle_message_count: int
    bundle_top_channels: list[str]
    bundle_channel_context: list[str]


def now_kst() -> datetime:
    return datetime.now(KST)


def generated_at_from_path(path: Path) -> datetime | None:
    match = BRIEFING_FILE_RE.search(path.name)
    if not match:
        return None
    naive = datetime.strptime(match.group("stamp"), "%Y-%m-%d_%H%M")
    return naive.replace(tzinfo=KST)


def norm_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def compact_text(text: str, max_len: int = 220) -> str:
    text = norm_text(re.sub(r"https?://\S+", "", text))
    if len(text) <= max_len:
        return text
    return text[:max_len].rsplit(" ", 1)[0].rstrip(" ,.;:") + "..."


def markdown_sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current = "meta"
    sections[current] = []
    for line in text.splitlines():
        if line.startswith("## "):
            current = line[3:].strip()
            sections[current] = []
            continue
        sections.setdefault(current, []).append(line)
    return sections


def bullets(lines: list[str], limit: int = 100) -> list[str]:
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith("- "):
            continue
        out.append(stripped[2:].strip())
        if len(out) >= limit:
            break
    return out


def keep_digest_line(text: str) -> bool:
    text = norm_text(text)
    if not text:
        return False
    denied_prefixes = (
        "대상 기간에 저장된 정기 브리핑 재료가 없다",
        "아직 누적 판단을 만들 만큼 저장된 정기 브리핑이 없다",
        "저장된 브리핑 없음",
    )
    return not any(text.startswith(prefix) for prefix in denied_prefixes)


def digest_bullets(lines: list[str], limit: int = 100) -> list[str]:
    return [line for line in bullets(lines, limit=limit) if keep_digest_line(line)]


def bundle_path_for_briefing(path: Path) -> Path | None:
    match = BRIEFING_FILE_RE.search(path.name)
    if not match:
        return None
    bundle_path = BUNDLES_DIR / f"{match.group('stamp')}_kst.bundle.md"
    return bundle_path if bundle_path.exists() else None


def read_bundle_support(path: Path | None) -> tuple[int, int, list[str], list[str]]:
    if path is None or not path.exists():
        return 0, 0, [], []

    channel_count = 0
    message_count = 0
    current_channel = ""
    current_message_count = 0
    current_snippets: list[str] = []
    channel_rows: list[tuple[int, str, list[str]]] = []

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            continue

        header_match = CHANNEL_HEADER_RE.match(line)
        if header_match:
            if current_channel:
                channel_rows.append((current_message_count, current_channel, current_snippets[:]))
            current_channel = header_match.group("name").strip()
            current_message_count = 0
            current_snippets = []
            continue

        if line.startswith("- "):
            payload = line[2:].strip()
            count_match = COUNT_RE.match(payload)
            if not count_match:
                continue
            label = count_match.group("label")
            value = int(count_match.group("value"))
            if label == "channel_count":
                channel_count = value
            elif label == "message_count":
                if current_channel:
                    current_message_count = value
                else:
                    message_count = value
            continue

        if not current_channel or line.startswith("#") or line.startswith("["):
            continue

        snippet = compact_text(line, 180)
        if snippet and snippet not in current_snippets:
            current_snippets.append(snippet)

    if current_channel:
        channel_rows.append((current_message_count, current_channel, current_snippets[:]))

    channel_rows.sort(key=lambda item: (item[0], item[1]), reverse=True)
    top_channels = [name for _, name, _ in channel_rows[:3]]
    bundle_context = [
        f"{name}: {snippets[0]}"
        for _, name, snippets in channel_rows[:2]
        if snippets
    ]
    return channel_count, message_count, top_channels, bundle_context


def read_briefing(path: Path) -> Briefing | None:
    generated_at = generated_at_from_path(path)
    if generated_at is None:
        return None

    text = path.read_text(encoding="utf-8")
    sections = markdown_sections(text)
    meta_bullets = bullets(sections.get("meta", []), limit=10)
    capture_range = ""
    for item in meta_bullets:
        if item.startswith("집계 구간:"):
            capture_range = item.removeprefix("집계 구간:").strip()
            break

    bundle_path = bundle_path_for_briefing(path)
    bundle_channel_count, bundle_message_count, bundle_top_channels, bundle_channel_context = read_bundle_support(bundle_path)

    return Briefing(
        generated_at=generated_at,
        path=path,
        bundle_path=bundle_path,
        capture_range=capture_range,
        summary=digest_bullets(sections.get("Summary", []), limit=4),
        themes=digest_bullets(sections.get("Theme & Issue", []), limit=6),
        house_view=digest_bullets(sections.get("House View", []), limit=4),
        watch=digest_bullets(sections.get("Watch", []), limit=4),
        bundle_channel_count=bundle_channel_count,
        bundle_message_count=bundle_message_count,
        bundle_top_channels=bundle_top_channels,
        bundle_channel_context=bundle_channel_context,
    )


def period_for_mode(mode: str, now: datetime) -> tuple[datetime, datetime, str]:
    if mode == "weekly":
        start_day = now.date() - timedelta(days=now.weekday())
        end_day = start_day + timedelta(days=7)
        label = f"{start_day.isoformat()} ~ {(end_day - timedelta(days=1)).isoformat()}"
    elif mode == "monthly":
        start_day = now.date().replace(day=1)
        if start_day.month == 12:
            end_day = date(start_day.year + 1, 1, 1)
        else:
            end_day = date(start_day.year, start_day.month + 1, 1)
        label = f"{start_day.year:04d}-{start_day.month:02d}"
    else:
        raise ValueError("mode must be weekly or monthly")

    start = datetime.combine(start_day, time(0, 0), tzinfo=KST)
    end = datetime.combine(end_day, time(0, 0), tzinfo=KST)
    return start, end, label


def list_briefings(start: datetime, end: datetime, now: datetime) -> list[Briefing]:
    items: list[Briefing] = []
    for path in sorted(BRIEFINGS_DIR.glob("*_kst.md")):
        generated_at = generated_at_from_path(path)
        if generated_at is None or generated_at < start or generated_at >= end or generated_at > now:
            continue
        briefing = read_briefing(path)
        if briefing is not None:
            items.append(briefing)
    return items


def digest_chunk_schema() -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "period_takeaways": {"type": "array", "items": {"type": "string"}},
            "market_focus": {"type": "array", "items": {"type": "string"}},
            "briefing_analyses": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "slot": {"type": "string"},
                        "dominant_narrative": {"type": "string"},
                        "market_focus": {"type": "string"},
                        "investment_translation": {"type": "string"},
                        "follow_through": {"type": "string"},
                    },
                    "required": [
                        "slot",
                        "dominant_narrative",
                        "market_focus",
                        "investment_translation",
                        "follow_through",
                    ],
                },
            },
        },
        "required": ["period_takeaways", "market_focus", "briefing_analyses"],
    }


def digest_final_schema() -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "summary": {"type": "array", "items": {"type": "string"}},
            "theme_issue": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "theme": {"type": "string"},
                        "period_takeaway": {"type": "string"},
                        "market_focus": {"type": "string"},
                        "investment_translation": {"type": "string"},
                        "supporting_slots": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": [
                        "theme",
                        "period_takeaway",
                        "market_focus",
                        "investment_translation",
                        "supporting_slots",
                    ],
                },
            },
            "house_view": {"type": "array", "items": {"type": "string"}},
            "timeline": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "slot": {"type": "string"},
                        "headline": {"type": "string"},
                    },
                    "required": ["slot", "headline"],
                },
            },
            "watch": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "theme_issue", "house_view", "timeline", "watch"],
    }


def render_briefing_packet(briefing: Briefing) -> str:
    slot_label = briefing.generated_at.strftime("%Y-%m-%d %H:%M KST")
    lines = [f"### Briefing Slot: {slot_label}"]
    if briefing.capture_range:
        lines.append(f"- capture_range: {briefing.capture_range}")
    lines.append(f"- source_file: {briefing.path.name}")
    if briefing.summary:
        lines.append("- summary:")
        lines.extend(f"  - {compact_text(item, 180)}" for item in briefing.summary[:3])
    if briefing.themes:
        lines.append("- theme_issue:")
        lines.extend(f"  - {compact_text(item, 180)}" for item in briefing.themes[:4])
    if briefing.house_view:
        lines.append("- house_view:")
        lines.extend(f"  - {compact_text(item, 180)}" for item in briefing.house_view[:3])
    if briefing.watch:
        lines.append("- watch:")
        lines.extend(f"  - {compact_text(item, 160)}" for item in briefing.watch[:3])
    if briefing.bundle_path is not None:
        bundle_parts: list[str] = []
        if briefing.bundle_channel_count:
            bundle_parts.append(f"{briefing.bundle_channel_count} channels")
        if briefing.bundle_message_count:
            bundle_parts.append(f"{briefing.bundle_message_count} messages")
        if briefing.bundle_top_channels:
            bundle_parts.append("top channels: " + ", ".join(briefing.bundle_top_channels))
        if bundle_parts:
            lines.append("- bundle_support: " + " | ".join(bundle_parts))
        if briefing.bundle_channel_context:
            lines.append("- bundle_channel_context:")
            lines.extend(f"  - {compact_text(item, 200)}" for item in briefing.bundle_channel_context[:2])
    return "\n".join(lines)


def chunk_texts(items: list[str], max_chars: int) -> list[list[str]]:
    chunks: list[list[str]] = []
    current: list[str] = []
    current_size = 0
    for item in items:
        item_size = len(item) + 2
        if current and current_size + item_size > max_chars:
            chunks.append(current)
            current = []
            current_size = 0
        current.append(item)
        current_size += item_size
    if current:
        chunks.append(current)
    return chunks


def missing_slots(slots: list[str], payload: dict) -> list[str]:
    expected = {slot.strip() for slot in slots}
    actual = {str(item.get("slot") or "").strip() for item in payload.get("briefing_analyses", [])}
    return sorted(expected - actual)


def build_chunk_prompt(mode: str, period_label: str, chunk_label: str, packets: list[str]) -> str:
    digest_label = "weekly" if mode == "weekly" else "monthly"
    packet_text = "\n\n".join(packets)
    return (
        "You are analyzing archived Telegram market briefings for a higher-level digest.\n"
        "The daily briefings already reflect GPT analysis of raw channel bundles.\n"
        "Treat bundle support as secondary context that can confirm breadth, channel mix, or representative raw color.\n"
        "Do not revert to keyword counting or raw-export dumping.\n"
        "For each briefing slot, explain:\n"
        "1. the dominant narrative,\n"
        "2. what the market was actually watching,\n"
        "3. how an investor should translate it,\n"
        "4. what follow-through matters next.\n"
        "Write concise Korean grounded only in the supplied packets.\n"
        f"Digest mode: {digest_label}.\n"
        f"Target period: {period_label}.\n"
        f"Chunk: {chunk_label}.\n\n"
        "<briefing_packets>\n"
        f"{packet_text}\n"
        "</briefing_packets>\n"
    )


def build_final_prompt(mode: str, period_label: str, now: datetime, briefings: list[Briefing], chunk_results: list[dict]) -> str:
    digest_label = "주간" if mode == "weekly" else "월간"
    analyses_payload = json.dumps(chunk_results, ensure_ascii=False, indent=2)
    bundle_supported = sum(1 for briefing in briefings if briefing.bundle_path is not None)
    return (
        "You are producing the final Telegram market digest from archived briefing analyses.\n"
        "This is a second-order synthesis: the source material is daily final briefings, not raw Telegram exports.\n"
        "Use the chunk analyses to answer these questions:\n"
        "- Over the period, what were channels broadly talking about?\n"
        "- What was the market actually watching or pricing?\n"
        "- What is the investor translation at the period level?\n"
        "- Which briefing slots best mark the flow of the period?\n"
        "Write concrete Korean, avoid repeated template sentences, and do not leak process language.\n"
        f"Digest type: {digest_label}.\n"
        f"Generated at: {now.strftime('%Y-%m-%d %H:%M KST')}.\n"
        f"Target period: {period_label}.\n"
        f"Briefing count: {len(briefings)}.\n"
        f"Bundle-supported briefing count: {bundle_supported}.\n"
        f"Return at most {MAX_THEME_ITEMS} theme_issue items and {MAX_TIMELINE_ITEMS} timeline entries.\n\n"
        "<chunk_analyses>\n"
        f"{analyses_payload}\n"
        "</chunk_analyses>\n"
    )


def unique_strings(items: list[str], limit: int | None = None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in items:
        cleaned = norm_text(item)
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        out.append(cleaned)
        if limit is not None and len(out) >= limit:
            break
    return out


def fallback_briefing_analysis(briefing: Briefing) -> dict:
    dominant_narrative = (
        briefing.summary[0]
        if briefing.summary
        else (briefing.themes[0] if briefing.themes else "기간 중 해당 슬롯의 핵심 내러티브 재확인 필요")
    )
    market_focus = (
        briefing.themes[0]
        if briefing.themes
        else (briefing.house_view[0] if briefing.house_view else dominant_narrative)
    )
    investment_translation = (
        briefing.house_view[0]
        if briefing.house_view
        else (briefing.watch[0] if briefing.watch else dominant_narrative)
    )
    follow_through = briefing.watch[0] if briefing.watch else "다음 정기 브리핑에서 후속 확인"
    return {
        "slot": briefing.generated_at.strftime("%Y-%m-%d %H:%M KST"),
        "dominant_narrative": compact_text(dominant_narrative, 180),
        "market_focus": compact_text(market_focus, 180),
        "investment_translation": compact_text(investment_translation, 180),
        "follow_through": compact_text(follow_through, 160),
    }


def complete_chunk_coverage(
    mode: str,
    period_label: str,
    chunk_label: str,
    briefings_by_slot: dict[str, Briefing],
    packet_by_slot: dict[str, str],
    payload: dict,
) -> dict:
    missing = missing_slots(list(packet_by_slot), payload)
    if not missing:
        return payload

    supplemental_packets = [packet_by_slot[slot] for slot in missing]
    supplemental_payload = run_structured_json(
        build_chunk_prompt(mode, period_label, f"{chunk_label} supplemental", supplemental_packets),
        digest_chunk_schema(),
        DIGEST_ANALYSIS_CONFIG,
    )

    merged_analyses: dict[str, dict] = {
        str(item.get("slot") or "").strip(): item for item in payload.get("briefing_analyses", []) if str(item.get("slot") or "").strip()
    }
    for item in supplemental_payload.get("briefing_analyses", []):
        slot = str(item.get("slot") or "").strip()
        if slot:
            merged_analyses[slot] = item

    still_missing = [slot for slot in missing if slot not in merged_analyses]
    for slot in still_missing:
        merged_analyses[slot] = fallback_briefing_analysis(briefings_by_slot[slot])

    return {
        "period_takeaways": unique_strings(
            list(payload.get("period_takeaways", [])) + list(supplemental_payload.get("period_takeaways", [])),
            limit=8,
        ),
        "market_focus": unique_strings(
            list(payload.get("market_focus", [])) + list(supplemental_payload.get("market_focus", [])),
            limit=8,
        ),
        "briefing_analyses": [merged_analyses[slot] for slot in packet_by_slot if slot in merged_analyses],
    }


def clean_report_text(text: str, max_len: int) -> str:
    text = norm_text(re.sub(r"https?://\S+", "", text))
    text = text.replace("...", "")
    if len(text) <= max_len:
        return text
    return text[:max_len].rsplit(" ", 1)[0].rstrip(" ,.;:") + "."


def render_supporting_slots(slots: list[str]) -> str:
    unique: list[str] = []
    for slot in slots:
        stripped = norm_text(slot)
        if stripped and stripped not in unique:
            unique.append(stripped)
    if not unique:
        return "기간 종합"
    if len(unique) <= 3:
        return ", ".join(unique)
    return f"{', '.join(unique[:3])} 외 {len(unique) - 3}건"


def validate_markdown(markdown_text: str) -> None:
    required_sections = [
        "## 기간 요약",
        "## 누적 테마",
        "## 누적 판단",
        "## 브리핑 타임라인",
        "## 다음 체크포인트",
    ]
    for section in required_sections:
        if section not in markdown_text:
            raise RuntimeError(f"missing required section: {section}")
    if "## Raw Channel Blocks" in markdown_text:
        raise RuntimeError("raw bundle text leaked into digest")


def build_empty_digest(mode: str, period_label: str, now: datetime) -> str:
    title = "주간" if mode == "weekly" else "월간"
    lines = [
        f"## 텔레그램 {title} 브리핑 종합",
        f"- 작성 시각: {now.strftime('%Y-%m-%d %H:%M KST')}",
        f"- 대상 기간: {period_label}",
        "- 대상 브리핑: 0건",
        "- 번들 보조 문맥 있는 브리핑: 0건",
        "",
        "## 기간 요약",
        "- 대상 기간에 저장된 정기 브리핑이 없다.",
        "",
        "## 누적 테마",
        "- 누적할 테마가 없다.",
        "",
        "## 누적 판단",
        "- 다음 브리핑 적재 이후 재생성 필요.",
        "",
        "## 브리핑 타임라인",
        "- 저장된 브리핑 없음",
        "",
        "## 다음 체크포인트",
        "- 다음 정기 브리핑 저장 여부 확인",
        "",
    ]
    return "\n".join(lines)


def collect_theme_buckets(briefings: list[Briefing]) -> list[tuple[str, list[str], list[str]]]:
    buckets: dict[str, dict[str, list[str] | set[str]]] = {}
    for briefing in briefings:
        for item in briefing.themes:
            text = norm_text(item)
            if not text:
                continue
            theme = clean_report_text(text.split("|", 1)[0], 36)
            bucket = buckets.setdefault(theme, {"items": [], "slots": []})
            bucket["items"].append(text)
            bucket["slots"].append(briefing.generated_at.strftime("%m-%d %H:%M"))

    ranked = sorted(
        buckets.items(),
        key=lambda kv: (len(kv[1]["items"]), kv[0]),
        reverse=True,
    )
    return [
        (
            theme,
            unique_strings(data["items"], limit=3),
            unique_strings(data["slots"], limit=4),
        )
        for theme, data in ranked[:MAX_THEME_ITEMS]
    ]


def build_digest_rule_based(mode: str, briefings: list[Briefing], period_label: str, now: datetime) -> str:
    if not briefings:
        return build_empty_digest(mode, period_label, now)

    title = "주간" if mode == "weekly" else "월간"
    bundle_supported = sum(1 for briefing in briefings if briefing.bundle_path is not None)
    analyses = [fallback_briefing_analysis(briefing) for briefing in briefings]
    theme_buckets = collect_theme_buckets(briefings)
    summary = unique_strings(
        [analysis["dominant_narrative"] for analysis in analyses]
        + [analysis["market_focus"] for analysis in analyses[:2]],
        limit=MAX_PERIOD_SUMMARY_ITEMS,
    )
    house_view = unique_strings(
        [analysis["investment_translation"] for analysis in analyses]
        + [item for briefing in briefings for item in briefing.house_view],
        limit=MAX_HOUSE_VIEW_ITEMS,
    )
    watch = unique_strings(
        [analysis["follow_through"] for analysis in analyses]
        + [item for briefing in briefings for item in briefing.watch],
        limit=MAX_WATCH_ITEMS,
    )

    lines = [
        f"## 텔레그램 {title} 브리핑 종합",
        f"- 작성 시각: {now.strftime('%Y-%m-%d %H:%M KST')}",
        f"- 대상 기간: {period_label}",
        f"- 대상 브리핑: {len(briefings)}건",
        f"- 번들 보조 문맥 있는 브리핑: {bundle_supported}건",
        "",
        "## 기간 요약",
    ]
    lines.extend(f"- {clean_report_text(item, 160)}" for item in summary)
    if len(lines) == 6:
        lines.append("- 기간 요약을 만들 재료가 부족하다.")

    lines.extend(["", "## 누적 테마"])
    if theme_buckets:
        for theme, items, slots in theme_buckets:
            lead = clean_report_text(items[0], 150)
            support = render_supporting_slots(slots)
            lines.append(f"- {theme}: {lead} ({support})")
    else:
        lines.append("- 누적할 테마가 없다.")

    lines.extend(["", "## 누적 판단"])
    if house_view:
        lines.extend(f"- {clean_report_text(item, 160)}" for item in house_view)
    else:
        lines.append("- 기간 누적 판단을 만들 만큼 저장된 브리핑이 없다.")

    lines.extend(["", "## 브리핑 타임라인"])
    for briefing in briefings[-MAX_TIMELINE_ITEMS:]:
        lead = briefing.summary[0] if briefing.summary else (briefing.themes[0] if briefing.themes else "요약 라인 없음")
        lines.append(f"- {briefing.generated_at.strftime('%m-%d %H:%M')}: {clean_report_text(lead, 140)}")

    lines.extend(["", "## 다음 체크포인트"])
    if watch:
        lines.extend(f"- {clean_report_text(item, 140)}" for item in watch)
    else:
        lines.append("- 다음 정기 브리핑에서 가격, 정책, 실적 후속을 재확인")
    lines.append("")

    markdown_text = "\n".join(lines)
    validate_markdown(markdown_text)
    return markdown_text


def build_digest(mode: str, briefings: list[Briefing], period_label: str, now: datetime) -> str:
    if not briefings:
        return build_empty_digest(mode, period_label, now)

    if not USE_LLM_DIGEST:
        return build_digest_rule_based(mode, briefings, period_label, now)

    packets = [render_briefing_packet(briefing) for briefing in briefings]
    packet_chunks = chunk_texts(packets, DIGEST_CHUNK_MAX_CHARS)

    chunk_results: list[dict] = []
    for chunk_index, packet_chunk in enumerate(packet_chunks, start=1):
        chunk_label = f"{chunk_index}/{len(packet_chunks)}"
        slots = []
        for packet in packet_chunk:
            first_line = packet.splitlines()[0]
            slots.append(first_line.removeprefix("### Briefing Slot:").strip())
        packet_by_slot = dict(zip(slots, packet_chunk))
        briefings_by_slot = {
            briefing.generated_at.strftime("%Y-%m-%d %H:%M KST"): briefing
            for briefing in briefings
            if briefing.generated_at.strftime("%Y-%m-%d %H:%M KST") in packet_by_slot
        }
        payload = run_structured_json(
            build_chunk_prompt(mode, period_label, chunk_label, packet_chunk),
            digest_chunk_schema(),
            DIGEST_ANALYSIS_CONFIG,
        )
        payload = complete_chunk_coverage(mode, period_label, chunk_label, briefings_by_slot, packet_by_slot, payload)
        chunk_results.append(
            {
                "chunk_index": chunk_index,
                "briefing_count": len(packet_chunk),
                "slots": slots,
                **payload,
            }
        )

    final_payload = run_structured_json(
        build_final_prompt(mode, period_label, now, briefings, chunk_results),
        digest_final_schema(),
        DIGEST_SYNTHESIS_CONFIG,
    )

    title = "주간" if mode == "weekly" else "월간"
    bundle_supported = sum(1 for briefing in briefings if briefing.bundle_path is not None)
    lines = [
        f"## 텔레그램 {title} 브리핑 종합",
        f"- 작성 시각: {now.strftime('%Y-%m-%d %H:%M KST')}",
        f"- 대상 기간: {period_label}",
        f"- 대상 브리핑: {len(briefings)}건",
        f"- 번들 보조 문맥 있는 브리핑: {bundle_supported}건",
        "",
        "## 기간 요약",
    ]

    summary_lines = [clean_report_text(item, 160) for item in final_payload.get("summary", [])[:MAX_PERIOD_SUMMARY_ITEMS]]
    if summary_lines:
        lines.extend(f"- {item}" for item in summary_lines)
    else:
        lines.append("- 기간 요약을 만들 재료가 부족하다.")

    lines.extend(["", "## 누적 테마"])
    theme_items = final_payload.get("theme_issue", [])[:MAX_THEME_ITEMS]
    if theme_items:
        for item in theme_items:
            theme = clean_report_text(str(item.get("theme") or "테마"), 36)
            period_takeaway = clean_report_text(str(item.get("period_takeaway") or ""), 150)
            market_focus = clean_report_text(str(item.get("market_focus") or ""), 120)
            investment_translation = clean_report_text(str(item.get("investment_translation") or ""), 120)
            support = render_supporting_slots(item.get("supporting_slots") or [])
            lines.append(
                f"- {theme}: {period_takeaway} | 시장은 {market_focus} | 투자 번역: {investment_translation} ({support})"
            )
    else:
        lines.append("- 누적 테마를 만들 만큼 일관된 흐름이 없다.")

    lines.extend(["", "## 누적 판단"])
    house_view_lines = [clean_report_text(item, 160) for item in final_payload.get("house_view", [])[:MAX_HOUSE_VIEW_ITEMS]]
    if house_view_lines:
        lines.extend(f"- {item}" for item in house_view_lines)
    else:
        lines.append("- 기간 누적 판단을 만들 만큼 저장된 브리핑이 없다.")

    lines.extend(["", "## 브리핑 타임라인"])
    timeline_items = final_payload.get("timeline", [])[:MAX_TIMELINE_ITEMS]
    if timeline_items:
        for item in timeline_items:
            slot = clean_report_text(str(item.get("slot") or ""), 32)
            headline = clean_report_text(str(item.get("headline") or ""), 140)
            lines.append(f"- {slot}: {headline}")
    else:
        for briefing in briefings[-MAX_TIMELINE_ITEMS:]:
            lead = briefing.summary[0] if briefing.summary else (briefing.themes[0] if briefing.themes else "요약 라인 없음")
            lines.append(f"- {briefing.generated_at.strftime('%m-%d %H:%M')}: {clean_report_text(lead, 140)}")

    lines.extend(["", "## 다음 체크포인트"])
    watch_lines = [clean_report_text(item, 140) for item in final_payload.get("watch", [])[:MAX_WATCH_ITEMS]]
    if watch_lines:
        lines.extend(f"- {item}" for item in watch_lines)
    else:
        lines.append("- 다음 정기 브리핑에서 가격, 정책, 실적 후속을 재확인")
    lines.append("")

    markdown_text = "\n".join(lines)
    validate_markdown(markdown_text)
    return markdown_text


def write_digest(mode: str, text: str, now: datetime) -> Path:
    DIGESTS_DIR.mkdir(parents=True, exist_ok=True)
    out = DIGESTS_DIR / f"{mode}_{now.strftime('%Y-%m-%d_%H%M')}_kst.md"
    out.write_text(text + "\n", encoding="utf-8")
    latest = DIGESTS_DIR / f"latest_{mode}.md"
    latest.write_text(text + "\n", encoding="utf-8")
    return out


def main(argv: list[str]) -> int:
    mode = argv[1] if len(argv) > 1 else "weekly"
    now = now_kst()
    start, end, period_label = period_for_mode(mode, now)
    briefings = list_briefings(start, end, now)
    text = build_digest(mode, briefings, period_label, now)
    out = write_digest(mode, text, now)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
