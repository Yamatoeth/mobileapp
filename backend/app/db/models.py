"""
SQLAlchemy database models
"""
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def generate_uuid() -> str:
    """Generate a UUID string."""
    return str(uuid4())


class TrustLevel(str, PyEnum):
    """User trust levels with escalating permissions."""
    CONSULTANT = "consultant"
    ADVISOR = "advisor"
    MANAGER = "manager"
    EXECUTIVE = "executive"


class LifeState(str, PyEnum):
    """Discrete life states for context-aware responses."""
    SLEEPING = "sleeping"
    EXERCISING = "exercising"
    WORKING = "working"
    MEETING = "meeting"
    LEISURE = "leisure"
    STRESSED = "stressed"


class User(Base):
    """User model with trust system."""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    trust_level: Mapped[TrustLevel] = mapped_column(
        Enum(TrustLevel), default=TrustLevel.CONSULTANT
    )
    trust_score: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    biometrics: Mapped[list["BiometricReading"]] = relationship(back_populates="user")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user")


class BiometricReading(Base):
    """Biometric data readings from Apple Watch / HealthKit."""
    __tablename__ = "biometric_readings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    hrv_ms: Mapped[float] = mapped_column(Float)
    bpm: Mapped[int] = mapped_column(Integer)
    stress_score: Mapped[float] = mapped_column(Float, default=0.0)
    state: Mapped[LifeState] = mapped_column(Enum(LifeState), default=LifeState.LEISURE)
    source: Mapped[str] = mapped_column(String(50), default="apple_watch")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="biometrics")


class Conversation(Base):
    """Conversation session container."""
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation")


class Message(Base):
    """Individual message within a conversation."""
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text)
    # Biometric snapshot at time of message
    hrv_snapshot: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bpm_snapshot: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


class Intervention(Base):
    """Proactive intervention log."""
    __tablename__ = "interventions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    intervention_type: Mapped[str] = mapped_column(String(50))
    priority: Mapped[str] = mapped_column(String(20))
    message: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    trigger_reason: Mapped[str] = mapped_column(Text)
    # Biometric values at trigger time
    hrv_at_trigger: Mapped[float] = mapped_column(Float)
    bpm_at_trigger: Mapped[int] = mapped_column(Integer)
    # User response
    user_response: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
