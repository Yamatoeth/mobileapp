from app.core.prompt_engine import build_messages, build_system_prompt


def test_build_system_prompt_uses_structured_context_sections():
    prompt = build_system_prompt(
        {
            "character": {"full_name": "Obito"},
            "knowledge_summary": {"summary": "Goal: ship the app this week"},
            "recent_conversation": {"summary": "User: Help me debug audio\nAssistant: Let's inspect the playback path."},
        }
    )

    assert "Server context:" in prompt
    assert "Goal: ship the app this week" in prompt
    assert "Recent conversation:" in prompt
    assert "Context Builder" not in prompt


def test_build_messages_does_not_duplicate_raw_context_in_user_message():
    messages = build_messages("What should I work on next?", {"knowledge_summary": {"summary": "Focus on voice UX"}})

    assert len(messages) == 2
    assert messages[1]["content"] == "What should I work on next?"
