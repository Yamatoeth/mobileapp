# Backend environment variables (quick reference)

Copy `backend/.env.example` to `backend/.env` and fill in your keys before starting the backend.

Required / strongly recommended variables
- `REDIS_URL` — Redis connection used for working memory and pub/sub. Example: `redis://localhost:6379/0`.
- `OPENAI_API_KEY` — API key for OpenAI embeddings and LLM calls.
- `SECRET_KEY` — Application secret used for signing tokens; set to a strong value in production.

Optional / integration variables
- `PINECONE_API_KEY`, `PINECONE_ENV`, `PINECONE_INDEX` — If using Pinecone for vector similarity search.
- `DEEPGRAM_API_KEY` — Deepgram STT integration (if used).
- `ELEVENLABS_API_KEY` — ElevenLabs TTS integration (if used).
- `DATABASE_URL` — If your app stores user data in a relational DB.
- `CELERY_BROKER_URL` — Broker for Celery workers; defaults to a Redis URL.

Developer quick-start
1. Copy and edit the example env file:

```bash
cp backend/.env.example backend/.env
open backend/.env  # or edit with your editor
```

2. Start Redis (development) with Docker if you don't have Redis installed:

```bash
docker run -d --name jarvis-redis -p 6379:6379 redis:7
```

3. Activate your Python venv and install requirements (if not done):

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
```

4. Start the backend:

```bash
cd backend
. ../.venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

5. Smoke-test endpoints (example):

```bash
curl -X POST 'http://127.0.0.1:8000/api/v1/memory/upsert' \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"test","items":[{"content":"Hello world","title":"greeting"}]}'

curl 'http://127.0.0.1:8000/api/v1/memory/search?user_id=test&query=hello'

curl -N 'http://127.0.0.1:8000/api/v1/stream/memory?user_id=test'
```

Notes
- If you do not configure Redis, the backend will return connection errors for memory endpoints. Use the Docker command above to bring up a local Redis quickly.
- If you don't have external API keys (OpenAI, Pinecone, Deepgram, ElevenLabs) the corresponding features will be disabled or fall back to simpler implementations.
