"""
J.A.R.V.I.S. shared type definitions.

Phase 1 keeps the durable user model in PostgreSQL Knowledge Base tables and
keeps biometric, location, calendar, and intervention surfaces out of scope.
"""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


KnowledgeDomain = Literal[
    "identity",
    "goals",
    "projects",
    "finances",
    "relationships",
    "patterns",
]


class User(BaseModel):
    id: str
    email: str
    full_name: str
    created_at: datetime


class Message(BaseModel):
    id: str
    role: Literal["user", "assistant", "system"]
    content: str
    timestamp: datetime
    audio_url: Optional[str] = None


class Conversation(BaseModel):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class KnowledgeFact(BaseModel):
    id: str
    domain: KnowledgeDomain
    field_name: str
    field_value: str
    confidence: float
    source: str
    last_updated: datetime


class KnowledgeUpdate(BaseModel):
    id: str
    user_id: str
    conversation_id: Optional[str] = None
    table_name: str
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    confidence: float
    source: str
    created_at: datetime


class TranscriptionResult(BaseModel):
    text: str
    confidence: Optional[float] = None
    duration_ms: Optional[int] = None


class VoiceResponse(BaseModel):
    text: str
    audio_url: Optional[str] = None
    memory_updated: bool = False
