"""
Durable recent-conversation memory with graceful fallbacks.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
import asyncio
import json
import logging
from urllib.parse import urlparse

from sqlalchemy import select

from app.core.config import get_settings
from app.db import models
from app.db.database import async_session_maker
from app.db.redis_client import redis_client

settings = get_settings()
logger = logging.getLogger(__name__)
_db_reachability_cache: dict[str, Any] = {"value": True, "checked_at": None}


@dataclass
class PersistedTurn:
    role: str
    content: str
    timestamp: str
    conversation_id: Optional[str] = None
    source: str = "unknown"


def _local_memory_path() -> Path:
    base = Path(settings.local_memory_path)
    base.mkdir(parents=True, exist_ok=True)
    return base


def _local_file_for_user(user_id: str) -> Path:
    safe_user_id = "".join(ch for ch in user_id if ch.isalnum() or ch in {"-", "_"})
    return _local_memory_path() / f"{safe_user_id or 'user'}.jsonl"


async def _database_is_reachable() -> bool:
    parsed = urlparse(settings.database_url)
    if parsed.scheme.startswith("sqlite"):
        return True

    now = asyncio.get_running_loop().time()
    checked_at = _db_reachability_cache.get("checked_at")
    if checked_at is not None and now - checked_at < 5:
        return bool(_db_reachability_cache.get("value", False))

    host = parsed.hostname
    port = parsed.port or 5432
    if not host:
        _db_reachability_cache["value"] = False
        _db_reachability_cache["checked_at"] = now
        return False

    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=0.15)
        writer.close()
        await writer.wait_closed()
        _db_reachability_cache["value"] = True
    except Exception:
        _db_reachability_cache["value"] = False

    _db_reachability_cache["checked_at"] = now
    return bool(_db_reachability_cache["value"])


def _append_turn_to_file(user_id: str, turn: PersistedTurn) -> None:
    path = _local_file_for_user(user_id)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(
            json.dumps(
                {
                    "role": turn.role,
                    "content": turn.content,
                    "timestamp": turn.timestamp,
                    "conversation_id": turn.conversation_id,
                    "source": "local_file",
                },
                ensure_ascii=False,
            )
            + "\n"
        )


def _read_recent_turns_from_file(user_id: str, limit: int) -> list[dict[str, Any]]:
    path = _local_file_for_user(user_id)
    if not path.exists():
        return []

    lines = path.read_text(encoding="utf-8").splitlines()
    recent = []
    for line in lines[-limit:]:
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        recent.append(
            {
                "role": payload.get("role", "assistant"),
                "content": payload.get("content", ""),
                "timestamp": payload.get("timestamp"),
                "conversation_id": payload.get("conversation_id"),
                "source": "local_file",
            }
        )
    return recent


async def _store_in_redis(user_id: str, turn: PersistedTurn) -> None:
    if redis_client._pool is None:
        return
    await redis_client.add_message(
        user_id,
        {
            "role": turn.role,
            "content": turn.content,
            "timestamp": turn.timestamp,
            "conversation_id": turn.conversation_id,
        },
    )


async def _ensure_user(session, user_id: str) -> None:
    user = await session.get(models.User, user_id)
    if user is not None:
        return
    session.add(
        models.User(
            id=user_id,
            email=f"user-{user_id}@local.invalid",
            hashed_password="!",
            full_name=f"User {user_id[:8]}",
        )
    )
    await session.flush()


async def append_turn(
    *,
    user_id: str,
    role: str,
    content: str,
    conversation_id: str | None = None,
) -> Optional[str]:
    normalized = content.strip()
    if not normalized:
        return conversation_id

    turn = PersistedTurn(
        role=role,
        content=normalized,
        timestamp=datetime.now(timezone.utc).isoformat(),
        conversation_id=conversation_id,
    )

    stored_conversation_id = conversation_id

    try:
        if not await _database_is_reachable():
            raise RuntimeError("database socket unavailable")

        async def persist_to_database() -> None:
            nonlocal stored_conversation_id
            async with async_session_maker() as session:
                await _ensure_user(session, user_id)

                conversation = None
                if stored_conversation_id:
                    conversation = await session.get(models.Conversation, stored_conversation_id)
                    if conversation is not None and conversation.user_id != user_id:
                        conversation = None

                if conversation is None:
                    conversation = models.Conversation(user_id=user_id)
                    session.add(conversation)
                    await session.flush()

                stored_conversation_id = conversation.id
                message = models.Message(
                    conversation_id=conversation.id,
                    role=role,
                    content=normalized,
                    timestamp=datetime.utcnow(),
                )
                session.add(message)
                await session.commit()
                turn.conversation_id = conversation.id

        await asyncio.wait_for(persist_to_database(), timeout=0.75)
    except Exception as exc:
        logger.warning("Database conversation persistence unavailable: %s", exc)

    try:
        await _store_in_redis(user_id, turn)
    except Exception as exc:
        logger.warning("Redis conversation persistence unavailable: %s", exc)

    try:
        await asyncio.to_thread(_append_turn_to_file, user_id, turn)
    except Exception as exc:
        logger.warning("Local file conversation persistence unavailable: %s", exc)

    return stored_conversation_id


async def get_recent_turns(user_id: str, limit: int = 8) -> list[dict[str, Any]]:
    try:
        if not await _database_is_reachable():
            raise RuntimeError("database socket unavailable")

        async def fetch_from_database() -> list[dict[str, Any]]:
            async with async_session_maker() as session:
                stmt = (
                    select(models.Message, models.Conversation)
                    .join(models.Conversation, models.Message.conversation_id == models.Conversation.id)
                    .where(models.Conversation.user_id == user_id)
                    .order_by(models.Message.timestamp.desc())
                    .limit(limit)
                )
                rows = (await session.execute(stmt)).all()
                if not rows:
                    return []
                return [
                    {
                        "role": message.role,
                        "content": message.content,
                        "timestamp": message.timestamp.isoformat() if message.timestamp else None,
                        "conversation_id": conversation.id,
                        "source": "database",
                    }
                    for message, conversation in reversed(rows)
                ]

        turns = await asyncio.wait_for(fetch_from_database(), timeout=0.75)
        if turns:
            return turns
    except Exception as exc:
        logger.warning("Database conversation retrieval unavailable: %s", exc)

    if redis_client._pool is not None:
        try:
            messages = await redis_client.get_messages(user_id, limit=limit)
            if messages:
                return list(
                    reversed(
                        [
                            {
                                "role": message.get("role", "assistant"),
                                "content": message.get("content", ""),
                                "timestamp": message.get("timestamp"),
                                "conversation_id": message.get("conversation_id"),
                                "source": "redis",
                            }
                            for message in messages
                        ]
                    )
                )
        except Exception as exc:
            logger.warning("Redis conversation retrieval unavailable: %s", exc)

    try:
        return await asyncio.to_thread(_read_recent_turns_from_file, user_id, limit)
    except Exception as exc:
        logger.warning("Local file conversation retrieval unavailable: %s", exc)
        return []


__all__ = ["append_turn", "get_recent_turns"]
