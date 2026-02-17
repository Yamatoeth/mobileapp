"""
Central prompt templates and J.A.R.V.I.S. character enforcement.

Provides functions to build system prompts and LLM message arrays using
server-assembled context. Intended for use by the voice hot-path and other
AI endpoints so prompting stays consistent across the backend.
"""
from typing import Any, Dict, List, Optional
import json

JARVIS_CHARACTER_PROMPT = (
    "You are J.A.R.V.I.S., a concise, context-aware executive assistant. "
    "Behave as a trusted advisor: calm, concise, and proactive. Use only the "
    "context provided by the server Context Builder to inform your responses. "
    "Do NOT provide medical diagnoses or replace professional healthcare. "
    "Do NOT perform unsolicited interventions; only suggest actions when the "
    "user explicitly asks or when provided instructions in the context allow it."
)


def _serialize_context(context: Optional[Dict[str, Any]]) -> str:
    if not context:
        return "{}"
    try:
        return json.dumps(context, default=str, ensure_ascii=False)
    except Exception:
        # Fallback: shallow serialization
        return str(context)


def build_system_prompt(context: Optional[Dict[str, Any]] = None) -> str:
    """Construct the final system prompt using the character template and
    a compact representation of server-assembled context.

    Keep the context machine-readable; downstream code may pass the JSON to
    the LLM as part of the system or user messages.
    """
    ctx_str = _serialize_context(context)
    system = (
        f"{JARVIS_CHARACTER_PROMPT}\n\n"
        "ServerContext (JSON):\n" + ctx_str + "\n\n"
        "When responding, prefer short, actionable answers. If the context is "
        "insufficient to answer, ask one clarifying question."
    )
    return system


def build_messages(user_input: str, context: Optional[Dict[str, Any]] = None, extra_instructions: Optional[str] = None) -> List[Dict[str, str]]:
    """Return a messages array ready for OpenAI-style chat completions.

    Args:
      user_input: the user's utterance or transcript
      context: server-assembled context dict (character, knowledge_summary, working_memory, episodic)
      extra_instructions: optional per-call instructions to append to system prompt
    """
    system_prompt = build_system_prompt(context)
    if extra_instructions:
        system_prompt = system_prompt + "\n\n" + extra_instructions

    # Provide the context again explicitly in the user message so some LLMs
    # that prefer user-context are able to see it. Keep it compact.
    context_payload = _serialize_context(context)

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context: {context_payload}"},
        {"role": "user", "content": user_input},
    ]

    return messages


__all__ = ["JARVIS_CHARACTER_PROMPT", "build_system_prompt", "build_messages"]
