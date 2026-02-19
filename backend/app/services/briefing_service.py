"""Compose LLM-based morning briefings for users.

Uses Redis-backed KB and recent conversation snippets to build a short
bullet-point briefing using the server's OpenAI wrapper.
"""
from typing import Optional
import asyncio
import logging

from app.db.redis_client import redis_client
from app.services.openai_service import openai_service

logger = logging.getLogger(__name__)


async def _get_kb_summary(user_id: str) -> str:
    await redis_client.connect()
    kb_summary = await redis_client.get_working_memory(user_id, "kb_summary")
    if kb_summary:
        return kb_summary

    entries = await redis_client.get_working_memory(user_id, "kb_entries") or []
    top = entries[:5]
    parts = []
    for e in top:
        title = e.get("title")
        content = e.get("content", "")
        if title:
            parts.append(f"{title}: {content[:140]}")
        else:
            parts.append(content[:140])

    return " \n".join(parts)


async def _get_recent_conversation_highlights(user_id: str, limit: int = 5) -> str:
    await redis_client.connect()
    msgs = await redis_client.get_messages(user_id, limit=limit)
    highlights = []
    for m in msgs:
        who = m.get("role") or m.get("speaker") or "user"
        text = m.get("text") or m.get("content") or ""
        highlights.append(f"{who}: {text[:120]}")
    return " \n".join(highlights)


async def build_morning_briefing(user_id: str) -> dict:
    """Returns {'title': str, 'body': str} with a concise morning briefing."""
    try:
        kb_summary, convo_summary = await asyncio.gather(
            _get_kb_summary(user_id), _get_recent_conversation_highlights(user_id)
        )

        # Prompt for the LLM
        messages = [
            {"role": "system", "content": "You are JARVIS, a concise personal assistant. Produce a short morning briefing in 3 bullet points: 1) key active projects and goals, 2) things you should know today, 3) suggested next action. Keep it friendly and short."},
            {"role": "user", "content": f"Knowledge summary:\n{kb_summary}\n\nRecent conversations:\n{convo_summary}\n\nReturn a short title and a 3-bullet briefing. Do not include any JSON, only plain text."},
        ]

        body = await openai_service.chat(messages, temperature=0.4, max_tokens=400)
        title = "Morning briefing from JARVIS"
        return {"title": title, "body": body}
    except Exception as e:
        logger.exception("Failed to build briefing for %s: %s", user_id, e)
        return {"title": "Morning briefing", "body": "JARVIS couldn't prepare a briefing right now."}


__all__ = ["build_morning_briefing"]
