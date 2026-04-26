#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from download_krx_pension_netbuys import (
    BROWSER_PROFILE_DIR,
    DEFAULT_ENV_FILE,
    JSON_URL,
    clean_number,
    ensure_login,
    load_env_file,
    parse_yyyymmdd,
)


DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "krx"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="KRX 일별 시세/시가총액 데이터를 JSON으로 저장합니다."
    )
    parser.add_argument("--date", help="기준일 (YYYYMMDD). 생략 시 data/krx 최신 CSV 날짜 사용")
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="JSON 저장 디렉터리",
    )
    parser.add_argument(
        "--env-file",
        default=str(DEFAULT_ENV_FILE),
        help="KRX 로그인 정보가 들어 있는 env 파일 경로",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="헤드리스 모드 사용. KRX가 막으면 끄세요.",
    )
    parser.add_argument(
        "--manual-login",
        action="store_true",
        help="env 로그인 대신 수동 로그인만 사용",
    )
    return parser.parse_args()


def latest_krx_csv_date(output_dir: Path) -> str | None:
    files = sorted(output_dir.glob("krx_*.csv"))
    if not files:
        return None
    return files[-1].stem.replace("krx_", "")


def format_market_cap(value: int) -> str:
    if value >= 1_000_000_000_000:
        return f"{round(value / 1_000_000_000_000):,}조"
    if value >= 100_000_000:
        return f"{round(value / 100_000_000):,}억"
    return f"{value:,}"


def fetch_market_meta(page, trade_date: str) -> list[dict]:
    payload = page.evaluate(
        """async ({ url, tradeDate }) => {
            const params = new URLSearchParams({
              bld: 'dbms/MDC/STAT/standard/MDCSTAT01501',
              mktId: 'ALL',
              trdDd: tradeDate,
              share: '1',
              money: '1',
              csvxls_isNo: 'false',
            });

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
              },
              credentials: 'include',
              body: params.toString(),
            });

            const text = await response.text();
            return { status: response.status, text };
        }""",
        {"url": JSON_URL, "tradeDate": trade_date},
    )

    text = payload["text"]
    if text.strip() == "LOGOUT":
        raise PermissionError("KRX 세션이 만료되었거나 로그인되지 않았습니다.")
    if payload["status"] != 200:
        raise RuntimeError(f"KRX 응답 오류(status={payload['status']}): {text[:200]}")

    data = json.loads(text)
    return data.get("OutBlock_1", [])


def normalize_meta(rows: list[dict], trade_date: str) -> dict[str, dict]:
    normalized: dict[str, dict] = {}

    for row in rows:
        ticker = str(row.get("ISU_SRT_CD", "")).zfill(6)
        market_cap = clean_number(row.get("MKTCAP", "0"))
        if not ticker or market_cap <= 0:
            continue

        normalized[ticker] = {
            "ticker": ticker,
            "name": row.get("ISU_ABBRV", ""),
            "market": row.get("MKT_NM", ""),
            "sector": row.get("SECT_TP_NM", ""),
            "marketCap": market_cap,
            "marketCapLabel": format_market_cap(market_cap),
            "price": clean_number(row.get("TDD_CLSPRC", "0")),
            "changeRate": float(str(row.get("FLUC_RT", "0")).replace(",", "") or 0),
            "volume": clean_number(row.get("ACC_TRDVOL", "0")),
            "amount": clean_number(row.get("ACC_TRDVAL", "0")),
            "listedShares": clean_number(row.get("LIST_SHRS", "0")),
            "tradeDate": trade_date,
            "source": "KRX",
            "updatedAt": datetime.now().isoformat(timespec="seconds"),
        }

    return normalized


def main() -> int:
    args = parse_args()
    output_dir = Path(args.output_dir).expanduser().resolve()
    trade_date = args.date or latest_krx_csv_date(output_dir)
    if not trade_date:
        raise SystemExit("--date를 지정하거나 data/krx에 krx_YYYYMMDD.csv가 있어야 합니다.")
    parse_yyyymmdd(trade_date)

    env_values = load_env_file(Path(args.env_file).expanduser())
    username = env_values.get("KRX_USERNAME")
    password = env_values.get("KRX_PASSWORD")

    BROWSER_PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        try:
            context = playwright.chromium.launch_persistent_context(
                str(BROWSER_PROFILE_DIR),
                channel="chrome",
                headless=args.headless,
            )
        except PlaywrightTimeoutError as exc:
            raise SystemExit(f"Chrome 실행 실패: {exc}") from exc

        page = context.pages[0] if context.pages else context.new_page()
        try:
            ensure_login(page, username, password, manual_login=args.manual_login)
            rows = fetch_market_meta(page, trade_date)
            meta = normalize_meta(rows, trade_date)
        finally:
            context.close()

    if not meta:
        raise SystemExit(f"{trade_date}: 시가총액 데이터가 없습니다.")

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"stock_meta_{trade_date}.json"
    output_path.write_text(f"{json.dumps(meta, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    print(f"{trade_date}: {len(meta)}개 시총 데이터 저장 -> {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
