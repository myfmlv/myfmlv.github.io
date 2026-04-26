#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from io import StringIO
from pathlib import Path
from urllib.request import Request, urlopen

OUT = Path(__file__).resolve().with_name('test_stooq_symbols_results.json')
HEADERS = {'User-Agent': 'Mozilla/5.0'}
CANDIDATES = {
    'VIX': ['^vix', 'vix'],
    'Brent': ['b.f', 'brent', 'brent.f'],
    'Gold': ['gold', 'xauusd', 'gc.f'],
    'Copper': ['copper', 'hg.f', 'cpr.f'],
}


def fetch(symbol: str) -> dict:
    req = Request(f'https://stooq.com/q/l/?s={symbol}', headers=HEADERS)
    text = urlopen(req, timeout=15).read().decode('utf-8', errors='replace').strip()
    row = next(csv.reader(StringIO(text)))
    return {
        'symbol': row[0],
        'date': row[1],
        'time': row[2],
        'open': row[3],
        'high': row[4],
        'low': row[5],
        'close': row[6],
    }


def main() -> int:
    out = {}
    for label, symbols in CANDIDATES.items():
        out[label] = []
        for s in symbols:
            try:
                data = fetch(s)
                out[label].append({'candidate': s, 'result': data})
            except Exception as e:
                out[label].append({'candidate': s, 'error': str(e)})
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(OUT))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
