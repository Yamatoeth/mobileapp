# QUICKSTART

## Prerequisites
- Docker Desktop (running)
- Python 3.12
- Node.js 22+ recommended (CI uses Node 22.x)

---

## 1. Databases

```bash
docker compose up -d postgres redis
```

---

## 2. Backend

**First time only:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
```

**Every time:**
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

✅ Check: http://localhost:8000/docs

---

## 3. Frontend

**First time only:**
```bash
npm install
```

**Every time:**
```bash
npm start
```

Then press `i` for iOS Simulator, `a` for Android, or use `npm run start:go -- --clear` for Expo Go over a tunnel.

---

## 4. Celery (optional)

Without this, the Knowledge Base won't update automatically after conversations.

```bash
cd backend
source .venv/bin/activate
celery -A app.tasks.fact_extraction.celery_app worker --loglevel=info
```

---

## Stop everything

```bash
docker compose down
```

---

## Environment variables

`backend/.env` must contain:

```
GROQ_API_KEY=...
DEEPGRAM_API_KEY=...
OPENAI_API_KEY=...        # embeddings only
PINECONE_API_KEY=...
SECRET_KEY=...   # generate with: openssl rand -hex 32
```

For local TTS fallback without Deepgram Aura, also set:

```
KOKORO_MODEL_PATH=/absolute/path/to/backend/models/kokoro/kokoro-v1.0.int8.onnx
KOKORO_VOICES_PATH=/absolute/path/to/backend/models/kokoro/voices-v1.0.bin
```
