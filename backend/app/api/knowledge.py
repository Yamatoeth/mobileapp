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
