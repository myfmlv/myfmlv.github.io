from __future__ import annotations

import re
from dataclasses import dataclass

from generate_briefing import clean_report_text, normalize_report_text


CJK_TAIL_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff㐀-䶿一-鿿]{3,}")
LATIN_WORD_PATTERN = re.compile(r"\b[a-z]{4,}\b", re.IGNORECASE)
HANGUL_PATTERN = re.compile(r"[가-힣]")
ALLOWED_LATIN_WORDS = {
    "hbm",
    "dram",
    "nand",
    "cpo",
    "ir",
    "eps",
    "ndf",
    "wti",
    "brent",
    "catl",
    "bhp",
    "cmrg",
    "ai",
    "ipo",
    "etf",
    "idm",
    "capex",
    "ebitda",
    "roi",
}
LATIN_NORMALIZATION_RULES = [
    (re.compile(r"비중확대\s*\(\s*Overweight\s*\)", re.IGNORECASE), "비중확대"),
    (re.compile(r"\bOverweight\b", re.IGNORECASE), "비중확대"),
    (re.compile(r"Top-?picks?로는", re.IGNORECASE), "최선호주로는"),
    (re.compile(r"\bTop-?picks?\b", re.IGNORECASE), "최선호주"),
    (re.compile(r"\bAI\s+disruption\b", re.IGNORECASE), "AI 교란"),
    (re.compile(r"\bCompliance\b", re.IGNORECASE), "컴플라이언스"),
]
COMPLETE_ENDING_PATTERN = re.compile(
    r"(이다|하다|했다|된다|됐다|나왔다|이어졌다|늘었다|줄었다|커졌다|확대됐다|축소됐다|유지됐다|반영됐다|확인됐다|상승했다|하락했다|받는다|보인다|예상된다|시사한다|공시했다|발표했다|체결했다|회수했다|매각했다|경고했다|지적했다|강조했다|판단한다|판단합니다|제시한다|유지한다)$"
)
DANGLING_ENDINGS = (
    "하지만",
    "다만",
    "한편",
    "등",
    "관련",
    "가능하지만",
    "가능성",
    "전망",
    "정리",
)
CJK_SPLIT_MARKERS = (
    "报道:",
    "报道：",
    "據媒體",
    "据媒体",
    "文件条款显示:",
    "文件条款显示：",
    "必和必拓宣布:",
    "必和必拓宣布：",
)


@dataclass(frozen=True)
class KoreanNormalizationResult:
    text: str
    language_status: str
    rejected: bool
    reject_reason: str | None = None


def strip_known_english_noise(text: str) -> str:
    cleaned = text
    for pattern, replacement in LATIN_NORMALIZATION_RULES:
        cleaned = pattern.sub(replacement, cleaned)
    cleaned = re.sub(r"\b[A-Za-z]{4,}\s*[:：]\s*(?=[가-힣])", "", cleaned)
    cleaned = re.sub(r"\((?:[A-Za-z][A-Za-z\- ]{2,})\)", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def truncate_before_cjk_tail(text: str) -> str:
    match = CJK_TAIL_PATTERN.search(text)
    if not match:
        return text.strip()
    prefix = text[: match.start()].strip(" -|/,:;>")
    if HANGUL_PATTERN.search(prefix):
        return prefix
    return ""


def strip_mixed_language_tail(text: str) -> str:
    cleaned = strip_known_english_noise(normalize_report_text(text))
    lines = [part.strip(" -|/,") for part in re.split(r"[\n]+", cleaned) if part.strip()]
    kept: list[str] = []
    for line in lines:
        truncated = line.split(">", 1)[0].strip()
        for marker in CJK_SPLIT_MARKERS:
            if marker in truncated:
                truncated = truncated.split(marker, 1)[0].strip()
                break
        truncated = truncate_before_cjk_tail(truncated)
        if not truncated:
            if kept:
                break
            continue
        kept.append(truncated)
    cleaned = " ".join(kept).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip(" -|/,")


def has_mixed_language_leakage(text: str) -> bool:
    cleaned = normalize_report_text(text)
    if CJK_TAIL_PATTERN.search(cleaned):
        return True
    latin_words = LATIN_WORD_PATTERN.findall(cleaned)
    return any(word.lower() not in ALLOWED_LATIN_WORDS for word in latin_words)


def is_complete_korean_sentence(text: str) -> bool:
    cleaned = clean_report_text(text, 220).strip(" -|/,.")
    if len(cleaned) < 14:
        return False
    if cleaned.endswith(DANGLING_ENDINGS):
        return False
    if re.search(r"(?:하지만|다만|한편)\s*$", cleaned):
        return False
    if re.search(r"[은는이가을를]$", cleaned):
        return False
    return bool(COMPLETE_ENDING_PATTERN.search(cleaned))


def normalize_korean_text(text: str) -> KoreanNormalizationResult:
    cleaned = strip_mixed_language_tail(text)
    if not cleaned:
        return KoreanNormalizationResult(text="", language_status="empty", rejected=True, reject_reason="empty")
    leakage = has_mixed_language_leakage(cleaned)
    language_status = "mixed" if leakage else "ko"
    if leakage:
        return KoreanNormalizationResult(text=cleaned, language_status=language_status, rejected=True, reject_reason="mixed_language")
    return KoreanNormalizationResult(text=cleaned, language_status=language_status, rejected=False, reject_reason=None)
