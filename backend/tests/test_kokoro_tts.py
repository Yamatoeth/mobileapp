from app.services.kokoro_service import kokoro_tts_service


def test_kokoro_lists_voices():
    voices = kokoro_tts_service.get_voices()

    assert voices
    assert "af_sarah" in voices


def test_kokoro_generates_wav_bytes():
    audio = kokoro_tts_service.generate_speech("Hello from Kokoro.")

    assert audio.startswith(b"RIFF")
    assert len(audio) > 1024
