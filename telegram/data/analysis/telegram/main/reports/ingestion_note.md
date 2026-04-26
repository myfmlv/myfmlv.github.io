# Telegram export ingestion note

Archive source:
- `data/archives/telegram/test/export`

Observed structure:
- `catalog.json`
- `dialogs/channel_<chat_id>/messages.jsonl`
- `dialogs/channel_<chat_id>/state.json`
- `runs/*.json`

Initial interpretation:
- The current export is a multi-dialog export bundle rather than a single chat export.
- `catalog.json` currently lists 9 dialogs.
- Listed dialogs are currently marked as `chat_kind: channel`.

Prepared analysis assets:
- `normalized/telegram_message_normalized_schema.json`
- `normalized/example.normalized.jsonl`

Next recommended step:
- Build a normalizer that converts each `messages.jsonl` file into per-dialog normalized JSONL under `data/analysis/telegram/test/normalized/`.
