from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import os
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = Path(__file__).resolve().parent
LAW_SCRIPT = SCRIPTS_DIR / "collect_law_updates.py"
LAW_UPDATES_PATH = ROOT / "data" / "law_updates.json"
SUMMARY_CACHE_PATH = ROOT / "data" / "law_summary_cache.json"
STATUS_PATH = ROOT / "data" / "automation_status.json"
KST = timezone(timedelta(hours=9))


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
        return "일부 관심 법령 확인에 실패했습니다. GitHub Actions 로그를 확인하세요."
    if status == "failed":
        return "법령 자동 확인 실행에 실패했습니다. GitHub Actions 로그를 확인하세요."
    return "오늘 확인 결과 변경된 관심 법령이 없습니다."


def append_step_summary(status_payload: dict) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return

    lines = [
        "## 오늘 법령 자동확인 결과",
        "",
        f"- 결과: {status_payload.get('status')}",
        f"- 메시지: {status_payload.get('message')}",
        f"- 확인 시각: {status_payload.get('last_run_kst')}",
        f"- 오늘: {status_payload.get('today_count')}건",
        f"- 최근 7일: {status_payload.get('last_7_days_count')}건",
        f"- 최근 30일: {status_payload.get('last_30_days_count')}건",
        f"- 신규 summary_key: {status_payload.get('new_summary_key_count')}개",
        f"- 캐시 재사용: {status_payload.get('cache_hit_count')}개",
        f"- OpenAI 호출: {status_payload.get('openai_call_count')}회",
        "",
    ]
    Path(summary_path).write_text("\n".join(lines), encoding="utf-8")


def build_status_payload(
    *,
    return_code: int,
    output: str,
    before_law_text: str,
    after_law_text: str,
    before_cache_text: str,
    after_cache_text: str,
) -> dict:
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

    return {
        "last_run_kst": now_kst().isoformat(timespec="seconds"),
        "status": status,
        "message": build_message(status, legal_change_count, openai_call_count),
        "legal_change_count": legal_change_count,
        "today_count": today_count,
        "last_7_days_count": last_7_days_count,
        "last_30_days_count": last_30_days_count,
        "new_summary_key_count": new_summary_key_count,
        "cache_hit_count": cache_hit_count,
        "openai_call_count": openai_call_count,
        "changed_files": changed_files,
        "workflow": "Auto Law Brief Update",
        "branch": os.environ.get("GITHUB_REF_NAME", "local"),
        "source": "github_actions",
    }


def main() -> int:
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
    )
    write_json(STATUS_PATH, status_payload)
    append_step_summary(status_payload)

    print("Automation status written to data/automation_status.json")
    print(f"Automation status: {status_payload['status']}")
    print(f"Automation message: {status_payload['message']}")

    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
