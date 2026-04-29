from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import os
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = Path(__file__).resolve().parent
LAW_SCRIPT = SCRIPTS_DIR / "collect_law_updates.py"
LAW_UPDATES_PATH = ROOT / "data" / "law_updates.json"
SUMMARY_CACHE_PATH = ROOT / "data" / "law_summary_cache.json"
STATUS_PATH = ROOT / "data" / "automation_status.json"
KST = timezone(timedelta(hours=9))
HISTORY_LIMIT = 90


def now_kst() -> datetime:
    return datetime.now(KST)


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def read_json(path: Path, fallback):
    try:
        if not path.exists():
            return fallback
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_int_from_output(output: str, label: str, default: int = 0) -> int:
    match = re.search(rf"{re.escape(label)}\s*:?\s*(\d+)", output)
    if not match:
        return default
    try:
        return int(match.group(1))
    except ValueError:
        return default


def parse_float(value, default: float = 0.0) -> float:
    try:
        return float(str(value or "").strip())
    except ValueError:
        return default


def round_usd(value: float) -> float:
    return round(float(value or 0), 6)


def date_text_from_kst(value: str) -> str:
    text = str(value or "")
    match = re.match(r"^(\d{4}-\d{2}-\d{2})", text)
    return match.group(1) if match else ""


def next_run_kst(reference: datetime) -> str:
    next_run = reference.replace(hour=9, minute=20, second=0, microsecond=0)
    if reference >= next_run:
        next_run += timedelta(days=1)
    return next_run.isoformat(timespec="seconds")


def get_git_changed_files() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
    except Exception:
        return []

    files: list[str] = []
    for line in result.stdout.splitlines():
        text = line.strip()
        if not text:
            continue
        path = text[3:].strip() if len(text) >= 3 else text
        if path and path != "data/automation_status.json":
            files.append(path)
    return files


def build_message(status: str, legal_change_count: int, openai_call_count: int) -> str:
    if status == "changed":
        return f"오늘 관심 법령 데이터가 갱신되었습니다. 변경 후보 {legal_change_count}건, OpenAI 호출 {openai_call_count}회입니다."
    if status == "partial_failed":
        return "일부 관심 법령 확인에 실패했습니다. GitHub Actions 로그 확인이 필요합니다."
    if status == "failed":
        return "법령 자동 확인 실행에 실패했습니다. GitHub Actions 로그 확인이 필요합니다."
    return "오늘 확인 결과 변경된 관심 법령이 없습니다."


def build_failure_hint(status: str, return_code: int, failed_laws, partial_failed_laws) -> str:
    if status == "failed":
        return f"수집 스크립트가 종료코드 {return_code}로 실패했습니다. LAW_OC, 네트워크, 법령 API 응답을 먼저 확인하세요."
    if status == "partial_failed":
        failed_count = len(failed_laws or []) + len(partial_failed_laws or [])
        return f"일부 법령 조회가 실패했습니다. 실패 후보 {failed_count}건의 법령명 또는 API 응답을 확인하세요."
    return "특이사항 없음"


def append_step_summary(status_payload: dict) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return

    cost_summary = status_payload.get("cost_summary", {})
    lines = [
        "## 오늘 법령 자동확인 결과",
        "",
        f"- 결과: {status_payload.get('status')}",
        f"- 메시지: {status_payload.get('message')}",
        f"- 확인 시각: {status_payload.get('last_run_kst')}",
        f"- 다음 예정 실행: {status_payload.get('next_run_kst')}",
        f"- OpenAI 호출: {status_payload.get('openai_call_count')}회",
        f"- 오늘 예상 비용: ${cost_summary.get('today_estimated_cost_usd', 0):.6f}",
        f"- 7일 예상 비용: ${cost_summary.get('last_7_days_estimated_cost_usd', 0):.6f}",
        f"- 30일 예상 비용: ${cost_summary.get('last_30_days_estimated_cost_usd', 0):.6f}",
        f"- 누적 예상 비용: ${cost_summary.get('lifetime_estimated_cost_usd', 0):.6f}",
        f"- 캐시 재사용: {status_payload.get('cache_hit_count')}개",
        f"- 실패 힌트: {status_payload.get('failure_hint')}",
        "",
    ]
    Path(summary_path).write_text("\n".join(lines), encoding="utf-8")


def normalize_history(previous_status: dict) -> list[dict]:
    history = previous_status.get("run_history", []) if isinstance(previous_status, dict) else []
    return [item for item in history if isinstance(item, dict)]


def summarize_history(history: list[dict], today: datetime, lifetime_cost: float, lifetime_calls: int) -> tuple[dict, dict]:
    today_date = today.date()

    def days_old(item: dict) -> int | None:
        item_date_text = date_text_from_kst(str(item.get("last_run_kst", ""))) or str(item.get("date", ""))
        try:
            item_date = datetime.strptime(item_date_text, "%Y-%m-%d").date()
        except ValueError:
            return None
        return (today_date - item_date).days

    def sum_cost(days: int) -> float:
        total = 0.0
        for item in history:
            age = days_old(item)
            if age is not None and 0 <= age < days:
                total += parse_float(item.get("estimated_cost_usd"), 0.0)
        return round_usd(total)

    def sum_calls(days: int) -> int:
        total = 0
        for item in history:
            age = days_old(item)
            if age is not None and 0 <= age < days:
                total += int(item.get("openai_call_count") or 0)
        return total

    cost_summary = {
        "today_estimated_cost_usd": sum_cost(1),
        "last_7_days_estimated_cost_usd": sum_cost(7),
        "last_30_days_estimated_cost_usd": sum_cost(30),
        "lifetime_estimated_cost_usd": round_usd(lifetime_cost),
    }
    call_summary = {
        "today_openai_call_count": sum_calls(1),
        "last_7_days_openai_call_count": sum_calls(7),
        "last_30_days_openai_call_count": sum_calls(30),
        "lifetime_openai_call_count": int(lifetime_calls or 0),
    }
    return cost_summary, call_summary


def build_status_payload(
    *,
    return_code: int,
    output: str,
    before_law_text: str,
    after_law_text: str,
    before_cache_text: str,
    after_cache_text: str,
    previous_status: dict,
    duration_seconds: float,
) -> dict:
    run_at = now_kst()
    law_data = read_json(LAW_UPDATES_PATH, {})
    metadata = law_data.get("metadata", {}) if isinstance(law_data, dict) else {}
    failed_laws = law_data.get("failed_laws", []) if isinstance(law_data, dict) else []
    partial_failed_laws = law_data.get("partial_failed_laws", []) if isinstance(law_data, dict) else []

    law_changed = before_law_text != after_law_text
    cache_changed = before_cache_text != after_cache_text
    changed_files = get_git_changed_files()

    openai_call_count = max(
        parse_int_from_output(output, "OpenAI call count", 0),
        parse_int_from_output(output, "AI 요약 OpenAI 호출 횟수", 0),
    )
    new_summary_key_count = parse_int_from_output(output, "New or changed summary_key count", 0)
    cache_hit_count = parse_int_from_output(output, "Cache hit count", 0)
    cost_per_call_usd = parse_float(os.environ.get("OPENAI_ESTIMATED_COST_PER_CALL_USD"), 0.0)
    estimated_cost_usd = round_usd(openai_call_count * cost_per_call_usd)

    if return_code != 0:
        status = "failed"
    elif failed_laws or partial_failed_laws or metadata.get("api_status") == "partial_success":
        status = "partial_failed"
    elif law_changed or cache_changed:
        status = "changed"
    else:
        status = "no_change"

    legal_change_count = 0
    if status == "changed" and isinstance(law_data, dict):
        try:
            legal_change_count = int(metadata.get("totalSavedCount") or len(law_data.get("items", [])))
        except Exception:
            legal_change_count = len(law_data.get("items", [])) if isinstance(law_data.get("items"), list) else 0

    today_count = int(law_data.get("today_count") or 0) if status != "no_change" and isinstance(law_data, dict) else 0
    last_7_days_count = int(law_data.get("last_7_days_count") or 0) if status != "no_change" and isinstance(law_data, dict) else 0
    last_30_days_count = int(law_data.get("last_30_days_count") or 0) if status != "no_change" and isinstance(law_data, dict) else 0

    previous_cost_summary = previous_status.get("cost_summary", {}) if isinstance(previous_status, dict) else {}
    previous_call_summary = previous_status.get("call_summary", {}) if isinstance(previous_status, dict) else {}
    previous_lifetime_cost = parse_float(previous_cost_summary.get("lifetime_estimated_cost_usd"), 0.0)
    previous_lifetime_calls = int(previous_call_summary.get("lifetime_openai_call_count") or 0)
    lifetime_cost = round_usd(previous_lifetime_cost + estimated_cost_usd)
    lifetime_calls = previous_lifetime_calls + openai_call_count

    current_run = {
        "date": run_at.date().isoformat(),
        "last_run_kst": run_at.isoformat(timespec="seconds"),
        "status": status,
        "message": build_message(status, legal_change_count, openai_call_count),
        "openai_call_count": openai_call_count,
        "estimated_cost_usd": estimated_cost_usd,
        "duration_seconds": round(duration_seconds, 2),
        "changed_files_count": len(changed_files),
    }
    history = normalize_history(previous_status) + [current_run]
    history = history[-HISTORY_LIMIT:]
    cost_summary, call_summary = summarize_history(history, run_at, lifetime_cost, lifetime_calls)

    payload = {
        "last_run_kst": run_at.isoformat(timespec="seconds"),
        "next_run_kst": next_run_kst(run_at),
        "status": status,
        "message": build_message(status, legal_change_count, openai_call_count),
        "failure_hint": build_failure_hint(status, return_code, failed_laws, partial_failed_laws),
        "legal_change_count": legal_change_count,
        "today_count": today_count,
        "last_7_days_count": last_7_days_count,
        "last_30_days_count": last_30_days_count,
        "new_summary_key_count": new_summary_key_count,
        "cache_hit_count": cache_hit_count,
        "openai_call_count": openai_call_count,
        "estimated_cost_usd": estimated_cost_usd,
        "cost_per_openai_call_usd": round_usd(cost_per_call_usd),
        "cost_estimate_enabled": cost_per_call_usd > 0,
        "cost_summary": cost_summary,
        "call_summary": call_summary,
        "run_history": history,
        "recent_7_runs": history[-7:],
        "duration_seconds": round(duration_seconds, 2),
        "changed_files": changed_files,
        "workflow": "Auto Law Brief Update",
        "branch": os.environ.get("GITHUB_REF_NAME", "local"),
        "source": "github_actions",
    }
    return payload


def main() -> int:
    start_time = time.monotonic()
    previous_status = read_json(STATUS_PATH, {})
    before_law_text = read_text(LAW_UPDATES_PATH)
    before_cache_text = read_text(SUMMARY_CACHE_PATH)

    result = subprocess.run(
        [sys.executable, "-u", str(LAW_SCRIPT)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        env=os.environ.copy(),
        check=False,
    )

    output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)

    status_payload = build_status_payload(
        return_code=result.returncode,
        output=output,
        before_law_text=before_law_text,
        after_law_text=read_text(LAW_UPDATES_PATH),
        before_cache_text=before_cache_text,
        after_cache_text=read_text(SUMMARY_CACHE_PATH),
        previous_status=previous_status if isinstance(previous_status, dict) else {},
        duration_seconds=time.monotonic() - start_time,
    )
    write_json(STATUS_PATH, status_payload)
    append_step_summary(status_payload)

    print("Automation status written to data/automation_status.json")
    print(f"Automation status: {status_payload['status']}")
    print(f"Automation message: {status_payload['message']}")
    print(f"OpenAI estimated cost: ${status_payload['estimated_cost_usd']:.6f}")

    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
