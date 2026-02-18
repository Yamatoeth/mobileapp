"""
WebSocket voice hot-path

Endpoint flow (hot path):
 1. Receive audio chunks over WebSocket (base64 JSON or binary frames)
 2. Assemble audio and run STT (Deepgram preferred, fallback to OpenAI Whisper)
 3. Build server-side context via `build_context`
 4. Stream LLM response back over the WebSocket (SSE-style from OpenAI)
 5. Optionally synthesize TTS audio (ElevenLabs) and stream/send audio back

Notes:
 - This implementation focuses on clarity and safe fallbacks. Production
   deployments should add authentication, rate limits, backpressure, and
   binary streaming support.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from typing import Optional
import base64
import asyncio
import logging
import httpx

from app.core.config import get_settings
from app.core.context_builder import build_context

settings = get_settings()
router = APIRouter()
logger = logging.getLogger(__name__)


async def transcribe_audio_deepgram(audio_bytes: bytes) -> Optional[str]:
    """Try Deepgram transcription if key is configured."""
    if not settings.deepgram_api_key:
        return None

    url = "https://api.deepgram.com/v1/listen"
    headers = {"Authorization": f"Token {settings.deepgram_api_key}"}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, content=audio_bytes, headers=headers)
            r.raise_for_status()
            data = r.json()
            return data.get("results", {}).get("channels", [])[0].get("alternatives", [])[0].get("transcript")
    except Exception:
        logger.exception("Deepgram transcription failed")
        return None


async def transcribe_audio_openai_whisper(audio_bytes: bytes) -> Optional[str]:
    """Fallback to OpenAI Whisper transcription via REST API (multipart)."""
    if not settings.openai_api_key:
        return None

    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}

    files = {"file": ("audio.wav", audio_bytes, "audio/wav")}
    data = {"model": "whisper-1"}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, headers=headers, files=files, data=data)
            r.raise_for_status()
            data = r.json()
            return data.get("text")
    except Exception:
        logger.exception("OpenAI Whisper transcription failed")
        return None


async def stream_openai_chat(messages, websocket: WebSocket) -> str:
    """Stream OpenAI chat completions to the websocket. Returns the full text."""
    if not settings.openai_api_key:
        await websocket.send_json({"type": "error", "message": "OpenAI API key not configured"})
        return ""

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "gpt-4o",
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
                        await websocket.send_json({"type": "llm_chunk", "data": delta})

    except Exception:
        logger.exception("OpenAI streaming failed")
        await websocket.send_json({"type": "error", "message": "LLM streaming failed"})

    await websocket.send_json({"type": "llm_done", "content": full_text})
    return full_text


async def synthesize_elevenlabs(text: str) -> Optional[bytes]:
    """Synthesize speech using ElevenLabs (best-effort). Returns raw audio bytes or None."""
    if not settings.elevenlabs_api_key:
        return None

    # Default voice id may be configured in settings; fall back to 'alloy'
    voice_id = getattr(settings, "elevenlabs_voice_id", "alloy")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
        "Content-Type": "application/json",
    }
    payload = {"text": text, "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}}

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            return r.content
    except Exception:
        logger.exception("ElevenLabs TTS failed")
        return None


@router.websocket("/ws/voice/{user_id}")
async def websocket_voice(user_id: str, websocket: WebSocket):
    await websocket.accept()
    audio_buffer = bytearray()

    try:
        await websocket.send_json({"type": "ready"})

        while True:
            msg = await websocket.receive()

            if msg.get("type") == "websocket.disconnect":
                break

            # Support binary frames (append) or JSON text frames
            if "bytes" in msg and msg["bytes"]:
                audio_buffer.extend(msg["bytes"])
                # acknowledge
                await websocket.send_json({"type": "ack_audio"})
                continue

            if "text" in msg and msg["text"]:
                try:
                    payload = websocket.json_decoder(msg["text"]) if hasattr(websocket, "json_decoder") else None
                except Exception:
                    payload = None

                # If the client sends a JSON control frame
                if payload and isinstance(payload, dict):
                    if payload.get("type") == "audio_chunk":
                        data_b64 = payload.get("data")
                        if data_b64:
                            audio_buffer.extend(base64.b64decode(data_b64))
                            await websocket.send_json({"type": "ack_audio"})
                        continue

                    if payload.get("type") == "final":
                        # Client finished sending audio; proceed with pipeline
                        await websocket.send_json({"type": "stt_start"})

                        # STT: try Deepgram then OpenAI Whisper
                        transcript = await transcribe_audio_deepgram(bytes(audio_buffer))
                        if not transcript:
                            transcript = await transcribe_audio_openai_whisper(bytes(audio_buffer))

                        await websocket.send_json({"type": "stt_done", "transcript": transcript})

                        # Build server-side context and measure latency
                        import time
                        start = time.perf_counter()
                        context = await build_context(user_id, transcript)
                        elapsed_ms = int((time.perf_counter() - start) * 1000)
                        await websocket.send_json({"type": "context_built", "ms": elapsed_ms})

                        # Prepare messages for LLM: include server-assembled context
                        system_message = {
                            "role": "system",
                            "content": "You are J.A.R.V.I.S. Use the provided server-side context to answer concisely. Do not perform interventions unless explicitly asked. Context: " + str(context),
                        }
                        user_message = {"role": "user", "content": transcript or ""}

                        # Stream LLM output back to the websocket
                        full_text = await stream_openai_chat([system_message, user_message], websocket)

                        # Optionally synthesize TTS and stream/send audio back in chunks
                        tts_audio = await synthesize_elevenlabs(full_text)
                        if tts_audio:
                            try:
                                chunk_size = 32 * 1024
                                # send in base64-encoded chunks to avoid huge single frames
                                for i in range(0, len(tts_audio), chunk_size):
                                    chunk = tts_audio[i : i + chunk_size]
                                    b64chunk = base64.b64encode(chunk).decode()
                                    logger.debug(
                                        "Sending tts chunk %s/%s",
                                        (i // chunk_size) + 1,
                                        (len(tts_audio) + chunk_size - 1) // chunk_size,
                                    )
                                    await websocket.send_json({"type": "tts_audio_chunk", "data": b64chunk})

                                await websocket.send_json({"type": "tts_audio_done"})
                                logger.debug("Sent tts_audio_done to websocket for user %s", user_id)
                            except Exception:
                                logger.exception("Failed streaming TTS chunks")
                                # fallback to sending whole audio as one base64 frame
                                try:
                                    b64 = base64.b64encode(tts_audio).decode()
                                    logger.debug("Sending fallback tts_audio_base64, size=%s", len(b64))
                                    await websocket.send_json({"type": "tts_audio_base64", "data": b64})
                                except Exception:
                                    logger.exception("Failed fallback TTS send")
                        else:
                            # If TTS not available, send final text explicitly
                            await websocket.send_json({"type": "final_text", "text": full_text})

                        # Reset buffer for next utterance
                        audio_buffer = bytearray()
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
