from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    role: str = Field(..., description="Role of the message: 'user' or 'assistant'")
    content: str
    hrv_snapshot: Optional[float] = None
    bpm_snapshot: Optional[int] = None


class ConversationTurn(BaseModel):
    user_id: str = Field(..., description="Existing user id")
    conversation_id: Optional[str] = None
    message: MessageCreate


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    hrv_snapshot: Optional[float] = None
    bpm_snapshot: Optional[int] = None
    timestamp: str


class ConversationResponse(BaseModel):
    id: str
    user_id: str
    created_at: str
