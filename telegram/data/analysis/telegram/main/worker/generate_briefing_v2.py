#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

import generate_briefing as gb
from v2.extract_facts import extract_facts_from_message
from v2.message_types import MessageLabel, classify_message
from v2.rank_facts import RankedFactGroup, rank_fact_groups
from v2.validate_output import validate_bullet, validate_fact

V2_REPORTS_DIR = gb.ROOT / "reports" / "briefings_v2"
V2_LATEST_REPORT_PATH = gb.ROOT / "reports" / "latest_v2.md"
V2_LATEST_CONTEXT_PATH = gb.ROOT / "reports" / "latest_v2.context.json"
V2_BUNDLES_DIR = gb.ROOT / "reports" / "bundles_v2"
V2_LATEST_BUNDLE_PATH = gb.ROOT / "reports" / "latest_v2.bundle.md"



def collect_messages(window: gb.BriefingWindow) -> tuple[list[gb.Msg], list[gb.ChannelBundle], str]:
    raw_messages = list(gb.iter_messages(window))
    raw_messages = gb.filter_selected_messages(raw_messages)
    bundles = gb.build_channel_bundles(raw_messages)
    bundle_text = gb.render_master_bundle(datetime.now(gb.KST), window, {}, bundles)
    deduped: list[gb.Msg] = []
    for bundle in bundles:
        deduped.extend(gb.dedupe_within_chat(bundle.messages))
    return deduped, bundles, bundle_text



def collect_candidate_facts(messages: list[gb.Msg]) -> tuple[list[dict], list]:
    classified: list[dict] = []
    facts = []
    for message in messages:
        label = classify_message(message)
        classified.append({"message": message, "label": label.value})
        facts.extend(extract_facts_from_message(message, label))
    return classified, facts



def select_validated_groups(facts: list) -> tuple[list[RankedFactGroup], list[dict]]:
    ranked = rank_fact_groups(facts)
    selected: list[RankedFactGroup] = []
    rejected: list[dict] = []
    for group in ranked:
        ok, reason = validate_fact(group.representative)
        if not ok:
            rejected.append({"signature": group.signature, "reason": reason, "summary": group.representative.summary_ko})
            continue
        selected.append(group)
    return selected, rejected



def compose_top_bullets(groups: list[RankedFactGroup], limit: int = 4) -> list[str]:
    bullets: list[str] = []
    for group in groups[: limit * 2]:
        fact = group.representative
        bullet = fact.summary_ko
        if group.consensus:
            bullet = f"{bullet}. 복수 출처에서 같은 사실이 확인됐다."
        ok, _ = validate_bullet(bullet)
        if ok:
            bullets.append(bullet)
        if len(bullets) >= limit:
            break
    return bullets



def build_regime_lines(groups: list[RankedFactGroup], snap: dict) -> list[str]:
    if not groups:
        return [
            "검증을 통과한 개별 사실이 부족해 보수적으로 비워 둔 슬롯이다.",
            f"거시 확인선은 WTI {gb.format_number(snap.get('WTI'))}, 원달러 {gb.format_number(snap.get('USDKRW_NDF_1M'))}, 미10년물 {gb.format_number(snap.get('US_10Y'))}이다.",
        ]
    topic_counts = Counter(group.representative.topic for group in groups[:4])
    lead_topic = topic_counts.most_common(1)[0][0]
    lead_label = gb.TOPIC_LABELS.get(lead_topic, "기타")
    lines = [f"이번 슬롯은 {lead_label} 관련 검증된 사실이 중심이었다."]
    if any(group.consensus for group in groups[:4]):
        lines.append("같은 사실이 복수 채널에서 반복된 항목만 공통 확인으로 승격했다.")
    lines.append("목록형 정리나 시스템 문구, 미완성 절은 모두 제외했다.")
    return lines[:3]



def build_judgement_lines(groups: list[RankedFactGroup]) -> list[str]:
    if not groups:
        return ["확신도 기준을 넘는 사실이 부족하면 무리한 요약 대신 보수적으로 비우는 편이 낫다."]
    lines = []
    if groups[0].consensus:
        lines.append("가장 위에는 복수 채널이 같은 사건을 반복 확인한 재료만 남겼다.")
    else:
        lines.append("상단 항목도 단독 채널 재료인 만큼 후속 공시와 가격 반응 확인이 필요하다.")
    if any(group.representative.event_type == "placement" for group in groups[:4]):
        lines.append("지분 매각·블록딜 성격 재료는 오버행 변수로 별도 경계가 필요하다.")
    else:
        lines.append("실적·계약·가격 지표처럼 수치가 붙은 재료를 우선했다.")
    return lines[:2]



def build_numbers_to_watch(snap: dict) -> list[str]:
    return [
        f"WTI {gb.format_number(snap.get('WTI'))}: 에너지 프리미엄 재확대 여부",
        f"미10년물 {gb.format_number(snap.get('US_10Y'))}: 성장주 할인율 부담 여부",
        f"원달러환율 {gb.format_number(snap.get('USDKRW_NDF_1M'))}: 국내 위험선호 회복 여부",
    ]



def render_markdown(window: gb.BriefingWindow, bullets: list[str], regime: list[str], judgement: list[str], watch: list[str]) -> str:
    concept = gb.slot_concept(window.slot)
    lines = [
        f"# {concept['title']} V2",
        f"- 기준 시각: {window.end.strftime('%Y-%m-%d %H:%M KST')}",
        f"- 집계 구간: {window.start.strftime('%Y-%m-%d %H:%M KST')} ~ {window.end.strftime('%Y-%m-%d %H:%M KST')}",
        "",
        "## 지금 중요한 사실",
    ]
    lines.extend(f"- {line}" for line in bullets)
    lines.append("")
    lines.append("## 해석과 우선순위")
    lines.extend(f"- {line}" for line in regime)
    lines.append("")
    lines.append("## 우리 판단")
    lines.extend(f"- {line}" for line in judgement)
    lines.append("")
    lines.append("## 체크할 숫자 3개")
    lines.extend(f"- {line}" for line in watch)
    return "\n".join(lines).strip() + "\n"



def write_outputs(window: gb.BriefingWindow, markdown_text: str, context: dict, bundle_text: str) -> tuple[Path, Path]:
    V2_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    V2_BUNDLES_DIR.mkdir(parents=True, exist_ok=True)
    out = V2_REPORTS_DIR / f"{window.end.strftime('%Y-%m-%d_%H%M')}_kst_v2.md"
    out.write_text(markdown_text, encoding="utf-8")
    context_path = out.with_suffix(".context.json")
    context_path.write_text(json.dumps(context, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    bundle_out = V2_BUNDLES_DIR / f"{window.end.strftime('%Y-%m-%d_%H%M')}_kst_v2.bundle.md"
    bundle_out.write_text(bundle_text, encoding="utf-8")
    V2_LATEST_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    V2_LATEST_REPORT_PATH.write_text(markdown_text, encoding="utf-8")
    V2_LATEST_CONTEXT_PATH.write_text(json.dumps(context, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    V2_LATEST_BUNDLE_PATH.write_text(bundle_text, encoding="utf-8")
    return out, bundle_out



def main() -> int:
    now_kst = datetime.now(gb.KST)
    stored_state = gb.load_state()
    window = gb.resolve_briefing_window(now_kst, stored_state.get("schedule_kst") or [])
    snap, snapshot_file = gb.extract_objective_snapshot(window.end)
    snapshot_file = snapshot_file or gb.resolve_slot_market_snapshot_file(window)
    messages, bundles, bundle_text = collect_messages(window)
    if not messages:
        print("[skip] no messages for V2 window")
        return 0
    classified, facts = collect_candidate_facts(messages)
    selected_groups, rejected_groups = select_validated_groups(facts)
    bullets = compose_top_bullets(selected_groups)
    regime = build_regime_lines(selected_groups, snap)
    judgement = build_judgement_lines(selected_groups)
    watch = build_numbers_to_watch(snap)
    markdown_text = render_markdown(window, bullets or ["검증 조건을 통과한 핵심 사실이 부족해 이번 슬롯은 비워 두었다."], regime, judgement, watch)
    context = {
        "generated_at_kst": now_kst.isoformat(timespec="seconds"),
        "window_start_kst": window.start.isoformat(timespec="seconds"),
        "window_end_kst": window.end.isoformat(timespec="seconds"),
        "briefing_slot_kst": window.slot,
        "market_snapshot_file": snapshot_file,
        "message_count": len(messages),
        "fact_count": len(facts),
        "validated_group_count": len(selected_groups),
        "classified_messages": [
            {"chat_slug": item["message"].chat_slug, "message_id": item["message"].message_id, "label": item["label"]}
            for item in classified[:200]
        ],
        "selected_groups": [
            {
                "signature": group.signature,
                "score": group.score,
                "chat_count": group.chat_count,
                "consensus": group.consensus,
                "representative": group.representative.summary_ko,
            }
            for group in selected_groups[:20]
        ],
        "rejected_groups": rejected_groups[:50],
    }
    out, _ = write_outputs(window, markdown_text, context, bundle_text)
    print(str(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
