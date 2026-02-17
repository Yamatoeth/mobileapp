# J.A.R.V.I.S. API Specification

## Base URL
- Development: `http://localhost:8000/api/v1`
- Production: `https://api.jarvis.app/api/v1`

## Authentication

All authenticated endpoints require a JWT token:
```
Authorization: Bearer <jwt_token>
```

### Login
```http
POST /auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "secure_password" }
```

**Response (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1Qi...",
  "token_type": "bearer",
  "expires_in": 604800,
  "user": { "id": "usr_123abc", "email": "user@example.com", "onboarding_complete": false }
}
```

---

## 1. User Management

### Create User
```http
POST /users
Content-Type: application/json

{ "email": "user@example.com", "password": "secure_password", "full_name": "John Doe" }
```

**Response (201):**
```json
{ "id": "usr_123abc", "email": "user@example.com", "full_name": "John Doe", "onboarding_complete": false, "created_at": "2026-02-17T10:00:00Z" }
```

### Get Profile
```http
GET /users/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "usr_123abc",
  "email": "user@example.com",
  "full_name": "John Doe",
  "onboarding_complete": true,
  "knowledge_base_last_updated": "2026-02-17T09:00:00Z",
  "settings": {
    "wake_word_enabled": false,
    "morning_briefing_enabled": true,
    "morning_briefing_time": "08:00",
    "max_proactive_notifications": 3,
    "voice_id": "jarvis_default"
  },
  "created_at": "2026-01-15T10:00:00Z"
}
```

### Update Settings
```http
PATCH /users/me/settings
Authorization: Bearer <token>
Content-Type: application/json

{ "morning_briefing_enabled": true, "morning_briefing_time": "07:30", "max_proactive_notifications": 2 }
```

---

## 2. Voice Interaction

### WebSocket: Voice Stream
Connect to: `ws://localhost:8000/ws/voice`

This is the primary interaction channel. All voice communication flows through here.

**Client → Server: Audio Chunk**
```json
{ "type": "audio_chunk", "data": "<base64-encoded-audio>", "chunk_index": 1, "is_final": false }
```

**Server → Client: Transcription (streaming)**
```json
{ "type": "transcription_partial", "text": "What should I focus on", "confidence": 0.87 }
```

```json
{ "type": "transcription_final", "text": "What should I focus on today?", "confidence": 0.95, "duration_seconds": 2.1 }
```

**Server → Client: LLM Response (streaming)**
```json
{ "type": "llm_response_chunk", "text": "Based on your projects, ", "is_final": false }
```

```json
{ "type": "llm_response_chunk", "text": "you should prioritise the client proposal.", "is_final": true }
```

**Server → Client: Audio Response (streaming)**
```json
{ "type": "audio_response", "audio_chunk": "<base64-encoded-audio>", "chunk_index": 1, "is_final": false }
```

**Server → Client: Context Used (after response)**
```json
{
  "type": "context_used",
  "knowledge_domains_injected": ["goals", "projects"],
  "memories_retrieved": 3,
  "working_memory_entries": 12,
  "context_build_ms": 187
}
```

### Generate Text Response (REST fallback)
```http
POST /voice/generate
Authorization: Bearer <token>
Content-Type: application/json

{ "query": "What should I focus on today?", "include_context": true }
```

**Response (200):**
```json
{
  "text": "Based on your projects, you should prioritise the client proposal. You mentioned it was due Friday and you have not touched it since Monday.",
  "audio_url": "https://cdn.jarvis.app/audio/resp_789ghi.mp3",
  "processing_time_ms": 1340,
  "context_used": {
    "knowledge_domains": ["projects", "goals"],
    "memories_retrieved": 2,
    "working_memory_entries": 8
  }
}
```

---

## 3. Knowledge Base

The Knowledge Base is the heart of JARVIS. Six domain endpoints follow the same pattern.

### Get Full Knowledge Base
```http
GET /knowledge
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "identity": { "last_updated": "2026-02-10T10:00:00Z", "field_count": 8, "completeness": 0.85 },
  "goals": { "last_updated": "2026-02-15T14:00:00Z", "field_count": 12, "completeness": 0.90 },
  "projects": { "last_updated": "2026-02-17T09:00:00Z", "field_count": 6, "completeness": 0.75 },
  "finances": { "last_updated": "2026-02-01T10:00:00Z", "field_count": 10, "completeness": 0.60 },
  "relationships": { "last_updated": "2026-02-12T10:00:00Z", "field_count": 15, "completeness": 0.80 },
  "patterns": { "last_updated": "2026-02-16T10:00:00Z", "field_count": 7, "completeness": 0.70 }
}
```

### Get Domain
```http
GET /knowledge/{domain}
Authorization: Bearer <token>
```

**Path params:** `domain` = `identity` | `goals` | `projects` | `finances` | `relationships` | `patterns`

**Response (200):**
```json
{
  "domain": "goals",
  "fields": [
    { "field": "financial_target_1yr", "value": "Reach €5000/month revenue from freelance", "confidence": 0.92, "last_updated": "2026-02-15T14:00:00Z", "source": "conversation" },
    { "field": "career_direction", "value": "Build own SaaS product while maintaining freelance income", "confidence": 0.88, "last_updated": "2026-02-10T10:00:00Z", "source": "onboarding" }
  ],
  "completeness": 0.90
}
```

### Update Field
```http
PATCH /knowledge/{domain}/{field}
Authorization: Bearer <token>
Content-Type: application/json

{ "value": "Reach €8000/month revenue from freelance", "source": "manual" }
```

**Response (200):**
```json
{ "domain": "goals", "field": "financial_target_1yr", "value": "Reach €8000/month revenue from freelance", "confidence": 1.0, "source": "manual", "updated_at": "2026-02-17T14:00:00Z" }
```

### Get Knowledge Update History
```http
GET /knowledge/updates?limit=20&domain=goals
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "updates": [
    {
      "id": "upd_abc123",
      "domain": "goals",
      "field": "financial_target_1yr",
      "old_value": "Reach €5000/month",
      "new_value": "Reach €8000/month",
      "source": "manual",
      "conversation_id": null,
      "updated_at": "2026-02-17T14:00:00Z"
    }
  ]
}
```

---

## 4. Onboarding

### Start Onboarding Interview
```http
POST /onboarding/start
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "session_id": "onb_456def",
  "first_question": "Let's start with who you are right now — not your job title, but how you see yourself and where you are in life.",
  "domain": "identity",
  "domain_index": 1,
  "total_domains": 6
}
```

### Continue Onboarding
```http
POST /onboarding/respond
Authorization: Bearer <token>
Content-Type: application/json

{ "session_id": "onb_456def", "response": "I'm a freelance developer, 28, working on building my own product on the side..." }
```

**Response (200):**
```json
{
  "session_id": "onb_456def",
  "next_question": "When you say you want to build your own product — what does success look like for that in three years?",
  "domain": "identity",
  "domain_index": 1,
  "total_domains": 6,
  "domain_complete": false
}
```

### Complete Onboarding
```http
POST /onboarding/complete
Authorization: Bearer <token>
Content-Type: application/json

{ "session_id": "onb_456def" }
```

**Response (200):**
```json
{
  "knowledge_base_populated": true,
  "fields_extracted": 47,
  "domains_complete": 6,
  "summary": "Based on our conversation, here is what I now know about you...",
  "review_required": true
}
```

---

## 5. Memory

### Search Memory
```http
POST /memory/search
Authorization: Bearer <token>
Content-Type: application/json

{ "query": "times I talked about the client project", "limit": 5 }
```

**Response (200):**
```json
{
  "results": [
    {
      "id": "mem_101abc",
      "date": "2026-02-14",
      "summary": "Discussed client proposal delays. Felt stuck on pricing section. Decided to send a draft by Friday.",
      "relevance_score": 0.94
    }
  ],
  "total": 3,
  "query_processed_in_ms": 212
}
```

### Get Conversation History
```http
GET /memory/conversations?page=1&per_page=20
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "conversations": [
    {
      "id": "conv_789xyz",
      "date": "2026-02-17",
      "summary": "Asked about focus priorities. Discussed client proposal. JARVIS flagged that project X has not been mentioned in 10 days.",
      "exchange_count": 4,
      "duration_seconds": 183
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 47 }
}
```

### Get Daily Summary
```http
GET /memory/summaries/2026-02-17
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "date": "2026-02-17",
  "summary": "Three conversations. Main topics: client proposal progress, financial goal reassessment, project X status.",
  "knowledge_updates": 3,
  "conversation_count": 3,
  "highlights": [
    "Financial target updated from €5000 to €8000/month",
    "Client proposal deadline noted: this Friday",
    "Project X flagged as stalled — 10 days since last mention"
  ]
}
```

---

## 6. Proactive Intelligence (Phase 2)

### Get Morning Briefing
```http
GET /intelligence/briefing
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "date": "2026-02-17",
  "briefing_text": "Good morning. Three things today: your client proposal is due Friday and you have not worked on it since Monday. Project X is stalled — you should decide today whether to continue or park it. Your financial goal revision from last week needs a concrete action plan.",
  "audio_url": "https://cdn.jarvis.app/audio/brief_2026-02-17.mp3",
  "active_projects": 3,
  "flagged_goals": 1,
  "stalled_projects": 1
}
```

### Get Patterns
```http
GET /intelligence/patterns
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "patterns": [
    { "id": "pat_001", "description": "You mention work-life balance concerns every Monday but rarely follow through on the changes you propose.", "confidence": 0.82, "first_detected": "2026-02-03", "occurrence_count": 3 },
    { "id": "pat_002", "description": "You have not mentioned your fitness goal since onboarding (23 days ago).", "confidence": 0.95, "first_detected": "2026-02-17", "occurrence_count": 1 }
  ]
}
```

---

## 7. Data Management

### Export All Data
```http
POST /data/export
Authorization: Bearer <token>
```

**Response (202):**
```json
{ "export_id": "exp_xyz789", "status": "processing", "estimated_seconds": 30 }
```

```http
GET /data/export/exp_xyz789
Authorization: Bearer <token>
```

**Response (200):**
```json
{ "export_id": "exp_xyz789", "status": "complete", "download_url": "https://cdn.jarvis.app/exports/exp_xyz789.json", "expires_at": "2026-02-18T14:00:00Z" }
```

### Delete All Data
```http
DELETE /data/all
Authorization: Bearer <token>
Content-Type: application/json

{ "confirm": "DELETE_ALL_MY_DATA", "reason": "privacy" }
```

**Response (200):**
```json
{ "deleted": true, "knowledge_base_cleared": true, "conversations_cleared": true, "vectors_cleared": true, "account_status": "data_cleared" }
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "KNOWLEDGE_BASE_NOT_FOUND",
    "message": "No knowledge base found. Complete onboarding first.",
    "details": { "onboarding_complete": false }
  }
}
```

**Common codes:**

| HTTP | Code | Meaning |
|------|------|---------|
| 401 | `UNAUTHORIZED` | Invalid or expired token |
| 403 | `ONBOARDING_REQUIRED` | Action requires completed onboarding |
| 404 | `RESOURCE_NOT_FOUND` | Requested resource does not exist |
| 422 | `VALIDATION_ERROR` | Invalid request data |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |

---

## Rate Limits

| Endpoint group | Limit |
|---------------|-------|
| REST endpoints | 100 req/min per user |
| WebSocket voice | 1 concurrent connection per user |
| Memory search | 20 req/min |
| Knowledge updates | 50 req/min |
| Auth | 5 attempts/min per IP |

---

## Removed from API (vs original spec)

The following endpoints from the original API.md have been **removed** as they are not part of the new vision:

- ❌ All `/biometrics` endpoints — no biometric monitoring in v1
- ❌ All `/interventions` endpoints — no intervention engine in v1
- ❌ All `/trust` endpoints — trust system removed
- ❌ `/calendar` endpoints — Phase 3 only, not yet specified
- ❌ `/webhooks` — Phase 3 only
- ❌ WebSocket `/ws/biometrics` — removed