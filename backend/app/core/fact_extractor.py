"""
Fact extractor for transcripts -> structured KB updates

This module exposes a primary function `extract_facts(transcript)` which
attempts to use the OpenAI Chat Completions API to parse free-text
transcripts into a compact JSON array of factual assertions. If OpenAI is not
configured or the call fails, a lightweight rule-based fallback extracts
candidate facts from sentences.

The output format is a list of objects like:
  {"subject": "User", "predicate": "likes", "object": "black coffee", "confidence": 0.86}

This is intended to be called from a Celery task that persists facts into
the knowledge DB or updates embeddings.
"""
from typing import List, Dict, Any, Optional
import logging
import re
import json
import httpx

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _rule_based_extract(transcript: str) -> List[Dict[str, Any]]:
    """Simple heuristic extractor: split into sentences and look for verb
    phrases that indicate personal facts. Returns low-confidence facts.
    """
    facts: List[Dict[str, Any]] = []
    # Normalize
    text = transcript.strip()
    if not text:
        return facts

    # Split into sentences (naive)
    sentences = re.split(r"(?<=[.!?])\s+", text)

    fact_patterns = [
        # I live in ... / I'm in ...
        (re.compile(r"\bI(?:'m| am) (?:from |in |based in )?(?P<object>.+?)(?:\.|$)", re.I), "lives_in"),
        (re.compile(r"\bI(?:'m| am) (?:a |an )?(?P<object>.+?)(?:\.|$)", re.I), "identity"),
        (re.compile(r"\bI (?:like|love|enjoy) (?P<object>.+?)(?:\.|$)", re.I), "likes"),
        (re.compile(r"\bI (?:don't |do not )?(?:like|love|enjoy) (?P<object>.+?)(?:\.|$)", re.I), "dislikes"),
        (re.compile(r"\bMy (?:favorite|favourite) (?P<object>.+?) is (?P<object2>.+?)(?:\.|$)", re.I), "preference"),
        (re.compile(r"\bI met (?P<object>.+?)(?:\.|$)", re.I), "met_person"),
        (re.compile(r"\bI (?:bought|purchased) (?P<object>.+?)(?:\.|$)", re.I), "purchased"),
    ]

    for s in sentences:
        s = s.strip()
        for pattern, predicate in fact_patterns:
            m = pattern.search(s)
            if m:
                obj = m.groupdict().get("object") or m.groupdict().get("object2")
                if obj:
                    obj = obj.strip().strip('.').strip()
                    facts.append({
                        "subject": "user",
                        "predicate": predicate,
                        "object": obj,
                        "source": "rule_fallback",
                        "confidence": 0.4,
                    })
                    break

    return facts


async def _openai_extract(transcript: str) -> Optional[List[Dict[str, Any]]]:
    """Use OpenAI Chat Completions to extract facts as JSON. Returns None on
    failure so caller can fallback.
    """
    if not settings.openai_api_key:
        return None

    system = (
        "You are a JSON-extraction assistant. Given a user's transcript, "
        "extract concise factual assertions as a JSON array. Each item should "
        "have keys: subject, predicate, object, confidence (0-1), and source. "
        "Return ONLY valid JSON. If no facts, return an empty array."
    )

    user_prompt = f"Transcript:\n"""{transcript}"""

    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.0,
        "max_tokens": 500,
    }

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            data = r.json()
            content = data.get("choices", [])[0].get("message", {}).get("content", "")
            # Attempt to parse JSON from the model output
            try:
                parsed = json.loads(content)
                if isinstance(parsed, list):
                    return parsed
                # If model returned an object with a field, try to find it
                if isinstance(parsed, dict):
                    # heuristics: look for keys containing 'facts' or 'items'
                    for k in ["facts", "items", "data"]:
                        if k in parsed and isinstance(parsed[k], list):
                            return parsed[k]
            except json.JSONDecodeError:
                # Try to extract JSON substring
                m = re.search(r"(\[\s*\{.*\}\s*\])", content, re.S)
                if m:
                    try:
                        return json.loads(m.group(1))
                    except Exception:
                        logger.exception("Failed to parse JSON substring from OpenAI output")
            return None
    except Exception:
        logger.exception("OpenAI fact extraction failed")
        return None


async def extract_facts(transcript: str) -> List[Dict[str, Any]]:
    """Primary entrypoint: try OpenAI extractor, fall back to rules.
    Returns a list of fact dicts.
    """
    # Try OpenAI extraction first
    try:
        ai_result = await _openai_extract(transcript)
        if ai_result is not None:
            # Ensure each fact has expected keys and types
            sanitized = []
            for item in ai_result:
                if not isinstance(item, dict):
                    continue
                subj = item.get("subject", "user")
                pred = item.get("predicate") or item.get("relation") or "statement"
                obj = item.get("object") or item.get("value") or ""
                conf = float(item.get("confidence", 0.6)) if item.get("confidence") is not None else 0.6
                sanitized.append({"subject": subj, "predicate": pred, "object": obj, "confidence": conf, "source": "openai"})
            if sanitized:
                return sanitized
    except Exception:
        logger.exception("OpenAI extraction attempt raised")

    # Fallback: rule-based
    try:
        return _rule_based_extract(transcript)
    except Exception:
        logger.exception("Rule-based extraction failed")
        return []


def facts_to_kb_updates(facts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Transform extracted facts into KB update payloads suitable for
    persistence. This is a thin mapping and can be adapted to your DB schema.
    """
    updates = []
    for f in facts:
        updates.append({
            "subject": f.get("subject", "user"),
            "predicate": f.get("predicate", "statement"),
            "object": f.get("object", ""),
            "confidence": float(f.get("confidence", 0.5)),
            "source": f.get("source", "extractor"),
        })
    return updates


__all__ = ["extract_facts", "facts_to_kb_updates"]
