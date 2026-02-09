# J.A.R.V.I.S. Technical Stack Specification

## Stack Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      MOBILE (iOS First)                      │
│  React Native 0.73+ • TypeScript 5.3+ • Expo SDK 50+       │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ WebSocket (WSS) + REST (HTTPS)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (Python)                         │
│     FastAPI 0.109+ • Python 3.11+ • Uvicorn (ASGI)         │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   DATABASES     │ │   VECTOR DB     │ │   CACHE         │
│  PostgreSQL 16  │ │  Pinecone       │ │   Redis 7.2     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              ▲
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   LLM APIs      │ │   VOICE APIs    │ │   ANALYTICS     │
│  GPT-4o/Gemini  │ │  Deepgram/EL    │ │   Sentry        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Frontend Stack (React Native)

### Core Framework
**React Native 0.73.2**
- Why: Mature, single codebase for iOS/Android, strong community
- Installation: `npx create-expo-app jarvis-mobile --template`

**Expo SDK 50.0**
- Why: Managed workflow, easy native module access, OTA updates
- Critical: Use Expo Go for development, bare workflow for production

**TypeScript 5.3.3**
- Why: Type safety prevents 80% of runtime errors
- Config: `strict: true`, no implicit any

### State Management
**Zustand 4.5.0**
```bash
npm install zustand
```
- Why: Lightweight (1.2kb), no boilerplate, React hooks-based
- Alternatives considered: Redux (too heavy), MobX (too magic)

**React Query 5.17.0** (for server state)
```bash
npm install @tanstack/react-query
```
- Why: Automatic caching, background refetching, devtools
- Use for: All API calls, biometric data fetching

### Navigation
**React Navigation 6.1.9**
```bash
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
```
- Stack Navigator for main flow
- Tab Navigator for home screen sections

### UI Components
**React Native Reanimated 3.6.1**
```bash
npx expo install react-native-reanimated
```
- Why: 60fps animations for biometric charts
- Use for: Real-time HRV/BPM line charts, voice waveforms

**React Native SVG 14.1.0**
```bash
npx expo install react-native-svg
```
- For custom biometric visualizations

**React Native Chart Kit 6.12.0**
```bash
npm install react-native-chart-kit
```
- Quick charts for MVP (replace with custom in Phase 2)

### Native Modules

**HealthKit Integration**
```bash
npm install react-native-health
```
- Access: HRV, BPM, sleep analysis, steps
- Permissions: Request on first launch with explanation

**Audio Recording & Playback**
```bash
npx expo install expo-av
```
- Record voice at 16kHz WAV
- Playback TTS responses

**Calendar Access**
```bash
npx expo install expo-calendar
```
- Read upcoming events
- Write focus blocks (Phase 3)

**Location Services**
```bash
npx expo install expo-location
```
- Background location updates (low power mode)
- Geofencing for context detection

**Notifications**
```bash
npx expo install expo-notifications
```
- Local notifications for interventions
- Push notifications (Phase 2)

### Development Tools

**ESLint + Prettier**
```bash
npm install --save-dev eslint prettier eslint-config-prettier
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Jest + React Native Testing Library**
```bash
npm install --save-dev jest @testing-library/react-native
```

**TypeScript Type Checking**
```bash
npm run type-check
```

### Package.json Scripts
```json
{
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "android": "expo run:android",
    "test": "jest",
    "type-check": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,json}\""
  }
}
```

---

## Backend Stack (Python)

### Core Framework
**FastAPI 0.109.0**
```bash
pip install fastapi[all]
```
- Why: Fastest Python framework, auto-docs, async support
- Includes: Uvicorn ASGI server, Pydantic validation

**Python 3.11.7**
- Why: 25% faster than 3.10, better async performance
- Use: pyenv for version management

### Database & ORM
**SQLAlchemy 2.0.25** (async mode)
```bash
pip install sqlalchemy[asyncio] asyncpg
```
- ORM for PostgreSQL
- Async engine for non-blocking queries

**Alembic 1.13.1** (migrations)
```bash
pip install alembic
```
- Database migrations
- Version control for schema changes

**PostgreSQL 16**
- Local: Docker container
- Production: AWS RDS or DigitalOcean Managed DB
- Extensions: TimescaleDB for time-series data

**Redis 7.2**
```bash
pip install redis[hiredis] aioredis
```
- Working memory cache (24h TTL)
- Session management
- Local: Docker container
- Production: AWS ElastiCache or Redis Cloud

### Vector Database
**Pinecone**
```bash
pip install pinecone-client
```
- Episodic memory (semantic search)
- 1536 dimensions (OpenAI embedding size)
- Free tier: 100k vectors, 1 index

### LLM Integration

**OpenAI**
```bash
pip install openai
```
- GPT-4o for real-time responses
- Embedding model: text-embedding-3-small
- Streaming API for low latency

**Google Generative AI**
```bash
pip install google-generativeai
```
- Gemini 1.5 Pro (fallback)
- 2M token context for long-term memory

### Voice Services

**Deepgram** (Speech-to-Text)
```bash
pip install deepgram-sdk
```
- Streaming transcription
- 300ms latency
- Custom vocabulary for biometric terms

**ElevenLabs** (Text-to-Speech)
```bash
pip install elevenlabs
```
- Voice cloning (J.A.R.V.I.S. voice)
- Streaming audio output
- Emotional inflection control

### Async & Concurrency
**HTTPX** (async HTTP client)
```bash
pip install httpx
```
- Replace requests for async API calls

**asyncio** (built-in)
- Concurrent LLM + TTS calls
- Non-blocking I/O

### Background Tasks
**Celery 5.3.6** (for long-running jobs)
```bash
pip install celery[redis]
```
- Nightly data aggregation
- Weekly report generation
- Email notifications

**APScheduler 3.10.4** (for scheduled jobs)
```bash
pip install apscheduler
```
- Simpler than Celery for periodic tasks
- Cleanup old Redis keys

### Development Tools

**Pytest**
```bash
pip install pytest pytest-asyncio pytest-cov
```

**MyPy** (type checking)
```bash
pip install mypy
```
- Config: `strict = true` in mypy.ini

**Black** (code formatting)
```bash
pip install black
```

**Pre-commit hooks**
```bash
pip install pre-commit
```

### requirements.txt
```txt
# Core
fastapi[all]==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# Database
sqlalchemy[asyncio]==2.0.25
asyncpg==0.29.0
alembic==1.13.1
redis[hiredis]==5.0.1
aioredis==2.0.1

# Vector DB
pinecone-client==3.0.0

# LLM & Voice
openai==1.10.0
google-generativeai==0.3.2
deepgram-sdk==3.0.0
elevenlabs==0.2.27

# Utilities
httpx==0.26.0
python-dotenv==1.0.0
pydantic==2.5.3
pydantic-settings==2.1.0

# Background Jobs
celery[redis]==5.3.6
apscheduler==3.10.4

# Testing & Dev
pytest==7.4.4
pytest-asyncio==0.23.3
pytest-cov==4.1.0
mypy==1.8.0
black==24.1.1
```

---

## Infrastructure & DevOps

### Local Development (Docker Compose)

**docker-compose.yml**
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

Start with: `docker-compose up -d`

### Production Deployment

**Backend Hosting: Railway / Render / Fly.io**
- Why: Simple Python deployment, auto-scaling
- Cost: ~$20-50/month for hobby tier

**Database:**
- PostgreSQL: AWS RDS or Supabase (managed)
- Redis: AWS ElastiCache or Upstash (serverless)

**Monitoring:**
```bash
pip install sentry-sdk
```
- Error tracking and performance monitoring
- Free tier: 5k events/month

**Logging:**
```bash
pip install loguru
```
- Structured logging to stdout
- Production: Ship to Datadog or Logtail

### CI/CD (GitHub Actions)

**.github/workflows/backend-test.yml**
```yaml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      
      redis:
        image: redis:7.2
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      
      - name: Run tests
        run: |
          pytest --cov=app tests/
      
      - name: Type check
        run: |
          mypy app/
```

**.github/workflows/frontend-test.yml**
```yaml
name: Frontend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd mobile && npm ci
      
      - name: Run tests
        run: |
          cd mobile && npm test
      
      - name: Type check
        run: |
          cd mobile && npm run type-check
```

---

## External Services & APIs

### Required Accounts (Free Tiers Available)

**OpenAI**
- API Key: https://platform.openai.com
- Cost: ~$0.50/1000 requests (GPT-4o)
- Budget: $50/month for solo dev

**Deepgram**
- API Key: https://deepgram.com
- Cost: $0.0125/min transcription
- Free tier: $200 credit

**ElevenLabs**
- API Key: https://elevenlabs.io
- Cost: $0.30/1000 characters
- Free tier: 10k characters/month

**Pinecone**
- API Key: https://pinecone.io
- Free tier: 100k vectors, 1 index
- Upgrade: $70/month for production

**Sentry**
- Project: https://sentry.io
- Free tier: 5k errors/month
- Upgrade: $26/month for unlimited

### Optional Services (Phase 2+)

**Twilio** (SMS notifications)
- For users without push enabled

**SendGrid** (Email)
- Weekly reports, notifications

**Google Calendar API**
- Richer calendar integration

---

## Development Environment Setup

### Prerequisites
```bash
# macOS
brew install node python@3.11 postgresql@16 redis

# Install pyenv for Python version management
brew install pyenv
pyenv install 3.11.7
pyenv global 3.11.7

# Install nvm for Node version management
brew install nvm
nvm install 18
nvm use 18
```

### Backend Setup
```bash
# Clone repo
git clone <your-repo>
cd jarvis/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up database
docker-compose up -d postgres redis
alembic upgrade head

# Create .env file
cp .env.example .env
# Add your API keys

# Run backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
cd jarvis/mobile

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Add backend URL: EXPO_PUBLIC_API_URL=http://localhost:8000

# Start Expo
npm start

# Run on iOS simulator
npm run ios
```

---

## Environment Variables

### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql+asyncpg://jarvis:jarvis_dev@localhost:5432/jarvis_db
REDIS_URL=redis://localhost:6379

# APIs
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1-aws

# Security
SECRET_KEY=<generate with: openssl rand -hex 32>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
```

### Frontend (.env)
```bash
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_WS_URL=ws://localhost:8000/ws
EXPO_PUBLIC_ENV=development
```

---

## Performance Benchmarks & Targets

### Backend Targets
| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| GET /health | <10ms | <20ms | <50ms |
| POST /biometrics | <100ms | <200ms | <500ms |
| POST /voice/transcribe | <500ms | <1s | <2s |
| GET /memory/search | <200ms | <400ms | <800ms |

### Frontend Targets
| Metric | Target |
|--------|--------|
| App launch time | <2s |
| Screen transition | <200ms |
| Voice button tap to recording | <100ms |
| HealthKit data fetch | <500ms |
| Chart render (1000 points) | <100ms |

### Database Query Limits
- Simple queries (indexed): <50ms
- Complex aggregations: <200ms
- Full-text search: <300ms

### Voice Pipeline Targets
| Stage | Target | Max |
|-------|--------|-----|
| Audio recording → upload | <200ms | <500ms |
| STT processing | <500ms | <1s |
| LLM first token | <800ms | <1.5s |
| TTS generation | <400ms | <800ms |
| **Total round-trip** | **<1.9s** | **<3s** |

---

## Security Checklist

### API Security
- [ ] HTTPS only (TLS 1.3)
- [ ] Rate limiting (10 req/sec per user)
- [ ] CORS configured (whitelist domains)
- [ ] JWT expiration enforced
- [ ] SQL injection prevention (ORM only)

### Data Security
- [ ] Passwords hashed (bcrypt)
- [ ] Biometric data encrypted at rest (AES-256)
- [ ] PII not logged
- [ ] API keys in environment variables (not code)
- [ ] Regular dependency updates (Dependabot)

### Mobile Security
- [ ] API keys in secure storage (expo-secure-store)
- [ ] Certificate pinning (production)
- [ ] Jailbreak detection
- [ ] Obfuscated code (production builds)

---

## Monitoring & Observability

### Metrics to Track

**Backend:**
- Request rate (req/sec)
- Error rate (errors/min)
- Latency (p50, p95, p99)
- Database connection pool usage
- Redis memory usage

**Frontend:**
- Crash rate
- Screen load time
- API call success rate
- Background task completion
- Battery usage

**Business:**
- Daily active users
- Intervention acceptance rate
- Voice interaction count
- Feature usage (which features are used most)

### Alerting Rules
- Error rate >5% → Slack notification
- p95 latency >3s → PagerDuty
- Database CPU >80% → Auto-scale
- Crash rate >1% → Immediate investigation

---

## Cost Estimation (Monthly)

**Development (First 3 months):**
- OpenAI API: $50
- Deepgram: $0 (free tier)
- ElevenLabs: $0 (free tier)
- Pinecone: $0 (free tier)
- Hosting: $0 (local dev)
**Total: ~$50/month**

**Production (Post-launch, 100 users):**
- OpenAI API: $200 (2k req/day)
- Deepgram: $75 (50 min/day)
- ElevenLabs: $22 (free tier + overflow)
- Pinecone: $70 (production index)
- Hosting: $50 (Railway/Render)
- Database: $25 (managed PostgreSQL)
- Redis: $10 (managed cache)
- Sentry: $0 (free tier)
**Total: ~$450/month**

**Scaling (1000 users):**
- APIs: ~$2000/month
- Infrastructure: ~$300/month
**Total: ~$2300/month**

---

This stack is optimized for **speed of development** (solo, 6 months) while maintaining **production-grade quality**. Every tool has been chosen for minimal complexity and maximum reliability.
