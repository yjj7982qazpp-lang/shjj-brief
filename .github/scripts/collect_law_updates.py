from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen
import json
import os
import re
import time

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = Path(__file__).resolve().parent

WATCHED_PATH = SCRIPTS_DIR / "watched_laws.json"
OUTPUT_PATH = ROOT / "data" / "law_updates.json"

API_ENDPOINTS = [
    "https://www.law.go.kr/DRF/lawSearch.do",
    "http://www.law.go.kr/DRF/lawSearch.do",
]
SERVICE_ENDPOINTS = [
    "https://www.law.go.kr/DRF/lawService.do",
    "http://www.law.go.kr/DRF/lawService.do",
]
API_TIMEOUT = 20
API_RETRY_COUNT = 3
API_RETRY_DELAY_SECONDS = 2
API_DISPLAY = "100"
MAX_ARTICLE_REFERENCES = 10
KST = timezone(timedelta(hours=9))
NAME_CLEANUP_RE = re.compile(r"[\s\W_]+", re.UNICODE)
HTML_TAG_RE = re.compile(r"<[^>]+>")
ARTICLE_NUMBER_RE = re.compile(r"^\d+$")
JO_SECTION_KEYS = {"조문", "jo", "lsJo"}
ARTICLE_REFERENCE_UNIT_RE = (
    r"제\s*\d+\s*조"
    r"(?:의\s*\d+)?"
    r"(?:\s*제\s*\d+\s*항)?"
    r"(?:\s*제\s*\d+\s*호)?"
    r"(?:\s*[가-힣]\s*목)?"
)
ARTICLE_REFERENCE_RE = re.compile(
    rf"({ARTICLE_REFERENCE_UNIT_RE}(?:\s*부터\s*{ARTICLE_REFERENCE_UNIT_RE}\s*까지)?)"
)
CHANGED_FLAG_VALUES = {
    "y",
    "yes",
    "true",
    "1",
    "변경",
    "있음",
    "개정",
}


class LawApiError(Exception):
    def __init__(self, attempts):
        super().__init__("Law API request failed")
        self.attempts = attempts


def read_json(path, fallback):
    if not path.exists():
        return fallback

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(payload):
    if isinstance(payload, dict):
        items = payload.get("items")
        if isinstance(items, list):
            payload["items"] = [ensure_article_reference_limit(ensure_detail_debug_fields(ensure_article_references(item))) for item in items]

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


def safe_dict(value):
    return value if isinstance(value, dict) else {}


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
    return "기타", 3


def build_detail_url(raw_link):
    if not raw_link:
        return ""
    if raw_link.startswith("http://") or raw_link.startswith("https://"):
        return raw_link
    if raw_link.startswith("/"):
        return f"https://www.law.go.kr{raw_link}"
    return f"https://www.law.go.kr/{raw_link.lstrip('/')}"


def clean_text(value):
    text = str(value or "").strip()
    if not text:
        return ""

    text = unescape(text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p\s*>", "\n", text)
    text = HTML_TAG_RE.sub("", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def walk_nodes(value):
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from walk_nodes(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from walk_nodes(nested)


def first_value(data, *keys):
    for node in walk_nodes(data):
        value = pick(node, *keys)
        if value:
            return clean_text(value)
    return ""


def format_output_date(value):
    parsed = parse_date(value)
    if parsed:
        return to_output_date(parsed)
    return clean_text(value)


def is_changed_flag(value):
    text = clean_text(value)
    if not text:
        return False

    lowered = text.lower()
    return lowered in CHANGED_FLAG_VALUES or text in CHANGED_FLAG_VALUES


def normalize_article_number(value):
    text = clean_text(value)
    if not text:
        return ""
    if ARTICLE_NUMBER_RE.match(text):
        return f"제{text}조"
    return text


def collect_debug_keys(data, limit=40):
    keys = []
    seen = set()
    for node in walk_nodes(data):
        if not isinstance(node, dict):
            continue
        for key in node.keys():
            key_text = clean_text(key)
            if not key_text or key_text in seen:
                continue
            seen.add(key_text)
            keys.append(key_text)
            if len(keys) >= limit:
                return keys
    return keys


def collect_node_keys(node):
    if not isinstance(node, dict):
        return []
    return [
        key_text
        for key_text in (clean_text(key) for key in node.keys())
        if key_text
    ]


def has_article_content_signal(article_number, article_title, article_effective_date, article_revision_type, article_content):
    return any([article_number, article_title, article_effective_date, article_revision_type, article_content])


def has_article_change_signal(article_changed, article_revision_type, article_effective_date, article_content):
    if is_changed_flag(article_changed):
        return True
    if article_revision_type:
        return True
    if article_effective_date and article_content:
        return True
    return False


def is_actual_article_unit(node):
    if not isinstance(node, dict):
        return False

    keys = set(collect_node_keys(node))
    if not keys:
        return False

    unit_keys = {
        "조문번호",
        "조문가지번호",
        "조문여부",
        "조문제목",
        "조문시행일자",
        "조문제개정유형",
        "조문내용",
        "joNo",
        "joTitle",
        "joYn",
        "articleNo",
        "articleTitle",
        "articleEffectiveDate",
        "articleRevisionType",
        "articleContent",
    }
    if not (keys & unit_keys):
        return False

    article_number = normalize_article_number(
        pick(node, "조문번호", "조문번호문자열", "조번호", "조항번호", "joNo", "JO", "articleNo", "article_number")
    )
    article_branch_number = clean_text(
        pick(node, "조문가지번호", "조항가지번호", "joBranchNo", "articleBranchNo", "article_branch_number")
    )
    article_title = clean_text(
        pick(node, "조문제목", "조제목", "조항제목", "joTitle", "articleTitle", "article_title")
    )
    article_effective_date = format_output_date(
        pick(node, "조문시행일자", "조문시행일자문자열", "시행일자", "articleEffectiveDate", "effectiveDate", "article_effective_date")
    )
    article_revision_type = clean_text(
        pick(node, "조문제개정유형", "조문개정유형", "개정유형", "제개정구분명", "개정구분", "articleRevisionType", "revisionType", "article_revision_type")
    )
    article_content = clean_text(
        pick(node, "조문내용", "조내용", "article_text", "joContent", "articleContent", "content")
    )
    article_flag = clean_text(pick(node, "조문여부", "joYn", "articleYn"))

    if article_flag and article_flag.upper() != "Y":
        return False
    if article_branch_number:
        return True
    if has_article_content_signal(
        article_number,
        article_title,
        article_effective_date,
        article_revision_type,
        article_content,
    ):
        return True
    return False


def iter_jo_section_values(data):
    for node in walk_nodes(data):
        if not isinstance(node, dict):
            continue
        for key, value in node.items():
            if clean_text(key) in JO_SECTION_KEYS:
                yield value


def parse_detail_query(item):
    detail_url = item.get("detail_url") or item.get("source_url") or ""
    if not detail_url:
        return {}
    return parse_qs(urlparse(detail_url).query)


def extract_detail_params(item):
    query = parse_detail_query(item)
    source_target = "eflaw" if item.get("source_type") == "effective" else "law"
    target = clean_text((query.get("target") or [source_target])[0]) or source_target
    params = {
        "target": target,
        "type": "JSON",
        "mobileYn": "",
    }

    law_id = clean_text((query.get("ID") or [item.get("law_id", "")])[0])
    law_mst = clean_text((query.get("MST") or [item.get("law_mst", "")])[0])
    if law_id:
        params["ID"] = law_id
    elif law_mst:
        params["MST"] = law_mst
    else:
        return {}

    if target == "eflaw":
        effective_date = clean_text((query.get("efYd") or [item.get("effective_date", "")])[0])
        digits = re.sub(r"\D", "", effective_date)
        if digits:
            params["efYd"] = digits[:8]

    return params


def build_article_record(node):
    article_number = normalize_article_number(
        pick(
            node,
            "조문번호",
            "조문번호문자열",
            "조번호",
            "조항번호",
            "joNo",
            "JO",
            "articleNo",
            "article_number",
        )
    )
    article_branch_number = clean_text(
        pick(
            node,
            "조문가지번호",
            "조항가지번호",
            "joBranchNo",
            "articleBranchNo",
            "article_branch_number",
        )
    )
    article_title = clean_text(
        pick(
            node,
            "조문제목",
            "조제목",
            "조항제목",
            "joTitle",
            "articleTitle",
            "article_title",
        )
    )
    article_effective_date = format_output_date(
        pick(
            node,
            "조문시행일자",
            "조문시행일자문자열",
            "시행일자",
            "articleEffectiveDate",
            "effectiveDate",
            "article_effective_date",
        )
    )
    article_revision_type = clean_text(
        pick(
            node,
            "조문제개정유형",
            "조문개정유형",
            "개정유형",
            "제개정구분명",
            "개정구분",
            "articleRevisionType",
            "revisionType",
            "article_revision_type",
        )
    )
    article_changed = clean_text(
        pick(
            node,
            "조문변경여부",
            "변경여부",
            "articleChangedYn",
            "article_changed",
            "changedYn",
            "changed",
        )
    )
    article_content = clean_text(
        pick(
            node,
            "조문내용",
            "조내용",
            "article_text",
            "joContent",
            "articleContent",
            "content",
        )
    )
    article_flag = clean_text(pick(node, "조문여부", "joYn", "articleYn"))

    if article_branch_number:
        article_number = f"{article_number}-{article_branch_number}" if article_number else article_branch_number

    if not has_article_content_signal(
        article_number,
        article_title,
        article_effective_date,
        article_revision_type,
        article_content,
    ):
        return None
    if article_flag and article_flag.upper() != "Y":
        return None
    if not has_article_change_signal(
        article_changed,
        article_revision_type,
        article_effective_date,
        article_content,
    ):
        return None

    return {
        "article_number": article_number,
        "article_title": article_title,
        "article_effective_date": article_effective_date,
        "article_revision_type": article_revision_type,
        "article_content": article_content,
        "article_changed": article_changed or ("Y" if article_revision_type else ""),
    }


def extract_changed_articles(detail_data):
    seen = set()
    articles = []

    for node in extract_article_candidates(detail_data):
        article = build_article_record(node)
        if not article:
            continue
        key = (
            article.get("article_number", ""),
            article.get("article_title", ""),
            article.get("article_effective_date", ""),
            article.get("article_revision_type", ""),
            article.get("article_content", ""),
        )
        if key in seen:
            continue
        seen.add(key)
        articles.append(article)

    return articles


def extract_article_candidates(detail_data):
    candidates = []
    seen = set()

    for section_value in iter_jo_section_values(detail_data):
        for node in walk_nodes(section_value):
            if not isinstance(node, dict):
                continue
            if not is_actual_article_unit(node):
                continue

            keys = tuple(collect_node_keys(node))
            identity = (
                tuple(keys),
                clean_text(pick(node, "조문번호", "조문번호문자열", "조문가지번호", "joNo", "articleNo")),
                clean_text(pick(node, "조문제목", "조제목", "joTitle", "articleTitle")),
            )
            if not keys:
                continue
            if identity in seen:
                continue
            seen.add(identity)
            candidates.append(node)

    return candidates


def extract_article_text(detail_data):
    return first_value(
        detail_data,
        "조문내용",
        "조내용",
        "조문단위",
        "조문",
        "법령본문",
        "joContent",
        "articleContent",
        "article_text",
    )


def ensure_detail_debug_fields(item):
    normalized = dict(item or {})

    article_count = normalized.get("detail_article_count", 0)
    try:
        article_count = int(article_count or 0)
    except (TypeError, ValueError):
        article_count = 0

    debug_keys = normalized.get("detail_debug_keys", [])
    if not isinstance(debug_keys, list):
        debug_keys = []

    first_article_keys = normalized.get("detail_first_article_keys", [])
    if not isinstance(first_article_keys, list):
        first_article_keys = []

    normalized["detail_article_count"] = article_count
    normalized["detail_debug_keys"] = debug_keys
    normalized["detail_first_article_keys"] = first_article_keys

    if not normalized.get("detail_fetch_status"):
        normalized["detail_fetch_status"] = "pending"

    article_references = normalized.get("article_references", [])
    if not isinstance(article_references, list):
        article_references = []
    normalized["article_references"] = article_references[:MAX_ARTICLE_REFERENCES]

    article_references_total_count = normalized.get("article_references_total_count", len(article_references))
    try:
        article_references_total_count = int(article_references_total_count or 0)
    except (TypeError, ValueError):
        article_references_total_count = len(article_references)
    normalized["article_references_total_count"] = max(article_references_total_count, len(article_references))

    return normalized


def ensure_article_reference_limit(item):
    normalized = dict(item or {})
    article_references = normalized.get("article_references", [])
    if not isinstance(article_references, list):
        article_references = []

    total_count = normalized.get("article_references_total_count", len(article_references))
    try:
        total_count = int(total_count or 0)
    except (TypeError, ValueError):
        total_count = len(article_references)

    normalized["article_references_total_count"] = max(total_count, len(article_references))
    normalized["article_references"] = article_references[:MAX_ARTICLE_REFERENCES]
    return normalized


def normalize_article_reference_label(value):
    text = clean_text(value)
    if not text:
        return ""
    return re.sub(r"\s+", "", text)


def stringify_article_reference_source(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return clean_text(value)
    if isinstance(value, (dict, list, tuple)):
        try:
            return clean_text(json.dumps(value, ensure_ascii=False))
        except (TypeError, ValueError):
            return clean_text(str(value))
    return clean_text(value)


def build_article_reference_snippet(text, start, end, radius=100):
    source_text = stringify_article_reference_source(text)
    if not source_text:
        return ""
    left = max(0, start - radius)
    right = min(len(source_text), end + radius)
    snippet = source_text[left:right].strip()
    return re.sub(r"\s+", " ", snippet)


def get_article_reference_family(label):
    text = normalize_article_reference_label(label)
    if not text or "부터" in text:
        return text
    match = re.match(r"^(제\d+조(?:의\d+)?)", text)
    return match.group(1) if match else text


def get_article_reference_specificity(label):
    text = normalize_article_reference_label(label)
    if not text:
        return 0
    score = len(text)
    score += text.count("제") * 4
    score += text.count("항") * 6
    score += text.count("호") * 8
    score += text.count("목") * 10
    if "부터" in text and "까지" in text:
        score -= 12
    return score


def compress_article_references(references, limit=10):
    grouped = {}

    for index, reference in enumerate(references):
        label = normalize_article_reference_label(reference.get("article_label", ""))
        if not label:
            continue

        candidate = dict(reference)
        candidate["article_label"] = label
        family = get_article_reference_family(label)
        current = grouped.get(family)
        candidate_rank = (get_article_reference_specificity(label), -index)

        if current is None:
            grouped[family] = (candidate_rank, candidate)
            continue

        current_rank, _ = current
        if candidate_rank > current_rank:
            grouped[family] = (candidate_rank, candidate)

    compressed = [entry[1] for entry in grouped.values()]
    compressed.sort(
        key=lambda reference: (
            -get_article_reference_specificity(reference.get("article_label", "")),
            reference.get("article_label", ""),
        )
    )
    return compressed[:limit]


def extract_article_references(*field_pairs):
    references = []
    seen_labels = set()

    for source_field, text in field_pairs:
        source_text = stringify_article_reference_source(text)
        if not source_text:
            continue

        for match in ARTICLE_REFERENCE_RE.finditer(source_text):
            label = normalize_article_reference_label(match.group(1))
            if not label or label in seen_labels:
                continue
            seen_labels.add(label)
            snippet = build_article_reference_snippet(source_text, match.start(), match.end())
            if len(snippet) > 120:
                snippet = snippet[:117].rstrip() + "..."
            references.append(
                {
                    "article_label": label,
                    "source_field": source_field,
                    "snippet": snippet,
                }
            )

    return references


def ensure_article_references(item):
    normalized = dict(item or {})
    all_references = extract_article_references(
        ("amendment_text", normalized.get("amendment_text", "")),
        ("change_reason", normalized.get("change_reason", "")),
        ("article_text", normalized.get("article_text", "")),
    )
    normalized["article_references_total_count"] = len(all_references)
    normalized["article_references"] = compress_article_references(all_references, limit=MAX_ARTICLE_REFERENCES)
    return ensure_article_reference_limit(normalized)


def build_article_text(changed_articles):
    parts = []
    for article in changed_articles:
        heading = " ".join(
            value
            for value in [article.get("article_number", ""), article.get("article_title", "")]
            if value
        ).strip()
        if heading:
            parts.append(heading)
        if article.get("article_content"):
            parts.append(article["article_content"])
    return "\n\n".join(parts).strip()


def summarize_attempts(attempts):
    parts = []
    for attempt in attempts[:5]:
        law_name = attempt.get("law_name", "unknown")
        query_type = attempt.get("query_type", "query")
        code = attempt.get("code", "error")
        message = attempt.get("message", "")
        parts.append(f"{law_name}:{query_type}:{code}:{message}")
    return " | ".join(parts)


def fetch_api_once(base_url, params, label):
    url = f"{base_url}?{urlencode(params)}"
    request = Request(
        url,
        headers={
            "User-Agent": "SHJJ-Brief-LawCollector/3.0",
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


def fetch_api_from_endpoints(endpoints, params, label):
    attempts = []

    for base_url in endpoints:
        for retry_index in range(API_RETRY_COUNT):
            try:
                return fetch_api_once(base_url, params, label)
            except HTTPError as error:
                raw = error.read().decode("utf-8", errors="replace") if error.fp else ""
                attempts.append(
                    {
                        "label": label,
                        "code": "http_error",
                        "message": f"{base_url} HTTP {error.code}",
                        "raw_sample": raw[:240],
                        "attempt": retry_index + 1,
                    }
                )
                break
            except LawApiError as error:
                for attempt in error.attempts:
                    attempt["attempt"] = retry_index + 1
                    attempt["endpoint"] = base_url
                attempts.extend(error.attempts)
                break
            except (TimeoutError, URLError, OSError) as error:
                attempts.append(
                    {
                        "label": label,
                        "code": "request_error",
                        "message": f"{base_url} {str(error)[:180]}",
                        "attempt": retry_index + 1,
                    }
                )
                if retry_index < API_RETRY_COUNT - 1:
                    time.sleep(API_RETRY_DELAY_SECONDS)

    raise LawApiError(attempts)


def fetch_api(params, label):
    return fetch_api_from_endpoints(API_ENDPOINTS, params, label)


def fetch_law_search(oc, target, extra_params, label, law_name):
    params = {
        "OC": oc,
        "target": target,
        "type": "JSON",
        "search": "1",
        "query": law_name,
        **extra_params,
    }
    return fetch_api(params, label)


def fetch_law_detail(oc, item):
    params = extract_detail_params(item)
    if not params:
        raise ValueError("detail_params_missing")

    params["OC"] = oc
    return fetch_api_from_endpoints(SERVICE_ENDPOINTS, params, "detail")


def fetch_effective_laws(oc, law_name, start_day, end_day):
    return fetch_law_search(
        oc,
        "eflaw",
        {
            "efYd": f"{to_api_date(start_day)}~{to_api_date(end_day)}",
            "display": API_DISPLAY,
            "page": "1",
            "sort": "efdes",
        },
        "effective",
        law_name,
    )


def fetch_promulgated_laws(oc, law_name):
    return fetch_law_search(
        oc,
        "law",
        {
            "display": API_DISPLAY,
            "page": "1",
            "sort": "ddes",
        },
        "promulgated",
        law_name,
    )


def source_date_for(item, source_type):
    if source_type == "effective":
        return parse_date(pick(item, "시행일자", "effectiveDate"))
    return parse_date(pick(item, "공포일자", "promulgationDate", "시행일자", "effectiveDate"))


def convert_api_item(item, watched_map, source_type, source_note):
    law_name = pick(item, "법령명한글", "법령명", "lawNm", "법령명한글HTML")
    ministry = pick(item, "소관부처명", "소관부처", "ministry")
    law_type = pick(item, "법령구분명", "법령구분", "lawType")
    revision_type = pick(item, "개정구분명", "개정구분", "revisionType")
    promulgation_date_obj = parse_date(pick(item, "공포일자", "promulgationDate"))
    effective_date_obj = parse_date(pick(item, "시행일자", "effectiveDate"))
    promulgation_date = to_output_date(promulgation_date_obj) if promulgation_date_obj else ""
    effective_date = to_output_date(effective_date_obj) if effective_date_obj else ""
    detail_url = build_detail_url(pick(item, "법령상세링크", "상세링크", "detailUrl"))
    category, priority = classify_law(law_name, ministry, watched_map)
    source_date = source_date_for(item, source_type)
    source_date_text = to_output_date(source_date) if source_date else ""

    if source_type == "effective":
        summary = "최근 30일 시행일 기준 변경 법령입니다."
        source = "law.go.kr eflaw"
    else:
        summary = "최근 30일 공포/개정 기준 변경 법령입니다."
        source = "law.go.kr law"

    detail_parts = []
    if revision_type:
        detail_parts.append(f"{revision_type} 법령")
    if ministry:
        detail_parts.append(f"소관부처 {ministry}")
    if law_type:
        detail_parts.append(f"법령구분 {law_type}")
    if source_note:
        detail_parts.append(source_note)

    return {
        "law_name": law_name,
        "category": category,
        "ministry": ministry,
        "law_type": law_type,
        "revision_type": revision_type,
        "promulgation_date": promulgation_date,
        "effective_date": effective_date,
        "summary": f"{summary} {' '.join(detail_parts)}".strip(),
        "detail_url": detail_url,
        "source": source,
        "source_type": source_type,
        "source_note": source_note,
        "source_date": source_date_text,
        "priority": priority,
        "status": "changed",
        "status_label": "변경 있음",
        "amendment_type": revision_type,
        "impact": "높음" if priority == 1 else "확인 필요",
        "change_summary": f"{summary} {' '.join(detail_parts)}".strip(),
        "source_url": detail_url,
        "detail_fetch_status": "pending",
        "amendment_text": "",
        "change_reason": "",
        "changed_articles": [],
        "article_text": "",
        "article_references": [],
        "article_references_total_count": 0,
        "detail_article_count": 0,
        "detail_debug_keys": [],
        "detail_first_article_keys": [],
    }


def item_sort_key(item):
    date = (
        parse_date(item.get("source_date"))
        or parse_date(item.get("effective_date"))
        or parse_date(item.get("promulgation_date"))
    )
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
        item.get("source_type", ""),
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


def is_same_law_name(left, right):
    return normalize_name(left) == normalize_name(right)


def filter_query_items(raw_items, watched_law_name, watched_map, source_type, source_note, start_day, end_day):
    filtered = []

    for item in raw_items:
        law_name = pick(item, "법령명한글", "법령명", "lawNm", "법령명한글HTML")
        if not is_same_law_name(law_name, watched_law_name):
            continue

        converted = convert_api_item(item, watched_map, source_type, source_note)
        source_date = parse_date(converted.get("source_date"))
        if not source_date or not (start_day <= source_date <= end_day):
            continue
        filtered.append(converted)

    return filtered


def extract_detail_fields(detail_data):
    article_candidates = extract_article_candidates(detail_data)
    changed_articles = extract_changed_articles(detail_data)
    article_text = build_article_text(changed_articles)
    if not article_text:
        article_text = extract_article_text(detail_data)

    amendment_text = first_value(detail_data, "개정문내용", "amendmentText")
    change_reason = first_value(detail_data, "제개정이유내용", "changeReason", "개정이유", "제개정이유")
    article_references = extract_article_references(
        ("amendment_text", amendment_text),
        ("change_reason", change_reason),
        ("article_text", article_text),
    )
    has_detail = any([amendment_text, change_reason, changed_articles, article_text])
    detail_debug_keys = collect_debug_keys(detail_data)
    detail_first_article_keys = collect_node_keys(article_candidates[0]) if article_candidates else []

    return ensure_detail_debug_fields(ensure_article_references({
        "amendment_text": amendment_text,
        "change_reason": change_reason,
        "changed_articles": changed_articles,
        "article_text": article_text,
        "article_references": article_references,
        "article_references_total_count": len(article_references),
        "detail_article_count": len(article_candidates),
        "detail_debug_keys": detail_debug_keys,
        "detail_first_article_keys": detail_first_article_keys,
        "detail_fetch_status": "success" if has_detail else "empty",
    }))


def enrich_items_with_detail(oc, items):
    detail_cache = {}
    enriched_items = []

    for item in items:
        enriched = ensure_detail_debug_fields(ensure_article_references(item))
        cache_key = json.dumps(extract_detail_params(item), ensure_ascii=False, sort_keys=True)
        if not cache_key or cache_key == "{}":
            enriched["detail_fetch_status"] = "failed"
            enriched_items.append(ensure_detail_debug_fields(ensure_article_references(enriched)))
            continue

        cached = detail_cache.get(cache_key)
        if cached is None:
            try:
                cached = ensure_detail_debug_fields(ensure_article_references(extract_detail_fields(fetch_law_detail(oc, item))))
            except (LawApiError, ValueError):
                cached = ensure_detail_debug_fields(ensure_article_references({
                    "amendment_text": "",
                    "change_reason": "",
                    "changed_articles": [],
                    "article_text": "",
                    "article_references": [],
                    "article_references_total_count": 0,
                    "detail_article_count": 0,
                    "detail_debug_keys": [],
                    "detail_first_article_keys": [],
                    "detail_fetch_status": "failed",
                }))
            detail_cache[cache_key] = cached

        enriched.update(cached)
        enriched_items.append(ensure_detail_debug_fields(ensure_article_references(enriched)))

    return enriched_items


def build_tracked_laws(today, watched_laws, all_items, previous_data, failed_law_names):
    previous_payload = safe_dict(previous_data)
    previous_tracked_laws = safe_dict_list(previous_payload.get("tracked_laws"))
    watched_map = {
        normalize_name(item.get("name")): item
        for item in watched_laws
        if isinstance(item, dict) and item.get("name")
    }
    previous_map = {
        normalize_name(item.get("law_name")): item
        for item in previous_tracked_laws
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
        if previous is None or (current_date and previous_date and current_date > previous_date):
            latest_by_law[key] = item

    today_text = to_output_date(today)
    failed_set = {normalize_name(name) for name in failed_law_names}
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
        elif latest_date:
            status = "recent_updated"
            final_date = latest_date
            final_type = latest.get("source", previous.get("latest_update_type", ""))
            effective_date = latest.get("effective_date", previous.get("effective_date", ""))
            ministry = latest.get("ministry", previous.get("ministry", ""))
            detail_url = latest.get("detail_url", previous.get("detail_url", ""))
        elif previous_date and previous_date not in ("", "확인 필요"):
            status = previous.get("status", "watching") or "watching"
            final_date = previous_date
            final_type = previous.get("latest_update_type", "")
            effective_date = previous.get("effective_date", "")
            ministry = previous.get("ministry", "")
            detail_url = previous.get("detail_url", "")
        elif key in failed_set:
            status = "check_required"
            final_date = "확인 필요"
            final_type = previous.get("latest_update_type", "")
            effective_date = previous.get("effective_date", "")
            ministry = previous.get("ministry", "")
            detail_url = previous.get("detail_url", "")
        else:
            status = "watching"
            final_date = ""
            final_type = previous.get("latest_update_type", "")
            effective_date = previous.get("effective_date", "")
            ministry = previous.get("ministry", "")
            detail_url = previous.get("detail_url", "")

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
    total_checked_laws,
    failed_laws,
    partial_failed_laws,
    error_text="",
    errors=None,
):
    now_dt = datetime.now(KST)
    now_text = now_dt.strftime("%Y-%m-%d %H:%M:%S KST")
    now_iso = now_dt.isoformat(timespec="seconds")
    start_7 = today - timedelta(days=6)
    start_30 = today - timedelta(days=29)

    normalized_items = [ensure_article_reference_limit(ensure_detail_debug_fields(ensure_article_references(item))) for item in dedupe(all_items)]
    sorted_items = sorted(normalized_items, key=item_sort_key)
    today_items = filter_window(sorted_items, today, today)
    last_7_days_items = filter_window(sorted_items, start_7, today)
    last_30_days_items = filter_window(sorted_items, start_30, today)
    today_effective_items = [item for item in today_items if item.get("source_type") == "effective"]
    today_promulgated_or_revised_items = [item for item in today_items if item.get("source_type") != "effective"]

    return {
        "metadata": {
            "lastUpdated": now_iso,
            "watchedLawCount": len(watched_laws),
            "totalSavedCount": len(sorted_items),
        },
        "items": sorted_items,
        "checked_at": today.isoformat(),
        "updated_at": now_text,
        "timezone": "Asia/Seoul",
        "synced_at": now_text,
        "api_status": api_status,
        "source": "국가법령정보 Open API watched_laws query mode",
        "basis": "KST 기준 관심 법령명별 오늘 / 최근 7일 / 최근 30일 변경",
        "scope": "관심 법령만 API query로 조회하고 그 결과만 저장합니다.",
        "notice": notice,
        "error": error_text,
        "error_detail": errors or [],
        "watched_laws": watched_laws,
        "summary": {
            "today_changes": len(today_items),
            "today_effective_changes": len(today_effective_items),
            "today_promulgated_or_revised_changes": len(today_promulgated_or_revised_items),
            "other_changes": 0,
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
        "other_changes": [],
        "tracked_laws": tracked_laws,
        "total_checked_laws": total_checked_laws,
        "failed_laws": failed_laws,
        "partial_failed_laws": partial_failed_laws,
        "collector": {
            "version": "law_collector_kst_watched_only_v3",
            "api": "https://www.law.go.kr/DRF/lawSearch.do",
            "targets": ["eflaw", "law"],
            "query_mode": "watched_laws_only",
            "oc_mode": "secret" if os.environ.get("LAW_OC", "").strip() else "missing",
            "display": int(API_DISPLAY),
            "max_api_calls_per_law": 2,
            "detail_requests_per_result_item": 1,
            "retry_count": API_RETRY_COUNT,
            "errors": errors or [],
        },
    }


def collect_for_watched_law(oc, watched_law_name, watched_map, start_30, today):
    items = []
    law_errors = []
    successful_queries = 0
    query_counts = {
        "effective": 0,
        "promulgated": 0,
    }

    try:
        effective_data = fetch_effective_laws(oc, watched_law_name, start_30, today)
        effective_before_count = len(items)
        items.extend(
            filter_query_items(
                extract_items(effective_data),
                watched_law_name,
                watched_map,
                "effective",
                "시행일 기준 조회 결과입니다.",
                start_30,
                today,
            )
        )
        query_counts["effective"] = len(items) - effective_before_count
        successful_queries += 1
    except LawApiError as error:
        law_errors.append(
            {
                "law_name": watched_law_name,
                "query_type": "effective",
                "code": "request_failed",
                "message": summarize_attempts(error.attempts) or "request_failed",
                "attempts": error.attempts,
            }
        )

    try:
        promulgated_data = fetch_promulgated_laws(oc, watched_law_name)
        promulgated_before_count = len(items)
        items.extend(
            filter_query_items(
                extract_items(promulgated_data),
                watched_law_name,
                watched_map,
                "promulgated",
                "공포/개정일 기준 조회 결과입니다.",
                start_30,
                today,
            )
        )
        query_counts["promulgated"] = len(items) - promulgated_before_count
        successful_queries += 1
    except LawApiError as error:
        law_errors.append(
            {
                "law_name": watched_law_name,
                "query_type": "promulgated",
                "code": "request_failed",
                "message": summarize_attempts(error.attempts) or "request_failed",
                "attempts": error.attempts,
            }
        )

    return enrich_items_with_detail(oc, dedupe(items)), law_errors, successful_queries, query_counts


def print_collection_log(watched_laws, per_law_logs, total_effective_count, total_promulgated_count, total_saved_count):
    completed_at = datetime.now(KST).isoformat(timespec="seconds")

    print(f"전체 관심 법령 개수: {len(watched_laws)}")
    for law_log in per_law_logs:
        print(
            "관심 법령 조회 결과: "
            f"{law_log['law_name']} / 총 {law_log['total_count']}건 "
            f"(시행일 {law_log['effective_count']}건, 공포/개정 {law_log['promulgated_count']}건)"
        )
    print(f"시행일 기준 조회 결과 개수: {total_effective_count}")
    print(f"공포/개정 기준 조회 결과 개수: {total_promulgated_count}")
    print(f"최종 저장된 법령 개수: {total_saved_count}")
    print(f"저장 파일 경로: {OUTPUT_PATH}")
    print(f"실행 완료 시간: {completed_at}")


def main():
    watched_laws = safe_dict_list(read_json(WATCHED_PATH, []))
    previous_data = read_json(OUTPUT_PATH, {})
    today = today_kst()
    start_30 = today - timedelta(days=29)
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
            tracked_laws=build_tracked_laws(today, watched_laws, [], previous_data, []),
            api_status="missing_law_oc",
            notice="LAW_OC 환경변수가 없어 법제처 API를 조회하지 않았습니다.",
            total_checked_laws=len(watched_laws),
            failed_laws=[],
            partial_failed_laws=[],
            error_text="missing_law_oc",
            errors=[
                {
                    "code": "missing_law_oc",
                    "message": "GitHub Secrets 또는 환경변수에 LAW_OC가 필요합니다.",
                }
            ],
        )
        write_json(payload)
        print_collection_log(watched_laws, [], 0, 0, payload.get("metadata", {}).get("totalSavedCount", 0))
        print("LAW_OC missing: wrote safe placeholder JSON.")
        return

    all_items = []
    error_details = []
    failed_laws = []
    partial_failed_laws = []
    any_successful_query = False
    per_law_logs = []
    total_effective_count = 0
    total_promulgated_count = 0

    for watched_law in watched_laws:
        law_name = str(watched_law.get("name", "")).strip()
        if not law_name:
            continue

        law_items, law_errors, successful_queries, query_counts = collect_for_watched_law(
            oc,
            law_name,
            watched_map,
            start_30,
            today,
        )
        all_items.extend(law_items)
        error_details.extend(law_errors)
        total_effective_count += query_counts["effective"]
        total_promulgated_count += query_counts["promulgated"]
        per_law_logs.append(
            {
                "law_name": law_name,
                "total_count": len(law_items),
                "effective_count": query_counts["effective"],
                "promulgated_count": query_counts["promulgated"],
            }
        )

        if successful_queries > 0:
            any_successful_query = True

        if successful_queries == 0 and law_errors:
            failed_laws.append(law_name)
        elif successful_queries < 2 and law_errors:
            partial_failed_laws.append(law_name)

    all_items = [item for item in dedupe(all_items) if item.get("law_name")]
    tracked_laws = build_tracked_laws(today, watched_laws, all_items, previous_data, failed_laws)

    today_items = filter_window(all_items, today, today)
    last_7_days_items = filter_window(all_items, today - timedelta(days=6), today)
    last_30_days_items = filter_window(all_items, start_30, today)

    if error_details and any_successful_query:
        api_status = "partial_success"
        notice = "관심 법령 조회 중 일부 실패가 있었지만 성공한 결과는 반영했습니다."
        error_text = ""
    elif error_details:
        api_status = "api_error"
        notice = "관심 법령 API 조회에 실패했습니다. 수동 확인이 필요합니다."
        error_text = "api_request_failed"
    elif not today_items and not last_7_days_items and not last_30_days_items:
        api_status = "no_data"
        notice = "관심 법령 기준 오늘 / 최근 7일 / 최근 30일 변경이 없습니다."
        error_text = ""
    else:
        api_status = "success"
        notice = "관심 법령 기준 변경 결과를 반영했습니다."
        error_text = ""

    payload = build_payload(
        today=today,
        watched_laws=watched_laws,
        all_items=all_items,
        tracked_laws=tracked_laws,
        api_status=api_status,
        notice=notice,
        total_checked_laws=len(watched_laws),
        failed_laws=failed_laws,
        partial_failed_laws=partial_failed_laws,
        error_text=error_text,
        errors=error_details,
    )

    write_json(payload)
    print_collection_log(
        watched_laws,
        per_law_logs,
        total_effective_count,
        total_promulgated_count,
        payload.get("metadata", {}).get("totalSavedCount", len(payload.get("items", []))),
    )
    print(
        "Watched laws collected: "
        f"today {payload['today_count']} / "
        f"7 days {payload['last_7_days_count']} / "
        f"30 days {payload['last_30_days_count']}"
    )


if __name__ == "__main__":
    main()
