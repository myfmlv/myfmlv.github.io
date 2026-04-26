#!/usr/bin/env python3
from urllib.request import Request, urlopen

url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv'
req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
text = urlopen(req, timeout=20).read().decode('utf-8', errors='replace')
for i, line in enumerate(text.splitlines()[:8], 1):
    print(f'{i}: {line}')
