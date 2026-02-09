"""
J.A.R.V.I.S. Shared Type Definitions
These types are shared between frontend (React Native) and backend (FastAPI)
"""
from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel


# ============================================
# User & Authentication
# ============================================


class TrustLevel(str, Enum):
    CONSULTANT = "consultant"
    ADVISOR = "advisor"
    MANAGER = "manager"
    EXECUTIVE = "executive"


class User(BaseModel):
    id: str
    email: str
    full_name: str
    trust_level: TrustLevel
    trust_score: int
    created_at: datetime


# ============================================
# Biometric Data
# ============================================


class BiometricSource(str, Enum):
    APPLE_WATCH = "apple_watch"
    MANUAL = "manual"


class BiometricData(BaseModel):
    hrv_ms: float
    bpm: int
    timestamp: datetime
    source: BiometricSource


class BiometricReading(BiometricData):
    id: str
    stress_score: float
    state: "LifeState"
    intervention_needed: bool
    created_at: datetime


# ============================================
# Life States
# ============================================


class LifeState(str, Enum):
    SLEEPING = "sleeping"
    EXERCISING = "exercising"
    WORKING = "working"
    MEETING = "meeting"
    LEISURE = "leisure"
    STRESSED = "stressed"


class ContextPayload(BaseModel):
    location: Optional[str] = None
    next_event: Optional[str] = None
    next_event_time: Optional[datetime] = None
    calendar_events: Optional[List["CalendarEvent"]] = None


class CurrentState(BaseModel):
    state: LifeState
    hrv_ms: float
    bpm: int
    stress_score: float
    last_updated: datetime
    context: ContextPayload


# ============================================
# Context
# ============================================


class CalendarEvent(BaseModel):
    id: str
    title: str
    start_time: datetime
    end_time: datetime
    attendees: int
    is_focus_time: bool


# ============================================
# Conversations & Memory
# ============================================


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class Message(BaseModel):
    id: str
    role: MessageRole
    content: str
    timestamp: datetime
    biometric_snapshot: Optional[BiometricData] = None


class Conversation(BaseModel):
    id: str
    messages: List[Message]
    created_at: datetime
    updated_at: datetime


# ============================================
# Interventions
# ============================================


class InterventionType(str, Enum):
    BREATHING_EXERCISE = "breathing_exercise"
    MOVEMENT_BREAK = "movement_break"
    HYDRATION_REMINDER = "hydration_reminder"
    ENERGY_MANAGEMENT = "energy_management"


class InterventionPriority(str, Enum):
    CRITICAL = "critical"
    IMPORTANT = "important"
    NICE_TO_HAVE = "nice_to_have"


class UserResponse(str, Enum):
    ACCEPTED = "accepted"
    DISMISSED = "dismissed"
    SNOOZED = "snoozed"


class Intervention(BaseModel):
    id: str
    type: InterventionType
    priority: InterventionPriority
    message: str
    confidence: float
    trigger_reason: str
    biometric_values: BiometricData
    created_at: datetime
    user_response: Optional[UserResponse] = None


# ============================================
# Voice Pipeline
# ============================================


class TranscriptionResult(BaseModel):
    text: str
    confidence: float
    duration_ms: int


class VoiceResponse(BaseModel):
    text: str
    audio_url: Optional[str] = None
    biometric_context: Optional[BiometricData] = None


# Update forward references
BiometricReading.model_rebuild()
CurrentState.model_rebuild()
ContextPayload.model_rebuild()
