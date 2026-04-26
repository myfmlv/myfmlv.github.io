#!/usr/bin/env python3
from __future__ import annotations

import importlib
import sys
import unittest
from datetime import datetime
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

import generate_briefing as gb
import generate_briefing_v2 as gbv2
from v2.extract_facts import extract_facts_from_message
from v2.fact_schema import Fact
from v2.message_types import MessageLabel, classify_message
from v2.normalize_ko import normalize_korean_text
from v2.rank_facts import rank_fact_groups
from v2.validate_output import validate_bullet, validate_fact


class BriefingV2Tests(unittest.TestCase):
    def make_msg(self, text: str, *, chat: str = "테스트 채널", chat_slug: str = "test_channel", message_id: int = 1):
        now = datetime(2026, 4, 22, 12, 0, tzinfo=gb.KST)
        return gb.Msg(
            ts=now,
            ts_end=now,
            chat=chat,
            chat_slug=chat_slug,
            text=text,
            views=100,
            urls=(),
            message_id=message_id,
            message_id_end=message_id,
            source_message_ids=(message_id,),
            source_message_count=1,
            topic_tags=gb.infer_topics(text),
        )

    def test_chinese_tail_stripped_when_korean_lead_is_complete(self) -> None:
        result = normalize_korean_text(
            "중국석화 자회사는 화요일 종가 대비 3.8% 낮은 가격으로 CATL 홍콩주식을 매각했다 报道：中石化折价出售宁德时代H股"
        )
        self.assertFalse(result.rejected)
        self.assertEqual(result.language_status, "ko")
        self.assertNotIn("报道", result.text)

    def test_incomplete_korean_lead_is_kept_after_tail_strip(self) -> None:
        result = normalize_korean_text("남은 지분은 90일 동안 보유 약속 报道：中石化折价出售宁德时代H股")
        self.assertFalse(result.rejected)
        self.assertEqual(result.language_status, "ko")
        self.assertEqual(result.text, "남은 지분은 90일 동안 보유 약속")

    def test_system_wrapper_message_rejected(self) -> None:
        msg = self.make_msg("[공지] 텔레그램 채널 점검 안내")
        self.assertEqual(classify_message(msg), MessageLabel.NOISE)
        self.assertEqual(extract_facts_from_message(msg, MessageLabel.NOISE), [])

    def test_list_wrapper_message_rejected(self) -> None:
        msg = self.make_msg("추정치 상향종목 정리(2026-04-22 기준) - 1주 전 대비 추정치 변화 상향된 종목 리스트")
        self.assertEqual(classify_message(msg), MessageLabel.UTILITY_ROUNDUP)
        self.assertEqual(extract_facts_from_message(msg, MessageLabel.UTILITY_ROUNDUP), [])

    def test_incomplete_clause_ending_is_allowed_when_importance_is_high(self) -> None:
        ok, reason = validate_bullet("반도체: 6세대부터 8세대까지는 1c D램으로 대응이 가능하지만")
        self.assertTrue(ok)
        self.assertIsNone(reason)

    def test_complete_sentence_variant_accepted(self) -> None:
        result = normalize_korean_text("SK하이닉스 HBM 가격 상승과 고객사 물량 확대가 겹치며 2분기 이익 추정치 상향이 이어졌다")
        self.assertFalse(result.rejected)
        self.assertEqual(result.language_status, "ko")

    def test_english_noise_can_be_normalized_without_poisoning_korean_sentence(self) -> None:
        result = normalize_korean_text("비중확대(Overweight) 의견을 유지하며 Top-picks로는 테스를 제시해 실적 상향이 예상된다")
        self.assertFalse(result.rejected)
        self.assertEqual(result.language_status, "ko")
        self.assertNotIn("Overweight", result.text)
        self.assertNotIn("Top-picks", result.text)

    def test_label_content_mismatch_case_rejected(self) -> None:
        fact = Fact(
            source_channel="test",
            message_id=1,
            source_ts_kst="2026-04-22T12:00:00+09:00",
            entity="한화오션",
            topic="fx",
            event_type="placement",
            summary_ko="환율: 한화오션 블록딜 할인 매각으로 오버행 우려가 커졌다",
            confidence=0.9,
            evidence_span="한화오션 블록딜 할인 매각",
            language_status="ko",
            classification="actionable_news",
        )
        ok, reason = validate_fact(fact)
        self.assertFalse(ok)
        self.assertEqual(reason, "label_content_mismatch")

    def test_false_consensus_pair_sharing_broad_tag_only_not_grouped(self) -> None:
        left = Fact(
            source_channel="chat_a",
            message_id=1,
            source_ts_kst="2026-04-22T12:00:00+09:00",
            entity="SK하이닉스",
            topic="semis",
            event_type="pricing",
            summary_ko="반도체: SK하이닉스 HBM 가격 인상 기대가 커졌다",
            confidence=0.85,
            evidence_span="SK하이닉스 HBM 가격 인상 기대",
            language_status="ko",
            classification="actionable_news",
        )
        right = Fact(
            source_channel="chat_b",
            message_id=2,
            source_ts_kst="2026-04-22T12:01:00+09:00",
            entity="TSMC",
            topic="semis",
            event_type="policy",
            summary_ko="반도체: TSMC 미국 공장 규제 완화 기대가 나왔다",
            confidence=0.83,
            evidence_span="TSMC 미국 공장 규제 완화 기대",
            language_status="ko",
            classification="actionable_news",
        )
        ranked = rank_fact_groups([left, right])
        self.assertEqual(len(ranked), 2)
        self.assertTrue(all(not item.consensus for item in ranked))

    def test_actionable_filing_vs_utility_roundup_classification(self) -> None:
        utility = self.make_msg(
            "2026년 1분기 실적발표 일정 - 결산실적예고 공시를 바탕으로 작성되었습니다.",
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            message_id=10,
        )
        filing = self.make_msg(
            "단일판매·공급계약 체결. 820억 원 규모 수주 공시.",
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            message_id=11,
        )
        self.assertEqual(classify_message(utility), MessageLabel.UTILITY_ROUNDUP)
        self.assertEqual(classify_message(filing), MessageLabel.UTILITY_ACTIONABLE_FILING)

    def test_utility_actionable_filing_extracts_sentence_from_structured_blob(self) -> None:
        filing = self.make_msg(
            "2026.04.22 09:04:58 기업명: HJ중공업(시가총액: 2조 5,599억) A097230 보고서명: 단일판매ㆍ공급계약체결 계약상대 : 한국토지주택공사 계약내용 : ( 공사수주 ) 남양주왕숙2 A-6BL 및 A-7BL 통합형 민간참여 공공주택 건설사업 계약금액 : 682억 계약시작 : 2026-04-21 계약종료 : 2029-04-30 계약기간 : 3년 매출대비 : 3.41%",
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            message_id=12,
        )
        facts = extract_facts_from_message(filing, MessageLabel.UTILITY_ACTIONABLE_FILING)
        self.assertTrue(facts)
        self.assertIn("HJ중공업", facts[0].summary_ko)
        self.assertIn("682억", facts[0].summary_ko)
        ok, reason = validate_fact(facts[0])
        self.assertTrue(ok, reason)

    def test_importance_can_override_previous_insufficient_evidence_filter(self) -> None:
        fact = Fact(
            source_channel="chat_a",
            message_id=99,
            source_ts_kst="2026-04-22T12:00:00+09:00",
            entity="삼성전자",
            topic="semis",
            event_type="update",
            summary_ko="삼성전자 HBM5E용 7세대 D램 공정 양산 계획 철회",
            confidence=0.82,
            evidence_span="삼성전자 HBM5E용 7세대 D램 공정 양산 계획 철회",
            language_status="ko",
            classification="actionable_news",
        )
        ok, reason = validate_fact(fact)
        self.assertTrue(ok, reason)

    def test_positive_same_story_cross_channel_consensus_case(self) -> None:
        a = self.make_msg(
            "SK하이닉스 HBM 가격이 오르고 주요 고객향 물량이 늘어 2분기 영업이익 추정치가 상향됐다",
            chat="채널 A",
            chat_slug="chat_a",
            message_id=21,
        )
        b = self.make_msg(
            "SK하이닉스 HBM 가격 상승과 고객사 물량 확대가 겹치며 2분기 이익 추정치 상향이 이어졌다",
            chat="채널 B",
            chat_slug="chat_b",
            message_id=22,
        )
        facts = extract_facts_from_message(a, MessageLabel.ACTIONABLE_NEWS) + extract_facts_from_message(b, MessageLabel.ACTIONABLE_NEWS)
        ranked = rank_fact_groups(facts)
        self.assertTrue(ranked)
        self.assertTrue(ranked[0].consensus)
        self.assertGreaterEqual(ranked[0].chat_count, 2)

    def test_mixed_language_broker_note_keeps_first_clean_actionable_sentence(self) -> None:
        msg = self.make_msg(
            "* 중국석화 자회사는 화요일 종가대비 -3.8% 낮은 가격으로 CATL 홍콩주식 매각. 이를 통해 7.6억달러 회수. 남은 지분은 90일 동안 보유 약속 报道：中石化折价出售宁德时代H股，套现金额超7.6亿美元",
            chat="한투증권 중국/신흥국 정정영",
            chat_slug="한투증권_중국_신흥국_정정영__1250493882",
            message_id=30,
        )
        facts = extract_facts_from_message(msg, MessageLabel.BROKER_NOTE_ACTIONABLE)
        self.assertTrue(facts)
        self.assertIn("CATL", facts[0].summary_ko)
        self.assertIn("3.8%", facts[0].summary_ko)
        self.assertNotIn("报道", facts[0].summary_ko)
        ok, reason = validate_fact(facts[0])
        self.assertTrue(ok, reason)

    def test_strategy_opinion_prose_does_not_survive_extraction(self) -> None:
        msg = self.make_msg(
            "우리는 투자자들이 미국 주식 포트폴리오를 광범위한 경제 성장에 연동된 종목보다는, 전력 인프라 투자와 연관된 기업처럼 독자적인 실적 성장 동력을 보유하고 AI disruption 리스크가 제한적인 구조적 성장주 쪽으로 비중을 기울여야 한다고 판단합니다 골드만",
            chat="시장 이야기 by 제이슨",
            chat_slug="시장_이야기_by_제이슨__1192351807",
            message_id=31,
        )
        self.assertEqual(extract_facts_from_message(msg, MessageLabel.ACTIONABLE_NEWS), [])

    def test_headline_fragment_broker_note_can_be_shaped_into_publishable_sentence(self) -> None:
        msg = self.make_msg(
            "* BHP: 중국광산자원그룹(CMRG)과 철광석 계약 합의 必和必拓宣布：已与中国矿产资源集团达成铁矿石销售协议",
            chat="한투증권 중국/신흥국 정정영",
            chat_slug="한투증권_중국_신흥국_정정영__1250493882",
            message_id=32,
        )
        facts = extract_facts_from_message(msg, MessageLabel.BROKER_NOTE_ACTIONABLE)
        self.assertTrue(facts)
        self.assertIn("BHP", facts[0].summary_ko)
        self.assertIn("철광석 계약", facts[0].summary_ko)
        ok, reason = validate_fact(facts[0])
        self.assertTrue(ok, reason)

    def test_single_source_bullet_reads_like_investor_note(self) -> None:
        filing = self.make_msg(
            "2026.04.22 09:04:58 기업명: HJ중공업(시가총액: 2조 5,599억) A097230 보고서명: 단일판매ㆍ공급계약체결 계약상대 : 한국토지주택공사 계약내용 : ( 공사수주 ) 남양주왕숙2 A-6BL 및 A-7BL 통합형 민간참여 공공주택 건설사업 계약금액 : 682억 계약시작 : 2026-04-21 계약종료 : 2029-04-30 계약기간 : 3년 매출대비 : 3.41%",
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            message_id=33,
        )
        facts = extract_facts_from_message(filing, MessageLabel.UTILITY_ACTIONABLE_FILING)
        ranked = rank_fact_groups(facts)
        bullets = gbv2.compose_top_bullets(ranked, limit=1)
        self.assertEqual(len(bullets), 1)
        self.assertIn("HJ중공업", bullets[0])
        self.assertNotIn("핵심 수치는", bullets[0])
        self.assertNotIn("단독 확인된 재료이다", bullets[0])
        self.assertNotIn("보고서명", bullets[0])


if __name__ == "__main__":
    unittest.main()
