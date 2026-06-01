import json
import re
from typing import Any
from urllib.parse import quote, urljoin

import httpx
from bs4 import BeautifulSoup


UNSUPPORTED_RULE_PATTERN = re.compile(
    r"(<js>|</js>|@js:|java\.|cookie\.|webview|loginUrl|header\s*=|eval\()",
    re.IGNORECASE,
)


class SourceParseError(ValueError):
    pass


def clean_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def has_unsupported_rule(value: Any) -> bool:
    if value is None:
        return False
    raw = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return bool(UNSUPPORTED_RULE_PATTERN.search(raw))


def compatibility_for(raw: dict[str, Any]) -> str:
    return "unsupported: contains js/cookie/login rules" if has_unsupported_rule(raw) else "v1 compatible"


def extract_json_payload(text: str) -> str:
    raw = str(text or "").strip()
    if not raw:
        raise SourceParseError("Source content is empty")
    if raw[0] in "[{":
        return raw
    match = re.search(r"<(?:textarea|pre|code)[^>]*>([\s\S]*?)</(?:textarea|pre|code)>", raw, re.IGNORECASE)
    if match:
        return clean_text(match.group(1))
    starts = [index for index in [raw.find("["), raw.find("{")] if index >= 0]
    if not starts:
        raise SourceParseError("No JSON payload found in source content")
    start = min(starts)
    end = raw.rfind("]" if raw[start] == "[" else "}")
    if end <= start:
        raise SourceParseError("Source JSON payload is incomplete")
    return raw[start : end + 1]


def parse_source_json(text: str) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(extract_json_payload(text))
    except json.JSONDecodeError as exc:
        raise SourceParseError(f"Invalid source JSON: {exc.msg}") from exc

    if isinstance(parsed, list):
        items = parsed
    elif isinstance(parsed, dict) and "sources" in parsed:
        items = parsed["sources"]
    elif isinstance(parsed, dict):
        items = [parsed]
    else:
        raise SourceParseError("Source JSON must be an object, array, or object with sources")

    normalized = [normalize_source_config(item) for item in items if isinstance(item, dict)]
    if not normalized:
        raise SourceParseError("No valid source config found")
    return normalized


def normalize_source_config(raw: dict[str, Any]) -> dict[str, Any]:
    name = clean_text(raw.get("bookSourceName") or raw.get("name") or raw.get("sourceName") or "未命名书源")
    base_url = trim_trailing_slash(raw.get("bookSourceUrl") or raw.get("sourceUrl") or raw.get("baseUrl") or "")
    if not base_url:
        raise SourceParseError(f"Source {name} is missing base url")
    return {
        "name": name,
        "base_url": base_url,
        "group": clean_text(raw.get("bookSourceGroup") or raw.get("group") or "用户导入"),
        "enabled": True,
        "raw": raw,
        "compatibility": compatibility_for(raw),
    }


def trim_trailing_slash(url: str) -> str:
    return str(url or "").strip().rstrip("/")


def parse_response_payload(text: str) -> Any:
    raw = str(text or "")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def render_template(template: str, context: dict[str, Any]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1).strip()
        if key in {"key", "keyword"}:
            return quote(str(context.get("key") or context.get("keyword") or ""))
        if key == "page":
            return str(context.get("page") or 1)
        return str(context.get(key) or "")

    return re.sub(r"\{\{\s*([^}]+?)\s*\}\}", replace, str(template or ""))


def resolve_url(url: str, base_url: str) -> str:
    value = str(url or "").strip()
    if not value:
        return ""
    if value.startswith("//"):
        return f"https:{value}"
    if re.match(r"^https?://", value, re.IGNORECASE):
        return value
    return urljoin(ensure_base_url(base_url), value)


def ensure_base_url(url: str) -> str:
    value = str(url or "").strip()
    if re.match(r"^https?://", value, re.IGNORECASE):
        return value
    return f"https://{value}" if value else "https://example.com"


def parse_request_spec(spec: str, context: dict[str, Any], base_url: str) -> dict[str, Any]:
    text = render_template(str(spec or "").strip(), context)
    match = re.match(r"^([^,]+),\s*(\{[\s\S]*\})\s*$", text)
    if not match:
        return {"url": resolve_url(text, base_url), "method": "GET", "headers": {}, "data": None}
    try:
        options = json.loads(match.group(2))
    except json.JSONDecodeError:
        options = {}
    return {
        "url": resolve_url(match.group(1), base_url),
        "method": str(options.get("method") or ("POST" if options.get("body") else "GET")).upper(),
        "headers": options.get("headers") or options.get("header") or {},
        "data": render_template(options.get("body") or options.get("data") or "", context),
    }


async def request_text(spec: dict[str, Any]) -> str:
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        response = await client.request(
            spec.get("method", "GET"),
            spec["url"],
            headers=spec.get("headers") or {},
            content=spec.get("data"),
        )
        response.raise_for_status()
        return response.text


def field_rule(rule: dict[str, Any], names: list[str]) -> str:
    for name in names:
        value = rule.get(name)
        if value:
            return str(value)
    return ""


def first_value(value: Any) -> Any:
    if isinstance(value, list):
        return next((item for item in value if clean_text(item)), "")
    return value


def pick_text(input_value: Any, rule: dict[str, Any], names: list[str], context: dict[str, Any]) -> str:
    return clean_text(first_value(apply_rule(input_value, field_rule(rule, names), context)))


def pick_url(input_value: Any, rule: dict[str, Any], names: list[str], context: dict[str, Any], base_url: str) -> str:
    return resolve_url(clean_text(first_value(apply_rule(input_value, field_rule(rule, names), context))), base_url)


def apply_rule(input_value: Any, rule: str, context: dict[str, Any] | None = None) -> Any:
    if not rule and rule != "0":
        return ""
    if has_unsupported_rule(rule):
        return ""
    context = context or {}
    for option in split_fallbacks(str(rule)):
        value = apply_rule_part(input_value, option, context)
        if isinstance(value, list):
            if value:
                return value
        elif clean_text(value):
            return value
    return ""


def apply_list_rule(input_value: Any, rule: str, context: dict[str, Any] | None = None) -> list[Any]:
    value = apply_rule(input_value, rule, context or {})
    if isinstance(value, list):
        return value
    return [value] if value else []


def apply_rule_part(input_value: Any, rule: str, context: dict[str, Any]) -> Any:
    parts = str(rule or "").split("##")
    value = apply_selector_pipeline(input_value, render_template(parts[0], context))
    for index in range(1, len(parts), 2):
        pattern = parts[index]
        replacement = parts[index + 1] if index + 1 < len(parts) else ""
        if isinstance(value, list):
            value = [re.sub(pattern, replacement, str(item or "")) for item in value]
        else:
            value = re.sub(pattern, replacement, str(value or ""))
    return value


def apply_selector_pipeline(input_value: Any, rule: str) -> Any:
    text = str(rule or "").strip()
    if not text:
        return input_value
    if text in {"@text", "text"}:
        return extract_text(input_value)
    if text in {"@html", "html"}:
        return "".join(as_list(input_value))
    if text.startswith("$."):
        return read_json_path(input_value, text)

    selector, accessor = split_selector_accessor(text)
    selected = select_values(input_value, selector) if selector else input_value
    return apply_accessor(selected, accessor) if accessor else selected


def split_selector_accessor(rule: str) -> tuple[str, str]:
    if rule.startswith("@"):
        return "", rule[1:]
    if "@" not in rule:
        return rule, ""
    selector, accessor = rule.rsplit("@", 1)
    return selector.strip(), accessor.strip()


def select_values(input_value: Any, selector: str) -> list[str]:
    if isinstance(input_value, dict):
        by_path = read_json_path(input_value, selector)
        if by_path:
            return by_path if isinstance(by_path, list) else [by_path]

    results: list[str] = []
    for fragment in as_list(input_value):
        soup = BeautifulSoup(str(fragment or ""), "html.parser")
        results.extend(str(item) for item in soup.select(selector))
    return results


def apply_accessor(input_value: Any, accessor: str) -> Any:
    token = str(accessor or "").replace("@", "", 1)
    if token == "text":
        return extract_text(input_value)
    if token == "html":
        return "".join(as_list(input_value))
    if token.isdigit():
        values = as_list(input_value)
        return values[int(token)] if int(token) < len(values) else ""
    values = []
    for item in as_list(input_value):
        soup = BeautifulSoup(str(item or ""), "html.parser")
        node = soup.find()
        if node and node.has_attr(token):
            values.append(node.get(token))
    return values if len(values) > 1 else (values[0] if values else "")


def extract_text(input_value: Any) -> str:
    values = []
    for item in as_list(input_value):
        if isinstance(item, dict):
            values.append(clean_text(json.dumps(item, ensure_ascii=False)))
        else:
            soup = BeautifulSoup(str(item or ""), "html.parser")
            values.append(clean_text(soup.get_text("\n")))
    return "\n".join(value for value in values if value)


def read_json_path(input_value: Any, path: str) -> Any:
    if not isinstance(input_value, (dict, list)):
        return ""
    normalized = re.sub(r"^\$\.", "", str(path or ""))
    normalized = re.sub(r"\[(\d+|\*)\]", r".\1", normalized)
    parts = [part for part in normalized.split(".") if part]
    values = [input_value]
    for part in parts:
        next_values: list[Any] = []
        for item in values:
            if part == "*":
                if isinstance(item, list):
                    next_values.extend(item)
                elif isinstance(item, dict):
                    next_values.extend(item.values())
            elif isinstance(item, list) and part.isdigit():
                index = int(part)
                if index < len(item):
                    next_values.append(item[index])
            elif isinstance(item, dict) and part in item:
                next_values.append(item[part])
        values = next_values
    if len(values) > 1:
        return values
    return values[0] if values else ""


def split_fallbacks(rule: str) -> list[str]:
    return [item.strip() for item in str(rule or "").split("||") if item.strip()]


def as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return [] if value is None or value == "" else [value]


async def search_source(source: dict[str, Any], keyword: str, page: int) -> list[dict[str, Any]]:
    raw = source["raw"]
    rule = raw.get("ruleSearch") or {}
    if isinstance(rule, str):
        rule = json.loads(rule)
    search_url = raw.get("searchUrl")
    if not search_url or not rule:
        raise SourceParseError("This source has no search rule")
    spec = parse_request_spec(search_url, {"key": keyword, "keyword": keyword, "page": page}, source["base_url"])
    payload = parse_response_payload(await request_text(spec))
    list_rule = field_rule(rule, ["bookList", "list", "books"])
    items = apply_list_rule(payload, list_rule, {"key": keyword, "keyword": keyword, "page": page, "$": payload})
    books = []
    for item in items:
        context = {"key": keyword, "keyword": keyword, "$": item}
        book_url = pick_url(item, rule, ["bookUrl", "url", "link"], context, source["base_url"])
        title = pick_text(item, rule, ["name", "bookName", "title"], context)
        if not title or not book_url:
            continue
        books.append(
            {
                "title": title,
                "author": pick_text(item, rule, ["author", "bookAuthor"], context) or "未知作者",
                "book_url": book_url,
                "kind": pick_text(item, rule, ["kind", "category", "type"], context),
                "latest_chapter": pick_text(item, rule, ["latestChapter", "lastChapter", "last"], context),
                "intro": pick_text(item, rule, ["intro", "description", "desc"], context),
                "cover_url": pick_url(item, rule, ["coverUrl", "cover", "image"], context, source["base_url"]),
            }
        )
    return books


async def load_book_info(source: dict[str, Any], book: dict[str, Any]) -> dict[str, str]:
    raw = source["raw"]
    rule = raw.get("ruleBookInfo") or {}
    if isinstance(rule, str):
        rule = json.loads(rule)

    book_url = str(book.get("book_url") or book.get("bookUrl") or "").strip()
    if not book_url:
        raise SourceParseError("Book url is required")

    fallback = {
        "title": clean_text(book.get("title") or book.get("name") or "Untitled"),
        "author": clean_text(book.get("author") or "Unknown author"),
        "book_url": book_url,
        "toc_url": str(book.get("toc_url") or book.get("tocUrl") or book_url).strip(),
        "kind": clean_text(book.get("kind") or book.get("category") or ""),
        "latest_chapter": clean_text(book.get("latest_chapter") or book.get("latestChapter") or ""),
        "intro": clean_text(book.get("intro") or book.get("description") or ""),
        "cover_url": str(book.get("cover_url") or book.get("coverUrl") or "").strip(),
    }
    if not rule:
        return fallback

    context = {
        **book,
        "bookUrl": book_url,
        "tocUrl": fallback["toc_url"],
        "latestChapter": fallback["latest_chapter"],
        "coverUrl": fallback["cover_url"],
    }
    spec = parse_request_spec(book_url, context, source["base_url"])
    payload = parse_response_payload(await request_text(spec))
    context = {**context, "$": payload}

    return {
        "title": pick_text(payload, rule, ["name", "bookName", "title"], context) or fallback["title"],
        "author": pick_text(payload, rule, ["author", "bookAuthor"], context) or fallback["author"],
        "book_url": book_url,
        "toc_url": pick_url(payload, rule, ["tocUrl", "chapterUrl", "catalogUrl"], context, book_url)
        or fallback["toc_url"],
        "kind": pick_text(payload, rule, ["kind", "category", "type"], context) or fallback["kind"],
        "latest_chapter": pick_text(payload, rule, ["latestChapter", "lastChapter", "last"], context)
        or fallback["latest_chapter"],
        "intro": pick_text(payload, rule, ["intro", "description", "desc"], context) or fallback["intro"],
        "cover_url": pick_url(payload, rule, ["coverUrl", "cover", "image"], context, source["base_url"])
        or fallback["cover_url"],
    }


async def load_toc(source: dict[str, Any], book_url: str, toc_url: str | None = None) -> list[dict[str, Any]]:
    raw = source["raw"]
    rule = raw.get("ruleToc") or {}
    if isinstance(rule, str):
        rule = json.loads(rule)
    if not rule:
        raise SourceParseError("This source has no toc rule")
    target_url = toc_url or book_url
    spec = parse_request_spec(target_url, {"bookUrl": book_url, "tocUrl": target_url}, source["base_url"])
    payload = parse_response_payload(await request_text(spec))
    list_rule = field_rule(rule, ["chapterList", "list", "toc"])
    items = apply_list_rule(payload, list_rule, {"bookUrl": book_url, "tocUrl": target_url, "$": payload})
    chapters = []
    for index, item in enumerate(items):
        context = {"index": index, "bookUrl": book_url, "$": item}
        title = pick_text(item, rule, ["chapterName", "name", "title"], context) or f"第 {index + 1} 章"
        url = pick_url(item, rule, ["chapterUrl", "url", "link"], context, target_url)
        if title and url:
            chapters.append({"title": title, "url": url, "index": index})
    if not chapters:
        raise SourceParseError("Toc parsed empty")
    return chapters


async def load_content(source: dict[str, Any], chapter_url: str) -> str:
    raw = source["raw"]
    rule = raw.get("ruleContent") or {}
    if isinstance(rule, str):
        rule = json.loads(rule)
    if not rule:
        raise SourceParseError("This source has no content rule")
    spec = parse_request_spec(chapter_url, {"chapterUrl": chapter_url}, source["base_url"])
    response_text = await request_text(spec)
    payload = parse_response_payload(response_text)
    content = pick_text(payload, rule, ["content", "text"], {"chapterUrl": chapter_url, "$": payload})
    if not content:
        rule_text = field_rule(rule, ["content", "text"]) or "ruleContent.content"
        raise SourceParseError(
            "正文解析为空："
            f"url={chapter_url}；"
            f"rule=ruleContent.content({rule_text})；"
            f"响应长度={len(str(response_text or ''))}"
        )
    return content
