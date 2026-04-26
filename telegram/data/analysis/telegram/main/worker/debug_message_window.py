#!/usr/bin/env python3
from __future__ import annotations

import glob
import json
from datetime import datetime

cutoff = datetime.fromisoformat('2026-04-03T00:53:00+09:00')
count = 0
hits = []
for fp in sorted(glob.glob('data/analysis/telegram/main/normalized/*.normalized.jsonl')):
    with open(fp, 'r', encoding='utf-8') as f:
        for line in f:
            row = json.loads(line)
            ts = row.get('timestamp_kst')
            if not ts:
                continue
            dt = datetime.fromisoformat(ts)
            if dt <= cutoff:
                continue
            if row.get('is_service'):
                continue
            text = (row.get('text') or '').strip()
            if not text:
                continue
            count += 1
            if len(hits) < 20:
                hits.append({
                    'file': fp,
                    'chat_title': row.get('chat_title'),
                    'timestamp_kst': ts,
                    'text': text[:160],
                })
print(json.dumps({'count': count, 'hits': hits}, ensure_ascii=False, indent=2))
