#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import os
from datetime import datetime, timezone, timedelta
from io import StringIO
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

WORKSPACE_ROOT = Path(
    os.environ.get('TELEGRAM_PROJECT_ROOT')
    or os.environ.get('OPENCLAW_WORKSPACE_ROOT')
    or Path(__file__).resolve().parents[5]
).expanduser()
OUT_DIR = WORKSPACE_ROOT / 'data/analysis/telegram/main/market_snapshots'
KST = timezone(timedelta(hours=9))
HEADERS = {'User-Agent': 'Mozilla/5.0'}

# Keep Stooq as the first choice where it is historically close to the existing pipeline,
# but fill chronic gaps (Brent/VIX/DXY and occasional FX misses) from Yahoo Finance.
SERIES = {
    'USDKRW': {
        'stooq': 'usdkrw',
        'yahoo': 'KRW=X',
        'label': 'USD/KRW 현물',
    },
    'USDJPY': {
        'stooq': 'usdjpy',
        'yahoo': 'JPY=X',
        'label': 'USD/JPY 현물',
    },
    'EURUSD': {
        'stooq': 'eurusd',
        'yahoo': 'EURUSD=X',
        'label': 'EUR/USD 현물',
    },
    'SPX': {
        'stooq': '^spx',
        'yahoo': '^GSPC',
        'label': 'S&P 500',
    },
    'NASDAQ100': {
        'stooq': '^ndq',
        'yahoo': '^NDX',
        'label': 'NASDAQ 100',
    },
    'VIX': {
        'stooq': '^vix',
        'yahoo': '^VIX',
        'label': 'VIX',
    },
    'WTI': {
        'stooq': 'cl.f',
        'yahoo': 'CL=F',
        'label': 'WTI 선물',
    },
    'Brent': {
        'stooq': 'b.f',
        'yahoo': 'BZ=F',
        'label': 'Brent 선물',
    },
    'Gold': {
        'stooq': 'xauusd',
        'yahoo': 'GC=F',
        'label': 'Gold',
    },
    'Copper': {
        'stooq': 'hg.f',
        'yahoo': 'HG=F',
        'label': 'Copper',
    },
    'DXY': {
        'yahoo': 'DX-Y.NYB',
        'label': 'Dollar Index',
    },
}


def fetch_text(url: str) -> str:
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='replace')


def fetch_json(url: str) -> dict:
    return json.loads(fetch_text(url))


def fetch_stooq(symbol: str) -> dict:
    text = fetch_text(f'https://stooq.com/q/l/?s={symbol}')
    row = next(csv.reader(StringIO(text.strip())))
    data = {
        'symbol': row[0],
        'date': row[1],
        'time': row[2],
        'open': row[3],
        'high': row[4],
        'low': row[5],
        'close': row[6],
        'volume': row[7] if len(row) > 7 else None,
        'provider': 'stooq',
    }
    if data['date'] == 'N/D' or data['close'] == 'N/D':
        raise ValueError('no-data')
    return data


def _last_non_null(values: list | None):
    if not values:
        return None
    for value in reversed(values):
        if value is not None:
            return value
    return None


def fetch_yahoo(symbol: str) -> dict:
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol)}?interval=1d&range=10d'
    data = fetch_json(url)
    result = ((data.get('chart') or {}).get('result') or [None])[0]
    if not result:
        raise ValueError('no-result')

    meta = result.get('meta') or {}
    quote_data = ((result.get('indicators') or {}).get('quote') or [{}])[0]
    timestamps = result.get('timestamp') or []
    close = _last_non_null(quote_data.get('close'))
    open_ = _last_non_null(quote_data.get('open'))
    high = _last_non_null(quote_data.get('high'))
    low = _last_non_null(quote_data.get('low'))
    volume = _last_non_null(quote_data.get('volume'))
    if close is None:
        close = meta.get('regularMarketPrice')
    if close is None:
        raise ValueError('no-close')

    ts = timestamps[-1] if timestamps else meta.get('regularMarketTime')
    if ts is not None:
        dt = datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(KST)
        date = dt.strftime('%Y%m%d')
        time = dt.strftime('%H%M%S')
    else:
        date = None
        time = None

    def normalize(value):
        return None if value is None else str(value)

    return {
        'symbol': meta.get('symbol') or symbol,
        'date': date,
        'time': time,
        'open': normalize(open_),
        'high': normalize(high),
        'low': normalize(low),
        'close': normalize(close),
        'volume': normalize(volume),
        'provider': 'yahoo-finance',
        'currency': meta.get('currency'),
        'exchangeName': meta.get('exchangeName'),
    }


def fetch_symbol(spec: dict) -> dict:
    errors: list[str] = []
    if spec.get('stooq'):
        try:
            return fetch_stooq(spec['stooq'])
        except Exception as exc:
            errors.append(f"stooq:{exc}")
    if spec.get('yahoo'):
        try:
            return fetch_yahoo(spec['yahoo'])
        except Exception as exc:
            errors.append(f"yahoo:{exc}")
    raise ValueError('; '.join(errors) or 'no-source-configured')


def main() -> int:
    now = datetime.now(KST)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = {
        'asOfKst': now.isoformat(timespec='seconds'),
        'source': 'stooq+yahoo-no-key',
        'symbols': {},
        'errors': {},
    }
    for name, spec in SERIES.items():
        try:
            item = fetch_symbol(spec)
            item['seriesLabel'] = spec.get('label')
            out['symbols'][name] = item
        except Exception as e:
            out['errors'][name] = str(e)
    out_path = OUT_DIR / f"{now.strftime('%Y-%m-%d_%H%M')}_nokey_kst.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(out_path))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
