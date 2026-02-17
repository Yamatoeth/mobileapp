"""
ElevenLabs TTS wrapper

Provides a small wrapper around the ElevenLabs Text-to-Speech API with both
non-streaming and streaming helpers. Returns raw audio bytes for playback or
yields audio chunks for progressive delivery.
"""
from typing import AsyncGenerator, Optional
import logging
import httpx

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class ElevenLabsService:
    def __init__(self, api_key: Optional[str] = None, default_voice: str = "alloy"):
        self.api_key = api_key or settings.elevenlabs_api_key
        self.default_voice = getattr(settings, "elevenlabs_voice_id", default_voice)

    async def synthesize_bytes(self, text: str, voice_id: Optional[str] = None, stability: float = 0.5, similarity_boost: float = 0.5) -> Optional[bytes]:
        """Synthesize text to speech and return audio bytes, or None on failure."""
        if not self.api_key:
            logger.debug("ElevenLabs API key not configured")
            return None

        vid = voice_id or self.default_voice
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}"
        headers = {"xi-api-key": self.api_key, "Content-Type": "application/json"}
        payload = {"text": text, "voice_settings": {"stability": stability, "similarity_boost": similarity_boost}}

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(url, json=payload, headers=headers)
                r.raise_for_status()
                return r.content
        except Exception:
            logger.exception("ElevenLabs synthesize_bytes failed")
            return None

    async def stream_synthesize(self, text: str, voice_id: Optional[str] = None, chunk_size: int = 1024) -> AsyncGenerator[bytes, None]:
        """Stream synthesized audio as binary chunks.

        Yields raw bytes. Consumers can encode to base64 if transporting over JSON.
        """
        if not self.api_key:
            logger.debug("ElevenLabs API key not configured for streaming")
            return

        vid = voice_id or self.default_voice
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}"
        headers = {"xi-api-key": self.api_key, "Content-Type": "application/json"}
        payload = {"text": text, "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}}

        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", url, json=payload, headers=headers) as r:
                    r.raise_for_status()
                    async for chunk in r.aiter_bytes(chunk_size=chunk_size):
                        if chunk:
                            yield chunk
        except Exception:
            logger.exception("ElevenLabs stream_synthesize failed")
            return


elevenlabs_service = ElevenLabsService()

__all__ = ["elevenlabs_service", "ElevenLabsService"]
