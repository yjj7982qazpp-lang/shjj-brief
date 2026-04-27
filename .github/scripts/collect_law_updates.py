from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json
import os

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = Path(__file__).resolve().parent

WATCHED_PATH = SCRIPTS_DIR / "watched_laws.json"
OUTPUT_PATH = ROOT / "data" / "law_updates.json"

LAW_API_URLS = [
    "https://www.law.go.kr/DRF/lawSearch.do",
    "http://www.law.go.kr/DRF/lawSearch.do",
]
KST = timezone(timedelta(hours=9))

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


def yyyymmdd(day):
    return day.strftime("%Y%m%d")


def yyyy_mm_dd(value):
    text = str(value or "").strip()
    if len(text) == 8 and text.isdigit():
        return f"{text[0:4]}-{text[4:6]}-{text[6:8]}"
    return text


def normalize(value):
    return str(value or "").replace(" ", "").strip()


def pick(item, *keys):
    for key in keys:
        value = item.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def extract_items(data):
    if not isinstance(data, dict):
        return []

    root = data.get("LawSearch") or data.get("lawSearch") or data
    if not isinstance(root, dict):
        return []

    law = root.get("law")
    if isinstance(law, list):
        return law
    if isinstance(law, dict):
        return [law]
    return []


def classify_law(law_name, ministry, watched_map):
    watched = watched_map.get(normalize(law_name))
    if watched:
        return watched.get("category", "관심 법령"), watched.get("priority", 1)

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
    return f"https://www.law.go.kr{raw_link}"


def fetch_law_api(params, label):
    api_url = LAW_API_URLS[0]
    scheme = api_url.split(":", 1)[0]
    url = f"{api_url}?{urlencode(params)}"
    request = Request(
        url,
        headers={
            "User-Agent": "SHJJ-Brief-LawCollector/1.0",
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8", errors="replace")

        try:
            return json.loads(raw), None
        except json.JSONDecodeError as error:
            return {}, {
                "label": label,
                "scheme": scheme,
                "code": "json_decode_error",
                "message": str(error),
                "raw_sample": raw[:300],
            }
    except HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace") if error.fp else ""
        return {}, {
            "label": label,
            "scheme": scheme,
            "code": "http_error",
            "message": f"HTTP {error.code}",
            "raw_sample": raw[:300],
        }
    except (TimeoutError, URLError, OSError) as error:
        return {}, {
            "label": label,
            "scheme": scheme,
            "code": "request_error",
            "message": str(error)[:180],
        }


def fetch_today_effective_laws(oc, target_day):
    day_text = yyyymmdd(target_day)
    return fetch_law_api({
        "OC": oc,
        "target": "eflaw",
        "type": "JSON",
        "efYd": f"{day_text}~{day_text}",
        "display": "100",
        "sort": "efdes",
    }, "today_effective")


def fetch_today_changed_laws(oc, target_day):
    day_text = yyyymmdd(target_day)
    return fetch_law_api({
        "OC": oc,
        "target": "lsHstInf",
        "type": "JSON",
        "regDt": day_text,
        "display": "100",
        "page": "1",
    }, "today_promulgated_or_revised")


def convert_api_item(item, watched_map, source_type):
    law_name = pick(item, "법령명한글", "법령명", "lawNm", "법령명한글HTML")
    ministry = pick(item, "소관부처명", "소관부처", "ministry")
    law_type = pick(item, "법령구분명", "법령구분", "lawType")
    revision_type = pick(item, "제개정구분명", "제개정구분", "revisionType")
    promulgation_date = yyyy_mm_dd(pick(item, "공포일자", "promulgationDate"))
    effective_date = yyyy_mm_dd(pick(item, "시행일자", "effectiveDate"))
    detail_url = build_detail_url(pick(item, "법령상세링크", "상세링크", "detailUrl"))
    category, priority = classify_law(law_name, ministry, watched_map)
    summary_parts = []

    if source_type == "promulgated_or_revised" and revision_type:
        summary_parts.append(f"{revision_type} 법령이 오늘 공포/개정 목록에서 확인되었습니다.")
    elif source_type == "promulgated_or_revised":
        summary_parts.append("오늘 공포/개정된 법령으로 확인되었습니다.")
    elif revision_type:
        summary_parts.append(f"{revision_type} 법령이 오늘 시행됩니다.")
    else:
        summary_parts.append("오늘 시행되는 현행법령으로 확인되었습니다.")

    if ministry:
        summary_parts.append(f"소관부처는 {ministry}입니다.")
    if law_type:
        summary_parts.append(f"법령구분은 {law_type}입니다.")

    summary = " ".join(summary_parts)

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
        "source": "법제처 오늘 공포/개정 법령" if source_type == "promulgated_or_revised" else "법제처 현행법령 시행일 목록",
        "source_type": source_type,
        "priority": priority,
        "status": "changed",
        "status_label": "변경 있음",
        "amendment_type": revision_type,
        "impact": "높음" if priority == 1 else "확인 필요",
        "change_summary": summary,
        "source_url": detail_url,
    }


def get_update_date(item):
    return item.get("promulgation_date") or item.get("effective_date") or ""


def build_tracked_laws(today, watched_laws, effective_items, changed_items, previous_data):
    previous_map = {
        normalize(item.get("law_name")): item
        for item in previous_data.get("tracked_laws", [])
        if isinstance(item, dict) and item.get("law_name")
    }
    update_map = {}

    for item in effective_items:
        update_map[normalize(item.get("law_name"))] = item

    for item in changed_items:
        update_map[normalize(item.get("law_name"))] = item

    tracked = []
    today_text = today.isoformat()

    for law in watched_laws:
        name = law.get("name", "")
        key = normalize(name)
        previous = previous_map.get(key, {})
        update = update_map.get(key)
        latest_update_date = (
            today_text if update else
            previous.get("latest_update_date", "")
        )
        status = "today_updated" if update else "watching"
        if not update and not latest_update_date:
            status = "check_required"

        tracked.append({
            "law_name": name,
            "category": law.get("category", previous.get("category", "기타")),
            "latest_update_date": latest_update_date,
            "latest_update_type": update.get("source", previous.get("latest_update_type", "")) if update else previous.get("latest_update_type", ""),
            "effective_date": update.get("effective_date", previous.get("effective_date", "")) if update else previous.get("effective_date", ""),
            "ministry": update.get("ministry", previous.get("ministry", "")) if update else previous.get("ministry", ""),
            "status": status,
            "priority": law.get("priority", previous.get("priority", 3)),
            "detail_url": update.get("detail_url", previous.get("detail_url", "")) if update else previous.get("detail_url", ""),
        })

    return tracked


def is_watched_item(item, watched_map):
    return normalize(item.get("law_name")) in watched_map


def dedupe(items):
    seen = set()
    result = []

    for item in items:
        key = (
            item.get("law_name", ""),
            item.get("effective_date", ""),
            item.get("revision_type", ""),
            item.get("detail_url", ""),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(item)

    return result


def build_payload(today, watched_laws, effective_items, changed_items, tracked_laws, sync_status, notice, errors=None):
    now_text = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S KST")
    watched_map = {
        normalize(item.get("name")): item
        for item in watched_laws
        if isinstance(item, dict) and item.get("name")
    }
    effective_matched = [item for item in effective_items if is_watched_item(item, watched_map)]
    changed_matched = [item for item in changed_items if is_watched_item(item, watched_map)]
    other_changes = [
        item for item in dedupe(effective_items + changed_items)
        if not is_watched_item(item, watched_map)
    ]
    effective_sorted = sorted(effective_matched, key=lambda item: (item.get("priority", 9), item.get("law_name", "")))
    changed_sorted = sorted(changed_matched, key=lambda item: (item.get("priority", 9), item.get("law_name", "")))
    combined_items = dedupe(effective_sorted + changed_sorted)
    other_sorted = sorted(other_changes, key=lambda item: (item.get("law_name", ""), item.get("effective_date", "")))

    return {
        "checked_at": today.isoformat(),
        "synced_at": now_text,
        "sync_status": sync_status,
        "basis": "현행법령 시행일 목록 및 오늘 공포/개정 법령 조회",
        "scope": "법제처 API에서 오늘 시행 법령과 오늘 공포/개정 법령을 구분해 조회합니다.",
        "notice": notice,
        "watched_laws": watched_laws,
        "summary": {
            "today_changes": len(combined_items),
            "today_effective_changes": len(effective_sorted),
            "today_promulgated_or_revised_changes": len(changed_sorted),
            "other_changes": len(other_sorted),
            "last_7_days_changes": len(combined_items),
            "last_30_days_changes": len(combined_items),
        },
        "today": combined_items,
        "today_effective": effective_sorted,
        "today_promulgated_or_revised": changed_sorted,
        "other_changes": other_sorted,
        "tracked_laws": tracked_laws,
        "last_7_days": combined_items,
        "last_30_days": combined_items,
        "collector": {
            "version": "law_collector_today_dual_v1",
            "api": LAW_API_URLS[0],
            "targets": ["eflaw", "lsHstInf"],
            "oc_mode": "secret" if os.environ.get("LAW_OC", "").strip() else "missing",
            "display": 100,
            "max_api_calls": 2,
            "errors": errors or [],
        },
    }


def main():
    watched_laws = read_json(WATCHED_PATH, [])
    previous_data = read_json(OUTPUT_PATH, {})
    watched_map = {
        normalize(item.get("name")): item
        for item in watched_laws
        if isinstance(item, dict) and item.get("name")
    }
    today = today_kst()
    oc = os.environ.get("LAW_OC", "").strip()

    if not oc:
        payload = build_payload(
            today=today,
            watched_laws=watched_laws,
            effective_items=[],
            changed_items=[],
            tracked_laws=build_tracked_laws(today, watched_laws, [], [], previous_data),
            sync_status="missing_law_oc",
            notice="LAW_OC 환경변수가 설정되지 않아 법제처 API 조회를 건너뛰었습니다.",
            errors=[{"code": "missing_law_oc", "message": "GitHub Secrets에 LAW_OC를 설정하면 자동 수집이 실행됩니다."}],
        )
        write_json(payload)
        print("LAW_OC 미설정: 안전 상태 JSON을 저장했습니다.")
        return

    try:
        effective_data, effective_error = fetch_today_effective_laws(oc, today)
        changed_data, changed_error = fetch_today_changed_laws(oc, today)
        errors = [error for error in [effective_error, changed_error] if error]
        effective_items = dedupe([
            convert_api_item(item, watched_map, "effective")
            for item in extract_items(effective_data)
            if isinstance(item, dict)
        ])
        changed_items = dedupe([
            convert_api_item(item, watched_map, "promulgated_or_revised")
            for item in extract_items(changed_data)
            if isinstance(item, dict)
        ])
        sync_status = "api_error" if errors and not effective_items and not changed_items else "success"
        notice = "오늘 시행 법령과 오늘 공포/개정 법령 조회 결과입니다."
        if not effective_items and not changed_items and not errors:
            notice = "오늘 시행 또는 공포/개정된 법령이 없습니다."
        payload = build_payload(
            today=today,
            watched_laws=watched_laws,
            effective_items=effective_items,
            changed_items=changed_items,
            tracked_laws=build_tracked_laws(today, watched_laws, effective_items, changed_items, previous_data),
            sync_status=sync_status,
            notice=notice,
            errors=errors,
        )
    except LawApiError as error:
        payload = build_payload(
            today=today,
            watched_laws=watched_laws,
            effective_items=[],
            changed_items=[],
            tracked_laws=build_tracked_laws(today, watched_laws, [], [], previous_data),
            sync_status="api_error",
            notice="법제처 API 조회 중 오류가 발생했습니다. 수동 확인이 필요합니다.",
            errors=error.attempts,
        )
    except Exception as error:
        payload = build_payload(
            today=today,
            watched_laws=watched_laws,
            effective_items=[],
            changed_items=[],
            tracked_laws=build_tracked_laws(today, watched_laws, [], [], previous_data),
            sync_status="api_error",
            notice="법제처 API 조회 중 오류가 발생했습니다. 수동 확인이 필요합니다.",
            errors=[{"code": "api_error", "message": str(error)}],
        )

    write_json(payload)
    print(f"법제처 오늘 법령 수집 완료: {payload['summary']['today_changes']}건")


if __name__ == "__main__":
    main()
