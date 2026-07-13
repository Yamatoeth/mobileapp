from app.api.voice import _build_local_response, _is_probable_stt_artifact


def test_build_local_response_uses_context_summary():
    result = _build_local_response(
        "What do you know about me?",
        {
            "character": {"full_name": "Obito"},
            "knowledge_summary": {"summary": "Goal: ship the app"},
        },
    )

    assert "Goal: ship the app" in result


def test_build_local_response_handles_general_question():
    result = _build_local_response("How can you help me today?", {})

    assert "How can you help me today?" in result
    assert "local-mode answer" in result


def test_short_filler_transcripts_are_treated_as_stt_artifacts():
    assert _is_probable_stt_artifact("Thank you.")
    assert _is_probable_stt_artifact(" thanks ")
    assert not _is_probable_stt_artifact("Explain quantum computing in simple terms.")
