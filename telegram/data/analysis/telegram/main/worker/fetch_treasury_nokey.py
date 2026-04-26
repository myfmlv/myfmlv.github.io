#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen

WORKSPACE_ROOT = Path(
    os.environ.get('TELEGRAM_PROJECT_ROOT')
    or os.environ.get('OPENCLAW_WORKSPACE_ROOT')
    or Path(__file__).resolve().parents[5]
).expanduser()
OUT = WORKSPACE_ROOT / 'data/analysis/telegram/main/market_snapshots/treasury_nokey_latest.json'
KST = timezone(timedelta(hours=9))
HEADERS = {'User-Agent': 'Mozilla/5.0'}


def fetch_text(url: str) -> str:
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='replace')


def build_url(year: int) -> str:
    return (
        'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/'
        f'daily-treasury-rates.csv/{year}/all?type=daily_treasury_yield_curve'
        f'&field_tdr_date_value={year}&page&_format=csv'
    )


def extract_latest(text: str) -> dict:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    header_idx = next((i for i, line in enumerate(lines) if line.startswith('Date,')), None)
    if header_idx is None:
        raise ValueError('csv-header-not-found')
    header = [h.strip().strip('"') for h in lines[header_idx].split(',')]
    data_lines = lines[header_idx + 1:]
    rows = []
    for line in data_lines:
        parts = [p.strip() for p in line.split(',')]
        if len(parts) != len(header):
            continue
        if not re.match(r'\d{2}/\d{2}/\d{4}', parts[0]):
            continue
        rows.append(dict(zip(header, parts)))
    if not rows:
        raise ValueError('no-data-rows')
    last = rows[0]
    two = last['2 Yr']
    ten = last['10 Yr']
    return {
        'date': last['Date'],
        '2Y': two,
        '10Y': ten,
        '2Y10Y_SPREAD': round(float(ten) - float(two), 4),
    }


def main() -> int:
    now = datetime.now(KST)
    attempts: list[str] = []
    latest = None
    source_url = None
    for year in (now.year, now.year - 1):
        url = build_url(year)
        try:
            text = fetch_text(url)
            latest = extract_latest(text)
            source_url = url
            break
        except Exception as exc:
            attempts.append(f'{year}:{exc}')
    if latest is None:
        raise RuntimeError(' ; '.join(attempts) or 'treasury-fetch-failed')
    out = {
        'asOfKst': now.isoformat(timespec='seconds'),
        'source': 'us-treasury-textview',
        'sourceUrl': source_url,
        'latest': latest,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(OUT))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
