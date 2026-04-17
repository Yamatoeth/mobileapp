import pytest

from app.services.kokoro_service import kokoro_tts_service


pytestmark = pytest.mark.skipif(
    not kokoro_tts_service.is_available(),
    reason="Kokoro local TTS dependencies are not installed",
)


def test_kokoro_lists_voices():
    voices = kokoro_tts_service.get_voices()

    assert voices
    assert "af_sarah" in voices


def test_kokoro_generates_wav_bytes():
    audio = kokoro_tts_service.generate_speech("Hello from Kokoro.")

    assert audio.startswith(b"RIFF")
    assert len(audio) > 1024
