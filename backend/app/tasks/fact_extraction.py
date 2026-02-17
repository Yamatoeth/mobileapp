"""
Celery task wiring for background fact extraction and KB updates.

This module exposes `extract_facts_task` which is registered as a Celery
task when Celery is installed/configured. If Celery is not available, it
also exposes a synchronous function `run_extract_facts` which can be called
directly (useful for development or environments without Celery).

The task performs these steps:
 1. Extract structured facts from a transcript using `fact_extractor`.
 2. Persist KB entries into Redis under `kb_entries`.
 3. Create embeddings for objects and upsert into Pinecone (episodic memory).

This implementation is best-effort and logs failures without raising so
that background workers don't crash on partial failures.
"""
from typing import List, Dict, Any, Optional
import os
import asyncio
import logging
import uuid

from app.core.fact_extractor import extract_facts, facts_to_kb_updates
from app.db.redis_client import redis_client
from app.db.pinecone_client import pinecone_client, get_pinecone
from app.services.openai_service import openai_service
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# Try to register a Celery task if Celery is available. Otherwise provide a
# synchronous runner that can be invoked directly.
try:
    from celery import Celery

    CELERY_AVAILABLE = True
    broker = os.environ.get("CELERY_BROKER_URL", os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    celery_app = Celery("jarvis_tasks", broker=broker)

    @celery_app.task(name="jarvis.extract_facts")
    def extract_facts_task(transcript: str, user_id: str) -> Dict[str, Any]:
        """Celery task wrapper — runs the async worker synchronously via asyncio.run."""
        try:
            result = asyncio.run(run_extract_facts(transcript, user_id))
            return {"status": "ok", "result": result}
        except Exception as e:
            logger.exception("extract_facts_task failed: %s", e)
            return {"status": "error", "error": str(e)}

except Exception:
    CELERY_AVAILABLE = False
    celery_app = None
    logger.info("Celery not available; tasks will run synchronously")


async def _persist_kb_updates(user_id: str, updates: List[Dict[str, Any]]) -> int:
    """Persist KB updates into Redis and upsert embeddings into Pinecone.

    Returns the number of entries added.
    """
    if not updates:
        return 0

    try:
        existing = await redis_client.get_working_memory(user_id, "kb_entries") or []
        new_entries = []
        for u in updates:
            entry = {
                "id": str(uuid.uuid4()),
                "title": u.get("predicate")[:120] if u.get("predicate") else "",
                "content": u.get("object")[:2000] if u.get("object") else "",
                "metadata": {"confidence": u.get("confidence", 0.5), "source": u.get("source", "extractor")},
            }
            new_entries.append(entry)

        combined = new_entries + existing
        await redis_client.set_working_memory(user_id, "kb_entries", combined)

        # Upsert embeddings to Pinecone if available and OpenAI configured
        if pinecone_client.is_configured and settings.openai_api_key:
            pc = get_pinecone()
            for entry in new_entries:
                text = entry.get("content") or entry.get("title")
                if not text:
                    continue
                emb = await openai_service.embed_text(text)
                if emb:
                    try:
                        await pc.upsert_memory(memory_id=entry["id"], embedding=emb, metadata={"user_id": user_id, **entry.get("metadata", {})})
                    except Exception:
                        logger.exception("Failed to upsert memory for entry %s", entry.get("id"))

        return len(new_entries)

    except Exception:
        logger.exception("Failed to persist KB updates")
        return 0


async def run_extract_facts(transcript: str, user_id: str) -> Dict[str, Any]:
    """Async runner: extract facts and persist them. Returns summary dict."""
    try:
        facts = await extract_facts(transcript)
        if not facts:
            return {"facts_extracted": 0}

        kb_updates = facts_to_kb_updates(facts)
        added = await _persist_kb_updates(user_id, kb_updates)
        return {"facts_extracted": len(facts), "kb_entries_added": added}
    except Exception:
        logger.exception("run_extract_facts failed")
        return {"facts_extracted": 0}


def schedule_extract_facts(transcript: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Schedule or run the extraction depending on Celery availability.

    If Celery is available, enqueue the task and return task id. Otherwise run
    synchronously and return the result.
    """
    if CELERY_AVAILABLE and celery_app is not None:
        task = extract_facts_task.delay(transcript, user_id)
        return {"task_id": task.id}
    else:
        # Blocking run
        return asyncio.run(run_extract_facts(transcript, user_id))


__all__ = ["schedule_extract_facts", "run_extract_facts", "extract_facts_task"]
