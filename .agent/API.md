# J.A.R.V.I.S. API Reference

Status: current implementation reference. This file should match the FastAPI routes registered in `backend/app/main.py` and `backend/app/api/*`.

## Base URLs

- Development API: `http://localhost:8000`
- Versioned API prefix: `/api/v1`
- WebSocket voice endpoint: `ws://localhost:8000/api/v1/ws/voice/{user_id}`

Health and root endpoints are not versioned.

## Health

### Health Check

```http
GET /health
```

Returns:

```json
{ "status": "healthy", "app": "J.A.R.V.I.S.", "version": "1.0.0" }
```

### Status

```http
GET /api/v1/status
```

## Authentication

### Issue Token

```http
POST /api/v1/auth/token
Content-Type: application/json
```

Standard flow:

```json
{ "email": "user@example.com", "password": "secure_password" }
```

Development/test bootstrap flows:

```json
{ "user_id": "1" }
```

```json
{ "user_id": "1", "dev_auth_secret": "shared-dev-secret" }
```

The `user_id` bootstrap works only when `TEST_MODE=true` or `ALLOW_INSECURE_DEV_AUTH=true` with a matching `DEV_AUTH_SECRET`.

Response:

```json
{ "access_token": "<jwt>", "token_type": "bearer" }
```

### Current User

```http
GET /api/v1/auth/me
Authorization: Bearer <jwt>
```

## Users

### Get Or Create User

```http
PUT /api/v1/users/{user_id}
```

Creates a local placeholder user if it does not already exist.

## Voice And Assistant

### Text Query

```http
POST /api/v1/ai/process
Content-Type: application/json
```

```json
{
  "user_id": "1",
  "query": "What should I focus on today?",
  "context": {}
}
```

Response:

```json
{
  "response": "Assistant response text",
  "memoryUpdated": true,
  "mode": "provider"
}
```

`mode` is `local_fallback` when provider keys are not configured.

### TTS Voices

```http
GET /api/v1/tts/voices
```

### Generate TTS Audio

```http
POST /api/v1/tts
Content-Type: application/json
```

```json
{ "text": "Hello.", "voice": "aura-2-thalia-en", "speed": 1.0, "lang": "en-us" }
```

Returns streamed WAV audio.

## Voice WebSocket

### Connect

```text
ws://localhost:8000/api/v1/ws/voice/{user_id}?token=<jwt>
```

Token behavior:

- Required outside test mode and insecure local dev mode.
- Optional when `TEST_MODE=true`.
- Optional when `ALLOW_INSECURE_DEV_AUTH=true` and `APP_ENV` is not production.

Server sends on connect:

```json
{ "type": "ready" }
```

Client can send binary audio frames or JSON frames:

```json
{
  "type": "audio_chunk",
  "data": "<base64-audio>",
  "file_name": "audio.m4a",
  "mime_type": "audio/mp4"
}
```

Finish an utterance with:

```json
{ "type": "final" }
```

Server messages include:

```json
{ "type": "ack_audio" }
```

```json
{ "type": "stt_start" }
```

```json
{ "type": "stt_done", "transcript": "What should I focus on today?" }
```

```json
{ "type": "context_built", "ms": 187 }
```

```json
{ "type": "llm_chunk", "data": "Start with..." }
```

```json
{ "type": "llm_done", "content": "Start with the client proposal." }
```

```json
{ "type": "tts_audio_chunk", "data": "<base64-wav-chunk>" }
```

```json
{ "type": "tts_audio_done" }
```

## Knowledge Base

Domains:

- `identity`
- `goals`
- `projects`
- `finances`
- `relationships`
- `patterns`

### List User Knowledge

```http
GET /api/v1/kb?user_id=1
```

Returns a flat list of facts across all domains.

### Create Or Update Fact

```http
POST /api/v1/kb
Content-Type: application/json
```

```json
{
  "user_id": "1",
  "domain": "goals",
  "field_name": "financial_target_1yr",
  "field_value": "Reach 8000 EUR/month revenue",
  "confidence": 0.9,
  "source": "manual"
}
```

### Update Fact By ID

```http
PUT /api/v1/kb/{kb_id}
Content-Type: application/json
```

```json
{ "user_id": "1", "field_value": "Updated value", "confidence": 1.0 }
```

### Delete Fact By ID

```http
DELETE /api/v1/kb/{kb_id}?user_id=1
```

### Compact Knowledge Summary

```http
GET /api/v1/kb/summary?user_id=1
```

### Apply Structured Updates

```http
POST /api/v1/kb/apply
Content-Type: application/json
```

```json
{
  "updates": [
    {
      "user_id": "1",
      "domain": "identity",
      "field_name": "role",
      "field_value": "Freelance developer",
      "confidence": 0.95,
      "source": "conversation"
    }
  ]
}
```

### List Domain Items

```http
GET /api/v1/kb/items/{domain}/{user_id}
```

### Extract Candidate Updates

```http
POST /api/v1/kb/extract
Content-Type: application/json
```

```json
{
  "user_id": "1",
  "transcript": "My name is Alice and I work as a nurse.",
  "conversation_id": "optional-conversation-id"
}
```

Returns suggested updates without applying them.

## Onboarding

### Start Session

```http
POST /api/v1/onboarding/start
Content-Type: application/json
```

```json
{ "user_id": "1" }
```

Optional custom questions:

```json
{ "user_id": "1", "questions": ["What are you building right now?"] }
```

### Submit Answer

```http
POST /api/v1/onboarding/{session_id}/answer
Content-Type: application/json
```

```json
{ "user_id": "1", "answer": "I am building JARVIS." }
```

When the final answer is submitted, the backend runs fact extraction and returns `status: "completed"`.

### Session Summary

```http
GET /api/v1/onboarding/{session_id}/summary?user_id=1
```

## Memory

### Search Memory

```http
GET /api/v1/memory/search?user_id=1&query=client%20proposal&top_k=5
```

### Stream Memory Updates

```http
GET /api/v1/stream/memory?user_id=1
Accept: text/event-stream
```

### Upsert Memory Items

```http
POST /api/v1/memory/upsert
Content-Type: application/json
```

```json
{
  "user_id": "1",
  "items": [
    { "title": "goal", "content": "Ship the voice loop this week", "source": "client" }
  ]
}
```

## Conversations And Messages

### Create Conversation

```http
POST /api/v1/conversations
Content-Type: application/json
```

```json
{ "user_id": "1" }
```

### List Conversations

```http
GET /api/v1/conversations?user_id=1
```

### Get Conversation

```http
GET /api/v1/conversations/{conversation_id}
```

### Add Conversation Turn

```http
POST /api/v1/conversations/turn
Content-Type: application/json
```

Persists a user or assistant message, creating a conversation when `conversation_id` is omitted.

### Create Message

```http
POST /api/v1/messages
Content-Type: application/json
```

```json
{ "conversationId": "conversation-id", "role": "user", "content": "Hello" }
```

### List Conversation Messages

```http
GET /api/v1/conversations/{conversation_id}/messages
```

## Notifications

### Register Push Token

```http
POST /api/v1/notifications/register
Content-Type: application/json
```

```json
{ "user_id": "1", "token": "ExponentPushToken[...]" }
```

### Schedule Notification

```http
POST /api/v1/notifications/schedule
Content-Type: application/json
```

```json
{ "user_id": "1", "title": "Reminder", "body": "Check in", "when_ts": 1770000000 }
```

### Queue Check-In

```http
POST /api/v1/notifications/checkin?user_id=1
```

## Not Implemented Yet

These were present in older target specs but should not be treated as current API:

- `POST /auth/login`
- `GET /knowledge`
- `GET /knowledge/{domain}`
- `PATCH /knowledge/{domain}/{field}`
- `POST /onboarding/respond`
- `POST /data/export`
- `DELETE /data/all`
- `/biometrics`, `/interventions`, `/trust`, `/calendar`, `/webhooks`
