#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import os
import shlex
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Frame, Page, TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


MENU_URL = "https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020303"
LOGIN_URL = "https://data.krx.co.kr/contents/MDC/COMS/client/MDCCOMS001.cmd"
JSON_URL = "https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"
BROWSER_PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-krx"
DEFAULT_ENV_FILE = Path(__file__).resolve().parent.parent / ".env.krx"

MARKET_TO_CODE = {
    "KOSPI": "STK",
    "KOSDAQ": "KSQ",
    "KONEX": "KNX",
    "ALL": "ALL",
}

INVESTOR_TO_CODE = {
    "금융투자": "1000",
    "보험": "2000",
    "투신": "3000",
    "사모": "3100",
    "은행": "4000",
    "기타금융": "5000",
    "연기금": "6000",
    "연기금등": "6000",
    "연기금 등": "6000",
    "기관합계": "7050",
    "기타법인": "7100",
    "개인": "8000",
    "외국인": "9000",
    "기타외국인": "9001",
    "전체": "9999",
}

OUTPUT_COLUMNS = [
    "날짜",
    "시장",
    "투자자",
    "티커",
    "종목명",
    "매도거래량",
    "매수거래량",
    "순매수거래량",
    "매도거래대금",
    "매수거래대금",
    "순매수거래대금",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="KRX 연기금 순매수/순매도 종목을 거래일별 CSV로 저장합니다."
    )
    parser.add_argument("--start", required=True, help="시작일 (YYYYMMDD)")
    parser.add_argument("--end", help="종료일 (YYYYMMDD). 생략 시 시작일과 동일")
    parser.add_argument(
        "--market",
        default="ALL",
        choices=sorted(MARKET_TO_CODE),
        help="시장 구분",
    )
    parser.add_argument(
        "--investor",
        default="연기금 등",
        help="투자자 구분 (기본값: 연기금 등)",
    )
    parser.add_argument(
        "--output-dir",
        default=str(Path(__file__).resolve().parent.parent / "data" / "krx"),
        help="CSV 저장 디렉터리",
    )
    parser.add_argument(
        "--env-file",
        default=str(DEFAULT_ENV_FILE),
        help="로그인 정보가 들어 있는 env 파일 경로",
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
    parser.add_argument(
        "--browser-channel",
        default=os.environ.get("KRX_BROWSER_CHANNEL", "chrome"),
        help="Playwright 브라우저 채널. 빈 문자열이면 번들 Chromium을 사용합니다.",
    )
    parser.add_argument(
        "--keep-negative",
        action="store_true",
        help="호환용 옵션입니다. 현재는 기본으로 순매도 행까지 함께 저장합니다.",
    )
    parser.add_argument(
        "--positive-only",
        action="store_true",
        help="순매수 금액이 양수인 행만 저장",
    )
    return parser.parse_args()


def parse_yyyymmdd(value: str) -> date:
    return datetime.strptime(value, "%Y%m%d").date()


def iter_dates(start: date, end: date) -> Iterable[date]:
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def normalize_investor(name: str) -> str:
    key = name.strip()
    if key not in INVESTOR_TO_CODE:
        supported = ", ".join(sorted(INVESTOR_TO_CODE))
        raise SystemExit(f"지원하지 않는 investor: {name}\n지원값: {supported}")
    return key


def load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if path.exists():
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            if not key:
                continue
            if value:
                value = shlex.split(value)[0] if value[0] in {"'", '"'} else value
            env[key] = value

    for key in ("KRX_USERNAME", "KRX_PASSWORD", "KRX_API_KEY"):
        if os.environ.get(key):
            env.setdefault(key, os.environ[key])

    return env


def fetch_json_via_browser(page: Page, trade_date: str, market_code: str, investor_code: str) -> dict:
    payload = page.evaluate(
        """async ({ url, tradeDate, marketCode, investorCode }) => {
            const params = new URLSearchParams({
              bld: 'dbms/MDC/STAT/standard/MDCSTAT02401',
              strtDd: tradeDate,
              endDd: tradeDate,
              mktId: marketCode,
              invstTpCd: investorCode,
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
        {
            "url": JSON_URL,
            "tradeDate": trade_date,
            "marketCode": market_code,
            "investorCode": investor_code,
        },
    )

    text = payload["text"]
    if text.strip() == "LOGOUT":
        raise PermissionError("KRX 세션이 만료되었거나 로그인되지 않았습니다.")

    if payload["status"] != 200:
        raise RuntimeError(f"KRX 응답 오류(status={payload['status']}): {text[:200]}")

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"KRX JSON 파싱 실패: {text[:200]}") from exc


def get_login_frame(page: Page) -> Frame:
    page.goto(LOGIN_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    frame = page.frame(url=lambda url: url is not None and "login.jsp" in url)
    if frame is None:
        raise RuntimeError("KRX 로그인 프레임을 찾지 못했습니다.")
    return frame


def login_with_credentials(page: Page, username: str, password: str) -> None:
    frame = get_login_frame(page)
    frame.locator("#mbrId").fill(username)
    frame.locator("input[name='pw']").fill(password)
    frame.locator(".jsLoginBtn").click()
    page.wait_for_timeout(2500)

    try:
        if frame.get_by_text("이미 로그인된 계정입니다").is_visible(timeout=1000):
            frame.get_by_text("확인", exact=True).last.click()
            page.wait_for_timeout(2500)
    except (PlaywrightTimeoutError, PlaywrightError):
        pass


def ensure_login(page: Page, username: str | None, password: str | None, manual_login: bool) -> None:
    page.goto(MENU_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)

    try:
        fetch_json_via_browser(page, "20260423", "STK", "6000")
        return
    except (PermissionError, RuntimeError):
        pass

    if username and password and not manual_login:
        login_with_credentials(page, username, password)
        page.goto(MENU_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        try:
            fetch_json_via_browser(page, "20260423", "STK", "6000")
            return
        except PermissionError as exc:
            print(f"\n.env.krx 자동 로그인 후에도 세션 확인에 실패했습니다: {exc}", flush=True)

    print(
        "\nKRX 로그인이 필요합니다.\n"
        "열린 Chrome 창에서 로그인한 뒤 이 터미널로 돌아와 Enter를 누르세요.",
        flush=True,
    )
    if not sys.stdin.isatty():
        raise SystemExit("비대화형 실행에서는 수동 로그인을 기다릴 수 없습니다. .env.krx 값을 확인하세요.")
    input()
    page.goto(MENU_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    fetch_json_via_browser(page, "20260423", "STK", "6000")


def clean_number(value: str) -> int:
    text = (value or "0").replace(",", "").replace("/", "").strip()
    if text in {"", "-"}:
        return 0
    return int(text)


def normalize_rows(
    rows: list[dict],
    trade_date: str,
    market: str,
    investor: str,
    positive_only: bool,
) -> list[dict]:
    normalized = []
    for row in rows:
        item = {
            "날짜": trade_date,
            "시장": market,
            "투자자": investor,
            "티커": str(row.get("ISU_SRT_CD", "")).zfill(6),
            "종목명": row.get("ISU_NM", ""),
            "매도거래량": clean_number(row.get("ASK_TRDVOL", "0")),
            "매수거래량": clean_number(row.get("BID_TRDVOL", "0")),
            "순매수거래량": clean_number(row.get("NETBID_TRDVOL", "0")),
            "매도거래대금": clean_number(row.get("ASK_TRDVAL", "0")),
            "매수거래대금": clean_number(row.get("BID_TRDVAL", "0")),
            "순매수거래대금": clean_number(row.get("NETBID_TRDVAL", "0")),
        }
        if positive_only and item["순매수거래대금"] <= 0:
            continue
        normalized.append(item)
    return normalized


def save_csv(rows: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    args = parse_args()
    start = parse_yyyymmdd(args.start)
    end = parse_yyyymmdd(args.end or args.start)
    if end < start:
        raise SystemExit("--end는 --start보다 빠를 수 없습니다.")

    env_values = load_env_file(Path(args.env_file).expanduser())
    username = env_values.get("KRX_USERNAME")
    password = env_values.get("KRX_PASSWORD")

    investor = normalize_investor(args.investor)
    market = args.market.upper()
    market_code = MARKET_TO_CODE[market]
    investor_code = INVESTOR_TO_CODE[investor]
    output_dir = Path(args.output_dir).resolve()

    BROWSER_PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        try:
            launch_options = {"headless": args.headless}
            if args.browser_channel:
                launch_options["channel"] = args.browser_channel
            context = playwright.chromium.launch_persistent_context(
                str(BROWSER_PROFILE_DIR),
                **launch_options,
            )
        except PlaywrightTimeoutError as exc:
            raise SystemExit(f"Chrome 실행 실패: {exc}") from exc

        page = context.pages[0] if context.pages else context.new_page()

        try:
            ensure_login(page, username, password, manual_login=args.manual_login)

            for current in iter_dates(start, end):
                trade_date = current.strftime("%Y%m%d")
                data = fetch_json_via_browser(page, trade_date, market_code, investor_code)
                rows = normalize_rows(
                    data.get("output", []),
                    trade_date=trade_date,
                    market=market,
                    investor=investor,
                    positive_only=args.positive_only,
                )

                if not rows:
                    print(f"{trade_date}: 데이터 없음")
                    continue

                output_path = output_dir / f"krx_{trade_date}.csv"
                save_csv(rows, output_path)
                print(f"{trade_date}: {len(rows)}건 저장 -> {output_path}")
        finally:
            context.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
