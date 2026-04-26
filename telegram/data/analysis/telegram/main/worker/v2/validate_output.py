from __future__ import annotations

import re

from generate_briefing import normalize_report_text

from .fact_schema import Fact
from .normalize_ko import has_mixed_language_leakage, is_complete_korean_sentence

WRAPPER_PATTERNS = [
    re.compile(r"정리", re.IGNORECASE),
    re.compile(r"리스트", re.IGNORECASE),
    re.compile(r"현황", re.IGNORECASE),
    re.compile(r"일정", re.IGNORECASE),
    re.compile(r"시스템|공지|채널", re.IGNORECASE),
]
OPINION_PATTERNS = [
    re.compile(r"판단합니다|추천|비중확대|선호|전망입니다|봐야", re.IGNORECASE),
]

TOPIC_MISMATCH_HINTS = {
    "fx": [re.compile(r"블록딜|지분|오버행", re.IGNORECASE)],
    "semis": [re.compile(r"환율|원달러", re.IGNORECASE)],
}


def bullet_reject_reason(text: str) -> str | None:
    cleaned = normalize_report_text(text)
    if any(pattern.search(cleaned) for pattern in WRAPPER_PATTERNS):
        return "wrapper_contamination"
    if any(pattern.search(cleaned) for pattern in OPINION_PATTERNS):
        return "opinionated_text"
    if has_mixed_language_leakage(cleaned):
        return "mixed_language"
    return None


def fact_topic_mismatch(fact: Fact) -> bool:
    patterns = TOPIC_MISMATCH_HINTS.get(fact.topic, [])
    return any(pattern.search(fact.summary_ko) for pattern in patterns)


def has_publishable_evidence(fact: Fact) -> bool:
    if fact.supporting_metrics:
        return True
    if fact.event_type in {"contract", "earnings_revision", "placement", "pricing"}:
        return True
    return False


def validate_fact(fact: Fact, min_confidence: float = 0.6) -> tuple[bool, str | None]:
    if fact.confidence < min_confidence:
        return False, "low_confidence"
    if fact.language_status != "ko":
        return False, "language_status"
    if fact.classification in {"utility_roundup", "broker_note_roundup", "noise", "commentary"}:
        return False, "bad_classification"
    if fact_topic_mismatch(fact):
        return False, "label_content_mismatch"
    reason = bullet_reject_reason(fact.summary_ko)
    if reason:
        return False, reason
    return True, None


def validate_bullet(text: str) -> tuple[bool, str | None]:
    reason = bullet_reject_reason(text)
    return reason is None, reason
