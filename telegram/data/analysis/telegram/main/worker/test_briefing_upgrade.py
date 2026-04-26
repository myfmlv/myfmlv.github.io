#!/usr/bin/env python3
from __future__ import annotations

import importlib
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

WORKER_DIR = Path(__file__).resolve().parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))


class ScheduleUpgradeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.gb = self.reload_generate_briefing()

    def reload_generate_briefing(self, extra_env: dict[str, str] | None = None):
        sys.modules.pop("generate_briefing", None)
        env_patch = patch.dict(os.environ, extra_env or {}, clear=False)
        env_patch.start()
        self.addCleanup(env_patch.stop)
        import generate_briefing  # noqa: F401
        return importlib.reload(sys.modules["generate_briefing"])

    def make_msg(
        self,
        *,
        chat: str = "테스트 채널",
        chat_slug: str = "test_channel",
        text: str,
        views: int = 0,
        message_id: int = 1,
        source_message_count: int = 1,
        topic_tags: tuple[str, ...] = ("geopolitics",),
    ):
        now = datetime(2026, 4, 21, 12, 0, tzinfo=self.gb.KST)
        return self.gb.Msg(
            ts=now,
            ts_end=now,
            chat=chat,
            chat_slug=chat_slug,
            text=text,
            views=views,
            urls=(),
            message_id=message_id,
            message_id_end=message_id,
            source_message_ids=(message_id,),
            source_message_count=source_message_count,
            topic_tags=topic_tags,
        )

    def test_requested_windows_follow_custom_schedule_without_overlap(self) -> None:
        base = datetime(2026, 4, 21, 12, 45, tzinfo=self.gb.KST)
        windows = self.gb.requested_windows_for_date(base, ["08:20", "12:40", "17:10"])
        self.assertEqual([window.slot for window in windows], ["08:20", "12:40", "17:10"])
        self.assertEqual(windows[0].start.strftime("%Y-%m-%d %H:%M"), "2026-04-20 17:10")
        self.assertEqual(windows[0].end.strftime("%Y-%m-%d %H:%M"), "2026-04-21 08:20")
        self.assertEqual(windows[1].start, windows[0].end)
        self.assertEqual(windows[2].start, windows[1].end)

    def test_resolve_briefing_window_respects_runtime_schedule(self) -> None:
        now_kst = datetime(2026, 4, 21, 12, 45, tzinfo=self.gb.KST)
        window = self.gb.resolve_briefing_window(now_kst, ["08:20", "12:40", "17:10"])
        self.assertEqual(window.slot, "12:40")
        self.assertEqual(window.start.strftime("%H:%M"), "08:20")
        self.assertEqual(window.end.strftime("%H:%M"), "12:40")

    def test_render_final_markdown_uses_three_section_structure_for_all_slots(self) -> None:
        payload = {
            "regime": ["체제 변화 1", "체제 변화 2"],
            "judgement": ["판단 1"],
            "watch": ["KRW", "유가", "금리"],
        }
        for hour, minute, expected_title in (
            (8, 25, "# 텔레그램 프리오픈 브리핑"),
            (12, 45, "# 텔레그램 미드데이 펄스"),
            (17, 15, "# 텔레그램 클로즈 랩"),
        ):
            with self.subTest(slot=f"{hour:02d}:{minute:02d}"):
                now_kst = datetime(2026, 4, 21, hour, minute, tzinfo=self.gb.KST)
                window = self.gb.resolve_briefing_window(now_kst, ["08:20", "12:40", "17:10"])
                markdown = self.gb.render_final_markdown(now_kst, window, payload)
                self.assertIn(expected_title, markdown)
                self.assertIn("## 체제 변화", markdown)
                self.assertIn("## 우리 판단", markdown)
                self.assertIn("## 체크할 숫자 3개", markdown)
                self.assertNotIn("## 테마 및 이슈", markdown)

    def test_render_rule_based_markdown_uses_source_first_structure(self) -> None:
        now_kst = datetime(2026, 4, 21, 8, 25, tzinfo=self.gb.KST)
        window = self.gb.resolve_briefing_window(now_kst, ["08:20", "12:40", "17:10"])
        markdown = self.gb.build_markdown(
            now_kst,
            window,
            theme_items=[{"label": "반도체", "score": 10, "message": self.make_msg(text="메모리 가격 상승과 목표가 상향", topic_tags=("semis", "earnings"))}],
            common_signals=[],
            outliers=[],
            snap={"WTI": "87.75", "US_10Y": "4.30", "USDKRW_NDF_1M": "1469.3"},
            state={"energy_stress": True, "fx_stress": True, "rate_stress": True},
        )
        self.assertIn("## 지금 중요한 것", markdown)
        self.assertIn("## 해석과 우선순위", markdown)
        self.assertIn("## 우리 판단", markdown)
        self.assertIn("## 체크할 숫자 3개", markdown)

    def test_normalize_report_text_strips_forwarding_noise(self) -> None:
        raw = ">> [속보] 2026.04.21 [메리츠 Tech 김선우] 오늘의 주요 뉴스 - https://example.com LGD 공급망 확인..."
        cleaned = self.gb.normalize_report_text(raw)
        self.assertNotIn(">>", cleaned)
        self.assertNotIn("[속보]", cleaned)
        self.assertNotIn("https://example.com", cleaned)
        self.assertNotIn("오늘의 주요 뉴스", cleaned)
        self.assertNotIn("...", cleaned)

    def test_infer_topics_avoids_false_semis_match_from_jcpoa(self) -> None:
        text = "트럼프 대통령이 또 다른 JCPOA에 서명할 수도 있고 안 할 수도 있습니다. 전쟁이 재개될 수도 있습니다."
        topics = self.gb.infer_topics(text)
        self.assertIn("geopolitics", topics)
        self.assertNotIn("semis", topics)

    def test_rough_score_prefers_actionable_detail_over_ambiguous_commentary(self) -> None:
        state = {"energy_stress": True, "fx_stress": True, "rate_stress": True}
        shared_topics = self.gb.Counter({"geopolitics": 2, "earnings": 2, "semis": 2})
        actionable = self.make_msg(
            chat="시장 이야기 by 제이슨",
            chat_slug="시장_이야기_by_제이슨__1192351807",
            text="LG에너지솔루션 2.06조 원 계약 공식 확인, 2026년 영업이익 2% 상향, 목표가 51만원",
            views=900,
            message_id=11,
            topic_tags=("earnings", "semis"),
        )
        ambiguous = self.make_msg(
            chat="트릴리온",
            chat_slug="트릴리온__3402415038",
            text="협상이 열릴 수도 있고 안 열릴 수도 있습니다. 전쟁이 재개될 수도 있고 안 될 수도 있습니다. ㅋㅋ",
            views=900,
            message_id=12,
            topic_tags=("geopolitics", "trade"),
        )
        actionable_score = self.gb.rough_score(actionable, state, shared_topics)
        ambiguous_score = self.gb.rough_score(ambiguous, state, shared_topics)
        self.assertGreater(actionable_score, ambiguous_score)

    def test_build_signal_relabels_common_signal_to_primary_topic_when_more_source_faithful(self) -> None:
        state = {"energy_stress": True, "fx_stress": False, "rate_stress": True}
        shared_topics = self.gb.Counter({"geopolitics": 4, "semis": 3, "earnings": 2})
        message = self.make_msg(
            chat="한투증권 중국/신흥국 정정영",
            chat_slug="한투증권_중국_신흥국_정정영__1250493882",
            text="나우라는 세정 장비 경쟁력 보강과 공급망 내재화를 서두르고 있다. 미국 대중 반도체 제재가 부담이지만 중장기적으로 자국 장비 채택이 빨라질 수 있다.",
            views=300,
            message_id=21,
            topic_tags=("semis", "geopolitics"),
        )
        signal = self.gb.build_signal("geopolitics", [message], state, shared_topics, {}, "common")
        self.assertEqual(signal["tag"], "semis")
        self.assertEqual(signal["label"], "반도체")

    def test_build_signal_focus_lines_prefers_actionable_growth_over_second_risk_bullet(self) -> None:
        now = datetime(2026, 4, 21, 12, 0, tzinfo=self.gb.KST)
        semis_mna = self.gb.Msg(
            ts=now,
            ts_end=now,
            chat="한투증권 중국/신흥국 정정영",
            chat_slug="한투증권_중국_신흥국_정정영__1250493882",
            text="나우라는 인수합병을 통해 공정 생태계 통합에 나서고 있다. 세정 장비 경쟁력 보강과 공급망 구축을 서두르고 있다.",
            views=250,
            urls=(),
            message_id=31,
            message_id_end=31,
            source_message_ids=(31,),
            source_message_count=1,
            topic_tags=("semis",),
        )
        semis_price = self.gb.Msg(
            ts=now,
            ts_end=now,
            chat="하나 중국/신흥국 전략 김경환",
            chat_slug="하나_중국_신흥국_전략_김경환__1306052516",
            text="MLC NAND 공급 부족 심화. 2분기 NAND·NOR 가격 최대 +100% 상승 가능. EMIB-T 관련 매출 50% 이상 성장 가능.",
            views=200,
            urls=(),
            message_id=32,
            message_id_end=32,
            source_message_ids=(32,),
            source_message_count=1,
            topic_tags=("semis", "earnings"),
        )
        geopolitics = self.gb.Msg(
            ts=now,
            ts_end=now,
            chat="에테르의 일본&미국 리서치",
            chat_slug="에테르의_일본_미국_리서치__1909745040",
            text="미국 해군은 이란 항구 봉쇄를 계속할 것입니다. 제재 대상 선박도 확대될 수 있습니다.",
            views=400,
            urls=(),
            message_id=33,
            message_id_end=33,
            source_message_ids=(33,),
            source_message_count=1,
            topic_tags=("geopolitics", "shipping", "trade"),
        )
        trade = self.gb.Msg(
            ts=now,
            ts_end=now,
            chat="에테르의 일본&미국 리서치",
            chat_slug="에테르의_일본_미국_리서치__1909745040",
            text="트럼프: 아마존, 애플이 관세 환급을 청구하지 않는다면 훌륭할 것이라고 발언.",
            views=380,
            urls=(),
            message_id=34,
            message_id_end=34,
            source_message_ids=(34,),
            source_message_count=1,
            topic_tags=("trade",),
        )
        themes = [
            {"label": "반도체", "score": 21, "message": semis_mna},
            {"label": "반도체", "score": 15, "message": semis_price},
            {"label": "지정학", "score": 16, "message": geopolitics},
            {"label": "무역", "score": 14, "message": trade},
        ]
        lines = self.gb.build_signal_focus_lines(themes, [], [])
        self.assertTrue(any("NAND·NOR 가격 최대 +100% 상승 가능" in line for line in lines))
        risk_lines = [line for line in lines if line.startswith("지정학:") or line.startswith("무역:")]
        self.assertLessEqual(len(risk_lines), 1)

    def test_dedupe_within_chat_keeps_better_variant(self) -> None:
        short = self.make_msg(text="이란 외교부: 미국과 추가 협상 계획 없음", views=12, message_id=1)
        better = self.make_msg(text=">>이란 외교부: 미국과 추가 협상 계획 없음", views=200, message_id=2)
        deduped = self.gb.dedupe_within_chat([short, better])
        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0].message_id, 1)

    def test_build_theme_items_collapses_same_story_across_paths(self) -> None:
        first = self.make_msg(text="이란은 미국과 협상 지속하기로 결정", message_id=1)
        second = self.make_msg(text="이란 외교부: 미국과의 2차 협상 계획은 없음", message_id=2)
        third = self.make_msg(text="[속보] 이란 측 미국의 긍정 신호 있으면 대표단 파견", message_id=3)
        common_signals = [{"message": first, "label": "지정학", "score": 10, "chat_count": 2}]
        outliers = [{"message": second, "label": "지정학", "score": 9}]
        channel_insights = [{"highlights": [{"message": third, "score": 8}]}]
        items = self.gb.build_theme_items(common_signals, outliers, channel_insights)
        self.assertEqual(len(items), 1)

    def test_pick_outliers_can_stop_at_two_when_incremental_signal_is_weak_and_redundant(self) -> None:
        scores = {1: 16, 2: 15, 3: 10, 4: 5}
        messages = [
            self.make_msg(chat="반도체A", chat_slug="semis_a", text="NAND 가격 상승과 공급 부족", views=400, message_id=1, topic_tags=("semis",)),
            self.make_msg(chat="실적A", chat_slug="earnings_a", text="이익 추정 상향과 목표가 상향", views=380, message_id=2, topic_tags=("earnings",)),
            self.make_msg(chat="반도체B", chat_slug="semis_b", text="반도체 SOCAMM 양산 개시와 전력 효율 개선", views=360, message_id=3, topic_tags=("semis",)),
            self.make_msg(chat="기타A", chat_slug="other_a", text="불확실한 코멘트", views=100, message_id=4, topic_tags=("policy",)),
        ]
        with patch.object(self.gb, "judge_message", side_effect=lambda item, *_: (scores[item.message_id], ["test score"])):
            outliers = self.gb.pick_outliers(messages, set(), {"energy_stress": False, "fx_stress": False, "rate_stress": False}, self.gb.Counter(), {})
        self.assertEqual([item["message"].message_id for item in outliers], [1, 2])

    def test_pick_outliers_can_expand_to_four_when_high_scoring_candidates_add_new_coverage(self) -> None:
        scores = {11: 17, 12: 16, 13: 14, 14: 14}
        messages = [
            self.make_msg(chat="반도체A", chat_slug="semis_a", text="NAND 가격 급등과 공급 부족 심화", views=500, message_id=11, topic_tags=("semis",)),
            self.make_msg(chat="실적A", chat_slug="earnings_a", text="영업이익 전망 상향과 계약 확대", views=480, message_id=12, topic_tags=("earnings",)),
            self.make_msg(chat="무역A", chat_slug="trade_a", text="관세 유지 발언과 교역 압박 확대", views=460, message_id=13, topic_tags=("trade",)),
            self.make_msg(chat="정책A", chat_slug="policy_a", text="정책 프레임워크 개편과 규제 변화 시사", views=440, message_id=14, topic_tags=("policy",)),
        ]
        with patch.object(self.gb, "judge_message", side_effect=lambda item, *_: (scores[item.message_id], ["test score"])):
            outliers = self.gb.pick_outliers(messages, set(), {"energy_stress": False, "fx_stress": False, "rate_stress": False}, self.gb.Counter(), {})
        self.assertEqual([item["message"].message_id for item in outliers], [11, 12, 13, 14])

    def test_pick_outliers_blocks_fourth_slot_when_it_only_repeats_existing_theme(self) -> None:
        scores = {21: 17, 22: 16, 23: 14, 24: 14}
        messages = [
            self.make_msg(chat="반도체A", chat_slug="semis_a", text="NAND 가격 급등과 공급 부족 심화", views=500, message_id=21, topic_tags=("semis",)),
            self.make_msg(chat="실적A", chat_slug="earnings_a", text="영업이익 전망 상향과 계약 확대", views=480, message_id=22, topic_tags=("earnings",)),
            self.make_msg(chat="무역A", chat_slug="trade_a", text="관세 유지 발언과 교역 압박 확대", views=460, message_id=23, topic_tags=("trade",)),
            self.make_msg(chat="반도체B", chat_slug="semis_b", text="반도체 SOCAMM 양산 개시와 전력 효율 개선", views=450, message_id=24, topic_tags=("semis",)),
        ]
        with patch.object(self.gb, "judge_message", side_effect=lambda item, *_: (scores[item.message_id], ["test score"])):
            outliers = self.gb.pick_outliers(messages, set(), {"energy_stress": False, "fx_stress": False, "rate_stress": False}, self.gb.Counter(), {})
        self.assertEqual([item["message"].message_id for item in outliers], [21, 22, 23])

    def test_pick_outliers_blocks_fourth_slot_when_score_gap_exposes_a_weak_addition(self) -> None:
        scores = {31: 17, 32: 15, 33: 14, 34: 13}
        messages = [
            self.make_msg(chat="반도체A", chat_slug="semis_a", text="NAND 가격 급등과 공급 부족 심화", views=520, message_id=31, topic_tags=("semis",)),
            self.make_msg(chat="실적A", chat_slug="earnings_a", text="영업이익 전망 상향과 계약 확대", views=500, message_id=32, topic_tags=("earnings",)),
            self.make_msg(chat="무역A", chat_slug="trade_a", text="관세 유지 발언과 교역 압박 확대", views=480, message_id=33, topic_tags=("trade",)),
            self.make_msg(chat="지정학A", chat_slug="geo_a", text="이란 전쟁으로 카렉스 20-30% 가격 인상 통지", views=220, message_id=34, topic_tags=("geopolitics",)),
        ]
        shared_topics = self.gb.Counter({"geopolitics": 4, "trade": 2})
        with patch.object(self.gb, "judge_message", side_effect=lambda item, *_: (scores[item.message_id], ["test score"])):
            outliers = self.gb.pick_outliers(messages, set(), {"energy_stress": False, "fx_stress": False, "rate_stress": False}, shared_topics, {})
        self.assertEqual([item["message"].message_id for item in outliers], [31, 32, 33])

    def test_pick_outliers_blocks_third_slot_when_diversity_bonus_cannot_close_a_large_score_gap(self) -> None:
        scores = {41: 17, 42: 16, 43: 11}
        messages = [
            self.make_msg(chat="반도체A", chat_slug="semis_a", text="NAND 가격 급등과 공급 부족 심화", views=520, message_id=41, topic_tags=("semis",)),
            self.make_msg(chat="실적A", chat_slug="earnings_a", text="영업이익 전망 상향과 계약 확대", views=500, message_id=42, topic_tags=("earnings",)),
            self.make_msg(chat="정책A", chat_slug="policy_a", text="규제 프레임워크 재설계 가능성 시사", views=460, message_id=43, topic_tags=("policy",)),
        ]
        shared_topics = self.gb.Counter({"policy": 4})
        with patch.object(self.gb, "judge_message", side_effect=lambda item, *_: (scores[item.message_id], ["test score"])):
            outliers = self.gb.pick_outliers(messages, set(), {"energy_stress": False, "fx_stress": False, "rate_stress": False}, shared_topics, {})
        self.assertEqual([item["message"].message_id for item in outliers], [41, 42])

    def test_build_theme_items_excludes_generic_utility_roundups(self) -> None:
        utility = self.make_msg(
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            text="📊 2025년 4분기 어닝 서프라이즈 종목 현황 - 현재까지 발표된 어닝서프라이즈 종목 현황입니다.",
            message_id=10,
            topic_tags=("earnings",),
        )
        actionable = self.make_msg(
            chat="시장 이야기 by 제이슨",
            chat_slug="시장_이야기_by_제이슨__1192351807",
            text="LG에너지솔루션 2.06조 원 공급 계약 공식 확인, 2026년 영업이익 2% 상향",
            message_id=11,
            topic_tags=("earnings",),
        )
        items = self.gb.build_theme_items([], [], [{"highlights": [{"message": utility, "score": 9}]}, {"highlights": [{"message": actionable, "score": 8}]}])
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["message"].message_id, 11)

    def test_build_theme_items_excludes_generic_utility_earnings_lists_without_spacing(self) -> None:
        utility = self.make_msg(
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            text="🔴 어닝서프라이즈 리스트(2026년 4월 21일기준) - 영업익 기준으로 선정(컨센대비 +10%)",
            message_id=14,
            topic_tags=("earnings",),
        )
        items = self.gb.build_theme_items([], [], [{"highlights": [{"message": utility, "score": 9}]}])
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["label"], "기타")
        self.assertEqual(items[0]["message"].chat, "시스템")

    def test_build_analyst_memo_lines_skip_generic_utility_roundups(self) -> None:
        utility = self.make_msg(
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            text="2026년 1분기 실적발표 일정 - '결산실적예고' 공시를 바탕으로 작성되었습니다.",
            message_id=12,
            topic_tags=("earnings",),
        )
        actionable = self.make_msg(
            chat="하나 중국/신흥국 전략 김경환",
            chat_slug="하나_중국_신흥국_전략_김경환__1306052516",
            text="MLC NAND 공급 부족 심화. 2분기 NAND·NOR 가격 최대 +100% 상승 가능.",
            message_id=13,
            topic_tags=("semis", "earnings"),
        )
        lines = self.gb.build_analyst_memo_lines(
            [
                {
                    "chat": "AWAKE - 실시간 주식 공시 정리채널",
                    "desk_role": "실적 데스크",
                    "top_topics": ["실적"],
                    "highlights": [{"message": utility, "score": 9}],
                },
                {
                    "chat": "하나 중국/신흥국 전략 김경환",
                    "desk_role": "반도체 데스크",
                    "top_topics": ["반도체", "실적"],
                    "highlights": [{"message": actionable, "score": 8}],
                },
            ]
        )
        self.assertEqual(len(lines), 1)
        self.assertIn("NAND·NOR 가격 최대 +100% 상승 가능", lines[0])
        self.assertNotIn("AWAKE", lines[0])
        self.assertNotIn("담당 범위=", lines[0])
        self.assertNotIn("데스크", lines[0])

    def test_build_analyst_memo_lines_falls_back_to_non_utility_highlight(self) -> None:
        utility = self.make_msg(
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            text="🔴 어닝서프라이즈 리스트(2026년 4월 21일기준) - 영업익 기준으로 선정(컨센대비 +10%)",
            message_id=15,
            topic_tags=("earnings",),
        )
        actionable = self.make_msg(
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            text="단일판매·공급계약 체결. 820억 원 규모 수주 공시.",
            message_id=16,
            topic_tags=("earnings",),
        )
        lines = self.gb.build_analyst_memo_lines(
            [
                {
                    "chat": "AWAKE - 실시간 주식 공시 정리채널",
                    "desk_role": "실적 데스크",
                    "top_topics": ["실적"],
                    "highlights": [
                        {"message": utility, "score": 9},
                        {"message": actionable, "score": 8},
                    ],
                }
            ]
        )
        self.assertEqual(lines, ["AWAKE - 실시간 주식 공시 정리채널: 820억 원 규모 수주 공시"])

    def test_pick_channel_insights_skips_utility_only_roundup_channel(self) -> None:
        state = {"energy_stress": False, "fx_stress": False, "rate_stress": False}
        shared_topics = self.gb.Counter({"earnings": 1})
        utility = self.make_msg(
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            text="🔴 어닝서프라이즈 리스트(2026년 4월 21일기준) - 영업익 기준으로 선정(컨센대비 +10%)",
            message_id=17,
            topic_tags=("earnings",),
        )
        insights = self.gb.pick_channel_insights({utility.chat: [utility]}, state, shared_topics, {})
        self.assertEqual(insights, [])

    def test_build_context_payload_excludes_utility_channel_insights(self) -> None:
        now = datetime(2026, 4, 21, 8, 25, tzinfo=self.gb.KST)
        window = self.gb.BriefingWindow(
            slot="08:20",
            start=datetime(2026, 4, 20, 17, 10, tzinfo=self.gb.KST),
            end=datetime(2026, 4, 21, 8, 20, tzinfo=self.gb.KST),
        )
        utility = self.make_msg(
            chat="AWAKE - 실시간 주식 공시 정리채널",
            chat_slug="awake_실시간_주식_공시_정리채널__1066938528",
            text="단일판매·공급계약 체결. 820억 원 규모 수주 공시.",
            message_id=18,
            topic_tags=("earnings",),
        )
        core = self.make_msg(
            chat="시장 이야기 by 제이슨",
            chat_slug="시장_이야기_by_제이슨__1192351807",
            text="LG에너지솔루션 2.06조 원 공급 계약 공식 확인, 2026년 영업이익 2% 상향",
            message_id=19,
            topic_tags=("earnings",),
        )
        context = self.gb.build_context_payload(
            now,
            window,
            [{"label": "실적", "chat": core.chat, "text": core.text, "score": 10, "message": core}],
            [],
            [],
            [
                {"chat": utility.chat, "chat_slug": utility.chat_slug, "desk_role": "실적 데스크", "message_count": 1, "top_topics": ["실적"], "analyst_score": 8, "evidence_backed_highlights": 0, "highlights": [{"message": utility, "score": 8, "reasons": []}]},
                {"chat": core.chat, "chat_slug": core.chat_slug, "desk_role": "실적 데스크", "message_count": 1, "top_topics": ["실적"], "analyst_score": 10, "evidence_backed_highlights": 0, "highlights": [{"message": core, "score": 10, "reasons": []}]},
            ],
            {"WTI": "87.75", "US_10Y": "4.30", "USDKRW_NDF_1M": "1469.3"},
            {"energy_stress": True, "fx_stress": True, "rate_stress": True},
            {},
            None,
        )
        self.assertEqual(context["channel_insights_total"], 1)
        self.assertEqual(len(context["channel_insights"]), 1)
        self.assertEqual(context["channel_insights"][0]["chat"], core.chat)
        self.assertEqual(context["analyst_memos"], ["시장 이야기 by 제이슨: LG에너지솔루션 2.06조 원 공급 계약 공식 확인, 2026년 영업이익 2% 상향"])

    def test_build_signal_prefers_message_aligned_with_requested_tag(self) -> None:
        state = {"energy_stress": True, "fx_stress": False, "rate_stress": True}
        shared_topics = self.gb.Counter({"geopolitics": 2, "semis": 2})
        evidence_map = {}
        semis_heavy = self.make_msg(
            chat="한투증권 중국/신흥국 정정영",
            chat_slug="한투증권_중국_신흥국_정정영__1250493882",
            text="나우라는 킹세미 인수로 세정 장비 경쟁력을 보강했고 미국 대중 반도체 제재에도 자국 장비 채택이 빨라진다",
            views=300,
            message_id=21,
            topic_tags=("semis", "geopolitics"),
        )
        geopolitics_core = self.make_msg(
            chat="에테르의 일본&미국 리서치",
            chat_slug="에테르의_일본_미국_리서치__1909745040",
            text="미 재무부장관 베센트: 미국 해군은 이란 항구 봉쇄를 계속할 것이며 제재를 강화할 것",
            views=250,
            message_id=22,
            topic_tags=("geopolitics", "trade"),
        )
        signal = self.gb.build_signal("geopolitics", [semis_heavy, geopolitics_core], state, shared_topics, evidence_map, "common")
        self.assertIsNotNone(signal)
        self.assertEqual(signal["message"].message_id, 22)

    def test_same_story_text_requires_more_than_broad_sector_overlap(self) -> None:
        left = "모건스탠리: NAND와 NOR 가격이 2분기 최대 +100% 상승 가능"
        right = "Digitimes) 삼성 HBM4 수율 향상과 PMBIST 업그레이드가 엔비디아의 찬사를 받음"
        self.assertFalse(self.gb.same_story_text(left, right))

    def test_pick_common_signals_avoids_fake_consensus_for_unrelated_sector_posts(self) -> None:
        state = {"energy_stress": True, "fx_stress": False, "rate_stress": True}
        shared_topics = self.gb.Counter({"semis": 3})
        messages_by_chat = {
            "하나 중국/신흥국 전략 김경환": [
                self.make_msg(
                    chat="하나 중국/신흥국 전략 김경환",
                    chat_slug="하나_중국_신흥국_전략_김경환__1306052516",
                    text="모건스탠리: NAND와 NOR 가격이 2분기 최대 +100% 상승 가능",
                    views=220,
                    message_id=51,
                    topic_tags=("semis", "earnings"),
                )
            ],
            "에테르의 일본&미국 리서치": [
                self.make_msg(
                    chat="에테르의 일본&미국 리서치",
                    chat_slug="에테르의_일본_미국_리서치__1909745040",
                    text="Digitimes) 삼성 HBM4 수율 향상과 PMBIST 업그레이드가 엔비디아의 찬사를 받음",
                    views=210,
                    message_id=52,
                    topic_tags=("semis",),
                )
            ],
            "한투증권 중국/신흥국 정정영": [
                self.make_msg(
                    chat="한투증권 중국/신흥국 정정영",
                    chat_slug="한투증권_중국_신흥국_정정영__1250493882",
                    text="나우라는 킹세미 인수로 세정 장비 경쟁력을 보강하고 중국 장비 내재화를 서두름",
                    views=205,
                    message_id=53,
                    topic_tags=("semis",),
                )
            ],
        }
        signals = self.gb.pick_common_signals(messages_by_chat, state, shared_topics, {})
        self.assertEqual(signals, [])

    def test_pick_common_signals_recovers_broad_macro_theme_without_story_match(self) -> None:
        state = {"energy_stress": True, "fx_stress": True, "rate_stress": True}
        shared_topics = self.gb.Counter({"geopolitics": 2, "shipping": 2})
        messages_by_chat = {
            "시장 이야기 by 제이슨": [
                self.make_msg(
                    chat="시장 이야기 by 제이슨",
                    chat_slug="시장_이야기_by_제이슨__1192351807",
                    text="중동 리스크는 협상 headline보다 유가와 통항 변수로 번역되는 구간입니다. 호르무즈 운항 차질을 먼저 봐야 합니다.",
                    views=450,
                    message_id=61,
                    topic_tags=("geopolitics", "shipping", "energy"),
                )
            ],
            "에테르의 일본&미국 리서치": [
                self.make_msg(
                    chat="에테르의 일본&미국 리서치",
                    chat_slug="에테르의_일본_미국_리서치__1909745040",
                    text="미 재무부장관 베센트: 미국 해군은 이란 항구 봉쇄를 계속할 것이며 제재 대상 선박도 확대될 수 있음",
                    views=380,
                    message_id=62,
                    topic_tags=("geopolitics", "shipping", "trade"),
                )
            ],
        }
        signals = self.gb.pick_common_signals(messages_by_chat, state, shared_topics, {})
        self.assertEqual(len(signals), 1)
        self.assertEqual(signals[0]["tag"], "geopolitics")
        self.assertEqual(signals[0]["chat_count"], 2)
        self.assertEqual(signals[0]["message"].message_id, 62)

    def test_build_signal_focus_lines_prefers_actionable_investor_detail(self) -> None:
        actionable = {
            "label": "실적",
            "score": 14,
            "message": self.make_msg(
                text="LG에너지솔루션 계약 공식 확인. 2.06조 원 공급 계약 포함. 2026년 영업이익 2% 상향. 목표가 51만원",
                views=800,
                message_id=31,
                topic_tags=("earnings",),
            ),
        }
        narrative = {
            "label": "반도체",
            "score": 18,
            "message": self.make_msg(
                text="나우라는 인수합병을 통해 공정 생태계 통합에 나서고 있다. 세정 장비 경쟁력을 보강했고 공급망 구축을 서두르고 있다",
                views=500,
                message_id=32,
                topic_tags=("semis",),
            ),
        }
        lines = self.gb.build_signal_focus_lines([narrative, actionable], [], [])
        self.assertTrue(lines)
        self.assertTrue(lines[0].startswith("실적:"))
        self.assertIn("영업이익 2% 상향", lines[0])

    def test_build_signal_focus_lines_removes_section_heading_wrapper_from_earnings_bullet(self) -> None:
        wrapped = {
            "label": "실적",
            "score": 15,
            "message": self.make_msg(
                text=(
                    "LG에너지솔루션 제이피모건 1. 주가 급등 배경 (4월 21일 기준 +13.0%) 📈 계약 공식 확인: 메르세데스-벤츠의 LFP 배터리 공급업체 선정 확인. "
                    "2. 메르세데스-벤츠와의 파트너십 상세 🤝 LFP 배터리 공급: LGES와의 2.06조 원 규모 계약에 LFP 배터리 공급 포함 공식 인정. "
                    "3. 향후 전망 및 투자 의견 🚀 2026년과 2027년 영업이익 전망치를 각각 2%, 1% 상향 조정했습니다. 목표가 상향 : 51만원 기존 45만 투자 의견: 비중확대 유지."
                ),
                views=900,
                message_id=33,
                topic_tags=("earnings",),
            ),
        }
        lines = self.gb.build_signal_focus_lines([wrapped], [], [])
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0], "실적: 2026년과 2027년 영업이익 전망치를 각각 2%, 1% 상향 조정했습니다.")

    def test_build_signal_focus_lines_prefers_semis_price_signal_over_broker_pick_list(self) -> None:
        semis = {
            "label": "반도체",
            "score": 17,
            "message": self.make_msg(
                chat="하나 중국/신흥국 전략 김경환",
                chat_slug="하나_중국_신흥국_전략_김경환__1306052516",
                text=(
                    "• 모건스탠리: DDR4보다 MLC NAND와 NOR Flash를 더 유망하게 평가하며 최선호주로 Macronix(TP 202TWD), AP메모리(TP 777TWD)로 제시. "
                    "• 삼성, 키옥시아 축소 영향으로 MLC NAND 공급 부족 심화. 마크로닉스가 MLC NAND 확대하며 NOR 공급도 줄어 가격 상승. "
                    "이에 따라 2분기 NAND·NOR 가격 최대 +100% 상승 가능, 하반기도 강세 예상"
                ),
                views=300,
                message_id=35,
                topic_tags=("semis", "earnings"),
            ),
        }
        lines = self.gb.build_signal_focus_lines([semis], [], [])
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0], "반도체: 이에 따라 2분기 NAND·NOR 가격 최대 +100% 상승 가능, 하반기도 강세 예상")

    def test_build_analyst_memo_lines_prefers_operating_profit_revision_over_rating_boilerplate(self) -> None:
        wrapped = self.make_msg(
            chat="시장 이야기 by 제이슨",
            chat_slug="시장_이야기_by_제이슨__1192351807",
            text=(
                "LG에너지솔루션 제이피모건 1. 주가 급등 배경 📈 계약 공식 확인: 메르세데스-벤츠의 LFP 배터리 공급업체 선정 확인. "
                "3. 향후 전망 및 투자 의견 🚀 2026년과 2027년 영업이익 전망치를 각각 2%, 1% 상향 조정했습니다. 목표가 상향 : 51만원 기존 45만 투자 의견: 비중확대 유지."
            ),
            message_id=34,
            topic_tags=("earnings",),
        )
        lines = self.gb.build_analyst_memo_lines(
            [{"chat": wrapped.chat, "desk_role": "실적 데스크", "top_topics": ["실적"], "highlights": [{"message": wrapped, "score": 9}]}]
        )
        self.assertEqual(lines, ["시장 이야기 by 제이슨: 2026년과 2027년 영업이익 전망치를 각각 2%, 1% 상향 조정했습니다"])

    def test_build_regime_line_prefers_growth_when_growth_is_dominant(self) -> None:
        common_signals = [
            {"tag": "earnings", "label": "실적", "score": 14, "chat_count": 2, "message": self.make_msg(text="실적 상향", message_id=41, topic_tags=("earnings",))},
            {"tag": "semis", "label": "반도체", "score": 13, "chat_count": 2, "message": self.make_msg(text="HBM 가격 상승", message_id=42, topic_tags=("semis",))},
            {"tag": "geopolitics", "label": "지정학", "score": 10, "chat_count": 2, "message": self.make_msg(text="이란 제재", message_id=43, topic_tags=("geopolitics",))},
        ]
        theme_items = [
            {"label": "실적", "score": 14, "message": self.make_msg(text="영업이익 2% 상향", message_id=44, topic_tags=("earnings",))},
            {"label": "반도체", "score": 13, "message": self.make_msg(text="HBM 수요 지속", message_id=45, topic_tags=("semis",))},
            {"label": "지정학", "score": 10, "message": self.make_msg(text="중동 리스크", message_id=46, topic_tags=("geopolitics",))},
        ]
        state = {"energy_stress": True, "fx_stress": True, "rate_stress": True}
        line = self.gb.build_regime_line(common_signals, theme_items, {}, state)
        self.assertIn("반도체와 실적 재료", line)

    def test_validate_markdown_rejects_channel_leakage(self) -> None:
        markdown = "\n".join(
            [
                "# 텔레그램 미드데이 펄스",
                "- 기준 시각: 2026-04-21 12:40 KST",
                "- 집계 구간: 2026-04-21 08:20 KST ~ 2026-04-21 12:40 KST",
                "",
                "## 체제 변화",
                "- by 하나 중국/신흥국 전략 김경환",
                "",
                "## 우리 판단",
                "- headline보다 가격 확인이 중요하다.",
                "",
                "## 체크할 숫자 3개",
                "- WTI 88",
            ]
        )
        bundle = self.gb.ChannelBundle(
            chat="하나 중국/신흥국 전략 김경환",
            chat_slug="하나_중국_신흥국_전략_김경환__1306052516",
            messages=[],
            message_count=0,
            char_count=0,
            bundle_text="",
        )
        with self.assertRaises(RuntimeError):
            self.gb.validate_markdown(markdown, [{"label": "지정학"}], [bundle])

    def test_default_export_root_uses_flat_archives_path(self) -> None:
        gb = self.reload_generate_briefing({})
        self.assertEqual(gb.EXPORT_ROOT, gb.PROJECT_ROOT / "data" / "archives" / "export")

    def test_iter_messages_ignores_stale_normalized_when_slot_snapshot_is_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = Path(tmp_dir)
            analysis_root = project_root / "data" / "analysis" / "telegram" / "main"
            normalized_dir = analysis_root / "normalized"
            normalized_dir.mkdir(parents=True, exist_ok=True)
            export_root = project_root / "data" / "archives" / "telegram" / "main" / "export"
            slot_dir = export_root / "slot_snapshots" / "2026-04-21" / "1710"
            slot_dir.mkdir(parents=True, exist_ok=True)

            stale_row = {
                "chat_slug": "stale_channel__1",
                "chat_title": "Stale Channel",
                "text": "이란 관련 오래된 normalized 메시지",
                "raw_text": "이란 관련 오래된 normalized 메시지",
                "timestamp_kst": "2026-04-21T13:00:00+09:00",
                "timestamp_kst_end": "2026-04-21T13:00:00+09:00",
                "message_id": 77,
                "message_id_end": 77,
                "source_message_ids": [77],
                "source_message_count": 1,
            }
            (normalized_dir / "stale_channel__1.normalized.jsonl").write_text(
                json.dumps(stale_row, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )

            manifest = {
                "slot": "17:10",
                "slot_date": "2026-04-21",
                "slot_label": "1710",
                "slot_start": "2026-04-21T12:40:00+09:00",
                "slot_end": "2026-04-21T17:10:00+09:00",
                "channels_expected": 1,
                "channels_written": 1,
                "channel_message_counts": {"selected_channel__9": 0},
                "files": {"selected_channel__9": "selected_channel__9.jsonl"},
                "market_snapshot_file": "market_snapshot.json",
            }
            (slot_dir / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            (slot_dir / "selected_channel__9.jsonl").write_text("", encoding="utf-8")
            (slot_dir / "market_snapshot.json").write_text("{}\n", encoding="utf-8")

            gb = self.reload_generate_briefing(
                {
                    "TELEGRAM_ANALYSIS_ROOT": str(analysis_root),
                    "OPENCLAW_TELEGRAM_MAIN_ROOT": str(analysis_root),
                    "TELEGRAM_EXPORT_ROOT": str(export_root),
                }
            )
            window = gb.BriefingWindow(
                slot="17:10",
                start=datetime(2026, 4, 21, 12, 40, tzinfo=gb.KST),
                end=datetime(2026, 4, 21, 17, 10, tzinfo=gb.KST),
            )

            self.assertEqual(list(gb.iter_messages(window)), [])

    def test_iter_raw_messages_reads_slot_snapshot_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = Path(tmp_dir)
            analysis_root = project_root / "data" / "analysis" / "telegram" / "main"
            (analysis_root / "normalized").mkdir(parents=True, exist_ok=True)
            export_root = project_root / "data" / "archives" / "telegram" / "main" / "export"
            slot_dir = export_root / "slot_snapshots" / "2026-04-21" / "1240"
            slot_dir.mkdir(parents=True, exist_ok=True)

            manifest = {
                "slot": "12:40",
                "slot_date": "2026-04-21",
                "slot_label": "1240",
                "slot_start": "2026-04-21T08:20:00+09:00",
                "slot_end": "2026-04-21T12:40:00+09:00",
                "channels_expected": 1,
                "channels_written": 1,
                "channel_message_counts": {"alpha_channel__42": 1},
                "files": {"alpha_channel__42": "alpha_channel__42.jsonl"},
                "market_snapshot_file": "market_snapshot.json",
            }
            (slot_dir / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            snapshot_row = {
                "message_id": 314,
                "date": "2026-04-21T01:10:00+00:00",
                "chat_id": 42,
                "chat_title": "Alpha Channel",
                "chat_kind": "channel",
                "chat_username": "alpha",
                "text": "snapshot condensed text",
                "raw_text": "snapshot raw evidence",
                "views": 120,
            }
            (slot_dir / "alpha_channel__42.jsonl").write_text(
                json.dumps(snapshot_row, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            (slot_dir / "market_snapshot.json").write_text("{}\n", encoding="utf-8")

            gb = self.reload_generate_briefing(
                {
                    "TELEGRAM_ANALYSIS_ROOT": str(analysis_root),
                    "OPENCLAW_TELEGRAM_MAIN_ROOT": str(analysis_root),
                    "TELEGRAM_EXPORT_ROOT": str(export_root),
                }
            )
            window = gb.BriefingWindow(
                slot="12:40",
                start=datetime(2026, 4, 21, 8, 20, tzinfo=gb.KST),
                end=datetime(2026, 4, 21, 12, 40, tzinfo=gb.KST),
            )

            messages = list(gb.iter_raw_messages(window))
            self.assertEqual(len(messages), 1)
            self.assertEqual(messages[0].chat_slug, "alpha_channel__42")
            self.assertEqual(messages[0].text, "snapshot raw evidence")
            self.assertEqual(messages[0].message_id, 314)

    def test_main_skips_cleanly_when_slot_snapshot_has_no_messages(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = Path(tmp_dir)
            analysis_root = project_root / "data" / "analysis" / "telegram" / "main"
            (analysis_root / "normalized").mkdir(parents=True, exist_ok=True)
            (analysis_root / "worker").mkdir(parents=True, exist_ok=True)
            export_root = project_root / "data" / "archives" / "telegram" / "main" / "export"
            slot_dir = export_root / "slot_snapshots" / "2026-04-21" / "1710"
            slot_dir.mkdir(parents=True, exist_ok=True)

            manifest = {
                "slot": "17:10",
                "slot_date": "2026-04-21",
                "slot_label": "1710",
                "slot_start": "2026-04-21T12:40:00+09:00",
                "slot_end": "2026-04-21T17:10:00+09:00",
                "channels_expected": 1,
                "channels_written": 1,
                "channel_message_counts": {"selected_channel__9": 0},
                "files": {"selected_channel__9": "selected_channel__9.jsonl"},
                "market_snapshot_file": "market_snapshot.json",
            }
            (slot_dir / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            (slot_dir / "selected_channel__9.jsonl").write_text("", encoding="utf-8")
            (slot_dir / "market_snapshot.json").write_text("{}\n", encoding="utf-8")

            gb = self.reload_generate_briefing(
                {
                    "TELEGRAM_ANALYSIS_ROOT": str(analysis_root),
                    "OPENCLAW_TELEGRAM_MAIN_ROOT": str(analysis_root),
                    "TELEGRAM_EXPORT_ROOT": str(export_root),
                }
            )
            window = gb.BriefingWindow(
                slot="17:10",
                start=datetime(2026, 4, 21, 12, 40, tzinfo=gb.KST),
                end=datetime(2026, 4, 21, 17, 10, tzinfo=gb.KST),
            )

            with patch.object(gb, "resolve_briefing_window", return_value=window):
                result = gb.main()

            self.assertEqual(result, 0)
            self.assertFalse((analysis_root / "reports" / "latest.md").exists())
            state = json.loads((analysis_root / "worker" / "briefing_state.json").read_text(encoding="utf-8"))
            self.assertNotIn("last_briefing_status", state)
            self.assertNotIn("last_briefing_skip_reason", state)
            self.assertNotIn("last_briefing_slot_kst", state)
            self.assertNotIn("last_briefing_window_end_kst", state)
            self.assertNotIn("last_briefing_cutoff_kst", state)
            self.assertNotIn("last_briefing_ts_kst", state)
            self.assertNotIn("last_briefing_file", state)
            self.assertNotIn("last_briefing_context_file", state)
            self.assertNotIn("last_briefing_bundle_file", state)
            self.assertEqual(state["last_briefing"]["status"], "skipped_empty_window")
            self.assertEqual(state["last_briefing"]["slot_kst"], "17:10")
            self.assertEqual(state["last_briefing"]["window"], {
                "start_kst": "2026-04-21T12:40:00+09:00",
                "end_kst": "2026-04-21T17:10:00+09:00",
            })
            self.assertEqual(
                state["last_briefing"]["market_snapshot_file"],
                "slot_snapshots/2026-04-21/1710/market_snapshot.json",
            )
            self.assertEqual(
                state["last_briefing"]["skip"],
                {
                    "reason_code": "empty_window",
                    "reason": "no raw messages found for the requested briefing window",
                },
            )
            self.assertIsNone(state["last_briefing"]["outputs"])
            self.assertRegex(
                state["last_briefing"]["generated_at_kst"],
                r"^2026-04-(21|22)T\d{2}:\d{2}:\d{2}\+09:00$",
            )


class NimBackendConfigTests(unittest.TestCase):
    def tearDown(self) -> None:
        sys.modules.pop("briefing_llm", None)

    def test_prefers_nim_when_backend_is_requested(self) -> None:
        with patch.dict(
            os.environ,
            {
                "TELEGRAM_LLM_BACKEND": "nim",
                "TELEGRAM_NIM_BASE_URL": "https://integrate.api.nvidia.com/v1",
                "TELEGRAM_NIM_API_KEY": "nvapi-test",
            },
            clear=False,
        ):
            import briefing_llm

            mod = importlib.reload(briefing_llm)
            cfg = mod.resolve_backend_config(
                backend_env="TELEGRAM_BRIEFING_LLM_BACKEND",
                model_env="TELEGRAM_BRIEFING_SYNTHESIS_MODEL",
                reasoning_env="TELEGRAM_BRIEFING_SYNTHESIS_REASONING_EFFORT",
                default_model="meta/llama-3.1-70b-instruct",
            )

        self.assertEqual(cfg.backend, "nim")
        self.assertEqual(cfg.api_base, "https://integrate.api.nvidia.com/v1")
        self.assertEqual(cfg.api_key, "nvapi-test")
        self.assertEqual(cfg.model, "meta/llama-3.1-70b-instruct")

    def test_defaults_to_codex_when_no_backend_override_exists(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            import briefing_llm

            mod = importlib.reload(briefing_llm)
            cfg = mod.resolve_backend_config(
                backend_env="TELEGRAM_DIGEST_LLM_BACKEND",
                model_env="TELEGRAM_DIGEST_ANALYSIS_MODEL",
                reasoning_env="TELEGRAM_DIGEST_REASONING_EFFORT",
                default_model="gpt-5.4",
            )

        self.assertEqual(cfg.backend, "codex")
        self.assertEqual(cfg.model, "gpt-5.4")
        self.assertIsNone(cfg.api_base)
        self.assertIsNone(cfg.api_key)


if __name__ == "__main__":
    unittest.main()
