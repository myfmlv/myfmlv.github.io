# ETF data recovery archive

This directory preserves dated snapshots of ETF data collected by this project
from its documented public sources. It does not contain a scrape or copy of the
ETFnow service.

## `etf-universe-20260514.json`

- Snapshot timestamp: `2026-05-14T13:01:36.236Z`
- ETF records: `1,107`
- Source file: `data/etf-universe.json`
- Public-source pipeline: Naver ETF list and charts plus WiseReport ETF
  holdings, as documented in the project README
- Purpose: recovery fallback if a later refresh is incomplete or an external
  ETF information service becomes unavailable

The snapshot includes ETF codes, names, issuers, categories, prices, iNAV,
market capitalization, trading-value history, price history, period returns,
and holdings where available. Values are historical reference data and must not
be treated as current market prices.

## `etf-universe-20260714.json`

- Snapshot timestamp: `2026-07-14T11:07:24.140Z`
- ETF records: `1,147`
- Chart records: `1,147`
- ETF records with holdings: `1,066`
- Source file: `data/etf-universe.json`
- Public-source pipeline: Naver ETF list and charts plus WiseReport ETF
  holdings, as documented in the project README
- Recovery context: preserved after ETFnow became unavailable on 2026-07-14

This is the closest complete, structured replacement dataset available in the
workspace for the information formerly viewed on ETFnow. It is not scraped from
ETFnow. The snapshot was rebuilt from documented public market sources and
retains source attribution inside the JSON payload.

## `etfnow-public-cache-20260714.json`

This small manifest records only factual metadata recoverable from public search
indexes after the ETFnow outage: known page URLs, crawl recency, published data
sources, calculation outline, update cadence, and dataset-size statements. It
does not reproduce ETFnow page copy, private account data, or unavailable
five-minute estimate history.

## ETFnow Wayback API captures (`2026-04-28`)

The Internet Archive preserved four public JSON responses from ETFnow. Exact
decompressed response bodies are stored here without modification:

- `etfnow-api-etf-highlights-20260428.json` — 15 ETF highlight records
- `etfnow-api-hot-20260428.json` — closing snapshot, hot themes, core groups,
  and rising/falling iNAV rankings
- `etfnow-api-market-holidays-20260428.json` — Korean and US market holidays
  for 2026–2027
- `etfnow-api-market-status-20260428.json` — market segment and FX state at
  `2026-04-28T20:32:40+09:00`

Archive capture URLs use the `id_` replay modifier so the stored response body
is retrieved without Wayback toolbar rewriting. These files are historical
reference snapshots, not current prices and not a complete ETFnow database.
