# 텔레그램 브리핑용 객관지표 수집 설계

## 목적
- 텔레그램 브리핑의 정성 흐름 레이어와 분리된 객관지표 레이어를 구축한다.
- 초실시간보다는 신뢰도, 일관성, 재현 가능성을 우선한다.
- 기본 브리핑 시간은 08:00 / 12:00 / 17:00 KST 기준으로 운영한다.

## 최상위 원칙
1. 공식/준공식 거시 데이터는 FRED를 우선 사용한다.
2. 시장 시세/환율/원자재/지수는 Alpha Vantage를 1순위 벤더로 검토한다.
3. Twelve Data는 백업 벤더 후보로 둔다.
4. 텔레그램은 정성 흐름과 서사 변화 탐지용으로만 사용한다.
5. 객관지표는 별도 snapshot 파일로 저장하고 브리핑 생성 시 불러온다.

## 코어 지표와 권장 소스

| 구분 | 지표 | 이유 | 1순위 소스 | 2순위 소스 | 메모 |
|---|---|---|---|---|---|
| 금리 | 미 2년물 | 정책금리 기대 확인 | FRED | Alpha Vantage | 핵심 |
| 금리 | 미 10년물 | 장기금리/성장/인플레 확인 | FRED | Alpha Vantage | 핵심 |
| 금리 | 2s10s | 경기/정책 체제 보조 해석 | FRED 계산값 | Alpha Vantage | 직접 계산 권장 |
| 달러 | DXY | 전반적 달러 강세/약세 | Alpha Vantage | Twelve Data | 핵심 |
| 환율 | USD/KRW | 한국시장 부담/완화 확인 | Alpha Vantage | Twelve Data | 핵심 |
| 환율 | USD/JPY | 아시아 FX 분위기 확인 | Alpha Vantage | Twelve Data | 중요 |
| 환율 | EUR/USD | 달러 방향 보조 | Alpha Vantage | Twelve Data | 보조 |
| 에너지 | WTI | 위험자산/인플레/지정학 영향 | Alpha Vantage | Twelve Data | 핵심 |
| 에너지 | Brent | 글로벌 원유 체감 | Alpha Vantage | Twelve Data | 핵심 |
| 에너지 | Nat Gas | LNG/에너지 체인 확인 | Alpha Vantage | Twelve Data | 중요 |
| 변동성 | VIX | risk-on / risk-off 확인 | Alpha Vantage | Twelve Data | 핵심 |
| 주식 | S&P500 | 미국 위험자산 메인 축 | Alpha Vantage | Twelve Data | 핵심 |
| 주식 | NASDAQ | 성장주/AI 위험선호 축 | Alpha Vantage | Twelve Data | 핵심 |
| 반도체 | SOX | AI/반도체 체인 확인 | Alpha Vantage | Twelve Data | 핵심 |
| 금속 | Gold | 안전자산/실질금리/달러 해석 | Alpha Vantage | Twelve Data | 중요 |
| 금속 | Copper | 경기민감/산업활동 확인 | Alpha Vantage | Twelve Data | 중요 |

## 2차 후보 지표
- MOVE
- HY OAS
- KOSPI / KOSDAQ / KOSPI200
- Diesel / 정제품
- LNG / TTF / JKM proxy
- NVDA / TSMC

## 운영 구조

### 1. 시장 snapshot 수집
- 경로: `data/analysis/telegram/main/market_snapshots/`
- 파일명 예시: `2026-04-03_0800_kst.json`
- 기본 필드:
  - `asOfKst`
  - `sources`
  - `symbols`
  - `errors`

### 2. 텔레그램 브리핑 생성
- 최근 브리핑 이후 normalized 메시지를 집계
- dedupe 및 노이즈 제거 적용
- 외부 market snapshot 파일을 함께 읽음
- 브리핑 산출물에 `핵심 / 객관 지표 / 해석 / 전망 / 체크포인트`를 포함

## 추천 구현 순서
1. FRED에서 금리/거시 코어 지표 확보
2. Alpha Vantage에서 환율/원자재/지수 코어 지표 확보
3. Twelve Data를 백업 소스로 준비
4. 브리핑 생성기에서 snapshot 파일을 읽도록 연결
5. 필요 시 ranto28 스타일 참조 지표를 2단계 확장으로 추가

## 결론
- 신뢰 축: FRED
- 시장 시세 메인 축: Alpha Vantage
- 백업 벤더: Twelve Data
- 텔레그램은 정성 흐름 전용
