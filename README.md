# MYFMLV Market Check

ETF 테마 카드와 KRX 연기금 주식 수급 랭킹을 함께 보는 정적 GitHub Pages 사이트입니다.

## Commands

```bash
npm run sync:krx
npm run sync:krx-openapi -- --date=20260424
npm run sync:market-index
npm run dev
npm run check
```

KRX CSV 원본 기본 위치는 `/Users/Park/Documents/01_Projects/Telegram/data/krx`입니다.

## Data Flow

```bash
cd /Users/Park/Documents/01_Projects/Telegram
source .venv/bin/activate
python scripts/download_krx_pension_netbuys.py --start 20260101 --end 20260424
python scripts/download_krx_stock_meta.py --date 20260424

cd /Users/Park/Documents/01_Projects/Web/myfmlv.github.io
npm run sync:krx
```

`download_krx_pension_netbuys.py`는 기본으로 순매수와 순매도 행을 모두 저장합니다. `download_krx_stock_meta.py`는 KRX 일별 시세 화면에서 시가총액, 종가, 등락률, 거래대금, 상장주식수를 받아 `stock_meta_YYYYMMDD.json`으로 저장하고, `npm run sync:krx`가 최신 파일을 `data/stock-meta.json`으로 복사합니다.

`npm run sync:market-index`는 네이버 금융 시장지표 페이지에서 원달러, 원엔, WTI, 국제 금 값을 읽어 `data/market-index.json`을 갱신합니다.

`npm run sync:krx-openapi -- --date=YYYYMMDD`는 KRX OpenAPI의 전체 31개 엔드포인트 권한과 응답을 확인합니다. 사이트에 우선 필요한 API 신청 상태와 작업 맥락은 `PROJECT_CONTEXT.md`를 참고하세요.
