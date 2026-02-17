"""
Deepgram STT wrapper

Provides a simple async wrapper around Deepgram REST transcription and a
best-effort "streaming" interface that polls interim transcriptions while
collecting audio frames. This avoids a full realtime WebSocket client here
while still giving the backend a streaming-friendly API surface.
"""
from typing import AsyncIterator, AsyncGenerator, Optional
import asyncio
import logging
import httpx

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class DeepgramService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.deepgram_api_key
        self._client: Optional[httpx.AsyncClient] = None

    async def _client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=60)
        return self._client

    async def transcribe_bytes(self, audio_bytes: bytes, content_type: str = "audio/wav") -> Optional[str]:
        """Send audio bytes to Deepgram REST `/listen` endpoint and return transcript text.

        Returns `None` on failure.
        """
        if not self.api_key:
            logger.debug("Deepgram API key not configured")
            return None

        url = "https://api.deepgram.com/v1/listen?punctuate=true"
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": content_type,
        }

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(url, content=audio_bytes, headers=headers)
                r.raise_for_status()
                data = r.json()
                # Deepgram returns transcript under results.channels[0].alternatives[0].transcript
                transcript = (
                    data.get("results", {})
                    .get("channels", [])[0]
                    .get("alternatives", [])[0]
                    .get("transcript", "")
                )
                return transcript
        except Exception:
            logger.exception("Deepgram REST transcription failed")
            return None

    async def stream_transcribe(self, frames: AsyncIterator[bytes], interval: float = 1.0) -> AsyncGenerator[str, None]:
        """Best-effort streaming transcription.

        Collects audio frames from `frames`, accumulates them into an in-memory
        buffer, and every `interval` seconds sends the current buffer to
        Deepgram REST `/listen` to get an interim transcript. Yields transcript
        deltas as they appear. This is not real realtime but acceptable for
        server-side hot-paths that need interim updates without a websocket
        client to Deepgram.
        """
        buffer = bytearray()
        last_transcript = ""

        async def poller():
            while True:
                await asyncio.sleep(interval)
                if not buffer:
                    continue
                # Make a copy to avoid race conditions
                snapshot = bytes(buffer)
                transcript = await self.transcribe_bytes(snapshot)
                if transcript and transcript != last_transcript:
                    # compute delta
                    delta = transcript[len(last_transcript):].strip()
                    yield_delta = delta if delta else transcript
                    yield yield_delta

        # This implementation mixes consumption and polling. We'll implement a
        # manual loop: consume frames and periodically call transcription.
        try:
            poll_task = None
            start_time = asyncio.get_event_loop().time()
            # accumulate frames while producing interim transcripts
            async for frame in frames:
                buffer.extend(frame)
                now = asyncio.get_event_loop().time()
                if now - start_time >= interval:
                    # send snapshot
                    snapshot = bytes(buffer)
                    transcript = await self.transcribe_bytes(snapshot)
                    if transcript and transcript != last_transcript:
                        delta = transcript[len(last_transcript):].strip()
                        last_transcript = transcript
                        yield delta or transcript
                    start_time = now

            # After frames end, do a final transcription pass
            if buffer:
                final = await self.transcribe_bytes(bytes(buffer))
                if final and final != last_transcript:
                    yield final[len(last_transcript):].strip() or final

        except Exception:
            logger.exception("Error during Deepgram stream_transcribe")


deepgram_service = DeepgramService()

__all__ = ["deepgram_service", "DeepgramService"]
