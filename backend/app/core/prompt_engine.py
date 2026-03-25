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
    "Behave as a trusted advisor: calm, practical, and proactive without being pushy. "
    "Use the server-provided context when it is relevant, but do not invent facts that are not present. "
    "Preserve continuity with recent conversation when possible. "
    "Do not mention internal tools, JSON, context layers, or implementation details unless the user explicitly asks. "
    "Do NOT provide medical diagnoses or replace professional healthcare. "
    "Do NOT perform unsolicited interventions; only suggest actions when the user explicitly asks or when provided instructions in the context allow it."
)


def _compact_json(data: Any) -> str:
    try:
        return json.dumps(data, default=str, ensure_ascii=False)
    except Exception:
        return str(data)


def _truncate(text: str, limit: int = 220) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rstrip() + "..."


def _format_context_sections(context: Optional[Dict[str, Any]]) -> str:
    if not context:
        return "No server context available."

    lines: list[str] = []

    character = context.get("character") or {}
    if character:
        name = character.get("full_name")
        trust_level = character.get("trust_level")
        char_parts = []
        if name:
            char_parts.append(f"name={name}")
        if trust_level:
            char_parts.append(f"trust_level={trust_level}")
        if char_parts:
            lines.append("Character: " + ", ".join(char_parts))

    knowledge_summary = (context.get("knowledge_summary") or {}).get("summary")
    if knowledge_summary:
        lines.append("Knowledge summary: " + _truncate(str(knowledge_summary), 400))

    recent_conversation = context.get("recent_conversation") or {}
    recent_summary = recent_conversation.get("summary")
    if recent_summary:
        lines.append("Recent conversation:\n" + str(recent_summary))

    working_memory = context.get("working_memory") or {}
    working_state = working_memory.get("state")
    if working_state:
        lines.append("Working state: " + _compact_json(working_state))

    episodic = context.get("episodic") or []
    if episodic:
        snippets = []
        for item in episodic[:3]:
            metadata = item.get("metadata") or item
            if not isinstance(metadata, dict):
                continue
            text = (
                metadata.get("content")
                or metadata.get("text")
                or metadata.get("summary")
                or metadata.get("field_value")
            )
            if text:
                snippets.append(_truncate(str(text), 220))
        if snippets:
            lines.append("Relevant memories:\n- " + "\n- ".join(snippets))

    client_context = context.get("client_context")
    if client_context:
        lines.append("Client context: " + _compact_json(client_context))

    return "\n\n".join(lines) if lines else "No server context available."


def build_system_prompt(context: Optional[Dict[str, Any]] = None) -> str:
    """Construct a concise system prompt with structured, human-readable context."""
    return (
        f"{JARVIS_CHARACTER_PROMPT}\n\n"
        "Response style:\n"
        "- Prefer short, actionable answers.\n"
        "- If context is insufficient, ask at most one clarifying question.\n"
        "- If prior conversation matters, continue naturally instead of restarting.\n"
        "- Be explicit when you are uncertain.\n\n"
        "Server context:\n"
        f"{_format_context_sections(context)}"
    )


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

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input},
    ]

    return messages


__all__ = ["JARVIS_CHARACTER_PROMPT", "build_system_prompt", "build_messages"]
