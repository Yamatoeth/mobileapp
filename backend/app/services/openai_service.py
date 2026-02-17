"""
Server-side OpenAI wrapper providing embedding helpers and streaming chat
support. Other backend modules should import and reuse this for LLM
interactions to keep API usage centralized and testable.
"""
from typing import List, Optional, AsyncGenerator, Dict, Any
import logging
import httpx

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class OpenAIService:
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o", embed_model: str = "text-embedding-3-small"):
        self.api_key = api_key or settings.openai_api_key
        self.model = model
        self.embed_model = embed_model

    async def embed_text(self, text: str) -> Optional[List[float]]:
        """Return embedding vector for `text` or None on failure."""
        if not self.api_key:
            logger.debug("OpenAI API key missing for embeddings")
            return None

        url = "https://api.openai.com/v1/embeddings"
        payload = {"model": self.embed_model, "input": text}
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(url, json=payload, headers=headers)
                r.raise_for_status()
                data = r.json()
                emb = data.get("data", [])[0].get("embedding")
                return emb
        except Exception:
            logger.exception("Embedding request to OpenAI failed")
            return None

    async def chat(self, messages: List[Dict[str, Any]], temperature: float = 0.7, max_tokens: int = 1024) -> str:
        """Non-streaming chat completion. Returns assistant text."""
        if not self.api_key:
            raise RuntimeError("OpenAI API key not configured")

        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            data = r.json()
            return data.get("choices", [])[0].get("message", {}).get("content", "")

    async def stream_chat(self, messages: List[Dict[str, Any]], temperature: float = 0.7, max_tokens: int = 1024) -> AsyncGenerator[str, None]:
        """Async generator yielding text deltas from OpenAI streaming API.

        Yields successive chunks (strings). Caller should `async for chunk in svc.stream_chat(...):`.
        """
        if not self.api_key:
            raise RuntimeError("OpenAI API key not configured")

        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as resp:
                resp.raise_for_status()
                # Stream lines and parse SSE 'data: ' prefixed messages
                async for raw_line in resp.aiter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.strip()
                    if line == "[DONE]":
                        break
                    if line.startswith("data: "):
                        data = line[len("data: "):]
                    else:
                        data = line

                    try:
                        parsed = httpx.Response(200, content=data.encode()).json()
                    except Exception:
                        # On parse failure, yield raw data
                        yield data
                        continue

                    # Extract delta content if present
                    try:
                        delta = parsed.get("choices", [])[0].get("delta", {}).get("content")
                    except Exception:
                        delta = None

                    if delta:
                        yield delta


openai_service = OpenAIService()

__all__ = ["openai_service", "OpenAIService"]
