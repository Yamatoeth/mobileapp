#!/usr/bin/env python3
"""
Test script for the ContextBuilder.

Usage:
    cd backend
    source .venv/bin/activate
    TEST_USER_ID=1 TEST_QUERY="Tell me about my goals" python3 scripts/test_context.py

Expected output:
    {"ms": <int>, "ok": true, "keys": ["character", "knowledge_summary", "working_memory", "episodic"]}
"""
import asyncio
import time
import json
import os
import sys

# Ensure backend package is importable
backend_path = os.path.join(os.path.dirname(__file__), "..")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.context_builder import build_context


async def main():
    user_id = os.environ.get("TEST_USER_ID", "1")
    query = os.environ.get("TEST_QUERY", "Tell me about my goals")

    print(f"\n🔍 Testing ContextBuilder")
    print(f"   user_id : {user_id}")
    print(f"   query   : {query}")
    print(f"   {'─' * 40}")

    start = time.perf_counter()
    try:
        ctx = await build_context(user_id, query)
        elapsed_ms = int((time.perf_counter() - start) * 1000)

        # Analyse each layer
        character       = ctx.get("character", {})
        kb_summary      = ctx.get("knowledge_summary", {})
        working_memory  = ctx.get("working_memory", {})
        episodic        = ctx.get("episodic", [])

        print(f"\n✅ Context built in {elapsed_ms}ms")
        print(f"\n📋 Layer 2 — Character:")
        if character:
            for k, v in character.items():
                print(f"   {k}: {v}")
        else:
            print("   ⚠️  Empty — user not found in DB?")

        print(f"\n🧠 Layer 2 — Knowledge Summary:")
        summary = kb_summary.get("summary", "")
        if summary:
            # Pretty print pipe-separated sections
            for part in summary.split(" | "):
                print(f"   {part}")
        else:
            print("   ⚠️  Empty — onboarding not done or KB tables empty")

        print(f"\n💬 Layer 3 — Working Memory:")
        messages = working_memory.get("messages", [])
        state    = working_memory.get("state")
        print(f"   messages in Redis : {len(messages)}")
        print(f"   user state        : {state or 'None'}")

        print(f"\n🔮 Layer 4 — Episodic Memory (Pinecone):")
        print(f"   results returned  : {len(episodic)}")
        for i, ep in enumerate(episodic[:3]):
            print(f"   [{i+1}] {ep}")

        # Latency verdict
        print(f"\n⏱️  Latency: {elapsed_ms}ms", end=" ")
        if elapsed_ms < 300:
            print("✅ (target: <300ms)")
        elif elapsed_ms < 500:
            print("⚠️  (acceptable but above target)")
        else:
            print("❌ (too slow — investigate which layer is blocking)")

        # Summary JSON for CI / scripts
        result = {
            "ms": elapsed_ms,
            "ok": True,
            "keys": list(ctx.keys()),
            "has_character": bool(character),
            "has_kb_summary": bool(summary),
            "working_memory_count": len(messages),
            "episodic_count": len(episodic),
        }
        print(f"\n📦 JSON summary:")
        print(json.dumps(result, indent=2))

    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        print(f"\n❌ Error after {elapsed_ms}ms: {e}")
        import traceback
        traceback.print_exc()
        result = {"ms": elapsed_ms, "ok": False, "error": str(e)}
        print(json.dumps(result, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())