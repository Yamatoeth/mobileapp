# J.A.R.V.I.S. Quick Start

**Goal:** Backend running, iPhone app live, voice pipeline tested end-to-end. Under 20 minutes.

---

## Prerequisites

- [ ] **macOS** (required for iOS development)
- [ ] **Xcode 15+** — install from App Store, open it once to accept license
- [ ] **Node.js 18+** — `node --version`
- [ ] **Python 3.11+** — `python3 --version`
- [ ] **Docker Desktop** — running (required for local PostgreSQL + Redis)

**Install missing tools:**

```bash
# Node via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18 && nvm use 18

# Python via pyenv
brew install pyenv
pyenv install 3.11.7 && pyenv global 3.11.7

# Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop
```

---

## Step 1: Clone and Databases (2 min)

```bash
git clone https://github.com/yourusername/jarvis.git
cd jarvis

# Start PostgreSQL and Redis locally
docker-compose up -d

# Confirm both containers are running
docker ps
# You should see: jarvis_postgres and jarvis_redis
```

---

## Step 2: Backend (7 min)

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env template and fill in API keys (see below)
cp .env.example .env

# Run database migrations (creates all tables including Knowledge Base)
alembic upgrade head

# Start the backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Verify:** Open http://localhost:8000/docs — you should see the FastAPI interactive docs.

### Required API Keys

Open `backend/.env` and fill in these values:

```bash
OPENAI_API_KEY=sk-...           # platform.openai.com → API keys
DEEPGRAM_API_KEY=...            # console.deepgram.com → API keys
ELEVENLABS_API_KEY=...          # elevenlabs.io → Profile → API key
ELEVENLABS_VOICE_ID=...         # elevenlabs.io → Voice Library → copy ID
PINECONE_API_KEY=...            # app.pinecone.io → API keys
```

**Generate your secret key:**
```bash
openssl rand -hex 32
# Copy the output into SECRET_KEY= in your .env
```

### ElevenLabs Voice Setup

You need a voice for JARVIS before audio responses will work:

1. Go to [elevenlabs.io](https://elevenlabs.io) → Voice Lab
2. Either use an existing voice (e.g., "Adam") or clone your own
3. Copy the Voice ID and paste it into `ELEVENLABS_VOICE_ID=` in `.env`

---

## Step 3: Frontend (5 min)

**Open a new terminal:**

```bash
cd mobile

# Install dependencies
npm install

# Copy env template
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://localhost:8000 (already set)

# Start Expo development server
npm start
```

**Launch on iOS simulator:**
- Press `i` in the Expo terminal, OR
- Run `npm run ios`

**Launch on physical iPhone (recommended — better audio):**
- Install **Expo Go** from the App Store
- Scan the QR code shown in the terminal

---

## Step 4: First Launch (3 min)

**When the app opens:**

1. **Microphone permission** — tap Allow when prompted
2. **Notifications permission** — can skip for now (Phase 2 feature)
3. **Onboarding** — you will be taken directly to the onboarding interview on first launch

The onboarding interview is a 45-minute conversation. If you want to test the voice pipeline first before completing onboarding, you can bypass it in development mode by setting `BYPASS_ONBOARDING=true` in the mobile `.env`.

---

## Step 5: Test the Voice Pipeline (3 min)

1. On the main VoiceScreen, **hold** the central button
2. Say: *"Hello JARVIS, can you hear me?"*
3. Release the button
4. You should see:
   - Your speech transcribed in real time
   - JARVIS processing indicator
   - JARVIS speaking its response

**Target latency:** Under 2 seconds from when you stop speaking to when you hear JARVIS.

---

## Troubleshooting

### Backend won't start

**`ModuleNotFoundError`:**
```bash
# Make sure virtualenv is activated
source venv/bin/activate
pip install -r requirements.txt
```

**`FATAL: database "jarvis_db" does not exist`:**
```bash
docker-compose down -v    # Remove old containers and volumes
docker-compose up -d      # Fresh start
alembic upgrade head
```

**`alembic.exc.CommandError: Can't locate revision`:**
```bash
alembic downgrade base
alembic upgrade head
```

### Frontend won't build

**`Unable to resolve module`:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Expo Go shows network error:**
- Ensure backend is running: `curl http://localhost:8000/health`
- Check that your iPhone and Mac are on the same WiFi network
- Try using your Mac's local IP instead of localhost in `.env`

### Voice not working

**No transcription:**
```bash
# Test Deepgram API key directly
curl -X POST https://api.deepgram.com/v1/listen \
  -H "Authorization: Token YOUR_DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @test.wav
# Should return JSON with transcript
```

**No audio response:**
```bash
# Check ElevenLabs API key and voice ID
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/YOUR_VOICE_ID" \
  -H "xi-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test.", "model_id": "eleven_monolingual_v1"}' \
  --output test_output.mp3
# If test_output.mp3 plays, your setup is correct
```

**Verify all API keys are valid:**
```bash
# From backend directory, with virtualenv active
python -c "
import os
from dotenv import load_dotenv
load_dotenv()
print('OpenAI:', 'sk-' in os.getenv('OPENAI_API_KEY', ''))
print('Deepgram:', bool(os.getenv('DEEPGRAM_API_KEY')))
print('ElevenLabs:', bool(os.getenv('ELEVENLABS_API_KEY')))
print('Pinecone:', bool(os.getenv('PINECONE_API_KEY')))
"
```

### Latency over 3 seconds

Run the backend with latency logging enabled:
```bash
LOG_LATENCY=true uvicorn app.main:app --reload
```
Look for which stage is slow (STT / Context Builder / LLM / TTS) and address that stage first.

---

## Start the Celery Worker (Required for Fact Extraction)

The background fact extraction job runs after every conversation. Start the worker in a separate terminal:

```bash
cd backend
source venv/bin/activate
celery -A app.tasks.celery_app worker --loglevel=info
```

Without this running, JARVIS will still work, but the Knowledge Base will not update automatically from conversations. Fine for initial testing, but start the worker before doing your actual onboarding interview.

---

## Development Daily Workflow

```bash
# Terminal 1: Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload

# Terminal 2: Celery worker
cd backend && source venv/bin/activate
celery -A app.tasks.celery_app worker --loglevel=info

# Terminal 3: Frontend
cd mobile && npm start

# When done:
docker-compose stop   # Stops PostgreSQL and Redis (data preserved)
```

---

## Running Tests

```bash
# Backend tests
cd backend && source venv/bin/activate
pytest --cov=app tests/ -v

# Type checking
mypy app/

# Frontend tests
cd mobile
npm test

# Type checking
npm run type-check
```

---

## Success Criteria

You are ready to develop when:
- [ ] `http://localhost:8000/docs` loads the FastAPI docs
- [ ] `http://localhost:8000/health` returns `{"status": "ok"}`
- [ ] Mobile app opens on simulator/device
- [ ] Hold button → speak → hear JARVIS respond (end-to-end voice works)
- [ ] Backend tests pass: `pytest`
- [ ] Frontend tests pass: `npm test`

---

## Next Steps

Once everything is working:

1. **Complete your onboarding interview** — talk to JARVIS for 45 minutes, let it get to know you
2. **Use it daily** — the product is only good if you use it every day and feel the difference
3. **Follow [TIMELINE.md](./TIMELINE.md)** — check the current week's goals and work through them
4. **Read [RULES.md](./RULES.md)** before writing code

**The onboarding interview is not optional.** It is the moment JARVIS becomes yours. Do not skip it.