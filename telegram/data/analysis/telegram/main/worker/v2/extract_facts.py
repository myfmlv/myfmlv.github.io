from __future__ import annotations

import re

from generate_briefing import Msg, clean_report_text, infer_topics, normalize_report_text

from .fact_schema import Fact
from .message_types import MessageLabel
from .normalize_ko import normalize_korean_text

EVENT_PATTERNS = [
    ("contract", re.compile(r"단일판매.?공급계약|수주|공급계약|계약 합의|계약에 합의", re.IGNORECASE), "positive"),
    ("earnings_revision", re.compile(r"실적|영업이익|매출|가이던스|추정치|목표가", re.IGNORECASE), "positive"),
    ("placement", re.compile(r"블록딜|지분 매각|오버행|할인", re.IGNORECASE), "negative"),
    ("pricing", re.compile(r"가격|단가|운임|상승|하락|공급 부족", re.IGNORECASE), "positive"),
    ("policy", re.compile(r"허가|승인|규제|제재|관세", re.IGNORECASE), "neutral"),
]

ACTIONABLE_SEGMENT_PATTERN = re.compile(
    r"단일판매.?공급계약|수주|공급계약|실적|영업이익|매출|가이던스|추정치|목표가|블록딜|지분 매각|오버행|할인|가격|단가|운임|상승|하락|공급 부족|계약 합의|경고",
    re.IGNORECASE,
)

BROKER_OPINION_PATTERN = re.compile(
    r"우리는 투자자들이|판단합니다|투자 의견|비중확대|선호|최선호|top picks|보고서를 발간|전망입니다|추천",
    re.IGNORECASE,
)

METRIC_PATTERN = re.compile(
    r"(?:\d+[.,]?\d*\s*(?:조|억|만)?\s*원|\d+[.,]?\d*%|\+\d+[.,]?\d*%|\-\d+[.,]?\d*%|\d+[.,]?\d*배|\d+[.,]?\d*달러)"
)

ENTITY_PATTERN = re.compile(
    r"([A-Z]{2,}(?:[가-힣A-Za-z]+)?|[가-힣A-Za-z]+(?:전자|솔루션|테크|증권|에너지|중공업|반도체|조선|화학|물산|산업|바이오|제약|하이닉스|모비스|건설|카카오|네이버))"
)
FILING_FIELD_PATTERN = re.compile(
    r"(기업명|계약상대|계약내용|계약금액|계약기간|매출대비)\s*:\s*(.*?)"
    r"(?=\s*(?:기업명|계약상대|계약내용|공급지역|계약금액|계약시작|계약종료|계약기간|매출대비|공시링크|최근계약|회사정보)\s*:|$)"
)

BROKER_HEADLINE_REWRITES: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(r"^(?P<entity>[^,:]+):\s*(?P<counterparty>.+?)과\s+(?P<object>.+?)\s+계약\s+합의$"),
        "{entity}는 {counterparty}과 {object} 계약에 합의했다",
    ),
    (
        re.compile(r"^(?P<entity>.+?)\s+(?P<object>.+?지분)\s+매각$"),
        "{entity}는 {object}을 매각했다",
    ),
)


def choose_entity(text: str) -> str:
    matches = [match.group(1).strip() for match in ENTITY_PATTERN.finditer(text)]
    if not matches:
        return "관련 기업"
    ranked = sorted(matches, key=lambda item: (any("가" <= ch <= "힣" for ch in item), len(item)), reverse=True)
    return ranked[0]


def choose_event(text: str) -> tuple[str, str]:
    for event_type, pattern, direction in EVENT_PATTERNS:
        if pattern.search(text):
            return event_type, direction
    return "update", "neutral"


def supporting_metrics(text: str) -> tuple[str, ...]:
    seen: list[str] = []
    for metric in METRIC_PATTERN.findall(text):
        metric = re.sub(r"\s+", " ", metric).strip()
        if metric not in seen:
            seen.append(metric)
    return tuple(seen[:3])


def summarize_fact(text: str, entity: str, topic: str, event_type: str, metrics: tuple[str, ...]) -> str:
    sentence = clean_report_text(text, 160)
    sentence = re.sub(r"\s+", " ", sentence).strip(" -|/,")
    return sentence.rstrip(".")


def confidence_for_fact(text: str, label: MessageLabel, metrics: tuple[str, ...]) -> float:
    score = 0.45
    if label in {MessageLabel.ACTIONABLE_NEWS, MessageLabel.BROKER_NOTE_ACTIONABLE, MessageLabel.UTILITY_ACTIONABLE_FILING}:
        score += 0.15
    if metrics:
        score += min(0.2, 0.05 * len(metrics))
    if len(text) >= 35:
        score += 0.1
    if re.search(r"확인|공시|발표|계약|수주|상향|하향|부족|상승|하락", text):
        score += 0.1
    return min(score, 0.95)


def filing_structured_sentence(text: str) -> str | None:
    cleaned = normalize_report_text(text)
    company_match = re.search(r"기업명:\s*([^\(\n]+)", cleaned)
    counterparty_match = re.search(r"계약상대\s*:\s*(.+?)(?=\s*(?:계약내용|공급지역|계약금액|계약시작|계약종료|계약기간|매출대비)\s*:|$)", cleaned)
    contract_match = re.search(r"계약내용\s*:\s*(.+?)(?=\s*(?:공급지역|계약금액|계약시작|계약종료|계약기간|매출대비)\s*:|$)", cleaned)
    amount_match = re.search(r"계약금액\s*:\s*(.+?)(?=\s*(?:계약시작|계약종료|계약기간|매출대비)\s*:|$)", cleaned)
    ratio_match = re.search(r"매출대비\s*:\s*(.+?)(?=\s*(?:공시링크|최근계약|회사정보)\s*:|$)", cleaned)
    company = re.sub(r"\(.*?\)", "", company_match.group(1)).strip() if company_match else ""
    counterparty = counterparty_match.group(1).strip() if counterparty_match else ""
    contract = contract_match.group(1).strip() if contract_match else ""
    amount = amount_match.group(1).strip() if amount_match else ""
    ratio = ratio_match.group(1).strip() if ratio_match else ""
    if not company or not contract or not amount:
        return None
    contract = re.sub(r"^\([^)]*\)\s*", "", contract).strip()
    contract = re.sub(r"\s+", " ", contract).strip(" -|/,")
    amount = amount if amount.endswith("원") or amount.endswith("억원") else f"{amount} 원"
    sentence = f"{company}은 "
    if counterparty:
        sentence += f"{counterparty}와 "
    sentence += f"{contract} 공급계약을 체결했고 계약금액은 {amount}"
    if ratio:
        sentence += f", 매출 대비 {ratio}라고 공시했다"
    else:
        sentence += "라고 공시했다"
    return re.sub(r"\s+", " ", sentence).strip()


def split_candidate_segments(text: str) -> list[str]:
    cleaned = normalize_report_text(text)
    cleaned = re.sub(r"\s*[•·▪︎◦]\s*", ". ", cleaned)
    cleaned = re.sub(r"\s*[-–—]\s+", ". ", cleaned)
    return [segment.strip(" -|/,") for segment in re.split(r"(?<=[.!?])\s+", cleaned) if segment.strip(" -|/,")]


def rewrite_headline_fragment(text: str) -> str:
    pre_normalized = normalize_korean_text(normalize_report_text(text)).text
    rewritten = pre_normalized.strip(" -*|/,")
    rewritten = rewritten.rstrip(".")
    for pattern, template in BROKER_HEADLINE_REWRITES:
        match = pattern.fullmatch(rewritten)
        if match:
            return template.format(**{key: value.strip() for key, value in match.groupdict().items()})
    terminal_rewrites = (
        (r"수준임$", "수준이다"),
        (r"예정임$", "예정이다"),
        (r"했음$", "했다"),
        (r"됐음$", "됐다"),
        (r"였음$", "였다"),
        (r"경고$", "경고했다"),
        (r"매각$", "매각했다"),
        (r"회수$", "회수했다"),
        (r"합의$", "합의했다"),
        (r"철회$", "철회했다"),
    )
    for pattern, replacement in terminal_rewrites:
        updated = re.sub(pattern, replacement, rewritten)
        if updated != rewritten:
            rewritten = updated
            break
    return rewritten


def first_publishable_actionable_segment(text: str) -> str | None:
    candidates = split_candidate_segments(text)
    actionable_candidates = [segment for segment in candidates if ACTIONABLE_SEGMENT_PATTERN.search(segment)] or candidates
    for candidate in actionable_candidates:
        if BROKER_OPINION_PATTERN.search(candidate):
            continue
        rewritten = rewrite_headline_fragment(candidate)
        normalized = normalize_korean_text(rewritten)
        if not normalized.rejected:
            return normalized.text
        fallback = normalize_report_text(normalized.text).strip(" -*|/,")
        rewritten_fallback = rewrite_headline_fragment(fallback)
        normalized_fallback = normalize_korean_text(rewritten_fallback)
        if not normalized_fallback.rejected:
            return normalized_fallback.text
    return None


def normalize_fact_source_text(message: Msg, classification: MessageLabel) -> str:
    if classification == MessageLabel.UTILITY_ACTIONABLE_FILING:
        structured = filing_structured_sentence(message.text)
        if structured:
            return structured
    if classification in {MessageLabel.BROKER_NOTE_ACTIONABLE, MessageLabel.ACTIONABLE_NEWS}:
        actionable = first_publishable_actionable_segment(message.text)
        if actionable:
            return actionable
    return message.text


def extract_facts_from_message(message: Msg, classification: MessageLabel) -> list[Fact]:
    if classification in {MessageLabel.NOISE, MessageLabel.COMMENTARY, MessageLabel.BROKER_NOTE_ROUNDUP, MessageLabel.UTILITY_ROUNDUP}:
        return []
    source_text = normalize_fact_source_text(message, classification)
    if BROKER_OPINION_PATTERN.search(normalize_report_text(source_text)):
        return []
    normalized = normalize_korean_text(source_text)
    if normalized.rejected:
        return []
    text = normalize_report_text(normalized.text)
    topics = tuple(tag for tag in infer_topics(text) if tag != "uncategorized") or ("uncategorized",)
    entity = choose_entity(text)
    event_type, direction = choose_event(text)
    metrics = supporting_metrics(text)
    evidence_span = clean_report_text(text, 120)
    facts: list[Fact] = []
    for topic in topics[:2]:
        summary = summarize_fact(text, entity, topic, event_type, metrics)
        facts.append(
            Fact(
                source_channel=message.chat_slug,
                message_id=message.message_id,
                source_ts_kst=message.ts.isoformat(timespec="seconds"),
                entity=entity,
                topic=topic,
                event_type=event_type,
                summary_ko=summary,
                supporting_metrics=metrics,
                direction=direction,
                time_relevance="current",
                market_relevance=2 if metrics else 1,
                novelty_score=2 if metrics else 1,
                confidence=confidence_for_fact(text, classification, metrics),
                evidence_span=evidence_span,
                language_status=normalized.language_status,
                source_chat=message.chat,
                source_message_count=message.source_message_count,
                classification=classification.value,
                metadata={"raw_topics": topics},
            )
        )
    return facts
