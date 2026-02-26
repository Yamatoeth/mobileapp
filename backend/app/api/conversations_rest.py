from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db import models
from app.schemas.conversation import ConversationResponse

router = APIRouter()

@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(payload: dict, db: AsyncSession = Depends(get_db)):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    user = await db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    conv = models.Conversation(user_id=user_id)
    db.add(conv)
    await db.flush()
    return ConversationResponse(id=conv.id, user_id=conv.user_id, created_at=str(conv.created_at))

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    conv = await db.get(models.Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    return ConversationResponse(id=conv.id, user_id=conv.user_id, created_at=str(conv.created_at))

from sqlalchemy import select

@router.get("/conversations", response_model=list[ConversationResponse])
async def get_conversations(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Conversation).where(models.Conversation.user_id == user_id))
    conversations = result.scalars().all()
    return [ConversationResponse(id=conv.id, user_id=conv.user_id, created_at=str(conv.created_at)) for conv in conversations]
