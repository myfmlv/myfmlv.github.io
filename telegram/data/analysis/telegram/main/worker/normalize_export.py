#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))

from project_paths import remap_legacy_path, resolve_project_root
WORKSPACE_ROOT = resolve_project_root(__file__)
ARCHIVE_ROOT = WORKSPACE_ROOT / 'data/archives/export'
ANALYSIS_ROOT = WORKSPACE_ROOT / 'data/analysis/telegram/main'
NORMALIZED_DIR = ANALYSIS_ROOT / 'normalized'
CATALOG_PATH = ARCHIVE_ROOT / 'catalog.json'
KST = timezone(timedelta(hours=9))
URL_RE = re.compile(r'https?://\S+')
SHORT_FRAGMENT_CHARS = 90
MERGE_WINDOW_SECONDS = 180
MAX_MERGE_MESSAGES = 6
CONTINUATION_PREFIXES = (
    '그리고',
    '근데',
    '다만',
    '또',
    '즉',
    '그래서',
    '한편',
    '추가',
    '현재',
    '특히',
    '반면',
    '이건',
    '결론',
    '참고로',
)
CONTINUATION_SUFFIXES = (':', '-', '/', '(', '[', '{', ',', '…', '...')
HEADLINE_PREFIXES = ('[', '제목', '속보', '🚨', '🔲', '📌', '✅', '>>', '#')


def slugify(text: str) -> str:
    text = (text or '').strip().lower()
    text = re.sub(r'[^a-z0-9가-힣]+', '_', text)
    text = re.sub(r'_+', '_', text).strip('_')
    return text or 'unknown'


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def to_kst(value: str | None) -> str | None:
    dt = parse_dt(value)
    if dt is None:
        return None
    return dt.astimezone(KST).isoformat(timespec='seconds')


def norm_text(text: str | None) -> str:
    return ' '.join((text or '').split())


def row_text(row: dict[str, Any]) -> str:
    return norm_text(row.get('text') or row.get('raw_text') or '')


def unique_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def message_type_of(service_action: Any, text: str, has_media: bool) -> str:
    if service_action:
        return 'service'
    has_url = bool(URL_RE.search(text))
    if not text and not has_media:
        return 'empty'
    if has_url and has_media:
        return 'mixed_post'
    if has_url:
        return 'link_post'
    if has_media:
        return 'media_post'
    return 'text_post'


def looks_like_fragment(text: str) -> bool:
    cleaned = URL_RE.sub('', text).strip()
    return 0 < len(cleaned) <= SHORT_FRAGMENT_CHARS


def continuation_prefix(text: str) -> bool:
    stripped = text.strip().lower()
    return any(stripped.startswith(prefix.lower()) for prefix in CONTINUATION_PREFIXES)


def continuation_suffix(text: str) -> bool:
    stripped = text.strip()
    return any(stripped.endswith(suffix) for suffix in CONTINUATION_SUFFIXES)


def looks_standalone_post(text: str) -> bool:
    stripped = text.strip()
    if any(stripped.startswith(prefix) for prefix in HEADLINE_PREFIXES) and len(stripped) >= 50:
        return True
    if len(stripped) >= 150:
        return True
    if stripped.startswith('[') and ']' in stripped and len(stripped) >= 70:
        return True
    if len(URL_RE.findall(stripped)) > 0 and len(stripped) >= 80:
        return True
    return False


def starts_new_headline(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    return any(stripped.startswith(prefix) for prefix in HEADLINE_PREFIXES)


def merge_reason(current_segment: list[dict[str, Any]], row: dict[str, Any]) -> str | None:
    previous = current_segment[-1]
    if previous.get('service_action') or row.get('service_action'):
        return None
    if len(current_segment) >= MAX_MERGE_MESSAGES:
        return None

    prev_dt = parse_dt(previous.get('date'))
    current_dt = parse_dt(row.get('date'))
    if prev_dt is None or current_dt is None:
        return None
    gap_seconds = (current_dt - prev_dt).total_seconds()
    if gap_seconds < 0 or gap_seconds > MERGE_WINDOW_SECONDS:
        return None

    prev_sender = previous.get('sender_id')
    current_sender = row.get('sender_id')
    if prev_sender is not None and current_sender is not None and prev_sender != current_sender:
        return None

    if previous.get('grouped_id') and previous.get('grouped_id') == row.get('grouped_id'):
        return 'grouped_media'

    if row.get('reply_to_msg_id') and row.get('reply_to_msg_id') == previous.get('message_id'):
        return 'reply_chain'

    prev_text = row_text(previous)
    current_text = row_text(row)
    if not prev_text or not current_text:
        return None

    if (continuation_suffix(prev_text) or continuation_prefix(current_text)) and not starts_new_headline(current_text):
        return 'continuation_phrase'

    prev_fragment = looks_like_fragment(prev_text)
    current_fragment = looks_like_fragment(current_text)
    if prev_fragment and not starts_new_headline(current_text):
        return 'short_fragment_chain'
    if prev_fragment and current_fragment and not starts_new_headline(current_text):
        return 'short_fragment_chain'

    return None


def iter_segments(src: Any) -> Any:
    current_rows: list[dict[str, Any]] = []
    current_reasons: list[str] = []

    for line in src:
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        if not current_rows:
            current_rows = [row]
            current_reasons = []
            continue

        reason = merge_reason(current_rows, row)
        if reason is not None:
            current_rows.append(row)
            current_reasons.append(reason)
            continue

        yield current_rows, current_reasons
        current_rows = [row]
        current_reasons = []

    if current_rows:
        yield current_rows, current_reasons


def max_numeric(rows: list[dict[str, Any]], key: str) -> int | None:
    values = [row.get(key) for row in rows if isinstance(row.get(key), int)]
    return max(values) if values else None


def latest_non_null(rows: list[dict[str, Any]], key: str) -> Any:
    for row in reversed(rows):
        value = row.get(key)
        if value not in (None, ''):
            return value
    return None


def normalize_segment(
    archive_slug: str,
    chat_slug: str,
    source_file: str,
    rows: list[dict[str, Any]],
    reasons: list[str],
) -> dict[str, Any]:
    first = rows[0]
    last = rows[-1]
    texts = [row_text(row) for row in rows if row_text(row)]
    raw_texts = [norm_text(row.get('raw_text') or row.get('text') or '') for row in rows if row.get('raw_text') or row.get('text')]
    merged_text = '\n'.join(texts) if texts else None
    merged_raw_text = '\n'.join(raw_texts) if raw_texts else None
    urls = unique_keep_order([url for text in texts for url in URL_RE.findall(text)])
    media_kinds = unique_keep_order([str(value) for value in (row.get('media_kind') for row in rows) if value])
    file_names = unique_keep_order([str(value) for value in (row.get('file_name') for row in rows) if value])
    mime_types = unique_keep_order([str(value) for value in (row.get('mime_type') for row in rows) if value])
    source_message_ids = [value for value in (row.get('message_id') for row in rows) if value is not None]
    has_media = any(bool(row.get('has_media')) for row in rows)

    return {
        'source': 'telegram',
        'archive_slug': archive_slug,
        'chat_id': first.get('chat_id'),
        'chat_slug': chat_slug,
        'chat_title': first.get('chat_title') or '',
        'chat_kind': first.get('chat_kind') or '',
        'chat_username': first.get('chat_username'),
        'message_id': first.get('message_id'),
        'message_id_end': last.get('message_id'),
        'source_message_ids': source_message_ids,
        'source_message_count': len(rows),
        'message_window_kind': 'merged_segment' if len(rows) > 1 else 'single_message',
        'message_window_reason': reasons[0] if reasons else None,
        'merge_reasons': unique_keep_order(reasons),
        'timestamp_utc': first.get('date'),
        'timestamp_utc_end': last.get('date'),
        'timestamp_kst': to_kst(first.get('date')),
        'timestamp_kst_end': to_kst(last.get('date')),
        'edit_timestamp_utc': latest_non_null(rows, 'edit_date'),
        'sender_id': first.get('sender_id'),
        'sender_name': None,
        'post_author': latest_non_null(rows, 'post_author'),
        'via_bot_id': latest_non_null(rows, 'via_bot_id'),
        'message_type': message_type_of(first.get('service_action'), merged_text or '', has_media),
        'service_action': first.get('service_action'),
        'reply_to_msg_id': first.get('reply_to_msg_id'),
        'grouped_id': first.get('grouped_id'),
        'text': merged_text,
        'raw_text': merged_raw_text,
        'text_length': len(merged_text or ''),
        'has_url': bool(urls),
        'urls': urls,
        'has_media': has_media,
        'media_kind': media_kinds[0] if len(media_kinds) == 1 else ('multiple' if media_kinds else None),
        'media_kinds': media_kinds,
        'media_path': latest_non_null(rows, 'media_path'),
        'file_name': file_names[0] if len(file_names) == 1 else None,
        'file_names': file_names,
        'mime_type': mime_types[0] if len(mime_types) == 1 else None,
        'mime_types': mime_types,
        'file_size': max_numeric(rows, 'file_size'),
        'views': max_numeric(rows, 'views'),
        'forwards': max_numeric(rows, 'forwards'),
        'reply_count': max_numeric(rows, 'reply_count'),
        'is_outgoing': any(bool(row.get('out')) for row in rows),
        'is_service': bool(first.get('service_action')),
        'source_file': source_file,
    }


def main() -> int:
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)
    catalog = json.loads(CATALOG_PATH.read_text(encoding='utf-8'))
    archive_slug = 'main'
    dialog_summaries = []

    for dialog in catalog.get('dialogs', []):
        chat_id = dialog['chat_id']
        title = dialog.get('chat_title') or f'chat_{chat_id}'
        chat_slug = f"{slugify(title)}__{chat_id}"
        dialog_root = remap_legacy_path(dialog['dialog_root'], WORKSPACE_ROOT)
        messages_path = dialog_root / 'messages.jsonl'
        if not messages_path.exists():
            continue

        out_path = NORMALIZED_DIR / f'{chat_slug}.normalized.jsonl'
        source_count = 0
        normalized_count = 0
        merged_count = 0
        with messages_path.open(encoding='utf-8') as src, out_path.open('w', encoding='utf-8') as dst:
            for rows, reasons in iter_segments(src):
                normalized = normalize_segment(
                    archive_slug=archive_slug,
                    chat_slug=chat_slug,
                    source_file='data/archives/export/' + str(messages_path.relative_to(ARCHIVE_ROOT)).replace('\\', '/'),
                    rows=rows,
                    reasons=reasons,
                )
                dst.write(json.dumps(normalized, ensure_ascii=False) + '\n')
                source_count += len(rows)
                normalized_count += 1
                if len(rows) > 1:
                    merged_count += 1

        dialog_summaries.append({
            'chat_id': chat_id,
            'chat_slug': chat_slug,
            'chat_title': title,
            'chat_kind': dialog.get('chat_kind'),
            'chat_username': dialog.get('chat_username'),
            'normalized_file': str(out_path.relative_to(ANALYSIS_ROOT)).replace('\\', '/'),
            'source_message_count': source_count,
            'normalized_record_count': normalized_count,
            'merged_record_count': merged_count,
        })

    summary_path = NORMALIZED_DIR / 'dialogs.normalized.catalog.json'
    summary_path.write_text(json.dumps({'dialogs': dialog_summaries}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
