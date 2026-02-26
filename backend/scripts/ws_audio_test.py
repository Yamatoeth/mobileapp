import asyncio
import json
import base64
from pathlib import Path
import websockets

# Paths
HERE = Path(__file__).resolve().parent
AUDIO_FILE = HERE / "test_question.wav"
WS_URL = "ws://localhost:8000/api/v1/ws/voice/1"
OUT_FILE = HERE / "tts_output.wav"


async def run():
    if not AUDIO_FILE.exists():
        print(f"Audio file not found: {AUDIO_FILE}")
        return

    print("connecting ->", WS_URL)
    async with websockets.connect(WS_URL, max_size=None) as ws:
        print("connected")

        # Stream audio in binary chunks
        chunk_size = 32 * 1024
        with open(AUDIO_FILE, "rb") as f:
            i = 0
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                await ws.send(chunk)
                i += 1
                await asyncio.sleep(0.01)
        # Send final marker expected by server
        await ws.send(b"__FINAL__")
        print("sent final marker, awaiting responses...")

        tts_buf = bytearray()
        llm_text = []

        async for msg in ws:
            # websockets lib returns str for text frames
            if isinstance(msg, bytes):
                print(f"received binary frame (len={len(msg)}) - ignoring")
                continue

            try:
                payload = json.loads(msg)
            except Exception:
                print("raw:", msg)
                continue

            mtype = payload.get("type")
            if mtype:
                print("recv:", mtype)

            if mtype == "stt_start":
                print("STT started")

            elif mtype == "stt_done":
                print("STT done ->", payload.get("transcript"))

            elif mtype == "context_built":
                print("Context built (ms):", payload.get("ms"))

            elif mtype == "llm_chunk":
                data = payload.get("data")
                if data:
                    llm_text.append(data)
                    print("LLM chunk ->", data)

            elif mtype == "llm_done":
                print("LLM done")

            elif mtype == "tts_audio_chunk":
                b64 = payload.get("data")
                if b64:
                    tts_buf.extend(base64.b64decode(b64))
                    print(f"received tts chunk, total={len(tts_buf)} bytes")

            elif mtype == "tts_audio_done":
                print("received tts_audio_done, writing to", OUT_FILE)
                with open(OUT_FILE, "wb") as out:
                    out.write(tts_buf)
                print("Wrote TTS output; exiting")
                break

            elif mtype == "tts_audio_base64":
                b64 = payload.get("data")
                if b64:
                    data = base64.b64decode(b64)
                    with open(OUT_FILE, "wb") as out:
                        out.write(data)
                    print("Wrote fallback TTS output; exiting")
                    break

            elif mtype == "final_text":
                print("Final text:", payload.get("text"))
                # No audio delivered; break
                break

            elif mtype == "error":
                print("Error from server:", payload.get("message"))
                break

        # Print collected LLM text if any
        if llm_text:
            print("Full LLM text:\n", "".join(llm_text))


if __name__ == "__main__":
    asyncio.run(run())