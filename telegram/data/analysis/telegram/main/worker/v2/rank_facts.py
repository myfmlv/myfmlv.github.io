from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from generate_briefing import canonical_text, same_story_text

from .fact_schema import Fact


@dataclass(frozen=True)
class RankedFactGroup:
    signature: str
    facts: tuple[Fact, ...]
    representative: Fact
    chat_count: int
    score: float
    consensus: bool



def fact_signature(fact: Fact) -> str:
    metric_key = "|".join(fact.supporting_metrics[:2])
    return canonical_text(f"{fact.entity} {fact.event_type} {fact.topic} {metric_key}")[:180]



def group_facts(facts: list[Fact]) -> list[list[Fact]]:
    groups: list[list[Fact]] = []
    for fact in facts:
        placed = False
        for group in groups:
            lead = group[0]
            same_entity = fact.entity == lead.entity and fact.event_type == lead.event_type
            same_story = same_story_text(fact.evidence_span, lead.evidence_span)
            metric_overlap = bool(set(fact.supporting_metrics) & set(lead.supporting_metrics))
            if same_entity and (same_story or metric_overlap):
                group.append(fact)
                placed = True
                break
        if not placed:
            groups.append([fact])
    return groups



def rank_fact_groups(facts: list[Fact]) -> list[RankedFactGroup]:
    ranked: list[RankedFactGroup] = []
    for group in group_facts(facts):
        unique_by_source: dict[tuple[str, int | str | None], Fact] = {}
        for fact in group:
            unique_by_source[fact.source_key] = fact
        deduped = list(unique_by_source.values())
        representative = max(deduped, key=lambda item: (item.confidence, item.market_relevance, len(item.supporting_metrics), item.source_message_count))
        chat_count = len({fact.source_channel for fact in deduped})
        consensus = chat_count >= 2
        avg_conf = sum(fact.confidence for fact in deduped) / max(len(deduped), 1)
        avg_relevance = sum(fact.market_relevance + fact.novelty_score for fact in deduped) / max(len(deduped), 1)
        score = avg_conf * 10 + avg_relevance + (3.0 if consensus else 0.0)
        ranked.append(
            RankedFactGroup(
                signature=fact_signature(representative),
                facts=tuple(deduped),
                representative=representative,
                chat_count=chat_count,
                score=score,
                consensus=consensus,
            )
        )
    ranked.sort(key=lambda item: (item.consensus, item.score, item.chat_count, item.representative.confidence), reverse=True)
    return ranked
