# Telegram Briefing V2 Redesign Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the current clause-snipping/keyword-tagging briefing pipeline with a source-faithful, Korean-only, investor-usable briefing pipeline that is clearly better than manually reading one strong chat stream.

**Architecture:** V2 should stop treating raw Telegram messages as direct briefing bullets. Instead, it should run a staged pipeline: normalize → classify → translate/clean → extract structured facts → rank facts → compose briefing with hard output guards. The core design principle is that only validated, Korean, complete, actionable facts may reach the final markdown.

**Tech Stack:** Existing Python worker pipeline under `data/analysis/telegram/main/worker/`; rule-based preprocessing; optional small-model assist (Gemma 4 only for narrow subtasks, not full synthesis); existing test harness in `test_briefing_upgrade.py` plus new V2-focused tests.

---

## 1. Current failure modes to explicitly eliminate

Based on the current 12:40 artifacts:
- `reports/briefings/2026-04-22_1240_kst.md`
- `reports/briefings/2026-04-22_1240_kst.context.json`
- `reports/bundles/2026-04-22_1240_kst.bundle.md`

V1 currently fails in these ways:
1. **Non-Korean leakage**
   - Chinese / mixed-language text survives into final bullets and context.
2. **System/list/report wrappers treated as insight**
   - earnings lists, briefing headers, report intros, and utility roundup posts become top bullets.
3. **Broken sentence extraction**
   - incomplete clauses like `... 가능하지만` survive as final bullets.
4. **Weak semantic labeling**
   - keyword tags overrule meaning; e.g. a block-trade post becomes `환율`.
5. **Narrative contamination**
   - commentary, sarcasm, social post framing, and broker boilerplate degrade the briefing.
6. **No hard acceptance gate for final bullet quality**
   - if a clause is short enough and scores high enough, it can appear even if it is incomplete, mistranslated, or not investor-actionable.

V2 must treat these as **hard failures**, not as quality nuisances.

---

## 2. V2 design principles

1. **Korean-only user-facing output**
   - final markdown and audit-summary strings must be Korean only.
2. **Fact-first, prose-second**
   - extract normalized facts first; write prose only from approved facts.
3. **Message-type-aware processing**
   - a utility list, a broker note, a one-line alert, and a commentary post should not share one ranking path.
4. **Complete-thought requirement**
   - no incomplete clause may become a final bullet.
5. **Investor-actionability over generic narration**
   - revisions, contracts, quantities, pricing, supply constraints, and verified market consequences outrank mood or commentary.
6. **Auditable pipeline**
   - every final bullet should point back to a structured fact set and source message IDs in context JSON.
7. **Conservative fallback**
   - when confidence is low, omit the bullet rather than emit garbage.

---

## 3. Proposed V2 pipeline

### Stage A — Source ingestion remains snapshot-first, but V2 input objects become richer

**Keep:**
- `export_slot_snapshot.py`
- `normalize_export.py`
- snapshot-first backfill behavior already added in `generate_briefing.py`

**Change:**
- After `iter_messages(...)`, create a richer intermediate object for each message:
  - `language_profile`
  - `message_type`
  - `is_roundup`
  - `is_systemic_list`
  - `contains_non_korean_segments`
  - `commentary_level`
  - `structured_facts`
  - `quality_flags`

**Files likely to change:**
- Modify: `data/analysis/telegram/main/worker/generate_briefing.py`
- Optional create: `data/analysis/telegram/main/worker/briefing_v2_types.py`

---

### Stage B — Message classification before ranking

Add a deterministic classifier that assigns one of:
- `actionable_news`
- `broker_note_actionable`
- `broker_note_roundup`
- `utility_roundup`
- `utility_actionable_filing`
- `commentary`
- `noise`

**Rules:**
- `utility_roundup` never becomes a final bullet candidate.
- `broker_note_roundup` may supply supporting context but not top bullets directly.
- `commentary` can only survive if it contains a structured actionable fact extracted separately.

**Examples from current failures:**
- `추정치 상향종목 정리(...)` → `utility_roundup`
- `[메리츠증권 IT 소재장비 ... 인뎁스 보고서 발간]` → `broker_note_roundup`
- `중국석화 자회사는 ... CATL 홍콩주식 매각` → `actionable_news` or `broker_note_actionable`

**Files likely to change:**
- Modify: `generate_briefing.py`
- Test: `test_briefing_upgrade.py`

---

### Stage C — Korean normalization / translation gate

Before fact extraction, run a **translation and normalization step**:
- If the message contains substantial Chinese/Hanja/English source text, produce a Korean-normalized text field.
- Preserve original raw text for audit only.

**Important constraint:**
- Gemma 4 may be used only for tiny translation assists if the span is short and bounded.
- Default path should be deterministic/local heuristics first:
  - strip duplicated source-language tails
  - drop mirrored Chinese tail if a Korean summary already exists
  - translate known finance boilerplate with local rules
- If no reliable Korean normalized form can be produced, the message is not eligible for top bullets.

**New field:**
- `normalized_ko_text`

**Files likely to change:**
- Modify: `generate_briefing.py`
- Optional create: `data/analysis/telegram/main/worker/translation_rules.py`

---

### Stage D — Structured fact extraction (the core redesign)

Instead of choosing arbitrary clauses, extract facts such as:
- `entity` — company / country / instrument / channel source
- `event_type` — contract, earnings revision, capex delay, supply disruption, block trade, regulatory shift, etc.
- `metric_value` — e.g. `2.06조 원`, `+4.4%`, `7.6억달러`
- `direction` — up/down/delay/cancel/expand
- `time_relevance` — why now in this slot
- `market_link` — semis, shipping, FX, rates, energy, etc.
- `confidence` — extracted confidently or weakly

**Only facts with required fields and acceptable confidence move forward.**

**High-priority event types for top bullets:**
- earnings revision
- contract / supply agreement
- major pricing move / shortage
- production delay / cancellation affecting supply chain
- shipping / energy shock with explicit downstream consequence
- large financing / block trade if it clearly matters to market structure

**Files likely to change:**
- Modify: `generate_briefing.py`
- Optional create: `data/analysis/telegram/main/worker/fact_extraction.py`

---

### Stage E — Ranking facts, not messages

Create separate ranking lanes:
1. **Top bullets lane**
2. **Consensus lane**
3. **Outlier lane**
4. **Analyst memo lane**

#### E1. Top bullets lane
Rank structured facts with:
- investor actionability
- completeness
- numeric specificity
- source quality
- slot relevance
- non-duplication

**Hard reject if:**
- not Korean
- incomplete sentence
- list/header wrapper
- generic roundup/list post
- commentary-only

#### E2. Consensus lane
Consensus should operate on **normalized fact signatures**, not raw clauses or weak topic overlap.
Example signature:
- `semis / samsung / d1d_delay_or_cancel`
- `shipping / hormuz / food_cost_spillover`

Consensus requires:
- at least 2 independent chats
- similar fact signature
- acceptable confidence

#### E3. Outlier lane
Keep the new pass-6 2–4 variable policy, but apply it to **facts**, not raw messages.
That means the outlier budget should be decided after fact-level dedupe.

#### E4. Analyst memo lane
Analyst memos should be one-line source-aware summaries derived from the best fact per surviving channel insight, not from arbitrary clause ranking.

---

### Stage F — Final composition with hard output guards

Final markdown sections may stay:
- `## 지금 중요한 것`
- `## 해석과 우선순위`
- `## 우리 판단`
- `## 체크할 숫자 3개`

But every bullet in `지금 중요한 것` must pass validation:
- Korean only
- complete sentence
- no raw Chinese tail
- no system/list wrapper
- label matches fact type
- not a heading fragment
- not a dangling subordinate clause

If fewer than 3 valid bullets exist, output only 2 rather than forcing garbage.

---

## 4. File-level implementation plan

### Task 1: Add V2 message-type classification helpers
**Objective:** classify raw messages before ranking.

**Files:**
- Modify: `data/analysis/telegram/main/worker/generate_briefing.py`
- Test: `data/analysis/telegram/main/worker/test_briefing_upgrade.py`

**Implementation notes:**
- Add helpers like:
  - `classify_message_type(text, chat_slug) -> str`
  - `is_systemic_list_text(...)`
  - `is_roundup_header_text(...)`
- Make these testable independently.

**Verification:**
- Add unit tests for current 12:40 bad examples.

---

### Task 2: Add Korean normalization / translation gate
**Objective:** ensure only Korean-normalized content reaches top bullets.

**Files:**
- Modify: `generate_briefing.py`
- Optional create: `translation_rules.py`
- Test: `test_briefing_upgrade.py`

**Implementation notes:**
- Add `normalize_to_korean_fact_text(...)`
- Detect mirrored Chinese tails and strip them when a Korean lead exists.
- If non-Korean dominates and no reliable Korean normalization is possible, mark ineligible.

**Verification:**
- Tests for mixed Korean+Chinese lines from current bundle.

---

### Task 3: Introduce structured fact extraction
**Objective:** make final bullets fact-based.

**Files:**
- Modify: `generate_briefing.py`
- Optional create: `fact_extraction.py`
- Test: `test_briefing_upgrade.py`

**Implementation notes:**
- Add a `Fact` dataclass or dict schema.
- Extract key fields from semis/earnings/shipping/cross-border trade cases first.
- Start narrow; do not solve every domain in v1 of V2.

**Verification:**
- For known bad 12:40 messages, confirm extracted fact is cleaner than raw clause.

---

### Task 4: Rewrite top-bullet ranking to use facts
**Objective:** stop raw clause leakage into final markdown.

**Files:**
- Modify: `generate_briefing.py`
- Test: `test_briefing_upgrade.py`

**Implementation notes:**
- Replace `focus_candidate(...)` as the top-level bullet source with a fact-ranking path.
- Keep old path behind a fallback flag during migration.

**Verification:**
- Current 12:40 broken bullet examples must disappear.

---

### Task 5: Rewrite consensus/outlier selection on fact signatures
**Objective:** make consensus and outliers semantically stable.

**Files:**
- Modify: `generate_briefing.py`
- Test: `test_briefing_upgrade.py`

**Implementation notes:**
- Build `fact_signature(...)`
- consensus = repeated signatures
- outliers = high-scoring unique signatures
- preserve pass-6 variable outlier budget, but move it to fact layer

**Verification:**
- No fake consensus from generic semis overlap
- No zero-consensus collapse when real repeated macro facts exist

---

### Task 6: Tight final-output validator
**Objective:** fail closed on garbage bullets.

**Files:**
- Modify: `generate_briefing.py`
- Test: `test_briefing_upgrade.py`

**Rules to enforce:**
- reject Chinese/Hanja leakage in final markdown
- reject dangling endings like `...하지만`
- reject wrapper/list intros
- reject mismatched label-content combinations where possible

**Verification:**
- 12:40 pathological bullets should fail tests.

---

### Task 7: Shadow mode rollout before full cutover
**Objective:** reduce risk.

**Files:**
- Modify: `run_briefing_pipeline.py`
- Optional create: `generate_briefing_v2.py`
- Optional create: `reports/diagnostics/`

**Approach:**
- Run V1 and V2 side-by-side for a few slots
- Save V2 candidate as diagnostic artifact
- Compare:
  - Korean purity
  - bullet completeness
  - source faithfulness
  - human readability

**Cutover criterion:**
- V2 clearly beats V1 on at least 3 recent slots.

---

## 5. Testing strategy

### Required new test groups
1. **Classification tests**
   - utility roundup vs actionable filing
   - broker roundup vs actionable note
2. **Translation/normalization tests**
   - mixed Korean+Chinese message
   - pure Chinese tail stripping
3. **Fact extraction tests**
   - earnings revision
   - semis production delay
   - shipping/food spillover
   - block trade / stake sale
4. **Final bullet quality tests**
   - no incomplete clause
   - no Chinese leakage
   - no list wrappers
5. **Regression tests using current bad 12:40 examples**
   - every bad bullet quoted in the user complaint should be represented by a failing test first

### Commands
- `python3 -m unittest data.analysis.telegram.main.worker.test_briefing_upgrade`
- `python3 data/analysis/telegram/main/worker/generate_briefing.py`
- optionally: slot-specific shadow runs through `render_cron_briefing.py`

---

## 6. Success criteria

V2 is successful only if all are true:
1. Final top bullets are **Korean-only**.
2. No bullet is an incomplete sentence or heading fragment.
3. Utility roundups do not appear as `지금 중요한 것` bullets.
4. Labels reflect actual meaning, not incidental keywords.
5. Human judgment says the result is **better than reading one strong chat stream**, not worse.
6. The 12:40 failure case is no longer reproducible.

---

## 7. Risks and tradeoffs

### Risk: too much strict filtering → too few bullets
Mitigation:
- Allow 2 good bullets instead of 4 bad ones.
- Use shadow mode to tune thresholds.

### Risk: fact extraction becomes too ambitious
Mitigation:
- Start with only the top event families that dominate current failures.
- Keep the schema small and practical.

### Risk: local translation quality is poor
Mitigation:
- Use deterministic stripping/normalization first.
- Use Gemma 4 only for tiny bounded transforms if necessary.
- Never let low-confidence translation reach final bullets.

### Risk: implementation churn inside one giant file
Mitigation:
- Move V2 helpers into small modules if complexity rises.
- Keep `generate_briefing.py` as orchestrator, not monolith.

---

## 8. Recommended rollout order

1. Classification + Korean normalization gate
2. Final bullet validator
3. Fact extraction for top-bullet lane
4. Consensus/outlier fact-signature rewrite
5. Shadow mode comparison
6. Full cutover

---

## 9. Controller recommendation

This should **not** be treated as pass-7 micro-tuning.
It is a **V2 rebuild**.

Recommended execution model:
- bakgas2: controller only
- rosalind: fact extraction + signal logic
- mart: editorial composition + output validation
- controller compares shadow outputs and decides cutover
