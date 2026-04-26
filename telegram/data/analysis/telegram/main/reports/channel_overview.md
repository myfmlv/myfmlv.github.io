# Telegram channel overview - test export

Source archive:
- `data/archives/telegram/test/export`

Normalized catalog:
- `data/analysis/telegram/test/normalized/dialogs.normalized.catalog.json`

## Snapshot

- Total dialogs: 9
- Current observed chat kind: all listed dialogs are `channel`
- Largest dialog by message count: `시장 이야기 by 제이슨` (`79,496`)

## Dialog summary

1. **시장 이야기 by 제이슨**
   - chat_id: `1192351807`
   - username: `bumgore`
   - messages: `79,496`
   - normalized file: `normalized/시장_이야기_by_제이슨__1192351807.normalized.jsonl`

2. **가투방(DCTG) 저장소**
   - chat_id: `1370641552`
   - username: `gatubang`
   - messages: `43,279`
   - normalized file: `normalized/가투방_dctg_저장소__1370641552.normalized.jsonl`

3. **급등일보 미국주식🇺🇸 속보·리서치**
   - chat_id: `1586367974`
   - username: `FastStockNewsUSA`
   - messages: `17,143`
   - normalized file: `normalized/급등일보_미국주식_속보_리서치__1586367974.normalized.jsonl`

4. **Granit34의 투자스토리**
   - chat_id: `1776506878`
   - username: `Joorini34`
   - messages: `15,987`
   - normalized file: `normalized/granit34의_투자스토리__1776506878.normalized.jsonl`

5. **미래에셋증권 시황 김석환**
   - chat_id: `1926884456`
   - username: `globalmktinsight`
   - messages: `12,493`
   - normalized file: `normalized/미래에셋증권_시황_김석환__1926884456.normalized.jsonl`

6. **김찰저의 관심과 생각 저장소**
   - chat_id: `1861520498`
   - username: `kimcharger`
   - messages: `12,483`
   - normalized file: `normalized/김찰저의_관심과_생각_저장소__1861520498.normalized.jsonl`

7. **잠실개미&10X’s N.E.R.D.S**
   - chat_id: `1150586161`
   - username: `jake8lee`
   - messages: `11,467`
   - normalized file: `normalized/잠실개미_10x_s_n_e_r_d_s__1150586161.normalized.jsonl`

8. **트릴리온**
   - chat_id: `3402415038`
   - username: `Trillion_labs`
   - messages: `2,834`
   - normalized file: `normalized/트릴리온__3402415038.normalized.jsonl`

9. **키움증권 전략/시황 한지영**
   - chat_id: `1304649917`
   - username: `hedgecat0301`
   - messages: `2,667`
   - normalized file: `normalized/키움증권_전략_시황_한지영__1304649917.normalized.jsonl`

## Immediate observations

- The export appears to be a curated set of market / investing / commentary channels rather than general chat groups.
- Message counts vary widely; one or two channels are large enough to justify dedicated per-channel profiling before cross-channel comparison.
- `시장 이야기 by 제이슨` and `가투방(DCTG) 저장소` are the heaviest sources and likely deserve first-pass profiling if the goal is to understand recurring market narratives.
- `김찰저의 관심과 생각 저장소` is mid-sized and may be especially interesting as a personalized commentary source.

## Suggested next steps

1. Build per-channel profile reports for the top 3 channels by message count.
2. Extract link-heavy posts and frequent keywords from normalized files.
3. Compare channel tone: research relay vs commentary vs original thesis writing.
4. If needed, add SQLite ingestion later for faster filtering and cross-channel queries.
