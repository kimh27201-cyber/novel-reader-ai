import json
import re
from typing import Any

import httpx

from app.core.config import Settings


class AIClientError(RuntimeError):
    pass


def active_provider(settings: Settings) -> str:
    provider = (settings.ai_provider or "mock").strip().lower()
    if not settings.ai_api_key:
        return "mock"
    return provider or "mock"


def split_points(text: str, limit: int = 3) -> list[str]:
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip()
    parts = [part.strip() for part in re.split(r"[。！？!?]\s*", cleaned) if part.strip()]
    return parts[:limit] or ([cleaned[:80]] if cleaned else [])


def guess_characters(text: str) -> list[str]:
    candidates = []
    for name in ["安禾", "星轨图书馆", "借阅证"]:
        if name in text:
            candidates.append(name)
    return candidates or ["未识别出明确人物"]


def mock_summary(chapter_text: str) -> dict[str, Any]:
    points = split_points(chapter_text, limit=3)
    summary = "；".join(points)
    if len(summary) > 160:
        summary = f"{summary[:157]}..."
    return {
        "summary": summary or "本章内容较短，暂时无法生成更详细的总结。",
        "characters": guess_characters(chapter_text),
        "key_points": points,
        "provider": "mock",
    }


def mock_chat(question: str, context: str) -> dict[str, str]:
    points = split_points(context, limit=2)
    evidence = "；".join(points) if points else "当前上下文内容较少"
    return {
        "answer": f"根据当前上下文，{evidence}。针对你的问题“{question}”，可以先从章节中的人物行动和关键事件入手分析。",
        "provider": "mock",
    }


def chat_completions_url(settings: Settings) -> str:
    provider = active_provider(settings)
    base_url = (settings.ai_base_url or "").strip().rstrip("/")
    if not base_url:
        base_url = "https://api.deepseek.com" if provider == "deepseek" else "https://api.openai.com/v1"
    if base_url.endswith("/chat/completions"):
        return base_url
    return f"{base_url}/chat/completions"


def model_name(settings: Settings) -> str:
    provider = active_provider(settings)
    if settings.ai_model:
        return settings.ai_model
    if provider == "deepseek":
        return "deepseek-chat"
    if provider == "openai":
        return "gpt-4o-mini"
    return "mock"


async def request_chat_completion(settings: Settings, messages: list[dict[str, str]], temperature: float = 0.2) -> str:
    provider = active_provider(settings)
    if provider == "mock":
        raise AIClientError("Mock provider does not call external API")

    headers = {
        "Authorization": f"Bearer {settings.ai_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_name(settings),
        "messages": messages,
        "temperature": temperature,
    }
    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            response = await client.post(chat_completions_url(settings), headers=headers, json=payload)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise AIClientError(f"AI provider request failed: {exc}") from exc

    data = response.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIClientError("AI provider returned an unexpected response") from exc


def parse_summary_response(text: str) -> dict[str, Any]:
    raw = str(text or "").strip()
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        raw = match.group(0)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {
            "summary": raw[:300] or "AI 未返回有效总结。",
            "characters": [],
            "key_points": [],
        }
    return {
        "summary": str(data.get("summary") or data.get("简洁总结") or "").strip() or "AI 未返回有效总结。",
        "characters": normalize_list(data.get("characters") or data.get("人物")),
        "key_points": normalize_list(data.get("key_points") or data.get("剧情关键点")),
    }


def normalize_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in re.split(r"[，,、\n]", value) if item.strip()]
    return []


async def summarize_chapter(chapter_text: str, settings: Settings) -> dict[str, Any]:
    provider = active_provider(settings)
    if provider == "mock":
        return mock_summary(chapter_text)

    messages = [
        {
            "role": "system",
            "content": "你是一个小说阅读助手。请只输出 JSON，不要输出 Markdown。",
        },
        {
            "role": "user",
            "content": (
                "请总结以下小说章节，JSON 字段必须包含 summary、characters、key_points。"
                "summary 是 100 字以内中文总结，characters 是人物或关键对象数组，key_points 是 3 到 5 个剧情关键点数组。\n\n"
                f"章节正文：\n{chapter_text[:8000]}"
            ),
        },
    ]
    content = await request_chat_completion(settings, messages)
    result = parse_summary_response(content)
    result["provider"] = provider
    return result


async def answer_question(question: str, context: str, settings: Settings) -> dict[str, str]:
    provider = active_provider(settings)
    if provider == "mock":
        return mock_chat(question, context)

    messages = [
        {
            "role": "system",
            "content": "你是一个小说阅读助手。回答必须基于用户给出的上下文；如果上下文不足，要明确说明。",
        },
        {
            "role": "user",
            "content": f"上下文：\n{context[:8000]}\n\n问题：{question}",
        },
    ]
    answer = await request_chat_completion(settings, messages, temperature=0.3)
    return {"answer": answer.strip(), "provider": provider}
