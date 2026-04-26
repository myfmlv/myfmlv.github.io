# Telegram Briefing Project

이 프로젝트는 기존 `Hermes agent` + `DBbot`에 흩어져 있던 텔레그램 메시지 수집, 정규화, 시장 스냅샷 결합, 브리핑 생성, 다이제스트 생성, 텔레그램 전달 기능을 한곳으로 옮긴 로컬 워크스페이스다.

## 구조

- `scripts/run_telegram_export.sh` — 텔레그램 export 실행
- `scripts/bootstrap_telegram_export_env.sh` — Telethon 전용 가상환경 생성
- `scripts/run_telegram_delivery.py` — 브리핑/다이제스트 생성 후 바로 Telegram 전송
- `scripts/telegram_bot_gateway.py` — Telegram Bot API 기반 대화형 명령 게이트웨이
- `data/archives` — raw export, 세션, 환경 파일
- `data/analysis/telegram/main` — normalized data, market snapshots, reports, worker 파이프라인
- `data/analysis/telegram/main/worker/channel_selection.json` — 브리핑/저장 대상 채널 선별 규칙
- `data/analysis/telegram/main/worker/rank_channels.py` — 채널 점수 산정 및 랭킹 리포트 생성
- `data/analysis/telegram/main/worker/prune_channel_storage.py` — 선택 제외 채널 저장 데이터 정리

## 빠른 시작

1. `scripts/bootstrap_telegram_export_env.sh`
2. `data/archives/telegram_archive.env.example`를 참고해 `telegram_archive.env`를 채운다
3. NVIDIA NIM 연동이 필요하면 `.env.nim.example`를 참고해 운영 `.env` 또는 scheduler env에 반영한다
4. 최초 1회 로그인: `scripts/run_telegram_export.sh --login`
5. 아카이브 실행: `scripts/run_telegram_export.sh`
6. 브리핑 생성: `python3 data/analysis/telegram/main/worker/run_briefing_pipeline.py`
7. 최신 브리핑 전송: `python3 data/analysis/telegram/main/worker/send_latest_briefing.py`

채널 품질 점수와 선별 대상을 갱신하려면:

```bash
python3 data/analysis/telegram/main/worker/rank_channels.py
python3 data/analysis/telegram/main/worker/prune_channel_storage.py
```

실제 삭제는 아래처럼 명시적으로 실행한다.

```bash
python3 data/analysis/telegram/main/worker/prune_channel_storage.py --apply
```

정기 배치까지 한 번에 돌리려면:

```bash
python3 scripts/run_telegram_delivery.py briefing
```

## Bot Gateway

`TELEGRAM_BOT_TOKEN`과 `TELEGRAM_BOT_CHAT_ID`를 설정한 뒤 아래처럼 실행하면 Hermes 없이도 텔레그램에서 명령을 주고받을 수 있다.

프로젝트는 실행 시 `.env`, `.env.nim`, `data/archives/telegram_archive.env`를 순서대로 자동 로드한다. Hermes가 빈 환경으로 실행하더라도 위 파일들에 값이 있으면 그대로 사용한다.

```bash
python3 scripts/telegram_bot_gateway.py
```

지원 명령:

- `/briefing`
- `/digest weekly`
- `/digest monthly`
- `/export`
- `/latest`
- `/status`
- `/help`
