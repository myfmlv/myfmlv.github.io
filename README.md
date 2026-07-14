# MYFMLV Market Check

ETF 탐색·공식 iNAV·괴리율·구성종목·기간 수익률·위험지표와 KRX 연기금
주식 수급 랭킹을 함께 보는 정적 GitHub Pages 사이트입니다. 관심 ETF는
브라우저에 저장되며, 데이터는 매일 자동 갱신됩니다.

## ETF 기능

- `HOT ETF`: 공식 iNAV 괴리율, 거래대금, 기간 상승률 기준 랭킹
- `ETF 찾기`: ETF명·종목코드·운용사·테마·구성종목 통합 검색
- `미국 ETF`: 국내 상장 미국 자산 추종 ETF 전용 탐색
- `관심 ETF`: 로그인 없이 현재 브라우저에 관심 종목 저장
- 상세 분석: 가격, 공식 iNAV, 괴리율, 시가총액, 거래대금, 1·3·6개월
  수익률, 변동성, 최대낙폭, Sharpe, 구성종목과 역검색

공식 iNAV와 괴리율은 정규장 기준 참고 정보입니다. 장 마감 후 자체 추정
iNAV로 표시하지 않으며, 실제 체결가와 다를 수 있습니다.

## Commands

```bash
npm run sync:krx
npm run sync:krx-live
npm run sync:krx-openapi -- --date=20260424
npm run sync:market-index
npm run sync:etf
npm run sync:stock-charts
npm run sync:naver-market
npm run update:data
npm run dev
npm run validate:data
npm run check
npm run test:e2e
```

`npm run update:data`는 기존 데이터 수집 스크립트를 순서대로 실행하고 `data/update-status.json`에 자동갱신 결과를 기록합니다. KRX 로그인 정보가 있으면 `npm run sync:krx-live`로 장마감 후 확정된 거래일까지 직접 백필하고, 없으면 로컬 CSV 원본 동기화로 대체합니다. `npm run check`는 JavaScript 문법 검사, 핵심 데이터 JSON/CSV 검증, 정적 UI 스모크 테스트를 함께 실행합니다. `npm run test:e2e`는 정적 서버를 띄운 뒤 Playwright로 핵심 화면 동작을 확인합니다.

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

동기화 스크립트는 KRX CSV 파일을 `data/krx/`에 병합하고 `data/krx/index.json`을 갱신합니다. 원본 디렉터리가 기존 사이트 데이터보다 오래되어도 최신 기준일을 뒤로 되돌리지 않습니다. 같은 디렉터리에 최신 기준일 이상의 `stock_meta_YYYYMMDD.json`이 있으면 `data/stock-meta.json`도 함께 갱신합니다.

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

`npm run sync:stock-charts`와 `npm run sync:naver-market`는 기간 버튼(`1일`, `5일`, `20일`, `60일`)에서 쓰는 가격 흐름과 테마/검색/거래대금 랭킹 데이터를 보강합니다. 국내 주식과 국내상장 ETF의 `1일` 미니 차트는 Naver 10분봉(`minute10`)을 사용하고, 기간 수익률과 거래대금 랭킹은 선택 기간 기준으로 다시 정렬하거나 누적 합산합니다.

`npm run sync:krx-openapi -- --date=YYYYMMDD`는 KRX OpenAPI의 전체 31개 엔드포인트 권한과 응답을 확인합니다. 사이트에 우선 필요한 API 신청 상태와 작업 맥락은 `PROJECT_CONTEXT.md`를 참고하세요.

## Scheduled data update

GitHub Actions의 `Update market data` workflow는 매일 한국시간 08:30과 18:30에 실행됩니다. 08:30 실행은 미국장 마감 이후 미국 종목/랭킹 데이터를 갱신하고, 18:30 실행은 KRX 장마감 이후 국내 데이터를 갱신합니다. GitHub cron은 UTC 기준이므로 workflow cron은 각각 `30 23 * * *`, `30 9 * * *`입니다. 같은 workflow는 `workflow_dispatch`로 수동 실행할 수 있습니다.

Workflow는 Python Playwright 런타임을 설치한 뒤 `npm run update:data`, `npm run validate:data`, `npm run check`를 실행하고 변경된 `data/` 파일을 자동 commit/push합니다. GitHub Secrets에 `KRX_USERNAME`, `KRX_PASSWORD`를 넣으면 KRX 연기금 수급과 시가총액 데이터를 장마감 후 직접 갱신합니다. 비밀값이 없을 때는 `KRX_SOURCE_DIR`, 기본 Telegram 원본, 저장소에 포함된 `telegram/data/krx` 중 기존 사이트 데이터보다 더 최신인 CSV 원본만 병합합니다. KRX 기준일이 예상 거래일보다 늦으면 스크립트 자체가 성공해도 `data/update-status.json`에는 `partial` 상태와 지연 사유가 기록됩니다.

KRX 자체 갱신은 기존 최신 CSV 다음 날부터 한국시간 18:30 기준 확정 거래일까지 백필합니다. 주말은 직전 금요일을 기준으로 보고, 공휴일처럼 데이터가 없는 날은 다음 성공 실행 때 다시 확인됩니다.
