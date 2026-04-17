# J.A.R.V.I.S. Technical Stack

  ## Overview

  ```
  ┌─────────────────────────────────────────────────────────┐
  │              iOS App (React Native + Expo)               │
  │         VoiceScreen · HistoryScreen · KnowledgeScreen   │
  └─────────────────────────────────────────────────────────┘
                          ▲ ▼ WSS + HTTPS
  ┌─────────────────────────────────────────────────────────┐
  │             Backend (FastAPI + Python 3.12)              │
  │     Context Builder · Fact Extractor · Prompt Engine    │
  └─────────────────────────────────────────────────────────┘
          ▲               ▲               ▲               ▲
          │               │               │               │
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │  PostgreSQL  │ │   Pinecone   │ │    Redis     │ │    Celery    │
  │ Knowledge    │ │  Episodic    │ │  Working     │ │  Background  │
  │    Base      │ │   Memory     │ │   Memory     │ │    Jobs      │
  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
          ▲               ▲               ▲
          │               │               │
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │   Deepgram   │ │    Groq      │ │   Deepgram   │
  │ Flux/Nova STT│ │ GPT-OSS LLM │ │   Aura TTS   │
  └──────────────┘ └──────────────┘ └──────────────┘
  ```

Phase 1 source of truth: production voice uses Deepgram STT, Groq LLM inference, and Deepgram Aura TTS. Kokoro is allowed only as a local development fallback. OpenAI Realtime and ElevenLabs are future premium/provider options, not Phase 1 defaults.

---

## Frontend

### Core Framework

**React Native with Expo SDK 54+**
```bash
npm install
```
Why: iOS-first, single codebase, managed workflow, and a custom dev-client path when native modules are required.

**TypeScript 5.9+ (strict mode)**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### State Management

**Zustand 5+**
```bash
npm install zustand
```
Four stores: `voiceStore`, `conversationStore`, `knowledgeStore`, `settingsStore`. Flat state only, no nested objects.

### Navigation

**React Navigation 7**
```bash
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
```
Stack navigator with four screens: VoiceScreen (default), HistoryScreen, KnowledgeScreen, SettingsScreen. OnboardingScreen added as modal on first launch.

### Audio

**expo-audio**
```bash
npx expo install expo-audio
```
Records microphone input for the backend-owned voice pipeline. `expo-av` is deprecated and must not be used for new Phase 1 audio work.

### Animation

**React Native Reanimated 4**
```bash
npx expo install react-native-reanimated
```
Required for the arc-reactor pulse animation and voice waveform. 60fps on device.

### Notifications

**expo-notifications** (Phase 2+)
```bash
npx expo install expo-notifications
```
Used for future JARVIS-initiated briefings and proactive check-ins. Not used in Phase 1.

### package.json scripts

```json
{
  "scripts": {
    "start": "expo start",
    "start:go": "expo start --go --tunnel",
    "start:dev-client": "expo start --dev-client --tunnel",
    "backend": "cd backend && .venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000",
    "ios": "expo run:ios",
    "android": "expo run:android",
    "test": "jest",
    "type-check": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "pretty": "prettier --check package.json app.json tsconfig.json eas.json",
    "format": "prettier --write package.json app.json tsconfig.json eas.json"
  }
}
```

---

## Backend

### Core Framework

**FastAPI 0.109+ with Python 3.12**
```bash
pip install fastapi[all] uvicorn[standard]
```
Why: async WebSocket support out of the box, automatic OpenAPI docs, Pydantic validation built in, fast enough for our latency requirements.

**Uvicorn** as ASGI server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Database & ORM

**SQLAlchemy 2.0+ (async mode)**
```bash
pip install sqlalchemy[asyncio] asyncpg
```
Async engine required — never block the voice pipeline on a DB query.

**Alembic 1.13+** for migrations:
```bash
pip install alembic
alembic init alembic
alembic revision --autogenerate -m "Initial Knowledge Base schema"
alembic upgrade head
```

**PostgreSQL 16** — local via Docker, production via Supabase or Railway managed DB.

The Knowledge Base lives here. Six domain tables, a `knowledge_updates` change log, users table, and conversations table.

### Working Memory

**Redis 7.2**
```bash
pip install redis[hiredis]
```
Stores last 30 conversation summaries per user as a JSON list with 30-day TTL. All reads happen in the hot path, so this must be fast — target under 20ms.

```python
# Key pattern: working_memory:{user_id}
# Structure: JSON list of {date, summary, exchange_count} dicts
# TTL: 30 days
# Max entries: 30 (sliding window, pop oldest when adding newest)
```

### Episodic Memory

**Pinecone**
```bash
pip install pinecone-client
```
Index configuration:
- Dimensions: 1536 (OpenAI text-embedding-3-small)
- Metric: cosine
- Name: `jarvis-memory`

After each conversation, generate an embedding of the summary and upsert to Pinecone with metadata: `{user_id, date, topic_tags, conversation_id}`.

On each voice call, semantic search with the current query returns top 5 relevant past conversations. These form Layer 4 of the prompt.

### LLM

**Groq**
```bash
pip install httpx
```
Default Phase 1 model: `openai/gpt-oss-120b`. Fast/cheap fallback for simple commands: `llama-3.1-8b-instant`. Always use streaming where the endpoint supports it. First token should arrive in under 800ms after context build.

**OpenAI text-embedding-3-small** for Pinecone embeddings (background jobs only, not in hot path).

### STT

**Deepgram Flux/Nova-3**
```bash
pip install deepgram-sdk
```
Default Phase 1 STT provider. Use Flux for voice-agent turn handling where available; otherwise use Nova-3. Groq Whisper may remain a fallback adapter, but not the production default.

### TTS

**Deepgram Aura**
```bash
pip install httpx
```
Default Phase 1 TTS provider. Use Aura-1 when cost matters most and Aura-2 when quality matters more. Kokoro ONNX remains a local development fallback.

### Provider Boundary

All voice/AI providers must be accessed through backend interfaces:

```python
STTProvider
LLMProvider
TTSProvider
EmbeddingProvider
```

Routes and core services depend on these interfaces, not on provider-specific SDKs. This keeps Deepgram/Groq/Kokoro/OpenAI as swappable adapters rather than competing architectures.

### Background Jobs

**Celery 5.3+**
```bash
pip install celery[redis]
```
Uses Redis as broker. One critical task: `extract_facts_from_conversation` runs after every completed conversation. This task extracts structured facts and writes to PostgreSQL domain tables plus `knowledge_updates`. Redis may cache summaries, but it is not the durable Knowledge Base.

One weekly task: `analyse_patterns` runs every Sunday night, analyses the past 30 days of conversations for behavioural patterns, and writes findings to the `knowledge_patterns` table.

```python
# celery worker start command:
celery -A app.tasks.celery_app worker --loglevel=info
```

### HTTP Client

**HTTPX**
```bash
pip install httpx
```
Async HTTP client for all outbound API calls. Never use `requests` (sync, blocks event loop).

### requirements.txt

```
# Core
fastapi[all]==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6
httpx==0.26.0
python-dotenv==1.0.0
pydantic==2.5.3
pydantic-settings==2.1.0

# Database
sqlalchemy[asyncio]==2.0.25
asyncpg==0.29.0
alembic==1.13.1

# Memory
redis[hiredis]==5.0.1
pinecone==8.0.0

# AI / Voice
openai==1.10.0
deepgram-sdk==3.0.0

# Background jobs
celery[redis]==5.3.6

# Auth
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Monitoring
sentry-sdk==1.40.0
loguru==0.7.2

# Testing & dev
pytest==7.4.4
pytest-asyncio==0.23.3
pytest-cov==4.1.0
mypy==1.8.0
black==24.1.1
```

---

## Infrastructure

### Local Development

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: jarvis
      POSTGRES_PASSWORD: jarvis_dev
      POSTGRES_DB: jarvis_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Start: `docker-compose up -d`

### Production

**Backend:** Railway (recommended — zero-config Python, auto HTTPS, managed PostgreSQL and Redis add-ons)

**Alternative:** Fly.io (cheapest for low traffic), Render (free tier)

**Database:** Railway managed PostgreSQL or Supabase (free 500MB tier)

**Redis:** Railway managed Redis or Upstash (serverless, pay-per-request)

**Pinecone:** pinecone.io managed (free tier: 100k vectors, 1 index — sufficient for Phase 1-2)

**Mobile:** Expo EAS build → TestFlight → App Store

---

## Environment Variables

### Backend `.env`

```bash
# Database
DATABASE_URL=postgresql+asyncpg://jarvis:jarvis_dev@localhost:5432/jarvis_db
REDIS_URL=redis://localhost:6379

# AI / Voice APIs
GROQ_API_KEY=...
DEEPGRAM_API_KEY=...
OPENAI_API_KEY=...               # embeddings only

# Vector memory
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1-aws

# Local development TTS fallback
KOKORO_MODEL_PATH=/absolute/path/to/backend/models/kokoro/kokoro-v1.0.int8.onnx
KOKORO_VOICES_PATH=/absolute/path/to/backend/models/kokoro/voices-v1.0.bin

# Security
SECRET_KEY=<generate: openssl rand -hex 32>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# Environment
ENVIRONMENT=development
LOG_LEVEL=DEBUG
```

### Frontend `.env`

```bash
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_ENV=development
```

The app derives the WebSocket base URL from `EXPO_PUBLIC_API_URL`.

### Production `eas.json`

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.jarvis.app",
        "EXPO_PUBLIC_ENV": "production"
      }
    }
  }
}
```

---

## CI/CD

### GitHub Actions — Backend Tests

`.github/workflows/backend.yml`:
```yaml
name: Backend

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: jarvis_test
        options: --health-cmd pg_isready --health-interval 10s
      redis:
        image: redis:7.2

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements.txt
      - run: pytest
```

### GitHub Actions — Frontend Tests

`.github/workflows/frontend.yml`:
```yaml
name: Frontend

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run lint
      - run: npm run pretty
      - run: npm run type-check
```

---

## Performance Targets

### Voice Pipeline Latency Budget

| Stage | Target | Max |
|-------|--------|-----|
| Audio → backend (WebSocket) | <200ms | 400ms |
| Deepgram STT (streaming) | <300ms | 700ms |
| Context Builder (all 3 memory tiers) | <300ms | 500ms |
| Groq first token | <800ms | 1500ms |
| Deepgram Aura first audio chunk | <400ms | 800ms |
| **Total end-to-end** | **<2.0s** | **3.0s** |

If total exceeds 3s consistently: degrade gracefully — return text only, log the failure.

### Other Targets

| Operation | Target |
|-----------|--------|
| Knowledge Base read (full) | <100ms |
| Redis working memory read | <20ms |
| Pinecone semantic search | <300ms |
| Context Builder total | <300ms |
| Fact extraction job | <10s (background) |
| App launch to voice ready | <3s |

---

## External Services — Accounts Required

| Service | Use | Cost (dev) | Sign up |
|---------|-----|-----------|---------|
| Groq | Low-latency LLM inference | Usage-based; cheap dev tier | console.groq.com |
| OpenAI | Embeddings only in Phase 1 | Low usage-based | platform.openai.com |
| Deepgram | STT + Aura TTS | Usage-based; free credits often available | deepgram.com |
| Pinecone | Vector memory | $0 (100k vectors free) | pinecone.io |
| Sentry | Error tracking | $0 (5k events/mo free) | sentry.io |

### Voice Setup

Use Deepgram Aura for Phase 1 production TTS. Kokoro remains a local fallback
for development without external TTS credentials. ElevenLabs is not a Phase 1
dependency.

---

## Cost Estimates

**Phase 1 (solo dev, daily use only):**
- Groq LLM: ~$5-15/month at solo-dev volume
- Deepgram STT/TTS: ~$5-20/month depending on spoken minutes
- OpenAI embeddings: <$5/month
- Pinecone/Redis/Postgres local or free tiers: ~$0
- **Total: ~$10-40/month**

**Phase 3 (10 users on TestFlight):**
- Groq LLM: ~$30-80/month
- Deepgram STT/TTS: ~$40-120/month
- Hosting: ~$20/month (Railway)
- Pinecone: ~$0 (still on free tier)
- **Total: ~$90-220/month**

**Post App Store (100 users):**
- Groq LLM: ~$250-600/month
- Deepgram STT/TTS: ~$400-1,200/month
- Pinecone: ~$70/month (Standard)
- Infrastructure: ~$50/month
- **Total: ~$770-1,920/month**

---

## What Was Removed vs Original STACK.md

- ❌ `react-native-health` — no HealthKit integration in v1
- ❌ `expo-health` — removed
- ❌ `expo-calendar` — Phase 3 only
- ❌ `expo-location` — removed
- ❌ TimescaleDB extension — no biometric time-series data
- ❌ `google-generativeai` (Gemini) — Groq is the Phase 1 LLM provider
- ❌ `react-native-chart-kit` — no biometric charts
- ❌ Webhook infrastructure — Phase 3 only
- ❌ `APScheduler` — replaced by Celery for all background jobs
