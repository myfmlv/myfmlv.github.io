# MYFMLV Market Check

ETF 테마 카드와 KRX 연기금 주식 수급 랭킹을 함께 보는 정적 GitHub Pages 사이트입니다.

## Commands

```bash
npm run sync:krx
npm run sync:krx-openapi -- --date=20260424
npm run sync:market-index
npm run sync:etf
npm run sync:stock-charts
npm run sync:naver-market
npm run dev
npm run validate:data
npm run check
npm run test:e2e
```

`npm run check`는 JavaScript 문법 검사, 핵심 데이터 JSON/CSV 검증, 정적 UI 스모크 테스트를 함께 실행합니다. `npm run test:e2e`는 정적 서버를 띄운 뒤 Playwright로 핵심 화면 동작을 확인합니다.

## Local KRX data sync

원본 KRX CSV 위치는 환경변수나 `--source`로 명시합니다.

```bash
export KRX_SOURCE_DIR="/absolute/path/to/krx/data"
npm run sync:krx
```

또는:

```bash
npm run sync:krx -- --source="/absolute/path/to/krx/data"
```

동기화 스크립트는 최신 KRX CSV 파일을 `data/krx/`로 복사하고 `data/krx/index.json`을 갱신합니다. 같은 디렉터리에 `stock_meta_YYYYMMDD.json`이 있으면 `data/stock-meta.json`도 함께 갱신합니다.

## Data Flow

```bash
cd <telegram-project-root>
source .venv/bin/activate
python scripts/download_krx_pension_netbuys.py --start 20260101 --end 20260424
python scripts/download_krx_stock_meta.py --date 20260424

cd <myfmlv.github.io>
npm run sync:krx -- --source="<telegram-project-root>/data/krx"
npm run check
```

`download_krx_pension_netbuys.py`는 기본으로 순매수와 순매도 행을 모두 저장합니다. `download_krx_stock_meta.py`는 KRX 일별 시세 화면에서 시가총액, 종가, 등락률, 거래대금, 상장주식수를 받아 `stock_meta_YYYYMMDD.json`으로 저장하고, `npm run sync:krx`가 최신 파일을 `data/stock-meta.json`으로 복사합니다.

`npm run sync:market-index`는 네이버 금융 시장지표 페이지에서 원달러, 원엔, WTI, 국제 금 값을 읽어 `data/market-index.json`을 갱신합니다.

`npm run sync:etf`는 네이버 ETF 목록/차트와 WiseReport ETF 상세의 CU당 구성종목을 합쳐 `data/etf-universe.json`을 갱신합니다. 실제 구성종목 데이터가 없는 ETF에는 추정 편입비중을 넣지 않습니다.

`npm run sync:stock-charts`와 `npm run sync:naver-market`는 기간 버튼(`1일`, `5일`, `20일`, `60일`)에서 쓰는 가격 흐름과 테마/검색/거래대금 랭킹 데이터를 보강합니다. 기간 수익률을 보여주는 랭킹은 선택 기간 기준으로 다시 정렬합니다.

`npm run sync:krx-openapi -- --date=YYYYMMDD`는 KRX OpenAPI의 전체 31개 엔드포인트 권한과 응답을 확인합니다. 사이트에 우선 필요한 API 신청 상태와 작업 맥락은 `PROJECT_CONTEXT.md`를 참고하세요.
