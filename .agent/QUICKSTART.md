# QUICKSTART

## Prerequisites
- Docker Desktop (running)
- Python 3.11+
- Node.js 18+

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
pip install psycopg2-binary
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
cd mobile
npm install
```

**Every time:**
```bash
cd mobile
npm start
```

Then press `a` (Android) or `w` (browser).

---

## 4. Celery (optional)

Without this, the Knowledge Base won't update automatically after conversations.

```bash
cd backend
source .venv/bin/activate
celery -A app.tasks.fact_extraction worker --loglevel=info
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
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
PINECONE_API_KEY=...
SECRET_KEY=...   # generate with: openssl rand -hex 32
```