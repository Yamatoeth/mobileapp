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
from app.db.models import (
    User,
    KnowledgeIdentity,
    KnowledgeGoals,
    KnowledgeProjects,
    KnowledgeFinances,
    KnowledgeRelationships,
    KnowledgePatterns,
)
from sqlalchemy import select, desc
from app.core.config import get_settings
import httpx

settings = get_settings()
logger = logging.getLogger(__name__)


async def _fetch_character(user_id: str) -> Dict[str, Any]:
    """Fetch lightweight character/profile for a user from the database."""
    try:
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
    except Exception as exc:
        logger.warning("Character lookup unavailable: %s", exc)
        return {}


async def _fetch_working_memory(user_id: str) -> Dict[str, Any]:
    """Retrieve recent working memory items and cached user state from Redis."""
    if redis_client._pool is None:
        return {"messages": [], "state": None}

    try:
        messages = await redis_client.get_messages(user_id, limit=20)
        state = await redis_client.get_user_state(user_id)
        return {
            "messages": messages,
            "state": state,
        }
    except Exception as e:
        logger.warning("Working memory unavailable: %s", e)
        return {"messages": [], "state": None}


async def _fetch_knowledge_summary(user_id: str) -> Dict[str, Any]:
    """Fetch a concise KB summary. Try Redis cache first; if missing,
    query the Knowledge Base tables and synthesize a short summary string.
    """
    try:
        if redis_client._pool is not None:
            cached = await redis_client.get_working_memory(user_id, "kb_summary")
            if cached:
                return {"summary": cached}

        # Query DB concurrently for each domain and build a short summary
        async with async_session_maker() as session:
            async def q_top(model, limit=5):
                stmt = select(model).where(model.user_id == user_id).order_by(desc(model.confidence)).limit(limit)
                res = await session.execute(stmt)
                return res.scalars().all()

            tasks = [
                asyncio.create_task(q_top(KnowledgeIdentity, 10)),
                asyncio.create_task(q_top(KnowledgeGoals, 10)),
                asyncio.create_task(q_top(KnowledgeProjects, 10)),
                asyncio.create_task(q_top(KnowledgeFinances, 10)),
                asyncio.create_task(q_top(KnowledgeRelationships, 10)),
                asyncio.create_task(q_top(KnowledgePatterns, 10)),
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

        identities, goals, projects, finances, relationships, patterns = (r if not isinstance(r, Exception) else [] for r in results)

        def fmt_list(rows):
            out = []
            for r in rows:
                fname = getattr(r, "field_name", None)
                fval = getattr(r, "field_value", None)
                conf = getattr(r, "confidence", None)
                if fname and fval:
                    if conf is not None:
                        out.append(f"{fname}: {fval} ({conf:.2f})")
                    else:
                        out.append(f"{fname}: {fval}")
            return out

        parts = []
        id_parts = fmt_list(identities)
        if id_parts:
            parts.append("Identity: " + "; ".join(id_parts[:5]))
        goals_parts = fmt_list(goals)
        if goals_parts:
            parts.append("Goals: " + "; ".join(goals_parts[:5]))
        proj_parts = fmt_list(projects)
        if proj_parts:
            parts.append("Projects: " + "; ".join(proj_parts[:5]))
        fin_parts = fmt_list(finances)
        if fin_parts:
            parts.append("Finances: " + "; ".join(fin_parts[:5]))
        rel_parts = fmt_list(relationships)
        if rel_parts:
            parts.append("Relationships: " + "; ".join(rel_parts[:5]))
        pat_parts = fmt_list(patterns)
        if pat_parts:
            parts.append("Patterns: " + "; ".join(pat_parts[:5]))

        summary = " | ".join(parts)

        # Cache for 1 hour
        try:
            if redis_client._pool is not None:
                await redis_client.set_working_memory(user_id, "kb_summary", summary, ttl_seconds=3600)
        except Exception:
            logger.warning("Failed to cache kb_summary")

        return {"summary": summary}
    except Exception as e:
        logger.warning("Knowledge summary unavailable: %s", e)
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
    async def with_timeout(coro, timeout_seconds: float, fallback: Any, label: str):
        try:
            return await asyncio.wait_for(coro, timeout=timeout_seconds)
        except Exception as exc:
            logger.warning("Context layer %s timed out or failed: %s", label, exc)
            return fallback

    tasks = [
        asyncio.create_task(with_timeout(_fetch_character(user_id), 1.0, {}, "character")),
        asyncio.create_task(with_timeout(_fetch_knowledge_summary(user_id), 1.0, {}, "knowledge_summary")),
        asyncio.create_task(with_timeout(_fetch_working_memory(user_id), 0.5, {"messages": [], "state": None}, "working_memory")),
        asyncio.create_task(with_timeout(_fetch_episodic(user_id, query), 1.0, [], "episodic")),
    ]

    done = await asyncio.gather(*tasks, return_exceptions=True)

    character: Dict[str, Any] = {}
    knowledge_summary: Dict[str, Any] = {}
    working_memory: Dict[str, Any] = {}
    episodic: List[Dict[str, Any]] = []

    def _coerce(value: Any, fallback: Any, label: str) -> Any:
        if isinstance(value, Exception):
            logger.warning("Context layer %s unavailable: %s", label, value)
            return fallback
        return value if value is not None else fallback

    try:
        raw_character, raw_knowledge, raw_working, raw_episodic = done
        character = _coerce(raw_character, {}, "character")
        knowledge_summary = _coerce(raw_knowledge, {}, "knowledge_summary")
        working_memory = _coerce(raw_working, {}, "working_memory")
        episodic = _coerce(raw_episodic, [], "episodic")
    except Exception:
        logger.exception("Error assembling context layers")

    return {
        "character": character or {},
        "knowledge_summary": knowledge_summary or {},
        "working_memory": working_memory or {},
        "episodic": episodic or [],
    }


class ContextBuilder:
    """Object-oriented wrapper for context building. Useful for testing
    and for holding configuration in future iterations.
    """
    def __init__(self):
        pass

    async def build_context(self, user_id: str, query: Optional[str] = None) -> Dict[str, Any]:
        return await build_context(user_id, query)


# Default instance for easy import
default_context_builder = ContextBuilder()

__all__ = ["build_context", "default_context_builder", "ContextBuilder"]
