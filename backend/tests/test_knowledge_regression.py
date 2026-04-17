import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core import context_builder
from app.core.prompt_engine import build_messages
from app.db.base import Base
from app.db import models
from app.tasks import fact_extraction


@pytest.mark.asyncio
async def test_onboarding_fact_reaches_kb_context_and_prompt(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    monkeypatch.setattr(fact_extraction, "async_session_maker", session_maker)
    monkeypatch.setattr(context_builder, "async_session_maker", session_maker)
    monkeypatch.setattr(context_builder, "get_recent_turns", _empty_recent_turns)

    async def no_cache_refresh(user_id: str) -> None:
        return None

    async def no_episodic_upsert(user_id: str, updates: list[dict]) -> None:
        return None

    monkeypatch.setattr(fact_extraction, "_refresh_redis_summary", no_cache_refresh)
    monkeypatch.setattr(fact_extraction, "_upsert_episodic_memory", no_episodic_upsert)

    user_id = "regression-user"
    result = await fact_extraction.run_extract_facts(
        "My name is Simon. My goal is ship the low latency voice app.",
        user_id,
    )

    assert result["updates_applied"] >= 2

    async with session_maker() as session:
        goal = (
            await session.execute(
                select(models.KnowledgeGoals).where(models.KnowledgeGoals.user_id == user_id)
            )
        ).scalars().first()
        update = (
            await session.execute(
                select(models.KnowledgeUpdate).where(models.KnowledgeUpdate.user_id == user_id)
            )
        ).scalars().first()

    assert goal is not None
    assert "low latency voice app" in goal.field_value
    assert update is not None

    context = await context_builder.build_context(user_id, "What should I focus on?")
    messages = build_messages("What should I focus on?", context)

    assert "low latency voice app" in context["knowledge_summary"]["summary"]
    assert "low latency voice app" in messages[0]["content"]


async def _empty_recent_turns(user_id: str, limit: int = 8) -> list[dict]:
    return []
