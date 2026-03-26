"""
WebSocket voice hot-path

Endpoint flow (hot path):
 1. Receive audio chunks over WebSocket (base64 JSON or binary frames)
 2. Assemble audio and run STT (Deepgram preferred, fallback to OpenAI Whisper)
 3. Build server-side context via `build_context`
 4. Stream LLM response back over the WebSocket (SSE-style from OpenAI)
 5. Synthesize TTS audio with local Kokoro and stream/send audio back

Notes:
 - This implementation focuses on clarity and safe fallbacks. Production
   deployments should add authentication, rate limits, backpressure, and
   binary streaming support.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Any, Optional
import base64
import asyncio
import logging
import json
import httpx

from app.auth import decode_token
from app.core.config import get_settings
from app.core.context_builder import build_context
from app.core.prompt_engine import build_messages
from app.services.kokoro_service import kokoro_tts_service
from app.services.conversation_memory import append_turn

settings = get_settings()
router = APIRouter()
logger = logging.getLogger(__name__)


class TextQueryRequest(BaseModel):
    user_id: str
    query: str
    context: dict[str, Any] | None = None


class AudioPayloadMetadata(BaseModel):
    file_name: str = "audio.m4a"
    mime_type: str = "audio/mp4"
    voice: str | None = None
    speed: float | None = None
    lang: str | None = None


class TTSRequest(BaseModel):
    text: str
    voice: str | None = None
    speed: float | None = None
    lang: str | None = None


async def _safe_send_json(ws: WebSocket, payload: dict) -> bool:
    """Send JSON to websocket but swallow errors if socket closed.

    Returns True if send succeeded, False otherwise.
    """
    try:
        await ws.send_json(payload)
        return True
    except Exception:
        logger.debug("WebSocket closed or send failed for type=%s", payload.get("type"))
        return False


def _looks_like_pcm_wav(metadata: AudioPayloadMetadata) -> bool:
    mime = (metadata.mime_type or "").lower()
    file_name = (metadata.file_name or "").lower()
    return (
        mime in {"audio/wav", "audio/x-wav", "audio/wave", "audio/x-caf"}
        or file_name.endswith(".wav")
        or file_name.endswith(".caf")
    )


def _parse_speed(value: Any, fallback: float | None) -> float | None:
    """Coerce arbitrary payload speed into a float, keeping previous value on invalid input."""
    if value is None:
        return fallback
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return fallback
    return fallback


async def transcribe_audio_deepgram(
    audio_bytes: bytes,
    metadata: AudioPayloadMetadata,
) -> Optional[str]:
    """Try Deepgram transcription for linear PCM-style payloads."""
    # Test-mode stub
    if settings.test_mode:
        return "this is a test transcript from deepgram stub"

    if not settings.deepgram_api_key or not _looks_like_pcm_wav(metadata):
        return None

    url = "https://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&punctuate=true"
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": metadata.mime_type or "audio/wav",
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, content=audio_bytes, headers=headers)
            try:
                r.raise_for_status()
            except Exception:
                logger.error(f"Deepgram error response: {r.text}")
                raise
            data = r.json()
            return data.get("results", {}).get("channels", [])[0].get("alternatives", [])[0].get("transcript")
    except Exception:
        logger.exception("Deepgram transcription failed")
        return None


async def transcribe_audio_groq(
    audio_bytes: bytes,
    metadata: AudioPayloadMetadata,
) -> Optional[str]:
    """Primary STT via Groq Whisper-compatible transcription API."""
    # Test-mode stub
    if settings.test_mode:
        return "this is a test transcript from whisper stub"

    if not settings.groq_api_key:
        return None

    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {settings.groq_api_key}"}

    file_name = metadata.file_name or "audio.m4a"
    mime_type = metadata.mime_type or "audio/mp4"
    files = {"file": (file_name, audio_bytes, mime_type)}
    data = {"model": "whisper-large-v3-turbo"}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, headers=headers, files=files, data=data)
            r.raise_for_status()
            data = r.json()
            return data.get("text")
    except Exception:
        logger.exception("Groq transcription failed")
        return None


async def stream_openai_chat(messages, websocket: WebSocket) -> str:
    """Stream OpenAI chat completions to the websocket. Returns the full text."""
    # Test-mode streaming stub
    if settings.test_mode:
        full_text = "Hello — this is JARVIS (test mode). I know your goals and will help you."
        # simulate streaming in chunks
        for chunk in [full_text[:20], full_text[20:40], full_text[40:]]:
            await websocket.send_json({"type": "llm_chunk", "data": chunk})
            await asyncio.sleep(0.02)
        await websocket.send_json({"type": "llm_done", "content": full_text})
        return full_text

    if not settings.groq_api_key:
        await _safe_send_json(websocket, {"type": "error", "message": "Groq API key not configured"})
        return ""

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.7,
        "stream": True,
    }

    full_text = ""

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    # OpenAI SSE streams lines like: "data: {json}\n\n"
                    if line.startswith("data: "):
                        data = line[len("data: "):]
                    else:
                        data = line

                    if data.strip() == "[DONE]":
                        break
                    try:
                        parsed = httpx.Response(200, content=data.encode()).json()
                    except Exception:
                        # If it's not JSON, forward raw chunk
                        await websocket.send_json({"type": "llm_chunk", "data": data})
                        full_text += data
                        continue

                    # Compatibility: parsed may follow OpenAI streaming choice schema
                    delta = None
                    try:
                        delta = parsed.get("choices", [])[0].get("delta", {}).get("content")
                    except Exception:
                        pass

                    if delta:
                        full_text += delta
                        await _safe_send_json(websocket, {"type": "llm_chunk", "data": delta})

    except Exception:
        logger.exception("OpenAI streaming failed")
        await _safe_send_json(websocket, {"type": "error", "message": "LLM streaming failed"})
    await _safe_send_json(websocket, {"type": "llm_done", "content": full_text})
    return full_text


def _build_local_response(user_input: str, context: Optional[dict[str, Any]] = None) -> str:
    """Local fallback so development remains usable without external providers."""
    context = context or {}
    character = context.get("character") or {}
    name = character.get("full_name") or "there"
    knowledge_summary = context.get("knowledge_summary") or {}
    summary = knowledge_summary.get("summary") or ""

    normalized = user_input.strip()
    lower = normalized.lower()

    if not normalized:
        return "I didn't catch a question yet. Ask me anything and I'll help."

    if any(token in lower for token in ("hello", "hi", "hey", "bonjour", "salut")):
        return f"Hello {name}. I'm ready. Ask me a question and I'll answer in local mode."

    if "who are you" in lower:
        return "I'm J.A.R.V.I.S., your assistant. In local mode I can still answer and help you test the app end to end."

    if "what do you know about me" in lower:
        if summary:
            return f"Here's the context I currently have about you: {summary}"
        return "I don't have much saved context yet, but the assistant path is working and ready for onboarding data."

    response = f"You asked: {normalized}\n\nHere is a local-mode answer while provider APIs are not configured. "
    if summary:
        response += f"I also have this saved context: {summary}\n\n"
    response += (
        "The app, backend routing, and assistant loop are working. "
        "If you add Groq/OpenAI and optional voice provider keys, this same flow will use live model responses."
    )
    return response


async def generate_chat_response(messages, user_input: str, context: Optional[dict[str, Any]] = None) -> str:
    """Return a single assistant response using Groq when configured, or a local fallback."""
    if settings.test_mode:
        return "Hello — this is JARVIS (test mode). I know your goals and will help you."

    if not settings.groq_api_key:
        return _build_local_response(user_input=user_input, context=context)

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.7,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception:
        logger.exception("Non-stream chat completion failed")
        return _build_local_response(user_input=user_input, context=context)


async def synthesize_kokoro_tts(
    text: str,
    *,
    voice: str | None = None,
    speed: float | None = None,
    lang: str | None = None,
) -> bytes:
    return await asyncio.to_thread(
        kokoro_tts_service.generate_speech,
        text,
        voice=voice,
        speed=speed,
        lang=lang,
    )


@router.get("/tts/voices")
async def list_tts_voices():
    voices = await asyncio.to_thread(kokoro_tts_service.get_voices)
    return {"voices": voices, "default": settings.kokoro_default_voice}


@router.post("/tts")
async def generate_tts(payload: TTSRequest):
    text = payload.text.strip()
    if not text:
        return JSONResponse(status_code=400, content={"detail": "Text cannot be empty"})

    audio_bytes = await synthesize_kokoro_tts(
        text,
        voice=payload.voice,
        speed=payload.speed,
        lang=payload.lang,
    )
    return StreamingResponse(
        kokoro_tts_service.stream_audio(audio_bytes),
        media_type="audio/wav",
        headers={
            "Content-Disposition": 'inline; filename="tts.wav"',
            "X-TTS-Voice": payload.voice or settings.kokoro_default_voice,
        },
    )


async def run_voice_pipeline(
    *,
    user_id: str,
    audio_bytes: bytes,
    metadata: AudioPayloadMetadata,
    websocket: WebSocket,
) -> None:
    await _safe_send_json(websocket, {"type": "stt_start"})

    transcript = await transcribe_audio_groq(audio_bytes, metadata)
    if not transcript:
        transcript = await transcribe_audio_deepgram(audio_bytes, metadata)

    await _safe_send_json(websocket, {"type": "stt_done", "transcript": transcript})
    conversation_id: str | None = None
    if transcript:
        conversation_id = await append_turn(
            user_id=user_id,
            role="user",
            content=transcript,
        )

    start = asyncio.get_running_loop().time()
    context = await build_context(user_id, transcript)
    elapsed_ms = int((asyncio.get_running_loop().time() - start) * 1000)
    await _safe_send_json(websocket, {"type": "context_built", "ms": elapsed_ms})
    messages = build_messages(user_input=transcript or "", context=context)
    full_text = await stream_openai_chat(messages, websocket)
    if full_text:
        conversation_id = await append_turn(
            user_id=user_id,
            role="assistant",
            content=full_text,
            conversation_id=conversation_id,
        )

    tts_audio = await synthesize_kokoro_tts(
        full_text,
        voice=metadata.voice,
        speed=metadata.speed,
        lang=metadata.lang,
    )
    try:
        chunk_size = 32 * 1024
        for i in range(0, len(tts_audio), chunk_size):
            chunk = tts_audio[i : i + chunk_size]
            b64chunk = base64.b64encode(chunk).decode()
            await _safe_send_json(websocket, {"type": "tts_audio_chunk", "data": b64chunk})
        await _safe_send_json(websocket, {"type": "tts_audio_done"})
    except Exception:
        logger.exception("Failed streaming TTS chunks")
        b64 = base64.b64encode(tts_audio).decode()
        await _safe_send_json(websocket, {"type": "tts_audio_base64", "data": b64})


@router.post("/ai/process")
async def process_text_query(payload: TextQueryRequest):
    """Text-friendly entrypoint for the backend-owned assistant pipeline."""
    query = payload.query.strip()
    if not query:
        return JSONResponse(status_code=400, content={"detail": "Query cannot be empty"})

    context = await build_context(payload.user_id, query)
    if payload.context:
        context = {
            **context,
            "client_context": payload.context,
        }
    messages = build_messages(user_input=query, context=context)
    response_text = await generate_chat_response(messages, user_input=query, context=context)
    conversation_id = await append_turn(user_id=payload.user_id, role="user", content=query)
    await append_turn(
        user_id=payload.user_id,
        role="assistant",
        content=response_text,
        conversation_id=conversation_id,
    )

    return {
        "response": response_text,
        "memoryUpdated": False,
        "mode": "provider" if settings.groq_api_key else "local_fallback",
    }


def _extract_and_validate_token(token: Optional[str], expected_user_id: str) -> bool:
    """Validate JWT token and ensure it matches the user_id path param."""
    if not token:
        return False
    try:
        payload = decode_token(token)
        token_user_id = payload.get("sub")
        return token_user_id == expected_user_id
    except Exception:
        return False


@router.websocket("/ws/voice/{user_id}")
async def websocket_voice(
    user_id: str,
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """WebSocket voice endpoint with optional JWT authentication.

    Query parameters:
    - token: JWT token for authentication (required in production).
             In development/test mode, token is optional.
    """
    # Validate token unless in test_mode or development with test_mode disabled
    if not settings.test_mode and not _extract_and_validate_token(token, user_id):
        await websocket.close(code=4003, reason="Unauthorized")
        return

    await websocket.accept()
    audio_buffer = bytearray()
    audio_metadata = AudioPayloadMetadata()
    print('[PIPELINE] ✅ WebSocket connected — client ready to stream audio')

    try:
        await websocket.send_json({"type": "ready"})

        while True:
            msg = await websocket.receive()

            if msg.get("type") == "websocket.disconnect":
                break

            # Support binary frames (append) or JSON text frames
            if "bytes" in msg and msg["bytes"]:
                print(f'[PIPELINE 2/7] 📥 Audio chunk received — size: {len(msg["bytes"])} bytes')
                # Special-case: client can send a single-frame b"__FINAL__" to indicate end-of-utterance
                if msg["bytes"] == b"__FINAL__":
                    await run_voice_pipeline(
                        user_id=user_id,
                        audio_bytes=bytes(audio_buffer),
                        metadata=audio_metadata,
                        websocket=websocket,
                    )
                    audio_buffer = bytearray()
                    audio_metadata = AudioPayloadMetadata()
                    continue

                audio_buffer.extend(msg["bytes"])
                # acknowledge
                await websocket.send_json({"type": "ack_audio"})
                continue

            if "text" in msg and msg["text"]:
                try:
                    payload = json.loads(msg["text"]) if msg.get("text") else None
                except Exception:
                    # Best-effort fallback: if the text contains a simple control like 'final',
                    # accept it as a final marker. This helps clients that send plain strings.
                    raw = msg.get("text")
                    try:
                        if raw and isinstance(raw, str) and raw.strip().lower() == "final":
                            payload = {"type": "final"}
                        else:
                            payload = None
                    except Exception:
                        payload = None

                # If the client sends a JSON control frame
                if payload and isinstance(payload, dict):
                    if payload.get("type") == "audio_chunk":
                        data_b64 = payload.get("data")
                        if (
                            payload.get("file_name")
                            or payload.get("mime_type")
                            or payload.get("voice")
                            or payload.get("speed") is not None
                            or payload.get("lang")
                        ):
                            audio_metadata = AudioPayloadMetadata(
                                file_name=payload.get("file_name") or audio_metadata.file_name,
                                mime_type=payload.get("mime_type") or audio_metadata.mime_type,
                                voice=payload.get("voice") or audio_metadata.voice,
                                speed=_parse_speed(payload.get("speed"), audio_metadata.speed),
                                lang=payload.get("lang") or audio_metadata.lang,
                            )
                        if data_b64:
                            audio_buffer.extend(base64.b64decode(data_b64))
                            await websocket.send_json({"type": "ack_audio"})
                        continue

                    if payload.get("type") == "final":
                        if (
                            payload.get("file_name")
                            or payload.get("mime_type")
                            or payload.get("voice")
                            or payload.get("speed") is not None
                            or payload.get("lang")
                        ):
                            audio_metadata = AudioPayloadMetadata(
                                file_name=payload.get("file_name") or audio_metadata.file_name,
                                mime_type=payload.get("mime_type") or audio_metadata.mime_type,
                                voice=payload.get("voice") or audio_metadata.voice,
                                speed=_parse_speed(payload.get("speed"), audio_metadata.speed),
                                lang=payload.get("lang") or audio_metadata.lang,
                            )

                        await run_voice_pipeline(
                            user_id=user_id,
                            audio_bytes=bytes(audio_buffer),
                            metadata=audio_metadata,
                            websocket=websocket,
                        )
                        audio_buffer = bytearray()
                        audio_metadata = AudioPayloadMetadata()
                        continue

                # Unknown text frame; ignore or log
                await websocket.send_json({"type": "ignored"})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", user_id)
    except Exception:
        logger.exception("Error in voice websocket for user %s", user_id)
        try:
            await websocket.send_json({"type": "error", "message": "Server error in voice pipeline"})
        except Exception:
            pass
