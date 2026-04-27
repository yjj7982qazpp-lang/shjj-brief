from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json
import os
import re

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = Path(__file__).resolve().parent

WATCHED_PATH = SCRIPTS_DIR / "watched_laws.json"
OUTPUT_PATH = ROOT / "data" / "law_updates.json"

API_ENDPOINTS = [
    "https://www.law.go.kr/DRF/lawSearch.do",
    "http://www.law.go.kr/DRF/lawSearch.do",
]
API_TIMEOUT = 20
KST = timezone(timedelta(hours=9))
NAME_CLEANUP_RE = re.compile(r"[\s\W_]+", re.UNICODE)

HIGH_PRIORITY_RULES = [
    ("건축", "건축"),
    ("도시", "도시계획"),
    ("주택", "주택"),
    ("국토", "국토"),
    ("안전", "안전"),
    ("소방", "소방"),
    ("화재", "소방"),
    ("환경", "환경"),
    ("에너지", "에너지"),
    ("녹색", "환경ㆍ에너지"),
    ("시설물", "시설물 안전"),
]


class LawApiError(Exception):
    def __init__(self, attempts):
        super().__init__("법제처 API 호출 실패")
        self.attempts = attempts


def read_json(path, fallback):
    if not path.exists():
        return fallback

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(payload):
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def today_kst():
    return datetime.now(KST).date()


def to_api_date(day):
    return day.strftime("%Y%m%d")


def to_output_date(day):
    return day.strftime("%Y-%m-%d")


def parse_date(value):
    text = str(value or "").strip()
    if not text:
        return None

    digits = re.sub(r"\D", "", text)
    if len(digits) >= 8:
        try:
            return datetime.strptime(digits[:8], "%Y%m%d").date()
        except ValueError:
            return None

    try:
        return datetime.strptime(text[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def normalize_name(value):
    return NAME_CLEANUP_RE.sub("", str(value or ""))


def pick(item, *keys):
    for key in keys:
        value = item.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def safe_dict_list(value):
    return value if isinstance(value, list) else []


def extract_items(data):
    if not isinstance(data, dict):
        return []

    root = data.get("LawSearch") or data.get("lawSearch") or data
    if not isinstance(root, dict):
        return []

    law = root.get("law")
    if isinstance(law, list):
        return [item for item in law if isinstance(item, dict)]
    if isinstance(law, dict):
        return [law]
    return []


def classify_law(law_name, ministry, watched_map):
    watched = watched_map.get(normalize_name(law_name))
    if watched:
        return watched.get("category", "기타"), watched.get("priority", 3)

    target_text = f"{law_name} {ministry}"
    for keyword, category in HIGH_PRIORITY_RULES:
        if keyword in target_text:
            return category, 1

    return "기타", 3


def build_detail_url(raw_link):
    if not raw_link:
        return ""
    if raw_link.startswith("http://") or raw_link.startswith("https://"):
        return raw_link
    if raw_link.startswith("/"):
        return f"https://www.law.go.kr{raw_link}"
    return f"https://www.law.go.kr/{raw_link.lstrip('/')}"


def summarize_attempts(attempts):
    parts = []
    for attempt in attempts[:3]:
        label = attempt.get("label", "api")
        code = attempt.get("code", "error")
        message = attempt.get("message", "")
        parts.append(f"{label}:{code}:{message}")
    return " | ".join(parts)


def fetch_api_once(base_url, params, label):
    url = f"{base_url}?{urlencode(params)}"
    request = Request(
        url,
        headers={
            "User-Agent": "SHJJ-Brief-LawCollector/2.1",
            "Accept": "application/json",
        },
    )

    with urlopen(request, timeout=API_TIMEOUT) as response:
        raw = response.read().decode("utf-8", errors="replace")

    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise LawApiError([
            {
                "label": label,
                "code": "json_decode_error",
                "message": str(error),
                "raw_sample": raw[:240],
            }
        ])


def fetch_api(params, label):
    attempts = []

    for base_url in API_ENDPOINTS:
        try:
            return fetch_api_once(base_url, params, label), attempts
        except HTTPError as error:
            raw = error.read().decode("utf-8", errors="replace") if error.fp else ""
            attempts.append(
                {
                    "label": label,
                    "code": "http_error",
                    "message": f"HTTP {error.code}",
                    "raw_sample": raw[:240],
                }
            )
        except LawApiError as error:
            attempts.extend(error.attempts)
        except (TimeoutError, URLError, OSError) as error:
            attempts.append(
                {
                    "label": label,
                    "code": "request_error",
                    "message": str(error)[:180],
                }
            )

    raise LawApiError(attempts)


def fetch_law_search(oc, target, extra_params, label):
    params = {
        "OC": oc,
        "target": target,
        "type": "JSON",
        "search": "1",
        **extra_params,
    }
    return fetch_api(params, label)


def fetch_effective_laws(oc, day):
    day_text = to_api_date(day)
    return fetch_law_search(
        oc,
        "eflaw",
        {
            "efYd": f"{day_text}~{day_text}",
            "display": "100",
            "page": "1",
            "sort": "efdes",
        },
        "today_effective",
    )


def fetch_promulgated_laws(oc):
    return fetch_law_search(
        oc,
        "law",
        {
            "display": "100",
            "page": "1",
            "sort": "ddes",
        },
        "today_promulgated",
    )


def fetch_history_laws(oc, start_day, end_day):
    return fetch_law_search(
        oc,
        "lsJoHstInf",
        {
            "fromRegDt": to_api_date(start_day),
            "toRegDt": to_api_date(end_day),
            "display": "100",
            "page": "1",
        },
        "today_history",
    )


def source_date_for(item, source_type):
    if source_type == "effective":
        return parse_date(pick(item, "시행일자", "effectiveDate"))
    if source_type == "promulgated":
        return parse_date(pick(item, "공포일자", "promulgationDate"))
    return parse_date(pick(item, "조문개정일", "조문시행일", "공포일자", "시행일자"))


def convert_api_item(item, watched_map, source_type, source_note):
    law_name = pick(item, "법령명한글", "법령명", "lawNm", "법령명한글HTML")
    ministry = pick(item, "소관부처명", "소관부처", "ministry")
    law_type = pick(item, "법령구분명", "법령구분", "lawType")
    revision_type = pick(item, "제개정구분명", "제개정구분", "revisionType")
    promulgation_date_obj = parse_date(pick(item, "공포일자", "promulgationDate"))
    effective_date_obj = parse_date(pick(item, "시행일자", "effectiveDate"))
    promulgation_date = to_output_date(promulgation_date_obj) if promulgation_date_obj else ""
    effective_date = to_output_date(effective_date_obj) if effective_date_obj else ""
    detail_url = build_detail_url(pick(item, "법령상세링크", "상세링크", "detailUrl"))
    category, priority = classify_law(law_name, ministry, watched_map)
    source_date = source_date_for(item, source_type)
    source_date_text = to_output_date(source_date) if source_date else ""

    if source_type == "effective":
        summary = "오늘 시행되는 현행법령으로 확인되었습니다."
    elif source_type == "promulgated":
        summary = "오늘 공포된 현행법령으로 확인되었습니다."
    else:
        summary = "조문 개정 이력에서 확인된 법령 변경입니다."

    detail_parts = []
    if revision_type:
        detail_parts.append(f"{revision_type} 법령입니다.")
    if ministry:
        detail_parts.append(f"소관부처는 {ministry}입니다.")
    if law_type:
        detail_parts.append(f"법령구분은 {law_type}입니다.")
    if source_note:
        detail_parts.append(source_note)

    summary = f"{summary} {' '.join(detail_parts)}".strip()

    return {
        "law_name": law_name,
        "category": category,
        "ministry": ministry,
        "law_type": law_type,
        "revision_type": revision_type,
        "promulgation_date": promulgation_date,
        "effective_date": effective_date,
        "summary": summary,
        "detail_url": detail_url,
        "source": (
            "법제처 eflaw(시행일) 목록"
            if source_type == "effective"
            else "법제처 law(공포일) 목록"
            if source_type == "promulgated"
            else "법제처 lsJoHstInf(조문 개정 이력)"
        ),
        "source_type": source_type,
        "source_note": source_note,
        "source_date": source_date_text,
        "priority": priority,
        "status": "changed",
        "status_label": "변경 있음",
        "amendment_type": revision_type,
        "impact": "높음" if priority == 1 else "확인 필요",
        "change_summary": summary,
        "source_url": detail_url,
    }


def item_sort_key(item):
    date = parse_date(item.get("source_date")) or parse_date(item.get("effective_date")) or parse_date(item.get("promulgation_date"))
    return (
        item.get("priority", 9),
        -(date.toordinal() if date else 0),
        item.get("law_name", ""),
        item.get("source_type", ""),
    )


def item_key(item):
    return (
        normalize_name(item.get("law_name")),
        item.get("source_date", ""),
        item.get("revision_type", ""),
        item.get("effective_date", ""),
        item.get("promulgation_date", ""),
    )


def dedupe(items):
    seen = set()
    result = []

    for item in items:
        key = item_key(item)
        if key in seen:
            continue
        seen.add(key)
        result.append(item)

    return result


def filter_window(items, start_day, end_day):
    result = []
    for item in items:
        item_date = parse_date(item.get("source_date"))
        if item_date and start_day <= item_date <= end_day:
            result.append(item)
    return result


def build_tracked_laws(today, watched_laws, all_items, previous_data):
    watched_map = {
        normalize_name(item.get("name")): item
        for item in watched_laws
        if isinstance(item, dict) and item.get("name")
    }
    previous_map = {
        normalize_name(item.get("law_name")): item
        for item in previous_data.get("tracked_laws", [])
        if isinstance(item, dict) and item.get("law_name")
    }

    latest_by_law = {}
    for item in all_items:
        key = normalize_name(item.get("law_name"))
        if key not in watched_map:
            continue

        current_date = parse_date(item.get("source_date"))
        previous = latest_by_law.get(key)
        previous_date = parse_date(previous.get("source_date")) if previous else None
        if not previous or (current_date and previous_date and current_date > previous_date):
            latest_by_law[key] = item

    today_text = to_output_date(today)
    tracked = []

    for law in watched_laws:
        name = law.get("name", "")
        key = normalize_name(name)
        previous = previous_map.get(key, {})
        latest = latest_by_law.get(key)
        previous_date = previous.get("latest_update_date", "")
        latest_date = latest.get("source_date", "") if latest else ""

        if latest and latest_date == today_text:
            status = "today_updated"
            final_date = today_text
            final_type = latest.get("source", previous.get("latest_update_type", ""))
            effective_date = latest.get("effective_date", previous.get("effective_date", ""))
            ministry = latest.get("ministry", previous.get("ministry", ""))
            detail_url = latest.get("detail_url", previous.get("detail_url", ""))
        elif previous_date and previous_date != "확인 필요":
            status = previous.get("status", "watching") or "watching"
            final_date = previous_date
            final_type = previous.get("latest_update_type", "")
            effective_date = previous.get("effective_date", "")
            ministry = previous.get("ministry", "")
            detail_url = previous.get("detail_url", "")
        elif latest_date:
            status = "recent_updated"
            final_date = latest_date
            final_type = latest.get("source", "")
            effective_date = latest.get("effective_date", "")
            ministry = latest.get("ministry", "")
            detail_url = latest.get("detail_url", "")
        else:
            status = "check_required"
            final_date = "확인 필요"
            final_type = previous.get("latest_update_type", "")
            effective_date = previous.get("effective_date", "")
            ministry = previous.get("ministry", "")
            detail_url = previous.get("detail_url", "")

        if final_date == previous_date and previous_date not in ("", "확인 필요") and status != "today_updated":
            status = previous.get("status", "watching") or "watching"

        tracked.append(
            {
                "law_name": name,
                "category": law.get("category", previous.get("category", "기타")),
                "latest_update_date": final_date,
                "latest_update_type": final_type,
                "effective_date": effective_date,
                "ministry": ministry,
                "status": status,
                "priority": law.get("priority", previous.get("priority", 3)),
                "detail_url": detail_url,
            }
        )

    return tracked


def build_payload(
    today,
    watched_laws,
    all_items,
    tracked_laws,
    api_status,
    notice,
    error_text="",
    errors=None,
):
    now_text = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S KST")
    start_7 = today - timedelta(days=6)
    start_30 = today - timedelta(days=29)

    sorted_items = sorted(dedupe(all_items), key=item_sort_key)
    today_items = filter_window(sorted_items, today, today)
    last_7_days_items = filter_window(sorted_items, start_7, today)
    last_30_days_items = filter_window(sorted_items, start_30, today)
    today_effective_items = [item for item in today_items if item.get("source_type") == "effective"]
    today_promulgated_or_revised_items = [item for item in today_items if item.get("source_type") != "effective"]
    watched_names = {normalize_name(item.get("name")) for item in watched_laws if isinstance(item, dict)}
    other_changes = [item for item in last_30_days_items if normalize_name(item.get("law_name")) not in watched_names]

    return {
        "checked_at": today.isoformat(),
        "updated_at": now_text,
        "timezone": "Asia/Seoul",
        "synced_at": now_text,
        "api_status": api_status,
        "source": "법제처 국가법령정보 Open API (eflaw / law / lsJoHstInf)",
        "basis": "KST 기준 오늘/최근 7일/최근 30일 법령 업데이트",
        "scope": "시행일, 공포일, 조문 개정 이력을 결합해 법령 변경을 정리합니다.",
        "notice": notice,
        "error": error_text,
        "watched_laws": watched_laws,
        "summary": {
            "today_changes": len(today_items),
            "today_effective_changes": len(today_effective_items),
            "today_promulgated_or_revised_changes": len(today_promulgated_or_revised_items),
            "other_changes": len(other_changes),
            "last_7_days_changes": len(last_7_days_items),
            "last_30_days_changes": len(last_30_days_items),
        },
        "today_count": len(today_items),
        "last_7_days_count": len(last_7_days_items),
        "last_30_days_count": len(last_30_days_items),
        "today_items": today_items,
        "last_7_days_items": last_7_days_items,
        "last_30_days_items": last_30_days_items,
        "today_effective_items": today_effective_items,
        "today_promulgated_or_revised_items": today_promulgated_or_revised_items,
        "today": today_items,
        "last_7_days": last_7_days_items,
        "last_30_days": last_30_days_items,
        "changed_laws": today_items,
        "other_changes": other_changes,
        "tracked_laws": tracked_laws,
        "collector": {
            "version": "law_collector_kst_windows_v2",
            "api": "https://www.law.go.kr/DRF/lawSearch.do",
            "targets": ["eflaw", "law", "lsJoHstInf"],
            "oc_mode": "secret" if os.environ.get("LAW_OC", "").strip() else "missing",
            "display": 100,
            "max_api_calls": 3,
            "history_note": "lsJoHstInf는 전일 기준일 수 있습니다.",
            "errors": errors or [],
        },
    }


def main():
    watched_laws = safe_dict_list(read_json(WATCHED_PATH, []))
    previous_data = read_json(OUTPUT_PATH, {})
    today = today_kst()
    oc = os.environ.get("LAW_OC", "").strip()
    watched_map = {
        normalize_name(law.get("name")): law
        for law in watched_laws
        if isinstance(law, dict) and law.get("name")
    }

    if not oc:
        payload = build_payload(
            today=today,
            watched_laws=watched_laws,
            all_items=[],
            tracked_laws=build_tracked_laws(today, watched_laws, [], previous_data),
            api_status="missing_law_oc",
            notice="LAW_OC 환경변수가 설정되지 않아 법제처 API 조회를 건너뛰었습니다.",
            error_text="LAW_OC 미설정",
            errors=[
                {
                    "code": "missing_law_oc",
                    "message": "GitHub Secrets에 LAW_OC를 설정하면 자동 수집이 실행됩니다.",
                }
            ],
        )
        write_json(payload)
        print("LAW_OC 미설정: 안전 상태 JSON을 저장했습니다.")
        return

    errors = []
    all_items = []
    api_hits = 0

    try:
        effective_data, effective_attempts = fetch_api(
            {
                "OC": oc,
                "target": "eflaw",
                "type": "JSON",
                "search": "1",
                "efYd": f"{to_api_date(today)}~{to_api_date(today)}",
                "display": "100",
                "page": "1",
                "sort": "efdes",
            },
            "today_effective",
        )
        api_hits += 1
        errors.extend(effective_attempts)
        all_items.extend(
            convert_api_item(
                item,
                watched_map=watched_map,
                source_type="effective",
                source_note="시행일 기준 당일 조회 결과입니다.",
            )
            for item in extract_items(effective_data)
        )
    except LawApiError as error:
        errors.extend(error.attempts)

    try:
        promulgated_data, promulgated_attempts = fetch_promulgated_laws(oc)
        api_hits += 1
        errors.extend(promulgated_attempts)
        all_items.extend(
            convert_api_item(
                item,
                watched_map=watched_map,
                source_type="promulgated",
                source_note="공포일 기준 현행법령 목록입니다.",
            )
            for item in extract_items(promulgated_data)
        )
    except LawApiError as error:
        errors.extend(error.attempts)

    try:
        history_start = today - timedelta(days=29)
        history_data, history_attempts = fetch_history_laws(oc, history_start, today)
        api_hits += 1
        errors.extend(history_attempts)
        all_items.extend(
            convert_api_item(
                item,
                watched_map=watched_map,
                source_type="history",
                source_note="조문 개정 이력은 전일 기준일 수 있습니다.",
            )
            for item in extract_items(history_data)
        )
    except LawApiError as error:
        errors.extend(error.attempts)

    all_items = [item for item in all_items if item.get("law_name")]
    tracked_laws = build_tracked_laws(today, watched_laws, all_items, previous_data)

    today_items = filter_window(sorted(dedupe(all_items), key=item_sort_key), today, today)
    last_7_days_items = filter_window(sorted(dedupe(all_items), key=item_sort_key), today - timedelta(days=6), today)
    last_30_days_items = filter_window(sorted(dedupe(all_items), key=item_sort_key), today - timedelta(days=29), today)

    if not errors and not today_items and not last_7_days_items and not last_30_days_items:
        api_status = "no_data"
        notice = "오늘 해당 법령 없음"
        error_text = ""
    elif errors and (today_items or last_7_days_items or last_30_days_items):
        api_status = "partial_success"
        notice = "일부 API 조회에 실패했지만 가능한 범위의 법령 데이터를 반영했습니다."
        error_text = summarize_attempts(errors)
    elif errors:
        api_status = "api_error"
        notice = "법제처 API 조회 중 오류가 발생했습니다. 수동 확인이 필요합니다."
        error_text = summarize_attempts(errors)
    else:
        api_status = "success"
        notice = "오늘 시행 법령과 오늘 공포/개정 법령 조회 결과입니다."
        error_text = ""

    payload = build_payload(
        today=today,
        watched_laws=watched_laws,
        all_items=all_items,
        tracked_laws=tracked_laws,
        api_status=api_status,
        notice=notice,
        error_text=error_text,
        errors=errors,
    )

    write_json(payload)
    print(
        "법제처 오늘 법령 수집 완료: "
        f"{payload['summary']['today_changes']}건 / "
        f"7일 {payload['summary']['last_7_days_changes']}건 / "
        f"30일 {payload['summary']['last_30_days_changes']}건"
    )


if __name__ == "__main__":
    main()
