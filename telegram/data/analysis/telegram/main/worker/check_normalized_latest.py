#!/usr/bin/env python3
from __future__ import annotations

import glob
import json
from datetime import datetime

rows = []
all_latest = None
for fp in sorted(glob.glob('data/analysis/telegram/main/normalized/*.normalized.jsonl')):
    latest = None
    latest_text = None
    count = 0
    with open(fp, 'r', encoding='utf-8') as f:
        for line in f:
            row = json.loads(line)
            ts = row.get('timestamp_kst')
            if not ts:
                continue
            dt = datetime.fromisoformat(ts)
            count += 1
            if latest is None or dt > latest:
                latest = dt
                latest_text = (row.get('text') or '')[:120]
    rows.append({
        'file': fp,
        'count': count,
        'latest_timestamp_kst': latest.isoformat() if latest else None,
        'latest_text': latest_text,
    })
    if latest and (all_latest is None or latest > all_latest):
        all_latest = latest

print(json.dumps({'global_latest_timestamp_kst': all_latest.isoformat() if all_latest else None, 'files': rows}, ensure_ascii=False, indent=2))
