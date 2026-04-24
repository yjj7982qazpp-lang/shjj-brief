from pathlib import Path
from datetime import date, datetime, timedelta
from urllib.parse import urlencode
from urllib.request import urlopen, Request
import json
import os
import time

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = Path(__file__).resolve().parent

WATCHED_PATH = SCRIPTS_DIR / "watched_laws.json"
OUTPUT_PATH = ROOT / "data" / "law_updates.json"
STATUS_PATH = ROOT / "DEPLOY_STATUS.txt"

LAW_API_URL = "http://www.law.go.kr/DRF/lawSearch.do"


def read_json(path, fallback):
    if not path.exists():
        return fallback

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def yyyymmdd(day):
    return day.strftime("%Y%m%d")


def yyyy_mm_dd(value):
    text = str(value or "").strip()

    if len(text) == 8 and text.isdigit():
        return f"{text[0:4]}-{text[4:6]}-{text[6:8]}"

    return ""


def normalize_law_name(value):
    return str(value or "").replace(" ", "").strip()


def extract_items(data):
    if not isinstance(data, dict):
        return []

    root = data.get("LawSearch") or data.get("lawSearch") or data

    if not isinstance(root, dict):
        return []

    law = root.get("law")

    if law is None:
        return []

    if isinstance(law, list):
        return law

    if isinstance(law, dict):
        return [law]

    return []


def fetch_law_changes_by_reg_date(oc, reg_date):
    params = {
        "target": "lsHstInf",
        "OC": oc,
        "regDt": reg_date,
        "type": "JSON",
        "display": "100",
        "page": "1"
    }

    url = f"{LAW_API_URL}?{urlencode(params)}"

    request = Request(
        url,
        headers={
            "User-Agent": "SHJJ-Brief-GitHubActions/1.0"
        }
    )

    with urlopen(request, timeout=20) as response:
        raw = response.read().decode("utf-8", errors="replace")

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def make_empty_law_item(law):
    return {
        "law_name": law["name"],
        "category": law.get("category", ""),
        "status": "no_change",
        "status_label": "변경 없음",
        "effective_date": "",
        "promulgation_date": "",
        "amendment_type": "",
        "impact": "낮음",
        "summary": "오늘부터 새로 시행되는 변경사항이 확인되지 않았습니다.",
        "change_summary": "",
        "source_url": ""
    }


def convert_api_item(item, watched_map):
    law_name = item.get("법령명한글") or item.get("법령명") or item.get("lawNm") or ""
    normalized = normalize_law_name(law_name)

    watched = watched_map.get(normalized, {})
    category = watched.get("category", "관심 법령")

    effective_date = yyyy_mm_dd(item.get("시행일자"))
    promulgation_date = yyyy_mm_dd(item.get("공포일자"))
    amendment_type = item.get("제개정구분명") or ""
    detail_link = item.get("법령상세링크") or ""

    change_summary = []

    if amendment_type:
        change_summary.append(f"{amendment_type} 사항이 시행 기준으로 확인되었습니다.")

    if effective_date:
        change_summary.append(f"시행일은 {effective_date}입니다.")

    change_summary.append("세부 변경 전후 내용은 원문 확인 및 다음 단계의 상세 비교 기능에서 검토합니다.")

    return {
        "law_name": law_name,
        "category": category,
        "status": "changed",
        "status_label": "변경 있음",
        "effective_date": effective_date,
        "promulgation_date": promulgation_date,
        "amendment_type": amendment_type,
        "impact": "확인 필요",
        "summary": " ".join(change_summary),
        "change_summary": " ".join(change_summary),
        "source_url": detail_link
    }


def bucket_by_effective_date(items, today):
    week_start = today - timedelta(days=6)
    month_start = today - timedelta(days=29)

    today_items = []
    week_items = []
    month_items = []

    for item in items:
        effective = item.get("effective_date")

        if not effective:
            continue

        try:
            y, m, d = map(int, effective.split("-"))
            effective_day = date(y, m, d)
        except Exception:
            continue

        if effective_day == today:
            today_items.append(item)

        if week_start <= effective_day <= today:
            week_items.append(item)

        if month_start <= effective_day <= today:
            month_items.append(item)

    return today_items, week_items, month_items


def dedupe(items):
    seen = set()
    result = []

    for item in items:
        key = (
            item.get("law_name", ""),
            item.get("effective_date", ""),
            item.get("promulgation_date", ""),
            item.get("amendment_type", "")
        )

        if key in seen:
            continue

        seen.add(key)
        result.append(item)

    return result


def main():
    watched_laws = read_json(WATCHED_PATH, [])
    oc = os.environ.get("LAW_OC", "test").strip() or "test"

    today = date.today()

    watched_map = {
        normalize_law_name(item["name"]): item
        for item in watched_laws
        if item.get("name")
    }

    all_changed_items = []
    errors = []

    for delta in range(0, 30):
        target_day = today - timedelta(days=delta)
        reg_date = yyyymmdd(target_day)

        try:
            data = fetch_law_changes_by_reg_date(oc, reg_date)
            api_items = extract_items(data)

            for api_item in api_items:
                law_name = api_item.get("법령명한글") or api_item.get("법령명") or api_item.get("lawNm") or ""
                normalized = normalize_law_name(law_name)

                if normalized in watched_map:
                    all_changed_items.append(convert_api_item(api_item, watched_map))

            time.sleep(0.08)

        except Exception as e:
            errors.append({
                "date": reg_date,
                "error": str(e)
            })

    all_changed_items = dedupe(all_changed_items)

    today_changed, week_changed, month_changed = bucket_by_effective_date(all_changed_items, today)

    today_list = []

    for law in watched_laws:
        normalized = normalize_law_name(law["name"])
        changed_item = next(
            (item for item in today_changed if normalize_law_name(item.get("law_name")) == normalized),
            None
        )

        if changed_item:
            today_list.append(changed_item)
        else:
            today_list.append(make_empty_law_item(law))

    now_text = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    result = {
        "checked_at": today.isoformat(),
        "synced_at": now_text,
        "basis": "시행일 기준",
        "scope": "입법예고 제외, 실제 효력이 시작되는 시행일 기준으로 오늘·최근 7일·최근 30일을 확인합니다.",
        "notice": "GitHub Actions 자동 실행 결과입니다.",
        "watched_laws": watched_laws,
        "summary": {
            "today_changes": len(today_changed),
            "last_7_days_changes": len(week_changed),
            "last_30_days_changes": len(month_changed)
        },
        "today": today_list,
        "last_7_days": week_changed,
        "last_30_days": month_changed,
        "collector": {
            "version": "github_actions_law_collector_v1",
            "oc_mode": "test" if oc == "test" else "custom",
            "errors": errors[:10]
        }
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    today_count = len(today_changed)
    week_count = len(week_changed)
    month_count = len(month_changed)

    status_text = f"""SHJJ Brief Deploy Status

Last synced by GitHub Actions: {now_text}

Law update summary:
- Today: {today_count}
- Last 7 days: {week_count}
- Last 30 days: {month_count}

Sync status: success
"""

    STATUS_PATH.write_text(status_text, encoding="utf-8")

    print("완료: GitHub Actions 법령 데이터 갱신")
    print(f"오늘 시행 변경: {today_count}건")
    print(f"최근 7일 시행 변경: {week_count}건")
    print(f"최근 30일 시행 변경: {month_count}건")


if __name__ == "__main__":
    main()
