# Suggested Schedule

기존 Hermes 크론 흐름을 이 프로젝트 기준으로 옮길 때 사용할 수 있는 실행 포인트다.

## 추천 배치 명령

- 정기 export: `cd /Users/Park/Documents/01_Projects/Telegram && zsh scripts/run_telegram_export.sh`
- 정기 브리핑 + 전송: `cd /Users/Park/Documents/01_Projects/Telegram && python3 scripts/run_telegram_delivery.py briefing`
- 주간 다이제스트 + 전송: `cd /Users/Park/Documents/01_Projects/Telegram && python3 scripts/run_telegram_delivery.py weekly`
- 월간 다이제스트 + 전송: `cd /Users/Park/Documents/01_Projects/Telegram && python3 scripts/run_telegram_delivery.py monthly`

## Hermes 기준 매핑

- 08:20 KST pre-open briefing: 전일 마감 이후~개장 직전 누적 재료를 한 번에 정리하는 pre-open desk note
- 12:40 KST midday pulse: 오전장/점심 전후 업데이트만 짧게 반영하는 midday pulse
- 17:10 KST close wrap: 장 마감 이후 핵심 판단과 다음 체크포인트를 남기는 close wrap
- 일요일 20:00 KST weekly digest
- 월말 20:00 KST monthly digest

## 브리핑 톤 가이드

- 이벤트 나열보다 가격 반응과 해석 변화
- 과장된 헤드라인 톤보다 운영 가능한 house note 톤
- 다음 의사결정 직전에 바로 쓸 수 있는 체크포인트 중심

## 비고

- 실제 스케줄러는 `launchd`, `cron`, GitHub Actions, Codex automation 중 편한 걸 사용하면 된다.
- Hermes가 다른 워크스페이스 별칭이나 심볼릭 링크에서 실행되면 `TELEGRAM_PROJECT_ROOT=/Users/Park/Documents/01_Projects/Telegram`를 함께 넘겨 경로를 고정하는 편이 안전하다.
- `send_latest_briefing.py`와 `telegram_bot_gateway.py`는 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_CHAT_ID`를 사용한다.
