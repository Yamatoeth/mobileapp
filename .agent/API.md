# J.A.R.V.I.S. API Specification

## Base URL
- Development: `http://localhost:8000/api/v1`
- Production: `https://api.jarvis.app/api/v1`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Obtain Token
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 604800,
  "user": {
    "id": "usr_123abc",
    "email": "user@example.com",
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

## REST Endpoints

### 1. User Management

#### Create User
```http
POST /users
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "full_name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "id": "usr_123abc",
  "email": "user@example.com",
  "full_name": "John Doe",
  "created_at": "2025-01-15T10:00:00Z",
  "trust_level": "consultant"
}
```

#### Get User Profile
```http
GET /users/me
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "usr_123abc",
  "email": "user@example.com",
  "full_name": "John Doe",
  "trust_level": "advisor",
  "trust_score": 72,
  "settings": {
    "notifications_enabled": true,
    "voice_interruptions_enabled": false
  },
  "created_at": "2025-01-15T10:00:00Z"
}
```

#### Update User Settings
```http
PATCH /users/me/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "notifications_enabled": false,
  "voice_interruptions_enabled": true
}
```

**Response (200 OK):**
```json
{
  "notifications_enabled": false,
  "voice_interruptions_enabled": true,
  "updated_at": "2025-02-09T14:30:00Z"
}
```

---

### 2. Biometric Data

#### Submit Biometric Data
```http
POST /biometrics
Authorization: Bearer <token>
Content-Type: application/json

{
  "hrv_ms": 45.2,
  "bpm": 72,
  "timestamp": "2025-02-09T14:30:00Z",
  "source": "apple_watch"
}
```

**Response (201 Created):**
```json
{
  "id": "bio_456def",
  "hrv_ms": 45.2,
  "bpm": 72,
  "timestamp": "2025-02-09T14:30:00Z",
  "stress_score": 0.3,
  "state": "working",
  "intervention_needed": false,
  "created_at": "2025-02-09T14:30:01Z"
}
```

#### Get Biometric History
```http
GET /biometrics?start_date=2025-02-08T00:00:00Z&end_date=2025-02-09T23:59:59Z
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "timestamp": "2025-02-09T14:30:00Z",
      "hrv_ms": 45.2,
      "bpm": 72,
      "stress_score": 0.3,
      "state": "working"
    },
    {
      "timestamp": "2025-02-09T14:25:00Z",
      "hrv_ms": 43.8,
      "bpm": 75,
      "stress_score": 0.35,
      "state": "working"
    }
  ],
  "total": 288,
  "start_date": "2025-02-08T00:00:00Z",
  "end_date": "2025-02-09T23:59:59Z"
}
```

#### Get Current State
```http
GET /biometrics/current
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "state": "working",
  "hrv_ms": 45.2,
  "bpm": 72,
  "stress_score": 0.3,
  "last_updated": "2025-02-09T14:30:00Z",
  "context": {
    "location": "office",
    "next_event": "Q4 Planning Meeting",
    "next_event_time": "2025-02-09T15:00:00Z"
  }
}
```

---

### 3. Voice Interaction

#### Transcribe Audio
```http
POST /voice/transcribe
Authorization: Bearer <token>
Content-Type: multipart/form-data

audio: <binary audio file (WAV, 16kHz)>
```

**Response (200 OK):**
```json
{
  "text": "How stressed am I right now?",
  "confidence": 0.95,
  "duration_seconds": 2.3,
  "processed_in_ms": 487
}
```

#### Generate Response
```http
POST /voice/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "How stressed am I right now?",
  "include_context": true
}
```

**Response (200 OK):**
```json
{
  "text": "Based on your current HRV of 45ms and heart rate of 72bpm, you're in a calm state. Your next meeting is in 30 minutes, so this is a good time to prepare.",
  "audio_url": "https://cdn.jarvis.app/audio/resp_789ghi.mp3",
  "processing_time_ms": 1234,
  "context_used": {
    "hrv_ms": 45.2,
    "bpm": 72,
    "state": "working",
    "next_event": "Q4 Planning Meeting"
  }
}
```

---

### 4. Memory & Context

#### Search Memory
```http
POST /memory/search
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "times I was stressed before presentations",
  "limit": 5
}
```

**Response (200 OK):**
```json
{
  "results": [
    {
      "id": "mem_101abc",
      "date": "2025-02-05",
      "summary": "High stress before product demo. HRV dropped to 28ms.",
      "relevance_score": 0.92,
      "context": {
        "hrv_ms": 28.0,
        "bpm": 95,
        "event": "Product Demo to Investors"
      }
    },
    {
      "id": "mem_102def",
      "date": "2025-01-28",
      "summary": "Elevated stress before team presentation. Used breathing exercise.",
      "relevance_score": 0.87,
      "context": {
        "hrv_ms": 32.0,
        "bpm": 88,
        "event": "Team All-Hands"
      }
    }
  ],
  "total": 5,
  "query_processed_in_ms": 267
}
```

#### Get Daily Summary
```http
GET /memory/summaries/2025-02-09
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "date": "2025-02-09",
  "summary": "Overall calm day with one stress spike during afternoon meeting. Completed 2 movement breaks. HRV average: 42ms.",
  "metrics": {
    "avg_hrv_ms": 42.0,
    "avg_bpm": 75,
    "avg_stress_score": 0.35,
    "interventions_triggered": 3,
    "interventions_accepted": 2
  },
  "highlights": [
    "Longest focus session: 2.5 hours (9am-11:30am)",
    "Stress spike: 2pm meeting (HRV dropped to 30ms)",
    "Best HRV of day: 52ms at 10am"
  ]
}
```

---

### 5. Interventions

#### Get Intervention History
```http
GET /interventions?start_date=2025-02-08&end_date=2025-02-09
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "int_201xyz",
      "type": "breathing_exercise",
      "severity": "medium",
      "trigger_reason": "HRV dropped to 28ms during meeting",
      "message": "Your stress is rising. Take a 2-minute breathing break.",
      "triggered_at": "2025-02-09T14:05:00Z",
      "user_response": "accepted",
      "outcome": "HRV increased to 35ms after exercise",
      "confidence_score": 0.88
    },
    {
      "id": "int_202abc",
      "type": "movement_break",
      "severity": "low",
      "trigger_reason": "Sedentary for 105 minutes",
      "message": "You've been sitting for 1.5 hours. Time for a quick walk.",
      "triggered_at": "2025-02-09T11:45:00Z",
      "user_response": "dismissed",
      "outcome": null,
      "confidence_score": 0.75
    }
  ],
  "total": 2,
  "acceptance_rate": 0.5
}
```

#### Provide Intervention Feedback
```http
POST /interventions/int_201xyz/feedback
Authorization: Bearer <token>
Content-Type: application/json

{
  "helpful": true,
  "comment": "Great timing, really needed that break"
}
```

**Response (200 OK):**
```json
{
  "intervention_id": "int_201xyz",
  "feedback_recorded": true,
  "updated_at": "2025-02-09T14:10:00Z"
}
```

---

### 6. Trust System

#### Get Trust Status
```http
GET /trust
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "current_level": "advisor",
  "trust_score": 72,
  "next_level": "manager",
  "next_level_threshold": 75,
  "progress_to_next": 0.96,
  "permissions": {
    "can_send_notifications": true,
    "can_interrupt_voice": false,
    "can_modify_calendar": false,
    "can_draft_messages": false
  },
  "metrics": {
    "intervention_acceptance_rate": 0.78,
    "days_active": 14,
    "feedback_sentiment": 0.85
  }
}
```

#### Manually Override Trust Level
```http
POST /trust/override
Authorization: Bearer <token>
Content-Type: application/json

{
  "new_level": "manager",
  "reason": "User manually granted permission"
}
```

**Response (200 OK):**
```json
{
  "current_level": "manager",
  "trust_score": 72,
  "manually_overridden": true,
  "updated_at": "2025-02-09T14:30:00Z"
}
```

---

### 7. Calendar Integration (Phase 3)

#### Get Today's Events
```http
GET /calendar/events/today
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "events": [
    {
      "id": "evt_301abc",
      "title": "Q4 Planning Meeting",
      "start_time": "2025-02-09T15:00:00Z",
      "end_time": "2025-02-09T16:00:00Z",
      "attendees": 5,
      "location": "Conference Room A",
      "priority": "high"
    },
    {
      "id": "evt_302def",
      "title": "1:1 with Sarah",
      "start_time": "2025-02-09T17:00:00Z",
      "end_time": "2025-02-09T17:30:00Z",
      "attendees": 1,
      "location": null,
      "priority": "medium"
    }
  ],
  "total": 2
}
```

#### Reschedule Event (Requires Manager Trust)
```http
POST /calendar/events/evt_302def/reschedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "new_start_time": "2025-02-10T10:00:00Z",
  "reason": "User stress level too high today"
}
```

**Response (200 OK):**
```json
{
  "event_id": "evt_302def",
  "old_start_time": "2025-02-09T17:00:00Z",
  "new_start_time": "2025-02-10T10:00:00Z",
  "rescheduled": true,
  "notification_sent_to_attendees": true
}
```

---

## WebSocket Endpoints

### Voice Streaming

Connect to: `ws://localhost:8000/ws/voice`

**Client → Server: Audio Chunk**
```json
{
  "type": "audio_chunk",
  "data": "<base64-encoded audio>",
  "chunk_index": 1,
  "is_final": false
}
```

**Server → Client: Partial Transcription**
```json
{
  "type": "transcription_partial",
  "text": "How stressed am I",
  "confidence": 0.87
}
```

**Server → Client: Final Transcription**
```json
{
  "type": "transcription_final",
  "text": "How stressed am I right now?",
  "confidence": 0.95,
  "duration_seconds": 2.3
}
```

**Server → Client: LLM Response Stream**
```json
{
  "type": "llm_response_chunk",
  "text": "Based on your current ",
  "is_final": false
}
```

**Server → Client: Audio Response**
```json
{
  "type": "audio_response",
  "audio_chunk": "<base64-encoded audio>",
  "chunk_index": 1,
  "is_final": false
}
```

### Biometric Real-Time Updates

Connect to: `ws://localhost:8000/ws/biometrics`

**Client → Server: Subscribe**
```json
{
  "type": "subscribe",
  "user_id": "usr_123abc"
}
```

**Server → Client: Biometric Update**
```json
{
  "type": "biometric_update",
  "hrv_ms": 45.2,
  "bpm": 72,
  "stress_score": 0.3,
  "state": "working",
  "timestamp": "2025-02-09T14:30:00Z"
}
```

**Server → Client: Intervention Notification**
```json
{
  "type": "intervention",
  "id": "int_201xyz",
  "severity": "medium",
  "message": "Your HRV is dropping. Take a 2-minute break.",
  "actions": ["accept", "dismiss", "snooze_30min"],
  "timestamp": "2025-02-09T14:05:00Z"
}
```

**Client → Server: Intervention Response**
```json
{
  "type": "intervention_response",
  "intervention_id": "int_201xyz",
  "action": "accept"
}
```

---

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "INVALID_BIOMETRIC_DATA",
    "message": "HRV value must be positive",
    "details": {
      "field": "hrv_ms",
      "value": -5.2,
      "constraint": "must be > 0"
    }
  }
}
```

### Common Error Codes

**Authentication (401)**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

**Permission Denied (403)**
```json
{
  "error": {
    "code": "INSUFFICIENT_TRUST_LEVEL",
    "message": "Calendar modification requires Manager trust level",
    "details": {
      "current_level": "advisor",
      "required_level": "manager"
    }
  }
}
```

**Not Found (404)**
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Intervention not found",
    "details": {
      "intervention_id": "int_999xyz"
    }
  }
}
```

**Validation Error (422)**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "hrv_ms",
        "error": "field required"
      },
      {
        "field": "bpm",
        "error": "must be between 40 and 200"
      }
    ]
  }
}
```

**Rate Limit (429)**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "limit": 100,
      "window": "60 seconds",
      "retry_after": 45
    }
  }
}
```

**Server Error (500)**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "request_id": "req_abc123"
  }
}
```

---

## Rate Limits

**Per User:**
- REST endpoints: 100 requests/minute
- WebSocket connections: 1 concurrent connection
- Voice transcription: 10 requests/minute
- Memory search: 20 requests/minute

**Global:**
- Authentication: 5 attempts/minute per IP
- User registration: 3 accounts/hour per IP

---

## Pagination

Endpoints that return lists support pagination:

```http
GET /biometrics?page=2&per_page=50
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "per_page": 50,
    "total_items": 1234,
    "total_pages": 25,
    "has_next": true,
    "has_prev": true
  }
}
```

---

## Filtering & Sorting

**Filtering:**
```http
GET /interventions?type=breathing_exercise&severity=medium
```

**Sorting:**
```http
GET /biometrics?sort_by=timestamp&order=desc
```

---

## Webhooks (Phase 3)

Users can register webhooks to receive events:

```http
POST /webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com/jarvis-webhook",
  "events": ["intervention.triggered", "state.changed"],
  "secret": "webhook_secret_key"
}
```

**Webhook Payload:**
```json
{
  "event": "intervention.triggered",
  "timestamp": "2025-02-09T14:05:00Z",
  "data": {
    "intervention_id": "int_201xyz",
    "type": "breathing_exercise",
    "severity": "medium",
    "user_id": "usr_123abc"
  },
  "signature": "sha256=..."
}
```

---

## SDK Examples

### Python SDK
```python
from jarvis_sdk import JarvisClient

client = JarvisClient(api_key="your_api_key")

# Submit biometric data
client.biometrics.submit(hrv_ms=45.2, bpm=72)

# Get current state
state = client.biometrics.current()
print(f"Current state: {state.state}")
print(f"Stress score: {state.stress_score}")

# Search memory
results = client.memory.search("times I was stressed")
for result in results:
    print(f"{result.date}: {result.summary}")
```

### JavaScript/TypeScript SDK
```typescript
import { JarvisClient } from '@jarvis/sdk';

const client = new JarvisClient({ apiKey: 'your_api_key' });

// Submit biometric data
await client.biometrics.submit({
  hrvMs: 45.2,
  bpm: 72,
  timestamp: new Date(),
});

// Get current state
const state = await client.biometrics.current();
console.log(`Current state: ${state.state}`);
console.log(`Stress score: ${state.stressScore}`);

// WebSocket connection
const ws = client.biometrics.subscribe((update) => {
  console.log(`New HRV: ${update.hrvMs}`);
});
```

---

## Versioning

API versions are specified in the URL path:
- `/api/v1/...` - Current stable version
- `/api/v2/...` - Next version (when released)

**Deprecation Policy:**
- Breaking changes require new version
- Old versions supported for 12 months after new version release
- Deprecation warnings included in response headers

**Response Header:**
```
X-API-Version: v1
X-API-Deprecation-Date: 2026-02-09
```

---

This API is designed for **performance**, **security**, and **extensibility**. All endpoints are versioned, rate-limited, and include comprehensive error handling.
