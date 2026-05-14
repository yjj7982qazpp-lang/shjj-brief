#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

KST = timezone(timedelta(hours=9))
ROOT = Path(__file__).resolve().parents[2]
AI_LAB_DIR = ROOT / "data" / "ai_lab"
DAILY_DIR = AI_LAB_DIR / "daily"
GROWTH_REPORTS_DIR = AI_LAB_DIR / "growth_reports"
GOAL_FILE = AI_LAB_DIR / "project_goal.md"
CATEGORIES_FILE = AI_LAB_DIR / "growth_categories.json"
IDEA_LEDGER_FILE = AI_LAB_DIR / "idea_ledger.json"
DECISIONS_FILE = AI_LAB_DIR / "decisions.json"
STATE_FILE = AI_LAB_DIR / "idea_state.json"

CATEGORY_ORDER = [
    "revenue",
    "design_ux",
    "feature",
    "content",
    "scalability",
    "automation",
    "code_quality",
    "ops_cost",
    "admin_analytics",
    "marketing_growth",
]

DEFAULT_CATEGORIES: dict[str, dict[str, Any]] = {
    "revenue": {
        "name_ko": "수익",
        "purpose": "구독, B2B 리드, 후원, 프리미엄 기능 등 직접 매출 가능성을 찾는다.",
        "sample_questions": ["누가 돈을 낼 이유가 있는가?", "무료 사용자를 해치지 않는 과금 지점은 무엇인가?"],
    },
    "design_ux": {
        "name_ko": "디자인/UX",
        "purpose": "모바일 첫 화면, 탐색, 읽기 흐름, 반복 사용 편의성을 개선한다.",
        "sample_questions": ["사용자가 가장 먼저 읽어야 할 정보가 선명한가?", "반복 사용 흐름이 더 짧아질 수 있는가?"],
    },
    "feature": {
        "name_ko": "기능",
        "purpose": "기존 앱 목적을 강화하는 신규 기능 또는 기능 고도화 기회를 찾는다.",
        "sample_questions": ["오늘 브리프 이후 사용자가 바로 할 수 있는 일이 있는가?", "작은 기능으로 체류나 재방문이 늘어나는가?"],
    },
    "content": {
        "name_ko": "콘텐츠",
        "purpose": "법령, 일정, 행동 가이드 외에 재방문을 만드는 콘텐츠 확장 방향을 찾는다.",
        "sample_questions": ["매일 다른 가치가 보이는가?", "전문가가 저장하거나 공유할 콘텐츠가 있는가?"],
    },
    "scalability": {
        "name_ko": "확장성",
        "purpose": "iOS, Android, B2B, 다중 도메인 확장에 필요한 구조적 개선을 찾는다.",
        "sample_questions": ["앱화할 때 병목이 될 구조는 무엇인가?", "다른 업종으로 확장 가능한 단위는 무엇인가?"],
    },
    "automation": {
        "name_ko": "자동화",
        "purpose": "관리자 반복 작업, 보고, 검수, 배포 전 점검을 자동화한다.",
        "sample_questions": ["사람이 매일 확인하는 일을 줄일 수 있는가?", "자동화가 잘못 실행될 때 멈출 장치가 있는가?"],
    },
    "code_quality": {
        "name_ko": "코드품질",
        "purpose": "작은 범위의 유지보수성, 테스트 가능성, 회귀 방지 구조를 개선한다.",
        "sample_questions": ["반복 수정되는 파일에 분리 가능한 책임이 있는가?", "검증 명령이 충분히 빠른가?"],
    },
    "ops_cost": {
        "name_ko": "운영비",
        "purpose": "API 호출, AI 요약, 캐시, 빌드, 저장 비용을 낮춘다.",
        "sample_questions": ["실사용 가치가 낮은 호출을 줄일 수 있는가?", "캐시 재사용 기준이 충분히 강한가?"],
    },
    "admin_analytics": {
        "name_ko": "관리자/분석",
        "purpose": "운영자가 볼 지표, 결정 로그, 품질 신호를 체계화한다.",
        "sample_questions": ["무엇을 보고 진행/보류/폐기를 결정할 것인가?", "관리자용 지표가 과하지 않은가?"],
    },
    "marketing_growth": {
        "name_ko": "마케팅/성장",
        "purpose": "공유, 검색 유입, 랜딩 메시지, 바이럴 루프를 개선한다.",
        "sample_questions": ["사용자가 공유할 명확한 이유가 있는가?", "검색 유입용 콘텐츠 단위가 있는가?"],
    },
}

FALLBACK_IDEAS: dict[str, dict[str, Any]] = {
    "revenue": {
        "title": "전문가용 주간 법령 브리프 유료 리포트",
        "summary": "무료 일일 브리프는 유지하고, 주간 변경 요약과 실무 체크리스트를 PDF/메일형 프리미엄 리포트로 분리한다.",
        "keywords": ["유료", "주간", "프리미엄", "리포트", "전문가"],
    },
    "design_ux": {
        "title": "첫 화면 의사결정형 카드 우선순위 재배치",
        "summary": "오늘 시행 법령, 행동 가이드, 일정 중 사용자의 다음 행동과 연결되는 정보를 첫 화면 상단에 더 명확히 배치한다.",
        "keywords": ["첫화면", "카드", "우선순위", "모바일", "행동"],
    },
    "feature": {
        "title": "관심 법령별 개인 메모와 후속 알림",
        "summary": "사용자가 특정 법령 변경에 메모를 남기고 후속 확인 날짜를 저장해 재방문 이유를 만든다.",
        "keywords": ["메모", "후속", "알림", "관심법령", "재방문"],
    },
    "content": {
        "title": "오늘의 실무 영향 한 줄 해설",
        "summary": "법령 변경마다 원문 요약과 별도로 실무자가 바로 이해할 수 있는 영향 문장과 확인 질문을 제공한다.",
        "keywords": ["실무영향", "해설", "질문", "콘텐츠", "요약"],
    },
    "scalability": {
        "title": "앱화 대비 설정 데이터 분리",
        "summary": "알림 시간, 관심 법령, 사용자 결정 기록을 향후 iOS/Android 동기화가 쉬운 데이터 단위로 분리하는 계획을 세운다.",
        "keywords": ["앱화", "설정", "동기화", "iOS", "Android"],
    },
    "automation": {
        "title": "관리자용 제안 채택 상태 자동 반영",
        "summary": "진행/보류/폐기 결정이 decisions.json에 기록되면 다음 루프가 같은 제안을 반복하지 않도록 자동 반영한다.",
        "keywords": ["관리자", "결정", "자동반영", "보류", "폐기"],
    },
    "code_quality": {
        "title": "AI 루프 출력 스키마 고정 검증",
        "summary": "보고서 필수 섹션과 원장 필드를 검증하는 저비용 스키마 체크를 추가해 깨진 보고서 생성을 막는다.",
        "keywords": ["스키마", "검증", "보고서", "원장", "회귀방지"],
    },
    "ops_cost": {
        "title": "AI 요약 재사용률 월간 점검",
        "summary": "summary_key 캐시 재사용률과 신규 생성률을 월 1회 기록해 OpenAI 호출 비용이 늘어나는 지점을 조기 발견한다.",
        "keywords": ["비용", "캐시", "summary_key", "재사용률", "OpenAI"],
    },
    "admin_analytics": {
        "title": "성장 제안 결정 대시보드 데이터",
        "summary": "제안별 진행/보류/폐기 상태와 카테고리 편중을 JSON으로 축적해 운영자가 다음 작업을 빠르게 고르게 한다.",
        "keywords": ["대시보드", "결정", "상태", "카테고리", "운영자"],
    },
    "marketing_growth": {
        "title": "공유용 오늘의 변경 요약 문구",
        "summary": "사용자가 카카오톡이나 메일로 공유하기 쉬운 짧은 변경 요약 문구를 생성해 자연 유입을 늘린다.",
        "keywords": ["공유", "요약문구", "카카오톡", "메일", "유입"],
    },
}


@dataclass
class RunContext:
    now_kst: datetime
    today: str


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


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def clean_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [clean_text(item) for item in value if clean_text(item)]
    text = clean_text(value)
    return [text] if text else []


def parse_date(value: Any) -> date | None:
    try:
        return date.fromisoformat(clean_text(value)[:10])
    except ValueError:
        return None


def stable_id(category: str, title: str) -> str:
    raw = f"{category}:{title}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def ensure_seed_files() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    AI_LAB_DIR.mkdir(parents=True, exist_ok=True)
    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    GROWTH_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    categories = read_json(CATEGORIES_FILE, default=None)
    if not isinstance(categories, dict) or not all(key in categories for key in CATEGORY_ORDER):
        categories = {
            "schema_version": 1,
            "rotation_order": CATEGORY_ORDER,
            "categories": DEFAULT_CATEGORIES,
        }
        write_json(CATEGORIES_FILE, categories)

    ledger = read_json(IDEA_LEDGER_FILE, default=None)
    if not isinstance(ledger, dict):
        ledger = {}
    ledger.setdefault("schema_version", 1)
    ledger.setdefault("ideas", [])
    ledger.setdefault("rules", {"similar_block_days": 14, "paused_block_days": 30})
    write_json(IDEA_LEDGER_FILE, ledger)

    decisions = read_json(DECISIONS_FILE, default=None)
    if not isinstance(decisions, dict):
        decisions = {}
    decisions.setdefault("schema_version", 1)
    decisions.setdefault("decisions", [])
    decisions.setdefault(
        "allowed_statuses",
        ["proceed", "hold", "revise", "discard"],
    )
    write_json(DECISIONS_FILE, decisions)
    return categories, ledger, decisions


def list_recent_reports(max_files: int = 7) -> list[dict[str, str]]:
    files = sorted(
        [*DAILY_DIR.glob("*.md"), *GROWTH_REPORTS_DIR.glob("*.md")],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )[:max_files]
    return [{"filename": file.name, "content": read_text(file)[:2200]} for file in files]


def ledger_ideas(ledger: dict[str, Any]) -> list[dict[str, Any]]:
    return [item for item in ledger.get("ideas", []) if isinstance(item, dict)]


def is_similar_blocked(
    ledger: dict[str, Any],
    category: str,
    keywords: list[str],
    today_value: date,
) -> tuple[bool, str]:
    keyword_set = {keyword.lower() for keyword in keywords}
    for idea in ledger_ideas(ledger):
        idea_date = parse_date(idea.get("date"))
        if not idea_date:
            continue
        days = (today_value - idea_date).days
        if days <= 0:
            continue
        idea_keywords = {keyword.lower() for keyword in clean_list(idea.get("similarity_keywords"))}
        same_category = clean_text(idea.get("category")) == category
        overlaps = bool(keyword_set & idea_keywords)
        status = clean_text(idea.get("status")).lower()
        if status in {"hold", "paused", "보류"} and days <= 30 and (same_category or overlaps):
            return True, f"보류된 유사 제안 '{idea.get('title')}'이 {days}일 전 기록됨"
        if days <= 14 and (same_category and overlaps):
            return True, f"최근 14일 내 유사 제안 '{idea.get('title')}'이 기록됨"
    return False, "최근 14일 동일/유사 제안 없음"


def latest_ledger_entry(ledger: dict[str, Any]) -> dict[str, Any] | None:
    dated_ideas = [
        idea
        for idea in ledger_ideas(ledger)
        if clean_text(idea.get("category")) in CATEGORY_ORDER and parse_date(idea.get("date"))
    ]
    if not dated_ideas:
        return None
    return max(dated_ideas, key=lambda item: clean_text(item.get("date")))


def category_start_index(ledger: dict[str, Any], today_value: date) -> int:
    latest = latest_ledger_entry(ledger)
    if latest is None:
        return 0
    latest_category = clean_text(latest.get("category"))
    latest_date = parse_date(latest.get("date"))
    if latest_date == today_value:
        return CATEGORY_ORDER.index(latest_category)
    return (CATEGORY_ORDER.index(latest_category) + 1) % len(CATEGORY_ORDER)


def select_category(ledger: dict[str, Any], today_value: date) -> tuple[str, str]:
    start = category_start_index(ledger, today_value)
    last_reason = "중복 없음"
    for offset in range(len(CATEGORY_ORDER)):
        category = CATEGORY_ORDER[(start + offset) % len(CATEGORY_ORDER)]
        idea = FALLBACK_IDEAS[category]
        blocked, reason = is_similar_blocked(ledger, category, clean_list(idea.get("keywords")), today_value)
        if not blocked:
            return category, reason
        last_reason = reason
    return CATEGORY_ORDER[start], f"모든 카테고리에 중복 신호가 있어 순환 기준 카테고리 유지: {last_reason}"


def fallback_result(category: str, categories: dict[str, Any], duplicate_note: str) -> dict[str, Any]:
    category_meta = categories.get("categories", {}).get(category, DEFAULT_CATEGORIES[category])
    idea = FALLBACK_IDEAS[category]
    return {
        "perspective": {
            "category": category,
            "category_name": category_meta.get("name_ko", category),
            "core_question": clean_list(category_meta.get("sample_questions"))[0],
        },
        "existing_improvements": [
            "기존 앱의 정상 작동 여부 확인보다, 현재 화면과 데이터가 다음 행동을 충분히 유도하는지 평가한다.",
            "보고서가 반복 점검으로 흐르지 않도록 오늘의 제안은 하나의 성장 가설과 연결한다.",
        ],
        "missing_opportunities": [
            idea["summary"],
            "실제 앱 코드 변경은 다음 작업으로 분리하고, 이번 루프는 제안과 검수 기준만 만든다.",
            "수익화, 콘텐츠, 관리자 자동화, 앱화 중 적어도 하나와 연결되는 실행 단위를 우선한다.",
        ],
        "impact_analysis": {
            "수익": "직접 매출 또는 장기 전환 가능성을 확인할 수 있다.",
            "디자인/UX": "사용자에게 다음 행동이 더 분명해진다.",
            "기능": "작은 실험 단위로 기능 확장 여부를 판단할 수 있다.",
            "콘텐츠": "매일 다른 읽을 이유를 만든다.",
            "확장성": "앱화와 운영 자동화로 확장할 여지를 남긴다.",
            "운영비": "실제 구현 전 제안 단계에서 비용이 큰 작업을 걸러낸다.",
        },
        "top_proposal": {
            "title": idea["title"],
            "reason": "현재 없는 성장 축을 우선 검토해 반복적인 작동 점검 보고서에서 벗어나기 위함이다.",
            "expected_effect": "다음 Codex 작업이 기능 정상 확인이 아니라 성장 가설 검증으로 이어진다.",
            "risk": "사용자 결정 없이 바로 구현하면 범위가 커질 수 있으므로 제안 검토 후 진행해야 한다.",
            "priority": "P1",
            "summary": idea["summary"],
            "similarity_keywords": idea["keywords"],
        },
        "codex_work_order": {
            "branch_name": f"preview/growth-{category}",
            "target_files": ["data/ai_lab/growth_reports/*.md", "data/ai_lab/idea_ledger.json"],
            "todo": "선택된 제안의 검수 기준을 좁히고, 앱 기능 파일 수정 없이 다음 실행 후보를 정리한다.",
            "do_not_do": "법령/날씨/일정 앱 기능, 광고 스크립트, main 병합, 배포 작업은 하지 않는다.",
            "acceptance": "보고서가 새 형식을 따르고 최근 14일 유사 제안과 겹치지 않는다.",
        },
        "duplicate_review": {
            "same_14_days": duplicate_note,
            "similar_30_days": "보류 상태 아이디어는 30일간 반복 금지 규칙으로 확인한다.",
            "difference_if_duplicate": "중복이면 다음 카테고리로 넘기며, 모든 카테고리가 막힌 경우에만 순환 기준을 유지한다.",
        },
        "cost_model": {
            "recommended_model": "GPT-5.4 Mini",
            "reasoning": "Medium",
            "cost_reason": "최근 보고서 최대 7개와 요약 원장만 입력해 토큰과 호출량을 제한한다.",
        },
    }


def call_openai(api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.responses.create(
        model=os.getenv("AI_DEV_LOOP_MODEL") or os.getenv("AI_GROWTH_MODEL") or "gpt-5.4-mini",
        input=[
            {
                "role": "system",
                "content": (
                    "당신은 SHJJ Brief의 Growth PM이다. 앱 정상 작동 확인이 아니라 수익성, UX, 기능, 콘텐츠, "
                    "확장성, 코드품질, 자동화, 운영비 개선 제안을 만든다. 반드시 JSON만 출력한다."
                ),
            },
            {
                "role": "user",
                "content": (
                    "아래 입력을 기준으로 오늘의 AI Growth PM Loop 결과를 만든다. "
                    "현재 없는 기능/수익화/확장성/콘텐츠/관리자 자동화 제안을 가장 크게 다룬다. "
                    "최근 보고서 및 idea_ledger와 중복되는 주제는 피한다. "
                    "실제 앱 코드 수정 지시는 하지 않는다. 필수 키: perspective, existing_improvements, "
                    "missing_opportunities, impact_analysis, top_proposal, codex_work_order, "
                    "duplicate_review, cost_model.\n"
                    + json.dumps(payload, ensure_ascii=False)
                ),
            },
        ],
        reasoning={"effort": "medium"},
        text={"format": {"type": "json_object"}, "verbosity": "low"},
    )
    return json.loads(response.output_text)


def normalize_result(raw: dict[str, Any], category: str, categories: dict[str, Any], duplicate_note: str) -> dict[str, Any]:
    fallback = fallback_result(category, categories, duplicate_note)
    result = raw if isinstance(raw, dict) else {}
    for key, value in fallback.items():
        if key not in result or result[key] in ("", None, [], {}):
            result[key] = value

    top = result.get("top_proposal") if isinstance(result.get("top_proposal"), dict) else {}
    fallback_top = fallback["top_proposal"]
    top.setdefault("title", fallback_top["title"])
    top.setdefault("summary", fallback_top["summary"])
    top.setdefault("similarity_keywords", fallback_top["similarity_keywords"])
    top.setdefault("priority", "P1")
    result["top_proposal"] = top

    perspective = result.get("perspective") if isinstance(result.get("perspective"), dict) else {}
    perspective["category"] = category
    perspective.setdefault("category_name", categories.get("categories", {}).get(category, {}).get("name_ko", category))
    perspective.setdefault("core_question", fallback["perspective"]["core_question"])
    result["perspective"] = perspective
    return result


def render_report(result: dict[str, Any], ctx: RunContext) -> str:
    perspective = result["perspective"]
    top = result["top_proposal"]
    work = result["codex_work_order"]
    duplicate = result["duplicate_review"]
    cost = result["cost_model"]
    impact = result["impact_analysis"]
    lines = [
        f"# AI Development Loop 성장 제안 리포트 - {ctx.today}",
        "",
        "## 1. 오늘의 관점",
        f"- 분야: {perspective.get('category_name')} ({perspective.get('category')})",
        f"- 오늘의 핵심 질문: {perspective.get('core_question')}",
        "",
        "## 2. 현재 있는 부분에서 발전할 점",
    ]
    lines += [f"- {item}" for item in clean_list(result.get("existing_improvements"))]
    lines += ["", "## 3. 현재 없는 부분에서 발전할 점"]
    lines += [f"- {item}" for item in clean_list(result.get("missing_opportunities"))]
    lines += [
        "",
        "## 4. 분야별 영향 분석",
        "| 분야 | 영향 | 판단 |",
        "| --- | --- | --- |",
    ]
    for field in ["수익", "디자인/UX", "기능", "콘텐츠", "확장성", "운영비"]:
        value = impact.get(field, "") if isinstance(impact, dict) else ""
        lines.append(f"| {field} | {value} | 검토 필요 |")
    lines += [
        "",
        "## 5. 오늘의 최우선 제안 1개",
        f"- 제목: {top.get('title')}",
        f"- 이유: {top.get('reason')}",
        f"- 기대효과: {top.get('expected_effect')}",
        f"- 리스크: {top.get('risk')}",
        f"- 우선순위: {top.get('priority')}",
        "",
        "## 6. Codex 작업지시서",
        f"- 브랜치명: {work.get('branch_name')}",
        f"- 수정 대상 파일: {', '.join(clean_list(work.get('target_files')))}",
        f"- 해야 할 일: {work.get('todo')}",
        f"- 하지 말아야 할 일: {work.get('do_not_do')}",
        f"- 검수 기준: {work.get('acceptance')}",
        "",
        "## 7. 중복 검토",
        f"- 최근 14일 내 동일 제안 여부: {duplicate.get('same_14_days')}",
        f"- 최근 30일 내 유사 제안 여부: {duplicate.get('similar_30_days')}",
        f"- 중복이면 왜 다른 관점인지 설명: {duplicate.get('difference_if_duplicate')}",
        "",
        "## 8. 비용/모델 판단",
        f"- 추천 모델: {cost.get('recommended_model')}",
        f"- reasoning/intelligence: {cost.get('reasoning')}",
        f"- 크레딧 절약 근거: {cost.get('cost_reason')}",
        "",
        "## 9. 사용자 결정 필요",
        "- 진행 / 보류 / 수정 / 폐기",
    ]
    return "\n".join(lines).strip() + "\n"


def append_ledger(ledger: dict[str, Any], ctx: RunContext, category: str, result: dict[str, Any]) -> dict[str, Any]:
    top = result["top_proposal"]
    title = clean_text(top.get("title"))
    idea_id = stable_id(category, title)
    ideas = ledger_ideas(ledger)
    ideas = [idea for idea in ideas if not (idea.get("id") == idea_id and idea.get("date") == ctx.today)]
    ideas.append(
        {
            "id": idea_id,
            "date": ctx.today,
            "category": category,
            "title": title,
            "summary": clean_text(top.get("summary")) or clean_text(top.get("reason")),
            "status": "proposed",
            "similarity_keywords": clean_list(top.get("similarity_keywords")),
            "cooldown_days": 14,
        }
    )
    ledger["ideas"] = ideas[-300:]
    ledger["last_updated"] = ctx.now_kst.isoformat()
    return ledger


def build_idea_state(
    ctx: RunContext,
    category: str,
    result: dict[str, Any],
    growth_path: Path,
    daily_path: Path,
    issue_title: str,
) -> dict[str, Any]:
    perspective = result["perspective"]
    top = result["top_proposal"]
    growth_report_path = growth_path.relative_to(ROOT).as_posix()
    daily_report_path = daily_path.relative_to(ROOT).as_posix()
    return {
        "date": ctx.today,
        "mode": "growth_suggestion",
        "category": category,
        "category_name": clean_text(perspective.get("category_name")),
        "top_proposal_title": clean_text(top.get("title")),
        "top_proposal_summary": clean_text(top.get("summary")) or clean_text(top.get("reason")),
        "last_report_path": growth_report_path,
        "last_daily_report_path": daily_report_path,
        "last_issue_title": issue_title,
        "last_run_at_kst": ctx.now_kst.isoformat(),
        "cost_model": result.get("cost_model", {}),
        "_ai_development_loop": {
            "last_report_date": ctx.today,
            "last_report_path": growth_report_path,
            "last_issue_title": issue_title,
            "last_run_at_kst": ctx.now_kst.isoformat(),
        },
    }


def write_github_outputs(issue_title: str, report_path: Path, should_create_issue: bool) -> None:
    github_output = os.getenv("GITHUB_OUTPUT")
    if not github_output:
        return
    with open(github_output, "a", encoding="utf-8") as f:
        f.write(f"issue_title={issue_title}\n")
        f.write(f"report_path={report_path.as_posix()}\n")
        f.write(f"should_create_issue={'true' if should_create_issue else 'false'}\n")


def main() -> int:
    now_kst = datetime.now(KST)
    ctx = RunContext(now_kst=now_kst, today=now_kst.strftime("%Y-%m-%d"))
    categories, ledger, decisions = ensure_seed_files()
    today_date = now_kst.date()
    category, duplicate_note = select_category(ledger, today_date)

    payload = {
        "date": ctx.today,
        "selected_category": category,
        "category_order": CATEGORY_ORDER,
        "category_definition": categories.get("categories", {}).get(category),
        "project_goal": read_text(GOAL_FILE)[:3000],
        "recent_reports": list_recent_reports(max_files=7),
        "idea_ledger_recent": ledger_ideas(ledger)[-80:],
        "decisions": decisions.get("decisions", [])[-80:],
        "constraints": {
            "do_not_focus_on_app_health_check": True,
            "do_not_verify_features_already_in_main": True,
            "no_app_code_change": True,
            "no_ad_script_insertion": True,
            "max_recent_reports": 7,
            "prefer_missing_growth_opportunities": True,
        },
    }

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if api_key:
        try:
            raw_result = call_openai(api_key, payload)
        except Exception as exc:
            print(f"[ai-growth-loop] OpenAI 호출 실패, fallback 사용: {type(exc).__name__}: {exc}")
            raw_result = fallback_result(category, categories, duplicate_note)
    else:
        print("[ai-growth-loop] OPENAI_API_KEY 미설정: fallback 보고서를 생성합니다.")
        raw_result = fallback_result(category, categories, duplicate_note)

    result = normalize_result(raw_result, category, categories, duplicate_note)
    report_body = render_report(result, ctx)

    daily_path = DAILY_DIR / f"{ctx.today}-{now_kst.strftime('%H%M')}.md"
    growth_path = GROWTH_REPORTS_DIR / f"{ctx.today}.md"
    daily_path.write_text(report_body, encoding="utf-8")
    growth_path.write_text(report_body, encoding="utf-8")

    ledger = append_ledger(ledger, ctx, category, result)
    write_json(IDEA_LEDGER_FILE, ledger)

    category_name = result["perspective"].get("category_name", category)
    issue_title = f"[AI DEV] {ctx.today} {category_name} 성장 제안"
    write_json(STATE_FILE, build_idea_state(ctx, category, result, growth_path, daily_path, issue_title))
    write_github_outputs(issue_title, growth_path, should_create_issue=True)
    print(f"[ai-growth-loop] category={category}, daily={daily_path.name}, growth={growth_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
