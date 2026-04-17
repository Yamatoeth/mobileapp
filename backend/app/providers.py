"""
Provider adapters for Phase 1 voice and AI infrastructure.

Routes depend on these interfaces instead of binding directly to a vendor.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, AsyncIterator, Optional, Protocol
import asyncio
import logging

import httpx

from app.core.config import get_settings
from app.services.kokoro_service import kokoro_tts_service
from app.services.openai_service import openai_service

settings = get_settings()
logger = logging.getLogger(__name__)


@dataclass
class AudioMetadata:
    file_name: str = "audio.m4a"
    mime_type: str = "audio/mp4"
    voice: str | None = None
    speed: float | None = None
    lang: str | None = None


class STTProvider(Protocol):
    async def transcribe(self, audio_bytes: bytes, metadata: AudioMetadata) -> Optional[str]:
        ...


class LLMProvider(Protocol):
    async def stream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        ...

    async def complete(self, messages: list[dict[str, str]]) -> str:
        ...


class TTSProvider(Protocol):
    async def synthesize(self, text: str, metadata: AudioMetadata) -> bytes:
        ...


class EmbeddingProvider(Protocol):
    async def embed_text(self, text: str) -> Optional[list[float]]:
        ...


class DeepgramSTTProvider:
    async def transcribe(self, audio_bytes: bytes, metadata: AudioMetadata) -> Optional[str]:
        if settings.test_mode:
            return "this is a test transcript from deepgram stub"
        if not settings.deepgram_api_key or not audio_bytes:
            return None

        params = {
            "model": settings.deepgram_stt_model,
            "smart_format": "true",
            "punctuate": "true",
        }
        headers = {
            "Authorization": f"Token {settings.deepgram_api_key}",
            "Content-Type": metadata.mime_type or "audio/mp4",
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    "https://api.deepgram.com/v1/listen",
                    params=params,
                    content=audio_bytes,
                    headers=headers,
                )
                response.raise_for_status()
                data = response.json()
                return (
                    data.get("results", {})
                    .get("channels", [{}])[0]
                    .get("alternatives", [{}])[0]
                    .get("transcript")
                )
        except Exception:
            logger.exception("Deepgram transcription failed")
            return None


class GroqWhisperSTTProvider:
    async def transcribe(self, audio_bytes: bytes, metadata: AudioMetadata) -> Optional[str]:
        if settings.test_mode:
            return "this is a test transcript from whisper stub"
        if not settings.groq_api_key or not audio_bytes:
            return None

        headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
        files = {
            "file": (
                metadata.file_name or "audio.m4a",
                audio_bytes,
                metadata.mime_type or "audio/mp4",
            )
        }
        data = {"model": settings.groq_stt_model}

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers=headers,
                    files=files,
                    data=data,
                )
                response.raise_for_status()
                return response.json().get("text")
        except Exception:
            logger.exception("Groq transcription fallback failed")
            return None


class CompositeSTTProvider:
    def __init__(self) -> None:
        self.providers: list[STTProvider] = [
            DeepgramSTTProvider(),
            GroqWhisperSTTProvider(),
        ]

    async def transcribe(self, audio_bytes: bytes, metadata: AudioMetadata) -> Optional[str]:
        for provider in self.providers:
            transcript = await provider.transcribe(audio_bytes, metadata)
            if transcript:
                return transcript
        return None


class GroqLLMProvider:
    def _local_response(self, user_input: str, context_summary: str = "") -> str:
        normalized = user_input.strip()
        if not normalized:
            return "I didn't catch a question yet. Ask me anything and I'll help."
        if context_summary:
            return f"You asked: {normalized}\n\nI have this saved context: {context_summary}"
        return (
            f"You asked: {normalized}\n\n"
            "Here is a local-mode answer while provider APIs are not configured."
        )

    def _extract_last_user_text(self, messages: list[dict[str, str]]) -> str:
        for message in reversed(messages):
            if message.get("role") == "user":
                return message.get("content", "")
        return ""

    async def stream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        if settings.test_mode:
            for chunk in ["Hello ", "from JARVIS ", "(test mode)."]:
                yield chunk
                await asyncio.sleep(0.01)
            return

        if not settings.groq_api_key:
            yield self._local_response(self._extract_last_user_text(messages))
            return

        payload = {
            "model": settings.groq_chat_model,
            "messages": messages,
            "temperature": 0.7,
            "stream": True,
        }
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    json=payload,
                    headers=headers,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        data = line[len("data: ") :] if line.startswith("data: ") else line
                        if data.strip() == "[DONE]":
                            break
                        try:
                            parsed = httpx.Response(200, content=data.encode()).json()
                            delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content")
                        except Exception:
                            delta = data
                        if delta:
                            yield delta
        except Exception:
            logger.exception("Groq streaming failed")
            yield self._local_response(self._extract_last_user_text(messages))

    async def complete(self, messages: list[dict[str, str]]) -> str:
        if settings.test_mode:
            return "Hello from JARVIS (test mode). I know your goals and will help you."
        if not settings.groq_api_key:
            return self._local_response(self._extract_last_user_text(messages))

        payload = {
            "model": settings.groq_chat_model,
            "messages": messages,
            "temperature": 0.7,
            "stream": False,
        }
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
                return response.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        except Exception:
            logger.exception("Groq completion failed")
            return self._local_response(self._extract_last_user_text(messages))


class DeepgramTTSProvider:
    async def synthesize(self, text: str, metadata: AudioMetadata) -> bytes:
        if settings.test_mode:
            return b""
        if not settings.deepgram_api_key:
            raise RuntimeError("Deepgram API key not configured")

        model = metadata.voice or settings.deepgram_tts_model
        headers = {
            "Authorization": f"Token {settings.deepgram_api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    "https://api.deepgram.com/v1/speak",
                    params={"model": model},
                    json={"text": text},
                    headers=headers,
                )
                response.raise_for_status()
                return response.content
        except Exception:
            logger.exception("Deepgram TTS failed")
            raise


class KokoroFallbackTTSProvider:
    async def synthesize(self, text: str, metadata: AudioMetadata) -> bytes:
        return await asyncio.to_thread(
            kokoro_tts_service.generate_speech,
            text,
            voice=metadata.voice,
            speed=metadata.speed,
            lang=metadata.lang,
        )


class CompositeTTSProvider:
    def __init__(self) -> None:
        self.deepgram = DeepgramTTSProvider()
        self.kokoro = KokoroFallbackTTSProvider()

    async def synthesize(self, text: str, metadata: AudioMetadata) -> bytes:
        if not text:
            return b""
        if settings.deepgram_api_key and settings.tts_provider == "deepgram":
            try:
                return await self.deepgram.synthesize(text, metadata)
            except Exception:
                logger.warning("Falling back to Kokoro TTS")
        return await self.kokoro.synthesize(text, metadata)


class OpenAIEmbeddingProvider:
    async def embed_text(self, text: str) -> Optional[list[float]]:
        return await openai_service.embed_text(text)


def _build_stt_provider() -> STTProvider:
    if settings.stt_provider == "groq":
        return GroqWhisperSTTProvider()
    return CompositeSTTProvider()


def _build_tts_provider() -> TTSProvider:
    if settings.tts_provider == "kokoro":
        return KokoroFallbackTTSProvider()
    return CompositeTTSProvider()


stt_provider: STTProvider = _build_stt_provider()
llm_provider: LLMProvider = GroqLLMProvider()
tts_provider: TTSProvider = _build_tts_provider()
embedding_provider: EmbeddingProvider = OpenAIEmbeddingProvider()
