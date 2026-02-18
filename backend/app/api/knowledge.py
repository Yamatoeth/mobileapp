from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.db.database import async_session_maker
from app.core import prompt_engine
import os
import asyncio
import openai

router = APIRouter(prefix="/kb", tags=["kb"])


class KBUpdate(BaseModel):
    domain: str
    user_id: int
    field_name: str
    field_value: str
    confidence: float = Field(ge=0.0, le=1.0)
    source: str
    conversation_id: Optional[int] = None


class KBApplyRequest(BaseModel):
    updates: List[KBUpdate]


MODEL_MAP = {
    "identity": "KnowledgeIdentity",
    "goals": "KnowledgeGoals",
    "projects": "KnowledgeProjects",
    "finances": "KnowledgeFinances",
    "relationships": "KnowledgeRelationships",
    "patterns": "KnowledgePatterns",
}


@router.post("/apply")
async def apply_updates(req: KBApplyRequest):
    applied = 0
    for u in req.updates:
        model_name = MODEL_MAP.get(u.domain)
        if not model_name:
            raise HTTPException(status_code=400, detail=f"unknown domain: {u.domain}")
        models_mod = __import__("app.db.models", fromlist=[model_name])
        model_cls = getattr(models_mod, model_name, None)
        if model_cls is None:
            raise HTTPException(status_code=500, detail=f"model {model_name} not found")

        async with async_session_maker() as session:
            obj = model_cls(
                user_id=u.user_id,
                field_name=u.field_name,
                field_value=u.field_value,
                confidence=u.confidence,
                source=u.source,
                last_updated=datetime.utcnow(),
            )
            session.add(obj)
            await session.commit()
            applied += 1

    return {"applied": applied}


@router.get("/items/{domain}/{user_id}")
async def list_domain_items(domain: str, user_id: int):
    model_name = MODEL_MAP.get(domain)
    if not model_name:
        raise HTTPException(status_code=400, detail=f"unknown domain: {domain}")
    models_mod = __import__("app.db.models", fromlist=[model_name])
    model_cls = getattr(models_mod, model_name, None)
    if model_cls is None:
        raise HTTPException(status_code=500, detail=f"model {model_name} not found")

    async with async_session_maker() as session:
        q = await session.execute(select(model_cls).where(model_cls.user_id == user_id))
        rows = q.scalars().all()

    out = []
    for r in rows:
        out.append({
            "id": getattr(r, "id", None),
            "field_name": getattr(r, "field_name", None),
            "field_value": getattr(r, "field_value", None),
            "confidence": getattr(r, "confidence", None),
            "source": getattr(r, "source", None),
            "last_updated": getattr(r, "last_updated", None).isoformat() if getattr(r, "last_updated", None) else None,
        })

    return {"items": out}


class ExtractRequest(BaseModel):
    user_id: int
    transcript: str
    conversation_id: Optional[int] = None


@router.post("/extract")
async def extract_updates(req: ExtractRequest):
    """Call LLM to extract KB updates from a conversation transcript.

    Returns a JSON array of KBUpdate-like dicts the frontend can review.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    # Compose an instruction prompt for structured JSON extraction
    extra_instructions = (
        "Extract factual user knowledge into a JSON array.\n"
        "Each item must be an object with keys: domain (one of identity, goals, projects, finances, relationships, patterns),\n"
        "field_name, field_value, confidence (0.0-1.0), source (onboarding/conversation/manual).\n"
        "Return only JSON (no explanation). Example:\n"
        "[ { \"domain\": \"identity\", \"user_id\": 1, \"field_name\": \"name\", \"field_value\": \"Simon\", \"confidence\": 0.95, \"source\": \"onboarding\", \"conversation_id\": 123 } ]"
    )

    messages = prompt_engine.build_messages(
        user_input=req.transcript,
        context=None,
        extra_instructions=extra_instructions,
    )

    # Use blocking openai.ChatCompletion in a thread to avoid blocking the event loop
    async def call_openai():
        openai.api_key = api_key
        resp = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": m["role"], "content": m["content"]} for m in messages],
            temperature=0.0,
            max_tokens=800,
        )
        return resp

    try:
        resp = await asyncio.to_thread(call_openai)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    try:
        text = resp.choices[0].message.content
        # Parse JSON from model output
        import json

        parsed = json.loads(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to parse LLM output: {e}")

    # Attach user_id and conversation_id if missing
    out = []
    for item in parsed:
        item.setdefault("user_id", req.user_id)
        if req.conversation_id is not None:
            item.setdefault("conversation_id", req.conversation_id)
        out.append(item)

    return {"suggested": out}
"""
Knowledge Base API (Layer 2)

Lightweight Redis-backed KB CRUD and a summary endpoint. This implementation
stores KB entries in Redis under the working memory namespace to avoid
requiring new DB migrations. The summary endpoint returns a cached
`kb_summary` if present, otherwise composes a compact summary from recent
KB entries.

Endpoints:
 - `GET /api/v1/knowledge?user_id=...` list entries
 - `POST /api/v1/knowledge` create entry
 - `PUT /api/v1/knowledge/{kb_id}` update entry
 - `DELETE /api/v1/knowledge/{kb_id}` delete entry
 - `GET /api/v1/knowledge/summary?user_id=...` return summary
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from uuid import uuid4
import logging

from app.db.redis_client import redis_client

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/knowledge")
async def list_knowledge(user_id: str = Query(...)):
    """Return all KB entries for a user."""
    try:
        data = await redis_client.get_working_memory(user_id, "kb_entries")
        return data or []
    except Exception as e:
        logger.exception("Failed to list knowledge for %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="Failed to read knowledge")


@router.post("/knowledge")
async def create_knowledge(payload: dict):
    """Create a KB entry. Expects JSON: {user_id, title, content, metadata?}.

    Stores entry into Redis list `kb_entries` under working namespace.
    """
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    entry = {
        "id": str(uuid4()),
        "title": payload.get("title", ""),
        "content": payload.get("content", ""),
        "metadata": payload.get("metadata") or {},
    }

    try:
        existing = await redis_client.get_working_memory(user_id, "kb_entries") or []
        # Prepend newest entries
        new_list = [entry] + existing
        await redis_client.set_working_memory(user_id, "kb_entries", new_list)
        return entry
    except Exception as e:
        logger.exception("Failed to create knowledge: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create knowledge")


@router.put("/knowledge/{kb_id}")
async def update_knowledge(kb_id: str, payload: dict):
    """Update a KB entry by id. Expects JSON with fields to update."""
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    try:
        existing = await redis_client.get_working_memory(user_id, "kb_entries") or []
        updated = False
        for item in existing:
            if item.get("id") == kb_id:
                item.update({k: v for k, v in payload.items() if k != "user_id"})
                updated = True
                break

        if not updated:
            raise HTTPException(status_code=404, detail="KB entry not found")

        await redis_client.set_working_memory(user_id, "kb_entries", existing)
        return {"status": "ok", "id": kb_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update knowledge: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update knowledge")


@router.delete("/knowledge/{kb_id}")
async def delete_knowledge(kb_id: str, user_id: Optional[str] = Query(None)):
    """Delete a KB entry by id. Requires `user_id` query param."""
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    try:
        existing = await redis_client.get_working_memory(user_id, "kb_entries") or []
        new_list = [item for item in existing if item.get("id") != kb_id]
        if len(new_list) == len(existing):
            raise HTTPException(status_code=404, detail="KB entry not found")
        await redis_client.set_working_memory(user_id, "kb_entries", new_list)
        return {"status": "deleted", "id": kb_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete knowledge: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete knowledge")


@router.get("/knowledge/summary")
async def knowledge_summary(user_id: str = Query(...)):
    """Return a compact knowledge summary for the user.

    Prefers Redis `kb_summary` key if present; otherwise composes a short
    summary from the most recent KB entries.
    """
    try:
        kb_summary = await redis_client.get_working_memory(user_id, "kb_summary")
        if kb_summary:
            return {"summary": kb_summary}

        # Compose from entries
        entries = await redis_client.get_working_memory(user_id, "kb_entries") or []
        # Use up to 5 recent entries to compose a compact summary
        top = entries[:5]
        if not top:
            return {"summary": "", "count": 0}

        parts = []
        for e in top:
            title = e.get("title")
            content = e.get("content", "")
            if title:
                parts.append(f"{title}: {content[:120]}")
            else:
                parts.append(content[:140])

        composed = " \n".join(parts)
        return {"summary": composed, "count": len(entries)}
    except Exception as e:
        logger.exception("Failed to get knowledge summary: %s", e)
        raise HTTPException(status_code=500, detail="Failed to compute knowledge summary")
