#!/usr/bin/env python3
import asyncio
import time
import json
import os

# Ensure backend package is importable
sys_path = os.path.join(os.getcwd(), "backend")
if sys_path not in __import__("sys").path:
    __import__("sys").path.insert(0, sys_path)

from app.core.context_builder import build_context

async def main():
    user_id = os.environ.get("TEST_USER_ID", "1")
    query = os.environ.get("TEST_QUERY", "Tell me about my goals")

    start = time.perf_counter()
    try:
        ctx = await build_context(user_id, query)
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        print(json.dumps({"ms": elapsed_ms, "ok": True, "keys": list(ctx.keys())}, indent=None))
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        print(json.dumps({"ms": elapsed_ms, "ok": False, "error": str(e)}))

if __name__ == '__main__':
    asyncio.run(main())
