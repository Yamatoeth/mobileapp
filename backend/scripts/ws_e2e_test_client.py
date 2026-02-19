#!/usr/bin/env python3
import asyncio
import base64
import json
import time
import os
import websockets

URL = os.environ.get("WS_URL", "ws://localhost:8000/api/v1/ws/voice/1")

async def run_test():
    async with websockets.connect(URL) as ws:
        # wait for ready
        msg = await ws.recv()
        print("recv:", msg)

        # send a few binary audio frames (server accepts bytes frames)
        for i in range(3):
            await ws.send(b"dummy-audio-%d" % i)
            ack = await ws.recv()
            print("ack:", ack)

        # finalize by sending special binary marker
        await ws.send(b"__FINAL__")

        start = time.perf_counter()
        transcript = None
        full_text = None
        tts_done = False

        while True:
            try:
                m = await asyncio.wait_for(ws.recv(), timeout=10)
            except asyncio.TimeoutError:
                print("timeout waiting for server response")
                break
            try:
                obj = json.loads(m)
            except Exception:
                print("raw:", m)
                continue
            print("<-", obj)
            t = obj.get("type")
            if t == "stt_done":
                transcript = obj.get("transcript")
            if t == "llm_chunk":
                # accumulate
                pass
            if t == "llm_done":
                full_text = obj.get("content")
            if t == "tts_audio_done":
                tts_done = True
                elapsed = (time.perf_counter() - start) * 1000
                print(f"E2E latency (ms): {int(elapsed)}")
                break
            if t == "final_text":
                elapsed = (time.perf_counter() - start) * 1000
                print(f"E2E latency (ms) final_text: {int(elapsed)}")
                break

        print("transcript:", transcript)
        print("full_text:", full_text)
        print("tts_done:", tts_done)

if __name__ == '__main__':
    asyncio.run(run_test())
