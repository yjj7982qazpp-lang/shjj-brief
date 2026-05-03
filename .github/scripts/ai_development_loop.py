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

FALLBACK_RISK_MARKERS = (
    "fallback(TypeError)",
    "API 실패 fallback 적용",
    "AI API 미사용",
    "API 미사용",
    "OPENAI_API_KEY 미설정",
)


@dataclass
class RunContext:
    now_kst: datetime
    slot: str


def detect_slot(now_kst: datetime) -> str:
    hour = now_kst.hour
    if hour < 14:
        return "morning"
    if hour < 22:
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
    out = []
    for file in files:
        out.append({"filename": file.name, "content": read_text(file)[:2500]})
    return out


def dry_run_result(ctx: RunContext, goal_summary: str) -> dict[str, Any]:
    return {
        "date": ctx.now_kst.strftime("%Y-%m-%d"),
        "slot": ctx.slot,
        "focus_area": "API/운영비 절감",
        "goal_link": "앱 안정성을 해치지 않으면서 운영 고정비를 최소화해야 장기적인 사용자 확보와 수익화 실험을 지속할 수 있다.",
        "existing_ideas_review": [
            {
                "title": "브리핑 안정화 체크리스트 고도화",
                "decision": "발전",
                "reason": "안정성 1순위 목표를 직접 지원하고 저비용으로 즉시 개선 가능하다.",
            },
            {
                "title": "광고 수익화 즉시 적용",
                "decision": "보류",
                "reason": "사용자 기반과 체류 지표가 먼저 확보되어야 광고 단가와 UX 저하 리스크를 관리할 수 있다.",
            },
        ],
        "new_ideas": [
            {
                "title": "외부 API 호출 캐시 TTL 재설계",
                "summary": "날씨·법령 브리핑 갱신 주기를 분리해 불필요한 호출을 줄인다.",
                "expected_value": "API 비용과 실패율을 함께 낮추고 앱 안정성 유지에 기여한다.",
                "implementation_cost": "중",
                "recommendation": "유지",
            }
        ],
        "next_best_action": "다음 실행에서 캐시 TTL 분리 기준(데이터 신선도/비용)을 수치로 비교한다.",
        "codex_candidate": "없음",
        "risks": ["AI API 미사용 상태에서 판단 고도화 한계"],
        "cost_control_note": "OPENAI_API_KEY 미설정으로 dry-run 수행, 외부 API 비용 0원",
    }


def _clean_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if value is None:
        return ""
    return str(value).strip()


def _is_blank(value: Any) -> bool:
    return not _clean_text(value)


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, ""):
        return []
    return [value]


def _clean_string_list(value: Any) -> list[str]:
    out: list[str] = []
    for item in _as_list(value):
        text = _clean_text(item)
        if text:
            out.append(text)
    return out


def _contains_fallback_marker(text: str) -> bool:
    return any(marker in text for marker in FALLBACK_RISK_MARKERS)


def normalize_result(
    result: dict[str, Any],
    ctx: RunContext,
    goal_summary: str,
    current_fallback: bool = False,
) -> dict[str, Any]:
    if not isinstance(result, dict):
        result = {}

    normalized = dict(result)
    normalized["date"] = ctx.now_kst.strftime("%Y-%m-%d")
    normalized["slot"] = ctx.slot

    if _is_blank(normalized.get("project_goal_summary")):
        normalized["project_goal_summary"] = goal_summary or "SHJJ Brief 목표 달성 속도를 높이는 방향으로 아이디어를 재정렬한다."
    if _is_blank(normalized.get("focus_area")):
        normalized["focus_area"] = "앱 안정성"
    if _is_blank(normalized.get("goal_link")):
        normalized["goal_link"] = "공동 목표와 우선순위를 기준으로 오늘의 집중 분야를 실행 가능한 단위로 정리한다."

    existing_reviews = []
    for item in _as_list(normalized.get("existing_ideas_review")):
        if isinstance(item, dict):
            title = _clean_text(item.get("title")) or "기존 아이디어 재검토"
            decision = _clean_text(item.get("decision")) or "유지"
            reason = _clean_text(item.get("reason")) or "우선순위 기준 충족 여부를 다시 확인한다."
        else:
            title = _clean_text(item) or "기존 아이디어 재검토"
            decision = "유지"
            reason = "우선순위 기준 충족 여부를 다시 확인한다."
        existing_reviews.append({"title": title, "decision": decision, "reason": reason})
    if not existing_reviews:
        existing_reviews = [{"title": "기존 아이디어 재검토", "decision": "유지", "reason": "핵심 목표와 직접 연결되는 항목부터 유지한다."}]
    normalized["existing_ideas_review"] = existing_reviews

    ideas = []
    for raw_idea in _as_list(normalized.get("new_ideas"))[:2]:
        if not isinstance(raw_idea, dict):
            raw_idea = {"title": _clean_text(raw_idea)}
        idea = dict(raw_idea)
        if _is_blank(idea.get("title")):
            idea["title"] = "기존 아이디어 우선순위 재검토"
        if _is_blank(idea.get("type")):
            idea["type"] = "product"
        if _is_blank(idea.get("summary")):
            idea["summary"] = "목표 달성 속도를 높이기 위해 작고 검증 가능한 단위로 정리한다."
        if _is_blank(idea.get("expected_value")):
            idea["expected_value"] = "우선순위 판단 기준을 명확히 해 재작업 비용을 줄인다."
        if _is_blank(idea.get("implementation_cost")):
            idea["implementation_cost"] = "low"
        if _is_blank(idea.get("risk")):
            idea["risk"] = "실사용자 피드백 부족 시 판단 편향 가능"
        if _is_blank(idea.get("confidence")):
            idea["confidence"] = "medium"
        if _is_blank(idea.get("recommendation")):
            idea["recommendation"] = _clean_text(idea.get("decision")) or "keep"
        ideas.append(idea)

    if not ideas:
        ideas.append(
            {
                "title": "기존 아이디어 우선순위 재검토",
                "type": "product",
                "summary": "새 기능 추가보다 현재 목표에 가장 가까운 기존 아이디어를 재정렬한다.",
                "expected_value": "작업 범위를 줄이고 목표 달성 속도를 높인다.",
                "implementation_cost": "low",
                "risk": "판단 기준이 모호하면 우선순위가 흔들릴 수 있음",
                "confidence": "medium",
                "recommendation": "keep",
            }
        )
    normalized["new_ideas"] = ideas

    developed = _clean_string_list(normalized.get("developed_existing_ideas"))
    if not developed:
        developed = ["기존 아이디어를 목표 우선순위 기준으로 재검토한다."]
    normalized["developed_existing_ideas"] = developed

    normalized["paused_ideas"] = _clean_string_list(normalized.get("paused_ideas"))
    normalized["killed_ideas"] = _clean_string_list(normalized.get("killed_ideas"))

    codex_candidate = _clean_text(normalized.get("codex_candidate"))
    if _is_blank(codex_candidate):
        codex_candidates = _clean_string_list(normalized.get("codex_candidates"))
        if not codex_candidates:
            for item in _as_list(normalized.get("low_cost_candidates")):
                if isinstance(item, dict):
                    title = _clean_text(item.get("title"))
                    if title:
                        codex_candidates.append(title)
        codex_candidate = codex_candidates[0] if codex_candidates else "없음"
    normalized["codex_candidate"] = codex_candidate

    if _is_blank(normalized.get("next_best_action")):
        immediate_action = normalized.get("immediate_action")
        if isinstance(immediate_action, dict):
            normalized["next_best_action"] = _clean_text(immediate_action.get("title"))
        if _is_blank(normalized.get("next_best_action")):
            normalized["next_best_action"] = "다음 실행 전까지 기존 아이디어의 우선순위 점검 기준을 1페이지로 정리"

    if _is_blank(normalized.get("why_this_gets_us_to_goal_faster")):
        why_faster = _clean_string_list(normalized.get("why_faster"))
        normalized["why_this_gets_us_to_goal_faster"] = (
            " ".join(why_faster)
            if why_faster
            else "고비용 개발 전에 검증 단위를 작게 쪼개어 시행착오 비용을 줄인다."
        )

    cost_note = _clean_text(normalized.get("cost_control_note")) or _clean_text(normalized.get("cost_control"))
    if not cost_note:
        cost_note = (
            "fallback 실행으로 외부 API 비용을 제한하고 저장소 안전 상태를 유지함."
            if current_fallback
            else "정상 API 응답 기반 실행. 최근 기록은 최대 7개만 참고해 비용을 제한함."
        )
    normalized["cost_control_note"] = cost_note

    risks = _clean_string_list(normalized.get("risks"))
    if current_fallback:
        if not any(_contains_fallback_marker(risk) for risk in risks):
            risks.append("현재 실행에서 fallback이 적용되어 자동화 확대 전 원인 확인 필요")
    else:
        risks = [risk for risk in risks if not _contains_fallback_marker(risk)]
    normalized["risks"] = risks

    return normalized


def _extract_json_text_from_response(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    output = getattr(response, "output", None)
    if isinstance(output, list):
        for item in output:
            content = getattr(item, "content", None)
            if isinstance(content, list):
                for part in content:
                    for attr in ("text", "output_text"):
                        value = getattr(part, attr, None)
                        if isinstance(value, str) and value.strip():
                            return value.strip()
                    if isinstance(part, dict):
                        for key in ("text", "output_text"):
                            value = part.get(key)
                            if isinstance(value, str) and value.strip():
                                return value.strip()
            elif isinstance(content, str) and content.strip():
                return content.strip()
            if isinstance(item, dict):
                for part in item.get("content", []) or []:
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
                    "recent_reports 안의 fallback, TypeError, API 실패 문구는 과거 실행 이력일 뿐이다. "
                    "그 문구를 현재 실행 상태나 현재 리스크로 반복하거나 단정하지 마라. "
                    "필수 필드는 빈 문자열로 두지 마라.\n"
                    + json.dumps(payload, ensure_ascii=False)
                ),
            },
        ],
        reasoning={"effort": "medium"},
        text={"format": {"type": "json_object"}, "verbosity": "low"},
    )
    text = _extract_json_text_from_response(response)
    return json.loads(text)


def render_report(result: dict[str, Any], ctx: RunContext) -> str:
    slot_kor = {"morning": "오전", "afternoon": "오후", "manual": "수동"}.get(ctx.slot, "수동")
    lines = [
        f"# AI 아이디어 디벨롭 리포트 - {result['date']} {slot_kor}",
        "",
        "## 오늘 집중 분야",
        f"{result.get('focus_area', '앱 안정성')}",
        "",
        "## 목표와의 연결",
        f"{result.get('goal_link', '')}",
        "",
        "## 기존 아이디어 재검토",
    ]
    for item in result.get("existing_ideas_review", []):
        lines.append(f"- {item.get('title','기존 아이디어')} → {item.get('decision','유지')}")
        lines.append(f"  - 이유: {item.get('reason','')}")
    lines += ["", "## 새 아이디어"]
    for idea in result.get("new_ideas", []):
        lines.append(f"- {idea.get('title','새 아이디어')}")
        lines.append(f"  - 요약: {idea.get('summary','')}")
        lines.append(f"  - 예상 가치: {idea.get('expected_value','')}")
        lines.append(f"  - 구현 난이도: {idea.get('implementation_cost','')}")
        lines.append(f"  - 판단: {idea.get('recommendation','유지')}")
    lines += [
        "",
        "## 다음 실행 때 볼 것",
        f"{result.get('next_best_action', '')}",
        "",
        "## Codex 작업 후보",
        f"{result.get('codex_candidate', '없음')}",
    ]
    return "\n".join(lines).strip() + "\n"


def main() -> int:
    now_kst = datetime.now(timezone.utc).astimezone(KST)
    slot = os.getenv("AI_DEV_SLOT") or detect_slot(now_kst)
    ctx = RunContext(now_kst=now_kst, slot=slot)

    goal_text = read_text(GOAL_FILE).strip()
    goal_summary = goal_text.splitlines()[0] if goal_text else "프로젝트 목표 문서 없음"
    idea_state = read_json(STATE_FILE, default={})
    recent_reports = list_recent_reports(max_files=7)

    input_payload = {
        "goal": goal_text,
        "idea_state": idea_state,
        "recent_reports": recent_reports,
        "constraints": {
            "max_new_ideas": 2,
            "no_auto_code_change": True,
            "no_auto_merge_deploy": True,
            "past_fallback_logs_are_not_current_state": True,
        },
        "required_schema": {
            "date": "YYYY-MM-DD",
            "slot": "morning|afternoon|manual",
        },
    }

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    result: dict[str, Any]
    current_fallback = False

    if not api_key:
        print("[ai-dev-loop] OPENAI_API_KEY 미설정: dry-run으로 실행합니다.")
        result = dry_run_result(ctx, goal_summary)
        current_fallback = True
    else:
        try:
            result = call_openai(api_key, input_payload)
        except Exception as exc:
            print(f"[ai-dev-loop] OpenAI 호출 실패: {type(exc).__name__}: {exc}")
            result = dry_run_result(ctx, goal_summary)
            current_fallback = True
            result["risks"].append(f"API 실패 fallback 적용: {type(exc).__name__}: {exc}")
            result["cost_control_note"] = "API 실패로 fallback 사용, 저장소 안전 상태 유지"

    result = normalize_result(result, ctx, goal_summary, current_fallback=current_fallback)

    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report_name = f"{ctx.now_kst.strftime('%Y-%m-%d-%H%M')}.md"
    report_body = render_report(result, ctx)
    (DAILY_DIR / report_name).write_text(report_body, encoding="utf-8")

    slot_kor = {"morning": "오전", "afternoon": "오후", "manual": "수동"}.get(ctx.slot, "수동")
    issue_title = f"[AI DEV] {ctx.now_kst.strftime('%Y-%m-%d')} {slot_kor} 자동 디벨롭 브리프"

    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"issue_title={issue_title}\n")
            f.write(f"report_path={(DAILY_DIR / report_name).as_posix()}\n")

    print(f"[ai-dev-loop] slot={ctx.slot}, report={report_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
