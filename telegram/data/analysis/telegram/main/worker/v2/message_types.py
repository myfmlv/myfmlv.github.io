from __future__ import annotations

import enum
import re

from generate_briefing import (
    Msg,
    infer_topics,
    is_actionable_utility_text,
    is_generic_utility_text,
    is_market_roundup_text,
    normalize_report_text,
)


class MessageLabel(str, enum.Enum):
    ACTIONABLE_NEWS = "actionable_news"
    BROKER_NOTE_ACTIONABLE = "broker_note_actionable"
    BROKER_NOTE_ROUNDUP = "broker_note_roundup"
    UTILITY_ROUNDUP = "utility_roundup"
    UTILITY_ACTIONABLE_FILING = "utility_actionable_filing"
    COMMENTARY = "commentary"
    NOISE = "noise"


SYSTEM_WRAPPER_PATTERNS = [
    re.compile(r"^\s*(?:\[?공지\]?|시스템|알림|notice)[:：\-\s]", re.IGNORECASE),
    re.compile(r"텔레그램\s*채널", re.IGNORECASE),
    re.compile(r"실시간\s*주식\s*공시\s*정리채널", re.IGNORECASE),
]

LIST_WRAPPER_PATTERNS = [
    re.compile(r"정리\s*$", re.IGNORECASE),
    re.compile(r"리스트", re.IGNORECASE),
    re.compile(r"종목\s*정리", re.IGNORECASE),
    re.compile(r"추정치\s*상향종목\s*정리", re.IGNORECASE),
    re.compile(r"어닝\s*서프라이즈", re.IGNORECASE),
    re.compile(r"현황", re.IGNORECASE),
    re.compile(r"일정", re.IGNORECASE),
]

COMMENTARY_PATTERNS = [
    re.compile(r"ㅋㅋ|ㅎㅎ|lol", re.IGNORECASE),
    re.compile(r"인듯|같음|느낌", re.IGNORECASE),
    re.compile(r"개인적으로|제 생각", re.IGNORECASE),
]

BROKER_PATTERNS = [
    re.compile(r"증권"),
    re.compile(r"리서치"),
    re.compile(r"전략"),
    re.compile(r"메리츠|하나|한투|키움|신한|삼성", re.IGNORECASE),
]

ACTIONABLE_PATTERNS = [
    re.compile(r"단일판매.?공급계약", re.IGNORECASE),
    re.compile(r"수주", re.IGNORECASE),
    re.compile(r"계약", re.IGNORECASE),
    re.compile(r"실적", re.IGNORECASE),
    re.compile(r"가이던스", re.IGNORECASE),
    re.compile(r"영업이익", re.IGNORECASE),
    re.compile(r"매출", re.IGNORECASE),
    re.compile(r"블록딜", re.IGNORECASE),
    re.compile(r"지분", re.IGNORECASE),
    re.compile(r"상향", re.IGNORECASE),
    re.compile(r"하향", re.IGNORECASE),
    re.compile(r"가격", re.IGNORECASE),
    re.compile(r"공급 부족", re.IGNORECASE),
    re.compile(r"증설", re.IGNORECASE),
]


def is_system_wrapper(text: str) -> bool:
    cleaned = normalize_report_text(text)
    return any(pattern.search(cleaned) for pattern in SYSTEM_WRAPPER_PATTERNS)



def is_list_wrapper(text: str) -> bool:
    cleaned = normalize_report_text(text)
    return any(pattern.search(cleaned) for pattern in LIST_WRAPPER_PATTERNS)



def is_broker_source(message: Msg) -> bool:
    haystack = f"{message.chat} {message.chat_slug}"
    return any(pattern.search(haystack) for pattern in BROKER_PATTERNS)



def classify_message(message: Msg) -> MessageLabel:
    text = normalize_report_text(message.text)
    if not text or len(text) < 12:
        return MessageLabel.NOISE
    if is_system_wrapper(text):
        return MessageLabel.NOISE
    if is_market_roundup_text(text):
        return MessageLabel.BROKER_NOTE_ROUNDUP if is_broker_source(message) else MessageLabel.UTILITY_ROUNDUP
    if "실시간_주식_공시_정리채널" in message.chat_slug or "실시간 주식 공시 정리채널" in message.chat:
        return MessageLabel.UTILITY_ACTIONABLE_FILING if is_actionable_utility_text(text) else MessageLabel.UTILITY_ROUNDUP
    if is_generic_utility_text(text):
        return MessageLabel.UTILITY_ACTIONABLE_FILING if is_actionable_utility_text(text) else MessageLabel.UTILITY_ROUNDUP
    if is_list_wrapper(text):
        return MessageLabel.BROKER_NOTE_ROUNDUP if is_broker_source(message) else MessageLabel.UTILITY_ROUNDUP
    if any(pattern.search(text) for pattern in COMMENTARY_PATTERNS):
        return MessageLabel.COMMENTARY
    if is_broker_source(message):
        return MessageLabel.BROKER_NOTE_ACTIONABLE if any(pattern.search(text) for pattern in ACTIONABLE_PATTERNS) else MessageLabel.COMMENTARY
    topics = infer_topics(text)
    if topics and topics != ("uncategorized",) and any(pattern.search(text) for pattern in ACTIONABLE_PATTERNS):
        return MessageLabel.ACTIONABLE_NEWS
    if topics and topics != ("uncategorized",):
        return MessageLabel.COMMENTARY
    return MessageLabel.NOISE
