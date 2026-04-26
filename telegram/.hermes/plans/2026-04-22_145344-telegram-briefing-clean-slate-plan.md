# Telegram Briefing Clean-Slate Rebuild Plan

> **For Hermes:** This is a from-scratch plan, not a patch set. Treat the current pipeline as a useful source of components, but not as an architecture to preserve.

**Goal:** Build a Telegram investment briefing system that is reliably better than manually reading one good chat stream.

**Architecture:** Replace the current single-pass ranking-and-snipping pipeline with a newsroom-style pipeline: collect → classify → normalize → extract facts → build a briefing board → write the product → validate hard → deliver. The system should optimize for correctness, source fidelity, readability, and editorial trust rather than code reuse.

**Tech Stack:** Python worker pipeline in `data/analysis/telegram/main/worker/`; deterministic preprocessing and validation; small-model assist only where clearly bounded; optional stronger model only for the final write step once inputs are clean.

---

## 1. My opinionated stance

If this were my system, I would stop trying to make `generate_briefing.py` smarter by adding more heuristics onto the current shape.

I would do three hard things:

1. **Separate analysis from writing**
   - raw Telegram messages should never directly compete to become final bullets.
2. **Make facts the unit of selection**
   - not messages, not clauses, not tags.
3. **Add a hard editorial gate**
   - if the output is incomplete, mixed-language, wrapper-like, or low-confidence, it does not ship.

The current system fails because it tries to infer the final product too early from messy raw inputs.

---

## 2. Product definition first

Before implementation, define the briefing product precisely.

### 2.1 What the product is
A slot briefing is **not** a summary of everything said.
It is:
- the 2–5 most important investable developments in the slot,
- one concise interpretation of what matters now,
- one disciplined house view,
- 3 watch numbers.

### 2.2 What the product is not
It is not:
- a transcript digest,
- a channel-by-channel recap,
- a broker note excerpt pack,
- a themed keyword clustering exercise,
- a place to show the system worked hard.

### 2.3 Success test
If a human reads one strong channel and gets better signal than this briefing, the briefing failed.

---

## 3. Clean-slate architecture

## Stage A — Input ledger

Create a durable intermediate record per candidate message.

Each record should include:
- `chat_slug`
- `chat_title`
- `timestamp_kst`
- `raw_text`
- `normalized_text`
- `language_status`
- `message_type`
- `source_urls`
- `source_quality`
- `is_actionable`
- `candidate_status`
- `rejection_reason`

**Why:** right now too much reasoning is implicit and unrecoverable.

**Implementation preference:**
- create a V2 intermediate JSONL under something like:
  - `data/analysis/telegram/main/intermediate/briefing_v2/<slot>.jsonl`

---

## Stage B — Message triage

Every message gets classified before any ranking.

### Classes
- `market_fact`
- `company_fact`
- `broker_actionable`
- `broker_roundup`
- `utility_actionable`
- `utility_roundup`
- `macro_commentary`
- `social_commentary`
- `noise`

### My hard policy
- `utility_roundup` never reaches top-bullet selection.
- `broker_roundup` can inform context, but not directly produce final bullets.
- `social_commentary` is dead on arrival unless it contains an extractable fact.
- `noise` is dropped immediately.

### Examples from current failure cases
- `추정치 상향종목 정리(...)` → `utility_roundup`
- `IT 소재장비 인뎁스 보고서 발간` → `broker_roundup`
- `CATL H주 블록딜 / 90일 락업` → `market_fact`
- `HBM5E / D1d 양산 철회` → `company_fact`

---

## Stage C — Language normalization

I would make this brutal and conservative.

### Rules
1. Final candidate text must be Korean-only.
2. If the message contains mirrored Chinese text after a Korean summary, strip the non-Korean tail.
3. If the message is mainly Chinese and cannot be normalized confidently into Korean, reject it from top-bullet candidacy.
4. Preserve original text in audit only.

### Why
A mixed-language bullet instantly destroys trust.

### My policy on models
- Do not use a model by default here.
- First use deterministic normalization rules.
- Use a tiny local model only for bounded transforms if needed.
- If confidence is not high, reject rather than guess.

---

## Stage D — Fact extraction

This is the heart of the redesign.

Convert each surviving message into one or more structured facts.

### Fact schema
- `fact_id`
- `entity`
- `entity_type`
- `event_type`
- `direction`
- `magnitude`
- `metric`
- `time_scope`
- `market_domain`
- `why_now`
- `confidence`
- `source_message_ids`
- `source_chat_slug`
- `normalized_fact_text`

### Event types I would explicitly support first
- earnings revision
- contract / order / supply agreement
- production delay / cancellation
- price increase / shortage
- capex change
- block trade / stake sale / lockup
- shipping disruption
- energy bottleneck
- rate / FX implication

### Design principle
A message may be long and messy, but the extracted fact must be small and clean.

---

## Stage E — Fact board

Build a slot-level board of facts.

### Grouping dimensions
- by entity
- by event type
- by market domain
- by repeated fact signature
- by independence of source

### Outputs from this stage
- `core_facts`
- `repeated_facts`
- `supporting_facts`
- `discarded_facts`

This becomes the editorial board from which the briefing is written.

---

## Stage F — Briefing board selection

Here I would define four explicit lanes.

### Lane 1: Top developments
Choose 2–5 facts that answer:
- what actually changed,
- why an investor should care now,
- whether the fact is complete and numerically anchored.

### Lane 2: Consensus
Consensus should only exist if the same fact signature appears independently in multiple channels.
No broad keyword consensus.

### Lane 3: Outliers
Outliers should be unique but strong facts that matter despite not repeating.
Keep the current pass-6 idea of variable count, but only after fact-level dedupe.

### Lane 4: Desk memos
One short best fact per surviving high-value channel.
No metadata theater.
No `담당 범위=` style scaffolding.

---

## Stage G — Writing layer

Only after the fact board is ready should the writing layer exist.

### Writing input
A compact structured payload, not raw Telegram text.

### If fully rule-based
Compose bullets from facts with templates:
- `실적: {entity} {event} {magnitude}`
- `반도체: {entity} {supply/price/delay fact}`
- `해운/물류: {disruption} → {downstream effect}`

### If model-assisted
Use a model only to polish a fully structured fact board.
Never let the model see raw mixed-quality channel dumps when generating the final briefing.

### My preferred approach
- Rule-based for extraction and candidate generation
- Model-assisted only for final wording, if needed
- If no model is used, the output should still be shippable

---

## Stage H — Hard validator

The validator should be strong enough to block embarrassing output.

### Reject final output if any bullet is:
- not Korean,
- incomplete or dangling,
- list/header/system wrapper text,
- label-content mismatch,
- obviously commentary rather than fact,
- unsupported by a source fact.

### Also validate section-level quality
- `지금 중요한 것` should have 2–5 bullets, not forced 4
- `해석과 우선순위` should not simply restate bullets
- `우리 판단` should be slot-specific
- `체크할 숫자 3개` must be numeric and meaningful

---

## 4. What I would build first

### Phase 1 — Kill obvious garbage
**Goal:** stop embarrassing output immediately.

Build first:
1. message classification
2. Korean-only gate
3. final-output validator
4. utility/broker roundup exclusion

**Outcome:** even before V2 is fully smart, it stops shipping nonsense.

### Phase 2 — Fact extraction MVP
**Goal:** move from message snippets to structured facts.

Build support for:
- semis
- earnings/contracts
- shipping/energy shock
- block trade / stake sale

**Outcome:** top bullets become materially cleaner.

### Phase 3 — Rebuild consensus/outlier on facts
**Goal:** make repeated themes and outliers trustworthy.

**Outcome:** consensus and outliers become semantically meaningful rather than keyword artifacts.

### Phase 4 — Optional final writer
**Goal:** improve prose after the system is already correct.

**Outcome:** polish, not rescue.

---

## 5. Files I would likely create

Instead of stuffing everything into one huge file, I would split V2 into modules.

### New modules
- `data/analysis/telegram/main/worker/briefing_v2_types.py`
- `data/analysis/telegram/main/worker/briefing_v2_classify.py`
- `data/analysis/telegram/main/worker/briefing_v2_normalize.py`
- `data/analysis/telegram/main/worker/briefing_v2_extract.py`
- `data/analysis/telegram/main/worker/briefing_v2_rank.py`
- `data/analysis/telegram/main/worker/briefing_v2_write.py`
- `data/analysis/telegram/main/worker/briefing_v2_validate.py`

### Keep existing orchestrator thin
- `run_briefing_pipeline.py`
- `generate_briefing.py` can become a compatibility shell or dispatcher

---

## 6. Testing philosophy

I would stop writing only heuristic unit tests and start writing **artifact-quality tests**.

### Required test suites
1. `classification tests`
2. `language normalization tests`
3. `fact extraction tests`
4. `ranking tests`
5. `final artifact rejection tests`
6. `slot replay tests` using known bad cases like the 12:40 failure

### Golden test cases
Create frozen fixture inputs from real bad slots and assert:
- no Chinese leakage
- no incomplete bullets
- no utility lists in top developments
- no weird label mismatches
- bullets grounded in real facts

---

## 7. Rollout strategy

I would not replace V1 immediately.

### Shadow mode
For several runs:
- V1 generates current output
- V2 generates shadow output
- compare both side by side

Store shadow artifacts under:
- `reports/briefings_v2_shadow/`
- `reports/bundles_v2_shadow/`
- `reports/diagnostics_v2/`

### Cutover rule
V2 only replaces V1 when:
- it wins on 3 recent slots in a row,
- no validator failures,
- human review says it is decisively more useful.

---

## 8. What I would not optimize yet

I would deliberately ignore for now:
- pretty code reuse,
- perfect multilingual coverage,
- deep channel-specific style modeling,
- fancy LLM prompting.

First get to:
- clean,
- complete,
- Korean,
- actionable,
- trustworthy.

---

## 9. My hard recommendation

If this were my project, I would approve:
- **a clean V2 rebuild in parallel**,
- **not more patching on V1 as the main path**.

V1 can continue to run as fallback.
V2 should be developed as a parallel product until it clearly wins.

---

## 10. Suggested execution model

- **bakgas2**: controller only
  - define acceptance criteria
  - assign work
  - review shadow outputs
  - decide cutover
- **rosalind**: extraction/ranking pipeline
- **mart**: writing/validator/editorial surface

That is the structure I would choose if I were in charge.
