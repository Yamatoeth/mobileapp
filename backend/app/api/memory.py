from typing import Any, AsyncGenerator, List, Optional
import json
import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.db import pinecone_client as pinecone_module
from app.db import redis_client as redis_module

router = APIRouter()
logger = logging.getLogger(__name__)


class MemoryHit(BaseModel):
    id: str
    title: Optional[str] = None
    snippet: Optional[str] = None
    score: Optional[float] = None
    metadata: Optional[dict] = None


class SearchResponse(BaseModel):
    success: bool
    data: List[MemoryHit]
    error: Optional[str] = None


@router.get("/memory/search", response_model=SearchResponse)
async def memory_search(
    user_id: str = Query(...),
    query: str = Query(..., min_length=1),
    top_k: int = Query(5, ge=1, le=50),
):
    """
    Search user's memory. Prefers Pinecone vector search if configured,
    otherwise falls back to a naive text scan of stored KB entries in Redis.
    """
    try:
        # Try Pinecone client first
        PineconeClient = getattr(pinecone_module, "PineconeClient", None)
        if PineconeClient:
            client = PineconeClient()
            # If client exposes async query/search
            if hasattr(client, "query"):
                results = await client.query(user_id=user_id, query=query, top_k=top_k)
            elif hasattr(client, "search"):
                results = await client.search(user_id=user_id, query=query, top_k=top_k)
            else:
                results = []

            hits: List[MemoryHit] = []
            for r in results or []:
                metadata = r.get("metadata") if isinstance(r, dict) else {}
                hits.append(
                    MemoryHit(
                        id=str(r.get("id") or metadata.get("kb_id", "")),
                        title=metadata.get("title") if metadata else None,
                        snippet=(metadata.get("snippet") or (metadata.get("content", "")[:200])) if metadata else None,
                        score=r.get("score") if isinstance(r, dict) else None,
                        metadata=metadata,
                    )
                )
            return SearchResponse(success=True, data=hits)

        # Fallback: naive Redis scan of kb entries
        get_redis = getattr(redis_module, "get_redis", None)
        if get_redis:
            r = await redis_module.get_redis()
            raw = await r.get(f"kb_entries:{user_id}")
            entries = json.loads(raw) if raw else []
            matches: List[MemoryHit] = []
            qlower = query.lower()
            for e in entries:
                content = (e.get("content") or "").lower()
                title = (e.get("title") or "").lower()
                if qlower in content or qlower in title:
                    matches.append(
                        MemoryHit(
                            id=e.get("id"),
                            title=e.get("title"),
                            snippet=(e.get("content") or "")[:200],
                            score=None,
                            metadata={"source": e.get("source")},
                        )
                    )
                    if len(matches) >= top_k:
                        break
            return SearchResponse(success=True, data=matches)

        # If no backend available, return empty
        return SearchResponse(success=True, data=[])
    except Exception as exc:
        logger.exception("memory_search failed")
        return SearchResponse(success=False, data=[], error=str(exc))


async def _client_disconnected(request: Request) -> bool:
    try:
        return await request.is_disconnected()
    except Exception:
        return False


async def _redis_pubsub_generator(user_id: str, request: Request) -> AsyncGenerator[str, None]:
    """
    Subscribe to Redis pubsub channel `memory_updates:{user_id}` and stream SSE messages.
    If Redis is not available, stream a short heartbeat and exit.
    """
    get_redis = getattr(redis_module, "get_redis", None)
    if not get_redis:
        # fallback: simple heartbeat then close
        for _ in range(3):
            if await _client_disconnected(request):
                return
            yield "event: heartbeat\ndata: {}\n\n"
            await asyncio.sleep(1)
        return

    redis = await redis_module.get_redis()
    try:
        # aioredis interface
        try:
            # use the low-level async client for pubsub
            pubsub = redis.client.pubsub()
            channel = f"memory_updates:{user_id}"
            await pubsub.subscribe(channel)
            while True:
                if await _client_disconnected(request):
                    break
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message:
                    data = message.get("data")
                    if isinstance(data, (bytes, bytearray)):
                        try:
                            s = data.decode()
                        except Exception:
                            s = str(data)
                    else:
                        s = json.dumps(data) if not isinstance(data, str) else data
                    yield f"data: {s}\n\n"
                else:
                    yield ":\n\n"
                    await asyncio.sleep(0.1)
        except Exception:
            # fallback for other redis clients
            logger.exception("redis pubsub error")
            for _ in range(3):
                if await _client_disconnected(request):
                    return
                yield "event: heartbeat\ndata: {}\n\n"
                await asyncio.sleep(1)
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass


@router.get("/stream/memory")
async def stream_memory(request: Request, user_id: str = Query(...)):
    """
    Server-Sent Events endpoint streaming memory update notifications for a user.
    Clients should connect with `Accept: text/event-stream`.
    """
    try:
        generator = _redis_pubsub_generator(user_id, request)
        return StreamingResponse(generator, media_type="text/event-stream")
    except Exception as exc:
        logger.exception("stream_memory failed")
        raise HTTPException(status_code=500, detail="stream error")


# --- Upsert API -------------------------------------------------------------


class UpsertItem(BaseModel):
    id: Optional[str] = None
    title: Optional[str]
    content: str
    source: Optional[str] = "client"


class UpsertRequest(BaseModel):
    user_id: str
    items: List[UpsertItem]


class UpsertResponse(BaseModel):
    success: bool
    added: int
    error: Optional[str] = None


@router.post("/memory/upsert", response_model=UpsertResponse)
async def memory_upsert(payload: UpsertRequest):
    """
    Persist provided KB entries into working memory (Redis) and publish
    a notification on `memory_updates:{user_id}`. If a background task
    scheduler is available (e.g. `app.tasks.fact_extraction.schedule_extract_facts`),
    schedule embedding/extraction jobs.
    """
    try:
        # normalize items
        items = []
        for it in payload.items:
            entry = {
                "id": it.id or None,
                "title": it.title or (it.content[:120] if it.content else ""),
                "content": it.content,
                "source": it.source or "client",
            }
            items.append(entry)

        # persist into working memory list under 'kb_entries'
        rc = await redis_module.get_redis()
        existing = await rc.get_working_memory(payload.user_id, "kb_entries") or []
        # assign ids for any missing
        import uuid

        new_entries = []
        for e in items:
            if not e.get("id"):
                e["id"] = str(uuid.uuid4())
            new_entries.append(e)

        combined = new_entries + existing
        await rc.set_working_memory(payload.user_id, "kb_entries", combined)

        # publish notifications for SSE subscribers
        try:
            # use low-level redis client for publish
            await rc.client.publish(f"memory_updates:{payload.user_id}", json.dumps({"type": "upsert", "count": len(new_entries)}))
        except Exception:
            logger.exception("Failed to publish memory update")

        # schedule background extraction/embedding if available
        try:
            from app.tasks.fact_extraction import schedule_extract_facts

            # schedule per-item or a combined transcript summary; we'll pass concatenated content
            transcript = "\n\n".join([e.get("content", "") for e in new_entries])
            schedule_extract_facts(transcript, payload.user_id)
        except Exception:
            logger.debug("No background task scheduler available or scheduling failed")

        return UpsertResponse(success=True, added=len(new_entries))
    except Exception as exc:
        logger.exception("memory_upsert failed")
        return UpsertResponse(success=False, added=0, error=str(exc))
