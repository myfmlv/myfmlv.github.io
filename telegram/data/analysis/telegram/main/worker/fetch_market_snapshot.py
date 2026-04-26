#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen, Request

ANALYSIS_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ANALYSIS_ROOT / 'market_snapshots'
CONFIG_PATH = ANALYSIS_ROOT / 'worker' / 'market_api_keys.local.json'
KST = timezone(timedelta(hours=9))

FRED_SERIES = {
    'US_2Y': 'DGS2',
    'US_10Y': 'DGS10',
}

ALPHA_SERIES = {
    'WTI': {'function': 'WTI'},
    'Brent': {'function': 'BRENT'},
    'NatGas': {'function': 'NATURAL_GAS'},
    'Copper': {'function': 'COPPER'},
    'USDKRW': {'function': 'CURRENCY_EXCHANGE_RATE', 'from_currency': 'USD', 'to_currency': 'KRW'},
    'USDJPY': {'function': 'CURRENCY_EXCHANGE_RATE', 'from_currency': 'USD', 'to_currency': 'JPY'},
    'EURUSD': {'function': 'CURRENCY_EXCHANGE_RATE', 'from_currency': 'EUR', 'to_currency': 'USD'},
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json',
}


def load_local_keys() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def get_secret(name: str) -> str | None:
    return os.environ.get(name) or load_local_keys().get(name)


def fetch_json(url: str) -> dict:
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=20) as resp:
        return json.load(resp)


def fetch_fred_series(series_id: str) -> dict:
    api_key = get_secret('FRED_API_KEY')
    params = {
        'series_id': series_id,
        'file_type': 'json',
        'sort_order': 'desc',
        'limit': 5,
    }
    if api_key:
        params['api_key'] = api_key
    url = 'https://api.stlouisfed.org/fred/series/observations?' + urlencode(params)
    data = fetch_json(url)
    observations = data.get('observations') or []
    for obs in observations:
        value = obs.get('value')
        if value not in (None, '.', ''):
            return obs
    raise ValueError('empty-fred-response')


def fetch_alpha_series(spec: dict) -> dict:
    api_key = get_secret('ALPHAVANTAGE_API_KEY')
    if not api_key:
        raise ValueError('missing_ALPHAVANTAGE_API_KEY')
    params = dict(spec)
    params['apikey'] = api_key
    url = 'https://www.alphavantage.co/query?' + urlencode(params)
    return fetch_json(url)


def main() -> int:
    now = datetime.now(KST)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = {
        'asOfKst': now.isoformat(timespec='seconds'),
        'sources': {
            'FRED': list(FRED_SERIES.values()),
            'AlphaVantage': list(ALPHA_SERIES.keys()),
        },
        'symbols': {},
        'errors': {},
    }
    for name, series_id in FRED_SERIES.items():
        try:
            obs = fetch_fred_series(series_id)
            out['symbols'][name] = {
                'source': 'FRED',
                'series_id': series_id,
                'date': obs.get('date'),
                'value': obs.get('value'),
            }
        except Exception as e:
            out['errors'][name] = str(e)
    for name, spec in ALPHA_SERIES.items():
        try:
            data = fetch_alpha_series(spec)
            out['symbols'][name] = {
                'source': 'AlphaVantage',
                'raw': data,
            }
        except Exception as e:
            out['errors'][name] = str(e)
    if 'US_2Y' in out['symbols'] and 'US_10Y' in out['symbols']:
        try:
            two = float(out['symbols']['US_2Y']['value'])
            ten = float(out['symbols']['US_10Y']['value'])
            out['symbols']['US_2Y_10Y_SPREAD'] = {
                'source': 'derived',
                'value': round(ten - two, 4),
            }
        except Exception as e:
            out['errors']['US_2Y_10Y_SPREAD'] = str(e)
    out_path = OUT_DIR / f"{now.strftime('%Y-%m-%d_%H%M')}_kst.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(out_path))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
