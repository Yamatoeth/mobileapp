from __future__ import annotations

from io import BytesIO
from pathlib import Path
from threading import Lock
from typing import Iterable

import soundfile as sf
from kokoro_onnx import Kokoro

from app.core.config import get_settings

settings = get_settings()


class KokoroTTSService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._engine: Kokoro | None = None

    def _resolve_model_path(self) -> str:
        return settings.kokoro_model_path

    def _resolve_voices_path(self) -> str:
        return settings.kokoro_voices_path

    def _ensure_engine(self) -> Kokoro:
        if self._engine is not None:
            return self._engine

        with self._lock:
            if self._engine is None:
                self._engine = Kokoro(
                    model_path=self._resolve_model_path(),
                    voices_path=self._resolve_voices_path(),
                )
        return self._engine

    def get_voices(self) -> list[str]:
        engine = self._ensure_engine()
        return sorted(engine.get_voices())

    def generate_speech(
        self,
        text: str,
        *,
        voice: str | None = None,
        speed: float | None = None,
        lang: str | None = None,
    ) -> bytes:
        engine = self._ensure_engine()
        selected_voice = voice or settings.kokoro_default_voice
        selected_speed = speed if speed is not None else settings.kokoro_default_speed
        selected_lang = lang or settings.kokoro_default_language

        audio, sample_rate = engine.create(
            text=text,
            voice=selected_voice,
            speed=selected_speed,
            lang=selected_lang,
        )

        buffer = BytesIO()
        sf.write(buffer, audio, sample_rate, format="WAV", subtype="PCM_16")
        return buffer.getvalue()

    def stream_audio(
        self,
        audio_bytes: bytes,
        *,
        chunk_size: int = 32 * 1024,
    ) -> Iterable[bytes]:
        for i in range(0, len(audio_bytes), chunk_size):
            yield audio_bytes[i : i + chunk_size]


kokoro_tts_service = KokoroTTSService()

__all__ = ["KokoroTTSService", "kokoro_tts_service"]
