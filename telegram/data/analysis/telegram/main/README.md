# Telegram Analysis - main

This directory stores analysis-ready derivatives for the Telegram export archive at:

- `data/archives/export`

## Layout

- `normalized/` — normalized message-level records
- `threads/` — topic/thread/link regroupings
- `reports/` — human-readable summaries and analysis memos
- `reports/latest.md` — stable latest briefing for delivery
- `reports/latest.context.json` — stable latest context sidecar
- `worker/` — automation state, logs, and future pipeline control
- `OPERATING_POLICY.md` — short operating rules for retention, state, and delivery

## Current source snapshot

The current export contains `catalog.json` plus per-dialog folders under `export/dialogs/`.
Each dialog currently includes at least:

- `messages.jsonl`
- `state.json`

## Recommended first outputs

1. Per-dialog normalized JSONL files
2. Per-dialog summary metadata
3. Cross-dialog link extraction
4. Channel/topic reports

## Operations

See `OPERATING_POLICY.md` for the active retention and delivery policy.
