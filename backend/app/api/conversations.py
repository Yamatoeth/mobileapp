from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.schemas.conversation import ConversationTurn, ConversationResponse, MessageResponse
from app.db.database import get_db
from app.db import models

router = APIRouter()


@router.post("/conversations/turn", response_model=MessageResponse)
async def add_conversation_turn(payload: ConversationTurn, db: AsyncSession = Depends(get_db)):
    """Create or append a conversation and persist a message turn."""
    # Verify user exists
    user = await db.get(models.User, payload.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")

    # Use existing conversation or create one
    conv = None
    if payload.conversation_id:
        conv = await db.get(models.Conversation, payload.conversation_id)
        if conv is None or conv.user_id != payload.user_id:
            raise HTTPException(status_code=404, detail="conversation not found for user")
    else:
        conv = models.Conversation(user_id=payload.user_id)
        db.add(conv)
        await db.flush()  # populate conv.id

    # Create message
    msg = models.Message(
        conversation_id=conv.id,
        role=payload.message.role,
        content=payload.message.content,
        hrv_snapshot=payload.message.hrv_snapshot,
        bpm_snapshot=payload.message.bpm_snapshot,
        timestamp=datetime.utcnow(),
    )
    db.add(msg)
    await db.flush()

    # Commit handled by dependency context manager in get_db

    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        hrv_snapshot=msg.hrv_snapshot,
        bpm_snapshot=msg.bpm_snapshot,
        timestamp=msg.timestamp.isoformat(),
    )
