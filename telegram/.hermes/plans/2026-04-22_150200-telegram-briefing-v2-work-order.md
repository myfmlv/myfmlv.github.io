# Telegram Briefing V2 Work Order

> **Owner after launch:** `rosalind` (`dbanalystbot` / `@DB_analyst_bot`)
> 
> **Controller:** `bakgas2` — scope, prioritization, review, release decision only
> 
> **Supporting editor/validator:** `mart`

## 0. Mission
현재 V1 브리핑 시스템은 원문보다 정보밀도와 신뢰도가 낮고, 다음과 같은 실패를 반복한다.
- 중문/한자/영문 tail 누수
- 시스템/목록형/roundup 메시지의 본문 오염
- 잘린 절, dangling clause, wrapper 문장 채택
- 라벨과 내용의 불일치
- 서로 다른 뉴스를 억지로 공통 시그널로 묶는 문제

이번 작업의 목표는 **패치가 아니라 V2 병렬 시스템 구축**이다.
V2는 raw message를 바로 bullet 후보로 쓰지 않고, **분류 → 한국어 정규화 → fact extraction → fact ranking → hard validation → composition** 순서로 처리한다.

## 1. 책임 구조
### Primary owner — rosalind
rosalind가 새 브리핑 시스템의 실질 담당자다.
담당 범위:
- V2 핵심 로직 설계 유지보수
- message classification / fact extraction / ranking
- 테스트 확장
- shadow run 결과 점검
- cutover 이후 품질 책임

### Supporting owner — mart
mart는 보조 담당이다.
담당 범위:
- 최종 문장 surface 개선
- validator rule 제안 및 튜닝
- 한국어 표현 품질 검토
- human-readability 회귀 검수

### Controller — bakgas2
bakgas2는 구현자가 아니다.
담당 범위:
- 우선순위 결정
- 범위 잠금
- worker 결과 리뷰
- launch / rollback 결정

## 2. Non-negotiable product rules
이 규칙은 예외 없이 지킨다.
1. **최종 브리핑 markdown에는 한국어만 남긴다.**
2. **중문/한자/영문 원문이 섞인 채로 ship 금지.**
3. **system header / list wrapper / roundup wrapper / filings boilerplate는 bullet 금지.**
4. **문장이 미완성이면 ship 금지.**
5. **라벨과 문맥이 불일치하면 ship 금지.**
6. **공통 시그널은 같은 story/fact가 2개 이상 독립 채널에서 반복될 때만 허용.**
7. **불확실하면 넣지 말고 비워둔다. 억지 요약 금지.**

## 3. Architecture decision
### V1 유지, V2 병렬 구축
기존 `generate_briefing.py`를 계속 누더기 보수하지 않는다.
대신 V2를 별도 경로로 만든다.

### Proposed file layout
- `data/analysis/telegram/main/worker/v2/message_types.py`
- `data/analysis/telegram/main/worker/v2/normalize_ko.py`
- `data/analysis/telegram/main/worker/v2/fact_schema.py`
- `data/analysis/telegram/main/worker/v2/extract_facts.py`
- `data/analysis/telegram/main/worker/v2/rank_facts.py`
- `data/analysis/telegram/main/worker/v2/validate_output.py`
- `data/analysis/telegram/main/worker/generate_briefing_v2.py`
- `data/analysis/telegram/main/worker/test_briefing_v2.py`

V2는 slot snapshot / normalized fallback / market snapshot 입력은 재사용하되, 후보 선별 체인은 완전히 분리한다.

## 4. Output contract
V2 내부에서 사용하는 최소 단위는 `message`가 아니라 `fact`다.

### Message classification labels
- `actionable_news`
- `broker_note_actionable`
- `broker_note_roundup`
- `utility_roundup`
- `utility_actionable_filing`
- `commentary`
- `noise`

### Fact schema (minimum)
- `source_channel`
- `message_id`
- `source_ts_kst`
- `entity`
- `topic`
- `event_type`
- `summary_ko`
- `supporting_metrics`
- `direction`
- `time_relevance`
- `market_relevance`
- `novelty_score`
- `confidence`
- `evidence_span`
- `language_status`

Only facts with acceptable `confidence`, `language_status`, and sentence completeness can reach composition.

## 5. Build phases
## Phase 1 — Safety shell first
### Goal
가장 embarrassing한 실패를 즉시 차단한다.

### Deliverables
1. Message classifier MVP
2. Korean normalization gate MVP
3. Final bullet validator MVP
4. V2 smoke CLI that can produce a minimal briefing draft

### Acceptance
- 리스트형/시스템형/roundup 메시지가 final bullets에 0건
- 중문/한자 tail이 final bullets에 0건
- dangling clause 0건

## Phase 2 — Fact extraction MVP
### Goal
핵심 섹터에서 fact-first selection이 돌아가게 만든다.

### Initial supported domains
- semiconductors / HBM / foundry / memory
- earnings / guidance / estimate revision / contracts
- shipping / energy / macro-sensitive logistics
- block trade / placement / ownership overhang

### Acceptance
- 각 지원 도메인에서 raw message 대신 fact가 top candidate로 선택됨
- 같은 메시지 wrapper가 아니라 핵심 사실이 bullet로 올라감

## Phase 3 — Ranking and grouping
### Goal
consensus / outlier / channel insights를 fact 기준으로 재구성한다.

### Rules
- consensus = same fact signature repeated by independent channels
- outlier = high-value but independent fact with strong novelty and market relevance
- channel insight = 채널별 highest-quality fact 한 줄, commentary 남발 금지

### Acceptance
- false consensus 감소
- top section이 메시지 문장조각이 아니라 사건 중심으로 읽힘

## Phase 4 — Shadow mode and cutover
### Goal
V1과 병렬 비교하여 V2 cutover 여부를 결정한다.

### Shadow rules
- 같은 슬롯에 대해 V1/V2 동시 생성
- 최소 3개 슬롯 연속 비교
- human evaluation에서 V2 우위가 명확해야 cutover

### Cutover gate
아래 조건을 만족할 때만 V2를 default로 승격:
- completeness failures = 0
- mixed-language failures = 0
- wrapper/list contamination = 0
- reviewer preference: V2 wins 3 consecutive slots

## 6. Task breakdown
### Track A — rosalind (owner)
1. V2 파일 스캐폴딩 생성
2. message classifier rule set 초안 작성
3. normalized Korean gate 설계
4. fact schema / extraction interface 확정
5. initial fact extractors 구현
6. fact ranking/grouping 구현
7. regression tests 추가
8. shadow run 실행 및 결과 정리

### Track B — mart (support)
1. validator reject patterns 정리
2. bullet surface template 설계
3. 완결 문장 규칙 보강
4. bad output gallery 정리
5. human readability review checklist 작성
6. shadow outputs editorial review

### Track C — bakgas2 (controller)
1. scope lock
2. delivery review
3. acceptance signoff
4. cutover / rollback decision

## 7. Required tests
`test_briefing_v2.py`에는 최소 아래 실패 사례가 fixture로 들어가야 한다.
1. 중문+한자 tail 메시지
2. 시스템 wrapper 메시지
3. 추정치 상향종목 정리 같은 list wrapper
4. `...가능하지만` 형태 미완성 절
5. 라벨은 환율인데 내용은 블록딜인 메시지
6. 같은 broad tag지만 다른 story인 false consensus pair
7. actionable filing vs utility roundup 구분 사례
8. 동일 story cross-channel consensus positive case

## 8. Review checklist
출력 리뷰 때 아래를 한 줄씩 체크한다.
- 한국어 only인가?
- 문장이 완결인가?
- 라벨과 내용이 맞는가?
- wrapper/headline boilerplate가 아닌가?
- 원문에서 핵심 정보가 보존되었는가?
- 같은 뉴스를 억지로 묶지 않았는가?
- 읽는 사람이 바로 투자 포인트를 이해할 수 있는가?

## 9. Escalation rule
- rosalind가 구조 결정권을 가진다.
- mart는 표현/validator 측면에서 강하게 반대할 수 있다.
- 충돌 시 bakgas2가 결정한다.
- 다만 launch owner는 rosalind로 고정한다.

## 10. First instruction to workers
### To rosalind
너는 이 시스템의 owner다. V2를 새로 세운다고 생각하고 message classification, Korean normalization gate, fact extraction skeleton부터 잡아라. 기존 V1 패치 마인드 버리고 새 체인으로 설계해라. 가장 먼저 embarrassing failure를 못 나오게 safety shell을 만들어라.

### To mart
너는 editor/validator 담당이다. 어떤 문장이 최종 브리핑에 나오면 안 되는지 reject catalog를 먼저 만들고, 완결 한국어 문장 기준과 wrapper contamination rule을 엄격하게 정의해라. rosalind 산출물을 읽는 사람 관점에서 갈궈라.

## 11. Definition of done
다음 상태가 되면 이 work order는 완료다.
- V2가 별도 엔트리포인트에서 동작
- 최소 1회 slot briefing 생성 성공
- hard validation rules 작동 확인
- shadow mode 비교 자료 생성
- owner 문서에 rosalind 명시
- bakgas2 review complete

## 12. Owner record
새 브리핑 시스템의 운영/개선 담당자는 **rosalind**로 지정한다.
Cutover 이후 관련 이슈의 1차 triage도 rosalind가 맡는다.
