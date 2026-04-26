# Telegram Briefing Operating Policy

## Sources

- Raw source: `data/archives/export`
- Derived source: `data/analysis/telegram/main/normalized`
- Delivery output: `data/analysis/telegram/main/reports/latest.md`
- Delivery context: `data/analysis/telegram/main/reports/latest.context.json`
- Raw analysis bundle: `data/analysis/telegram/main/reports/latest.bundle.md`
- Archived outputs: `data/analysis/telegram/main/reports/briefings/*.md`, `*.context.json`, and `data/analysis/telegram/main/reports/bundles/*.bundle.md`

## Retention

- Raw Telegram messages: keep `30 days`
- Briefing markdown: keep long-term
- Briefing context JSON: keep long-term
- Widening retention does not restore messages already pruned under an older policy

## State

- Live cutoff state: `data/analysis/telegram/main/worker/briefing_state.json`
- Scheduled runs are allowed to advance this file
- Manual verification runs should back up and restore this file if they are only for testing

## Delivery Path

1. Run `data/analysis/telegram/main/worker/run_briefing_pipeline.py`
2. Save the final user-facing briefing to `data/analysis/telegram/main/reports/latest.md` and archive the same slot under `reports/briefings/*.md`
3. Save the raw channel/message bundle to `data/analysis/telegram/main/reports/latest.bundle.md` and archive the same slot under `reports/bundles/*.bundle.md`
4. Use `latest.context.json` only for internal audit, not as the user-facing message
5. Deliver `data/analysis/telegram/main/reports/latest.md` to Telegram as plain text

## Digest Inputs

- Weekly and monthly digests should read archived regular briefings from `data/analysis/telegram/main/reports/briefings/*.md` as the primary input
- Use matching archived raw bundles from `data/analysis/telegram/main/reports/bundles/*.bundle.md` only as supporting context such as channel/message breadth
- Weekly and monthly digests should use GPT synthesis over those archived briefings plus bundle support, rather than a pure rule-based Python merge
- Do not fall back to raw Telegram exports for digest generation unless the user explicitly asks for raw-export reanalysis

## Manual Delivery

- Re-send the current final briefing with `python3 data/analysis/telegram/main/worker/send_latest_briefing.py`
- Add `--prefix "[manual resend]"` only when the user explicitly wants the resend labeled
- Add `--dry-run` to verify the delivery payload without posting
- For conversational control from Telegram itself, run `python3 scripts/telegram_bot_gateway.py`

## Cron Rule

- Cron should not browse the workspace broadly
- Cron should not look for `package.json`, directory indexes, or alternate latest files
- Cron should execute the pipeline, then read `reports/latest.md`, and deliver that body as plain text
