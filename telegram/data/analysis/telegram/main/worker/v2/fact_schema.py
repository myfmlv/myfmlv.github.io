from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Fact:
    source_channel: str
    message_id: int | str | None
    source_ts_kst: str
    entity: str
    topic: str
    event_type: str
    summary_ko: str
    supporting_metrics: tuple[str, ...] = ()
    direction: str = "neutral"
    time_relevance: str = "current"
    market_relevance: int = 1
    novelty_score: int = 1
    confidence: float = 0.0
    evidence_span: str = ""
    language_status: str = "ko"
    source_chat: str = ""
    source_message_count: int = 1
    classification: str = "actionable_news"
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def source_key(self) -> tuple[str, int | str | None]:
        return self.source_channel, self.message_id
