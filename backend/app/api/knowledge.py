"""
Knowledge Base API (Layer 2)

Handles both Redis-backed CRUD (fast path) and PostgreSQL-backed
structured KB updates (apply/extract endpoints).

Endpoints:
 - GET    /api/v1/kb?user_id=...              list Redis KB entries
 - POST   /api/v1/kb                          create Redis KB entry
 - PUT    /api/v1/kb/{kb_id}                  update Redis KB entry
 - DELETE /api/v1/kb/{kb_id}                  delete Redis KB entry
 - GET    /api/v1/kb/summary?user_id=...       return KB summary
 - POST   /api/v1/kb/extract                  extract KB updates from transcript (LLM)
 - POST   /api/v1/kb/apply                    apply structured KB updates to PostgreSQL
 - GET    /api/v1/kb/items/{domain}/{user_id} list PostgreSQL KB items for a domain
"""
import asyncio
import json
import os
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

import openai
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select

from app.core import prompt_engine
from app.db.database import async_session_maker
from app.db.redis_client import redis_client
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

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


class ExtractRequest(BaseModel):
    user_id: int
    transcript: str
    conversation_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Domain → SQLAlchemy model name map
# ---------------------------------------------------------------------------

MODEL_MAP = {
    "identity": "KnowledgeIdentity",
    "goals": "KnowledgeGoals",
    "projects": "KnowledgeProjects",
    "finances": "KnowledgeFinances",
    "relationships": "KnowledgeRelationships",
    "patterns": "KnowledgePatterns",
}

# ---------------------------------------------------------------------------
# Redis-backed CRUD endpoints
# ---------------------------------------------------------------------------

@router.get("/kb")
async def list_knowledge(user_id: str = Query(...)):
    """Return all KB entries for a user (Redis)."""
    try:
        data = await redis_client.get_working_memory(user_id, "kb_entries")
        return data or []
    except Exception as e:
        logger.exception("Failed to list knowledge for %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="Failed to read knowledge")


@router.post("/kb")
async def create_knowledge(payload: dict):
    """Create a KB entry. Expects JSON: {user_id, title, content, metadata?}."""
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
        await redis_client.set_working_memory(user_id, "kb_entries", [entry] + existing)
        return entry
    except Exception as e:
        logger.exception("Failed to create knowledge: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create knowledge")


@router.put("/kb/{kb_id}")
async def update_knowledge(kb_id: str, payload: dict):
    """Update a KB entry by id."""
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


@router.delete("/kb/{kb_id}")
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


@router.get("/kb/summary")
async def knowledge_summary(user_id: str = Query(...)):
    """Return a compact knowledge summary for the user."""
    try:
        kb_summary = await redis_client.get_working_memory(user_id, "kb_summary")
        if kb_summary:
            return {"summary": kb_summary}

        entries = await redis_client.get_working_memory(user_id, "kb_entries") or []
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

        return {"summary": "\n".join(parts), "count": len(entries)}
    except Exception as e:
        logger.exception("Failed to get knowledge summary: %s", e)
        raise HTTPException(status_code=500, detail="Failed to compute knowledge summary")


# ---------------------------------------------------------------------------
# PostgreSQL-backed structured endpoints
# ---------------------------------------------------------------------------

@router.post("/kb/apply")
async def apply_updates(req: KBApplyRequest):
    """Apply structured KB updates to PostgreSQL with conflict resolution."""
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
            try:
                q = await session.execute(
                    select(model_cls).where(
                        model_cls.user_id == u.user_id,
                        model_cls.field_name == u.field_name,
                    )
                )
                existing = q.scalars().first()
            except Exception:
                existing = None

            def make_update_log(old_val, new_val):
                return models_mod.KnowledgeUpdate(
                    user_id=str(u.user_id),
                    conversation_id=str(u.conversation_id) if u.conversation_id is not None else None,
                    table_name=getattr(model_cls, "__tablename__", model_name),
                    field_name=u.field_name,
                    old_value=old_val,
                    new_value=new_val,
                    confidence=u.confidence,
                    source=u.source,
                )

            # No existing row — insert
            if not existing:
                obj = model_cls(
                    user_id=str(u.user_id),
                    field_name=u.field_name,
                    field_value=u.field_value,
                    confidence=u.confidence,
                    source=u.source,
                    last_updated=datetime.utcnow(),
                )
                session.add(obj)
                session.add(make_update_log(None, u.field_value))
                await session.commit()
                applied += 1
                continue

            # Conflict resolution: higher confidence wins; tie broken by recency
            try:
                existing_conf = float(getattr(existing, "confidence", 0.0) or 0.0)
            except Exception:
                existing_conf = 0.0

            incoming_conf = float(u.confidence or 0.0)
            should_update = False

            if incoming_conf > existing_conf + 1e-6:
                should_update = True
            elif abs(incoming_conf - existing_conf) <= 1e-6 and u.conversation_id is not None:
                try:
                    conv = await session.get(models_mod.Conversation, str(u.conversation_id))
                    if conv and getattr(conv, "created_at", None):
                        existing_updated = getattr(existing, "last_updated", None)
                        if existing_updated is None or conv.created_at > existing_updated:
                            should_update = True
                except Exception:
                    pass

            if should_update:
                old_val = getattr(existing, "field_value", None)
                existing.field_value = u.field_value
                existing.confidence = u.confidence
                existing.source = u.source
                existing.last_updated = datetime.utcnow()
                session.add(make_update_log(old_val, u.field_value))
                await session.commit()
                applied += 1

    return {"applied": applied}


@router.get("/kb/items/{domain}/{user_id}")
async def list_domain_items(domain: str, user_id: int):
    """List all PostgreSQL KB items for a domain."""
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

    return {
        "items": [
            {
                "id": getattr(r, "id", None),
                "field_name": getattr(r, "field_name", None),
                "field_value": getattr(r, "field_value", None),
                "confidence": getattr(r, "confidence", None),
                "source": getattr(r, "source", None),
                "last_updated": getattr(r, "last_updated", None).isoformat()
                if getattr(r, "last_updated", None)
                else None,
            }
            for r in rows
        ]
    }


@router.post("/kb/extract")
async def extract_updates(req: ExtractRequest):
    """Call LLM to extract KB updates from a conversation transcript."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    extra_instructions = (
        "Extract factual user knowledge into a JSON array.\n"
        "Each item must be an object with keys: domain (one of identity, goals, projects, finances, relationships, patterns), "
        "field_name, field_value, confidence (0.0-1.0), source (onboarding/conversation/manual).\n"
        "Return only valid JSON with no explanation or markdown.\n"
        'Example: [{"domain": "identity", "user_id": 1, "field_name": "name", "field_value": "Simon", "confidence": 0.95, "source": "onboarding"}]'
    )

    messages = prompt_engine.build_messages(
        user_input=req.transcript,
        context=None,
        extra_instructions=extra_instructions,
    )

    async def call_openai():
        openai.api_key = api_key
        return openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": m["role"], "content": m["content"]} for m in messages],
            temperature=0.0,
            max_tokens=800,
        )

    try:
        resp = await asyncio.to_thread(call_openai)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    try:
        text = resp.choices[0].message.content
        parsed = json.loads(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to parse LLM output: {e}")

    if not isinstance(parsed, list):
        raise HTTPException(status_code=500, detail="LLM did not return a JSON array")

    valid: List[dict] = []
    errors: List[dict] = []

    for idx, item in enumerate(parsed):
        if not isinstance(item, dict):
            errors.append({"index": idx, "error": "item is not an object", "item": item})
            continue

        item.setdefault("user_id", req.user_id)
        if req.conversation_id is not None:
            item.setdefault("conversation_id", req.conversation_id)

        try:
            kb_item = KBUpdate.parse_obj(item)
            valid.append(kb_item.dict())
        except ValidationError as exc:
            errors.append({"index": idx, "errors": exc.errors(), "item": item})

    return {"suggested": valid, "errors": errors}