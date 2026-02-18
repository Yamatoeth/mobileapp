#!/usr/bin/env python3
# Usage: python3 ws_test_py.py
# pip install websockets

import os
import json
import asyncio
import websockets

WS_URL = os.getenv("BACKEND_WS", "ws://localhost:8000/api/v1/ws/voice/1")

async def main():
    async with websockets.connect(WS_URL) as ws:
        print("connected ->", WS_URL)
        await ws.send(json.dumps({"type": "final"}))
        async for msg in ws:
            try:
                m = json.loads(msg)
                print('recv:', m)
                if m.get('type') == 'context_built':
                    print(f"Context build latency: {m.get('ms')} ms")
                    break
            except Exception:
                print('raw:', msg)

if __name__ == '__main__':
    asyncio.run(main())
