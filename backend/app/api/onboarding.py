"""
Onboarding interview endpoints

Endpoints implemented:
 - POST /api/v1/onboarding/start  -> create a new onboarding session
 - POST /api/v1/onboarding/{session_id}/answer -> submit an answer/advance
 - GET  /api/v1/onboarding/{session_id}/summary -> get session summary

Sessions are stored in Redis via the working memory helper. On completion
the transcripted answers are run through the fact extractor to generate
KB candidate updates which are stored under `kb_entries` and a short
`kb_summary` is cached.
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from uuid import uuid4
import logging

from app.db.redis_client import redis_client
from app.tasks.fact_extraction import run_extract_facts

router = APIRouter()
logger = logging.getLogger(__name__)

# Simple onboarding question set — adapt as needed
DEFAULT_QUESTIONS = [
    "What's your current role or job title?",
    "What are your top 3 goals for the next 3 months?",
    "Any communication style preferences (concise, verbose, formal)?",
    "Do you have any schedule constraints I should respect?",
    "What are a few things you enjoy or dislike?",
    "Voice preferences (male/female/neutral) or TTS voice?",
]


@router.post("/onboarding/start")
async def start_onboarding(payload: Dict[str, Any]):
    """Start an onboarding session.

    Expects JSON: {"user_id": "...", optional "questions": [..]}
    Returns session_id and first question.
    """
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    questions = payload.get("questions") or DEFAULT_QUESTIONS
    session_id = str(uuid4())
    session = {
        "id": session_id,
        "user_id": user_id,
        "questions": questions,
        "answers": [],
        "current_index": 0,
        "completed": False,
    }

    try:
        await redis_client.set_working_memory(user_id, f"onboarding:{session_id}", session)
        return {"session_id": session_id, "question": questions[0] if questions else None}
    except Exception as e:
        logger.exception("Failed to start onboarding: %s", e)
        raise HTTPException(status_code=500, detail="Failed to start onboarding")


@router.post("/onboarding/{session_id}/answer")
async def continue_onboarding(session_id: str, payload: Dict[str, Any]):
    """Submit an answer and advance the onboarding session.

    Expects JSON: {"user_id": "...", "answer": "..."}
    If session completes, runs fact extraction and stores KB updates.
    """
    user_id = payload.get("user_id")
    answer = payload.get("answer")
    if not user_id or answer is None:
        raise HTTPException(status_code=400, detail="user_id and answer required")

    try:
        session = await redis_client.get_working_memory(user_id, f"onboarding:{session_id}")
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if session.get("completed"):
            return {"status": "already_completed"}

        # Append answer and advance
        session.setdefault("answers", []).append(answer)
        session["current_index"] = session.get("current_index", 0) + 1

        if session["current_index"] >= len(session.get("questions", [])):
            # Completed
            session["completed"] = True
            await redis_client.set_working_memory(user_id, f"onboarding:{session_id}", session)

            # Aggregate answers into a transcript and extract durable KB facts.
            transcript = " \n".join(session.get("answers", []))
            extraction = await run_extract_facts(transcript, user_id)
            summary = await redis_client.get_working_memory(user_id, "kb_summary")

            return {
                "status": "completed",
                "facts_added": extraction.get("updates_applied", 0),
                "summary": summary or "",
            }

        # Not yet complete: save session and return next question
        await redis_client.set_working_memory(user_id, f"onboarding:{session_id}", session)
        next_q = None
        idx = session.get("current_index", 0)
        questions = session.get("questions", [])
        if idx < len(questions):
            next_q = questions[idx]

        return {"status": "in_progress", "next_question": next_q}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error continuing onboarding: %s", e)
        raise HTTPException(status_code=500, detail="Failed to continue onboarding")


@router.get("/onboarding/{session_id}/summary")
async def onboarding_summary(session_id: str, user_id: str):
    """Return onboarding session state and any computed summary."""
    try:
        session = await redis_client.get_working_memory(user_id, f"onboarding:{session_id}")
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        kb_summary = await redis_client.get_working_memory(user_id, "kb_summary")
        return {"session": session, "kb_summary": kb_summary}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching onboarding summary: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch summary")
