
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.db.database import get_db
from app.db import models
from app.schemas.conversation import MessageResponse

router = APIRouter()

@router.post("/messages", response_model=MessageResponse)
async def send_message(payload: dict, db: AsyncSession = Depends(get_db)):
    conversation_id = payload.get("conversationId")
    role = payload.get("role")
    content = payload.get("content")
    if not conversation_id or not role or not content:
        raise HTTPException(status_code=400, detail="Missing fields")
    conv = await db.get(models.Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    msg = models.Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        timestamp=datetime.utcnow(),
    )
    db.add(msg)
    await db.flush()
    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        timestamp=msg.timestamp.isoformat(),
    )

from sqlalchemy import select

@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_messages(conversation_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Message).where(models.Message.conversation_id == conversation_id))
    messages = result.scalars().all()
    return [MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        timestamp=msg.timestamp.isoformat(),
    ) for msg in messages]
