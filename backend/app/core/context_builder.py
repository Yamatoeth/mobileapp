"""
Server-side Context Builder

Assembles layered context for LLM calls concurrently:
 - character (user profile)
 - knowledge summary (cached or DB-derived)
 - working memory (Redis)
 - episodic memory (Pinecone search)

Provides a single async entrypoint `build_context(user_id, query)`.
"""
from typing import Optional, Dict, Any, List
import asyncio
import logging

from app.db.redis_client import redis_client
from app.db.pinecone_client import pinecone_client, get_pinecone
from app.db.database import async_session_maker
from app.db.models import User
from app.core.config import get_settings
import httpx

settings = get_settings()
logger = logging.getLogger(__name__)


async def _fetch_character(user_id: str) -> Dict[str, Any]:
    """Fetch lightweight character/profile for a user from the database."""
    async with async_session_maker() as session:
        user = await session.get(User, user_id)
        if user is None:
            return {}
        return {
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "trust_level": getattr(user, "trust_level", None),
        }


async def _fetch_working_memory(user_id: str) -> Dict[str, Any]:
    """Retrieve recent working memory items and cached user state from Redis."""
    try:
        messages = await redis_client.get_messages(user_id, limit=20)
        state = await redis_client.get_user_state(user_id)
        return {
            "messages": messages,
            "state": state,
        }
    except Exception as e:
        logger.exception("Error fetching working memory: %s", e)
        return {"messages": [], "state": None}


async def _fetch_knowledge_summary(user_id: str) -> Dict[str, Any]:
    """Fetch a cached knowledge/KB summary from Redis.

    Production implementations might compute this via DB queries plus
    embedding-based summarization; for now we look up a Redis key.
    """
    try:
        summary = await redis_client.get_working_memory(user_id, "kb_summary")
        return {"summary": summary or ""}
    except Exception as e:
        logger.exception("Error fetching knowledge summary: %s", e)
        return {"summary": ""}


async def _embed_text(text: str) -> Optional[List[float]]:
    """Create an embedding for `text` using OpenAI embeddings API if configured."""
    if not settings.openai_api_key:
        return None

    url = "https://api.openai.com/v1/embeddings"
    payload = {"model": "text-embedding-3-small", "input": text}
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            data = r.json()
            embedding = data.get("data", [])[0].get("embedding")
            return embedding
    except Exception:
        logger.exception("Embedding request failed")
        return None


async def _fetch_episodic(user_id: str, query: Optional[str], top_k: int = 5) -> List[Dict[str, Any]]:
    """Search Pinecone episodic memory using an embedding for `query`.
    Returns an empty list if Pinecone is not configured or embedding fails.
    """
    if not pinecone_client.is_configured or not query:
        return []

    embedding = await _embed_text(query)
    if not embedding:
        return []

    try:
        pc = get_pinecone()
        results = await pc.search_memories(query_embedding=embedding, top_k=top_k)
        return results
    except Exception:
        logger.exception("Pinecone search failed")
        return []


async def build_context(user_id: str, query: Optional[str] = None) -> Dict[str, Any]:
    """Public entrypoint: concurrently assemble layers 1-4 and return a dict.

    Result shape:
    {
      "character": {...},
      "knowledge_summary": {...},
      "working_memory": {...},
      "episodic": [...],
    }
    """
    tasks = [
        asyncio.create_task(_fetch_character(user_id)),
        asyncio.create_task(_fetch_knowledge_summary(user_id)),
        asyncio.create_task(_fetch_working_memory(user_id)),
        asyncio.create_task(_fetch_episodic(user_id, query)),
    ]

    done = await asyncio.gather(*tasks, return_exceptions=True)

    # default empty values
    character, knowledge_summary, working_memory, episodic = ({},) * 4
    try:
        character, knowledge_summary, working_memory, episodic = done
    except Exception:
        logger.exception("Error assembling context layers")

    return {
        "character": character or {},
        "knowledge_summary": knowledge_summary or {},
        "working_memory": working_memory or {},
        "episodic": episodic or [],
    }


__all__ = ["build_context"]
