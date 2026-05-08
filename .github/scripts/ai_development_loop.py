#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

KST = timezone(timedelta(hours=9))
ROOT = Path(__file__).resolve().parents[2]
AI_LAB_DIR = ROOT / "data" / "ai_lab"
DAILY_DIR = AI_LAB_DIR / "daily"
GOAL_FILE = AI_LAB_DIR / "project_goal.md"
STATE_FILE = AI_LAB_DIR / "idea_state.json"
REPORT_ISSUE_TITLE = "[AI Lab] Development Loop Reports"


@dataclass
class RunContext:
    now_kst: datetime
    slot: str


def detect_slot(now_kst: datetime) -> str:
    if now_kst.hour < 14:
        return "morning"
    if now_kst.hour < 22:
        return "afternoon"
    return "manual"


def read_text(path: Path, default: str = "") -> str:
    if not path.exists():
        return default
    return path.read_text(encoding="utf-8")


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def list_recent_reports(max_files: int = 7) -> list[dict[str, str]]:
    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(DAILY_DIR.glob("*.md"), reverse=True)[:max_files]
    return [{"filename": file.name, "content": read_text(file)[:2500]} for file in files]


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, ""):
        return []
    return [value]


def dry_run_result(ctx: RunContext, goal_summary: str) -> dict[str, Any]:
    return {
        "date": ctx.now_kst.strftime("%Y-%m-%d"),
        "slot": ctx.slot,
        "focus_area": "API/운영비 절감",
        "project_goal_summary": goal_summary or "SHJJ Brief 목표 달성 속도를 높이는 방향으로 아이디어를 재정렬한다.",
        "goal_link": "앱 안정성과 운영비 절감을 함께 달성해 장기 운영 기반을 만든다.",
        "existing_ideas_review": [
            {
                "title": "브리핑 안정화 체크리스트 고도화",
                "decision": "발전",
                "reason": "안정성 1순위 목표를 저비용으로 강화한다.",
            },
            {
                "title": "외부 API 호출 캐시 TTL 재설계",
                "decision": "발전",
                "reason": "호출 빈도와 운영비를 직접 줄인다.",
            },
            {
                "title": "광고 수익화 즉시 적용",
                "decision": "보류",
                "reason": "사용자 확보와 체류 지표를 먼저 확인한 뒤 판단한다.",
            },
        ],
        "new_ideas": [
            {
                "title": "소스별 일일 호출 중단선 표준표",
                "summary": "날씨·법령·일정 소스별 하루 허용 호출 수, 중단선, 재개 조건을 한 장으로 정리한다.",
                "expected_value": "TTL 조정과 예산 통제를 빠르게 연결해 비용 초과를 막는다.",
                "implementation_cost": "low",
                "recommendation": "development",
            },
            {
                "title": "브리핑 필수 필드 최소집합 정의",
                "summary": "브리핑 생성에 꼭 필요한 필드만 추려 재조회 범위를 줄인다.",
                "expected_value": "불필요한 호출을 줄이고 갱신 판단을 단순화한다.",
                "implementation_cost": "low",
                "recommendation": "development",
            },
        ],
        "next_best_action": "날씨·법령·일정별 변경감지 기준과 예외 우선순위를 1페이지 표로 확정한다.",
        "codex_candidate": "날씨·법령·일정 변경감지 기준 및 예외 우선순위 1페이지 초안 작성",
        "risks": ["OPENAI_API_KEY 미설정 또는 호출 실패 시 dry-run 기준으로만 판단한다."],
        "cost_control_note": "문서화와 기준 정리 중심으로 진행하고 구현·배포·대규모 기능 추가는 제외한다.",
    }


def normalize_result(result: dict[str, Any], ctx: RunContext, goal_summary: str) -> dict[str, Any]:
    if not isinstance(result, dict):
        result = {}

    normalized = dict(result)
    normalized["date"] = ctx.now_kst.strftime("%Y-%m-%d")
    normalized["slot"] = ctx.slot
    normalized.setdefault("project_goal_summary", goal_summary or "SHJJ Brief 공동 목표")
    normalized.setdefault("focus_area", "앱 안정성")
    normalized.setdefault("goal_link", "공동 목표와 우선순위를 기준으로 오늘의 집중 분야를 실행 가능한 단위로 정리한다.")

    reviews: list[dict[str, str]] = []
    for item in as_list(normalized.get("existing_ideas_review")):
        if isinstance(item, dict):
            reviews.append(
                {
                    "title": clean_text(item.get("title")) or "기존 아이디어 재검토",
                    "decision": clean_text(item.get("decision")) or "유지",
                    "reason": clean_text(item.get("reason")) or "우선순위 기준 충족 여부를 확인한다.",
                }
            )
    if not reviews:
        reviews = [{"title": "기존 아이디어 재검토", "decision": "유지", "reason": "핵심 목표와 직접 연결되는 항목부터 유지한다."}]
    normalized["existing_ideas_review"] = reviews

    ideas: list[dict[str, str]] = []
    for raw_idea in as_list(normalized.get("new_ideas"))[:2]:
        if not isinstance(raw_idea, dict):
            raw_idea = {"title": clean_text(raw_idea)}
        ideas.append(
            {
                "title": clean_text(raw_idea.get("title")) or "기존 아이디어 우선순위 재검토",
                "summary": clean_text(raw_idea.get("summary")) or "작고 검증 가능한 단위로 정리한다.",
                "expected_value": clean_text(raw_idea.get("expected_value")) or "재작업 비용을 줄인다.",
                "implementation_cost": clean_text(raw_idea.get("implementation_cost")) or "low",
                "recommendation": clean_text(raw_idea.get("recommendation")) or clean_text(raw_idea.get("decision")) or "keep",
            }
        )
    if not ideas:
        ideas = dry_run_result(ctx, goal_summary)["new_ideas"]
    normalized["new_ideas"] = ideas

    normalized.setdefault("next_best_action", "다음 실행 전까지 기존 아이디어의 우선순위 점검 기준을 1페이지로 정리한다.")
    normalized.setdefault("codex_candidate", "없음")
    normalized.setdefault("risks", [])
    normalized.setdefault("cost_control_note", "최근 기록은 최대 7개만 참고해 비용을 제한한다.")
    return normalized


def extract_json_text_from_response(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    output = getattr(response, "output", None)
    if isinstance(output, list):
        for item in output:
            content = getattr(item, "content", None)
            if isinstance(content, list):
                for part in content:
                    text = getattr(part, "text", None)
                    if isinstance(text, str) and text.strip():
                        return text.strip()
                    if isinstance(part, dict):
                        for key in ("text", "output_text"):
                            value = part.get(key)
                            if isinstance(value, str) and value.strip():
                                return value.strip()
    raise ValueError("OpenAI 응답에서 JSON 텍스트를 찾지 못했습니다.")


def call_openai(api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    from openai import OpenAI

    model = os.getenv("AI_DEV_LOOP_MODEL", "gpt-5.4-mini")
    client = OpenAI(api_key=api_key)
    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "system",
                "content": "당신은 제품 전략가다. 반드시 엄격한 JSON만 출력하고, 마크다운/설명문을 절대 섞지 마라.",
            },
            {
                "role": "user",
                "content": (
                    "다음 입력을 기준으로 목표 달성 속도를 높이는 의사결정을 JSON으로 출력하라. "
                    "새 아이디어는 최대 2개. 고비용은 즉시 실행 후보로 올리지 말 것. "
                    "필수 필드는 빈 문자열로 두지 마라.\n"
                    + json.dumps(payload, ensure_ascii=False)
                ),
            },
        ],
        reasoning={"effort": "medium"},
        text={"format": {"type": "json_object"}, "verbosity": "low"},
    )
    return json.loads(extract_json_text_from_response(response))


def render_report(result: dict[str, Any], ctx: RunContext) -> str:
    slot_kor = {"morning": "오전", "afternoon": "오후", "manual": "수동"}.get(ctx.slot, "수동")
    lines = [
        f"# AI 아이디어 디벨롭 리포트 - {result['date']} {slot_kor}",
        "",
        "## 오늘 집중 분야",
        clean_text(result.get("focus_area")) or "앱 안정성",
        "",
        "## 목표와의 연결",
        clean_text(result.get("goal_link")),
        "",
        "## 기존 아이디어 재검토",
    ]
    for item in result.get("existing_ideas_review", []):
        lines.append(f"- {item.get('title', '기존 아이디어')} → {item.get('decision', '유지')}")
        lines.append(f"  - 이유: {item.get('reason', '')}")
    lines += ["", "## 새 아이디어"]
    for idea in result.get("new_ideas", []):
        lines.append(f"- {idea.get('title', '새 아이디어')}")
        lines.append(f"  - 요약: {idea.get('summary', '')}")
        lines.append(f"  - 예상 가치: {idea.get('expected_value', '')}")
        lines.append(f"  - 구현 난이도: {idea.get('implementation_cost', '')}")
        lines.append(f"  - 판단: {idea.get('recommendation', '유지')}")
    lines += [
        "",
        "## 다음 실행 때 볼 것",
        clean_text(result.get("next_best_action")),
        "",
        "## Codex 작업 후보",
        clean_text(result.get("codex_candidate")) or "없음",
    ]
    return "\n".join(lines).strip() + "\n"


def main() -> int:
    now_kst = datetime.now(timezone.utc).astimezone(KST)
    slot = os.getenv("AI_DEV_SLOT") or detect_slot(now_kst)
    ctx = RunContext(now_kst=now_kst, slot=slot)

    goal_text = read_text(GOAL_FILE).strip()
    goal_summary = goal_text.splitlines()[0] if goal_text else "프로젝트 목표 문서 없음"
    input_payload = {
        "goal": goal_text,
        "idea_state": read_json(STATE_FILE, default={}),
        "recent_reports": list_recent_reports(max_files=7),
        "constraints": {
            "max_new_ideas": 2,
            "no_auto_code_change": True,
            "no_auto_merge_deploy": True,
            "do_not_commit_reports_to_main": True,
        },
    }

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("[ai-dev-loop] OPENAI_API_KEY 미설정: dry-run으로 실행합니다.")
        result = dry_run_result(ctx, goal_summary)
    else:
        try:
            result = call_openai(api_key, input_payload)
        except Exception as exc:
            print(f"[ai-dev-loop] OpenAI 호출 실패: {type(exc).__name__}: {exc}")
            result = dry_run_result(ctx, goal_summary)
            result.setdefault("risks", []).append(f"API 실패 fallback 적용: {type(exc).__name__}: {exc}")

    result = normalize_result(result, ctx, goal_summary)

    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report_name = f"{ctx.now_kst.strftime('%Y-%m-%d-%H%M')}.md"
    report_path = DAILY_DIR / report_name
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(render_report(result, ctx), encoding="utf-8")

    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"issue_title={REPORT_ISSUE_TITLE}\n")
            f.write(f"report_path={report_path.as_posix()}\n")

    print(f"[ai-dev-loop] slot={ctx.slot}, report={report_name}, issue={REPORT_ISSUE_TITLE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
