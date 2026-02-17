# J.A.R.V.I.S. Technical Stack

## Overview

```
┌─────────────────────────────────────────────────────────┐
│              iOS App (React Native + Expo)               │
│         VoiceScreen · HistoryScreen · KnowledgeScreen   │
└─────────────────────────────────────────────────────────┘
                         ▲ ▼ WSS + HTTPS
┌─────────────────────────────────────────────────────────┐
│             Backend (FastAPI + Python 3.11)              │
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
│   Deepgram   │ │   GPT-4o    │ │  ElevenLabs  │
│     STT      │ │     LLM     │ │     TTS      │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Frontend

### Core Framework

**React Native 0.73+ with Expo SDK 50+**
```bash
npx create-expo-app jarvis --template
```
Why: iOS-first, single codebase, managed workflow, no native Xcode wrestling.

**TypeScript 5.3+ (strict mode)**

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

**Zustand 4.5+**
```bash
npm install zustand
```
Four stores: `voiceStore`, `conversationStore`, `knowledgeStore`, `settingsStore`. Flat state only, no nested objects.

### Navigation

**React Navigation 6**
```bash
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
```
Stack navigator with four screens: VoiceScreen (default), HistoryScreen, KnowledgeScreen, SettingsScreen. OnboardingScreen added as modal on first launch.

### Audio

**expo-av**
```bash
npx expo install expo-av
```
Records audio at 16kHz WAV for Deepgram. Plays back ElevenLabs TTS streaming audio.

### Animation

**React Native Reanimated 3**
```bash
npx expo install react-native-reanimated
```
Required for the arc-reactor pulse animation and voice waveform. 60fps on device.

### Notifications

**expo-notifications** (Phase 2+)
```bash
npx expo install expo-notifications
```
Used for JARVIS-initiated morning briefings and proactive check-ins. Not used in Phase 1.

### package.json scripts

```json
{
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "test": "jest --watchAll",
    "type-check": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,json}\""
  }
}
```

---

## Backend

### Core Framework

**FastAPI 0.109+ with Python 3.11+**
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

**OpenAI GPT-4o**
```bash
pip install openai
```
Always use streaming (`stream=True`). First token must arrive in under 800ms. The four-layer prompt is assembled by the Context Builder before each call.

**OpenAI text-embedding-3-small** for Pinecone embeddings (background jobs only, not in hot path).

### STT

**Deepgram**
```bash
pip install deepgram-sdk
```
Streaming transcription via WebSocket. Interim results sent back to the client immediately so the UI can show live transcription. Final result triggers the LLM call.

### TTS

**ElevenLabs**
```bash
pip install elevenlabs
```
Streaming audio response. Begin streaming TTS as soon as the first LLM chunk arrives — do not wait for the complete LLM response. This is critical for meeting the 2-second latency budget.

### Background Jobs

**Celery 5.3+**
```bash
pip install celery[redis]
```
Uses Redis as broker. One critical task: `extract_facts_from_conversation` runs after every conversation ends. This task sends the transcript to GPT-4o with a structured extraction prompt and merges the results into the Knowledge Base.

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
pinecone-client==3.0.0

# AI / Voice
openai==1.10.0
deepgram-sdk==3.0.0
elevenlabs==0.2.27

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
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...          # Your custom JARVIS voice ID

# Vector memory
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=jarvis-memory

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
EXPO_PUBLIC_WS_URL=ws://localhost:8000/ws
EXPO_PUBLIC_ENV=development
```

### Production `eas.json`

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.jarvis.app",
        "EXPO_PUBLIC_WS_URL": "wss://api.jarvis.app/ws",
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
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: pytest --cov=app tests/
      - run: mypy app/
      - run: black --check app/
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
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd mobile && npm ci
      - run: cd mobile && npm test -- --watchAll=false
      - run: cd mobile && npm run type-check
```

---

## Performance Targets

### Voice Pipeline Latency Budget

| Stage | Target | Max |
|-------|--------|-----|
| Audio → backend (WebSocket) | <200ms | 400ms |
| Deepgram STT (streaming) | <300ms | 700ms |
| Context Builder (all 3 memory tiers) | <300ms | 500ms |
| GPT-4o first token | <800ms | 1500ms |
| ElevenLabs first audio chunk | <400ms | 800ms |
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
| OpenAI | LLM + embeddings | ~$30/mo | platform.openai.com |
| Deepgram | STT | $0 (free tier: $200 credit) | deepgram.com |
| ElevenLabs | TTS + voice clone | $0 (10k chars/mo free) | elevenlabs.io |
| Pinecone | Vector memory | $0 (100k vectors free) | pinecone.io |
| Sentry | Error tracking | $0 (5k events/mo free) | sentry.io |

### Voice Clone Setup (ElevenLabs)

You need a custom voice for JARVIS. On ElevenLabs:
1. Voice Lab → Add Voice → Instant Voice Cloning
2. Upload 5–10 minutes of clean source audio (the tone you want)
3. Name it "JARVIS"
4. Copy the Voice ID to your `.env`

Alternatively, use one of ElevenLabs' built-in professional voices.

---

## Cost Estimates

**Phase 1 (solo dev, daily use only):**
- OpenAI: ~$20/month
- All others: free tiers
- **Total: ~$20/month**

**Phase 3 (10 users on TestFlight):**
- OpenAI: ~$80/month
- ElevenLabs: ~$22/month (Starter plan)
- Hosting: ~$20/month (Railway)
- Pinecone: ~$0 (still on free tier)
- **Total: ~$120/month**

**Post App Store (100 users):**
- OpenAI: ~$400/month
- ElevenLabs: ~$99/month (Creator plan)
- Pinecone: ~$70/month (Standard)
- Infrastructure: ~$50/month
- **Total: ~$620/month**

---

## What Was Removed vs Original STACK.md

- ❌ `react-native-health` — no HealthKit integration in v1
- ❌ `expo-health` — removed
- ❌ `expo-calendar` — Phase 3 only
- ❌ `expo-location` — removed
- ❌ TimescaleDB extension — no biometric time-series data
- ❌ `google-generativeai` (Gemini) — GPT-4o only, no fallback needed for v1
- ❌ `react-native-chart-kit` — no biometric charts
- ❌ Webhook infrastructure — Phase 3 only
- ❌ `APScheduler` — replaced by Celery for all background jobs