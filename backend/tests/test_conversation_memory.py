from pathlib import Path
import pytest

from app.core.config import get_settings
from app.services import conversation_memory
from app.services.conversation_memory import append_turn, get_recent_turns


@pytest.mark.asyncio
async def test_conversation_memory_local_fallback_roundtrip(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    settings = get_settings()
    original_path = settings.local_memory_path
    settings.local_memory_path = str(tmp_path)

    async def force_unreachable() -> bool:
        return False

    monkeypatch.setattr(conversation_memory, "_database_is_reachable", force_unreachable)

    try:
        conversation_id = await append_turn(user_id="memory-user", role="user", content="First question")
        await append_turn(
            user_id="memory-user",
            role="assistant",
            content="First answer",
            conversation_id=conversation_id,
        )
        turns = await get_recent_turns("memory-user", limit=4)
    finally:
        settings.local_memory_path = original_path

    assert len(turns) >= 2
    assert turns[-2]["content"] == "First question"
    assert turns[-1]["content"] == "First answer"
