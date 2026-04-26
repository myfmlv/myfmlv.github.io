#!/usr/bin/env python3
from __future__ import annotations

import glob
import json
from collections import defaultdict
from datetime import datetime

# Heuristic weight: all channels matter, but some message types are more briefing-dense.
KEYWORDS = ['유가', '호르무즈', '환율', '달러', '국채', '금리', '반도체', '메모리', '삼성전자', '하이닉스', '방산', '전력기기', 'lng', '디젤']

hour_stats = {h: {'messages': 0, 'weighted': 0, 'channels': set()} for h in range(24)}

for fp in sorted(glob.glob('data/analysis/telegram/main/normalized/*.normalized.jsonl')):
    with open(fp, 'r', encoding='utf-8') as f:
        for line in f:
            row = json.loads(line)
            if row.get('is_service'):
                continue
            text = (row.get('text') or '').strip()
            if not text:
                continue
            ts = row.get('timestamp_kst')
            if not ts:
                continue
            dt = datetime.fromisoformat(ts)
            h = dt.hour
            hour_stats[h]['messages'] += 1
            hour_stats[h]['channels'].add(row.get('chat_title') or '')
            weight = 1
            if len(text) >= 80:
                weight += 1
            if any(k.lower() in text.lower() for k in KEYWORDS):
                weight += 2
            if row.get('views') and row.get('views') >= 500:
                weight += 1
            hour_stats[h]['weighted'] += weight

summary = []
for h in range(24):
    summary.append({
        'hour': h,
        'messages': hour_stats[h]['messages'],
        'weighted_score': hour_stats[h]['weighted'],
        'channel_count': len(hour_stats[h]['channels']),
    })

summary.sort(key=lambda x: x['weighted_score'], reverse=True)
print(json.dumps({'top_hours': summary[:10], 'all_hours': summary}, ensure_ascii=False, indent=2))
