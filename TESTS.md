# Tests & Runbook

This document collects the most useful local tests and the exact commands to run them.

**Prerequisites**
- **Docker**: Ensure Docker is running for Postgres/Redis (used by the backend).
- **Python (backend)**: Create a virtualenv inside `backend/` and install dependencies.
- **Node / npm**: Install JavaScript deps at the repo root for frontend/test scripts.

**Start Infrastructure**
- **Start Postgres + Redis**:

```bash
docker-compose up -d
```

**Backend: setup, migrations, run**
- From the repo root run:

```bash
cd backend
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt
# Run Alembic migrations (from backend/)
./.venv/bin/python -m alembic upgrade head
# Start the FastAPI server
./.venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Notes:
- If you use a different Python interpreter, adjust the venv/venv-activate commands accordingly.

**Run WebSocket (WS) latency tests**
- Node test (from repo root):

```bash
npm install
BACKEND_WS="ws://localhost:8000/api/v1/ws/voice/1" node scripts/ws_test_node.js
```

- Python test (from repo root):

```bash
BACKEND_WS="ws://localhost:8000/api/v1/ws/voice/1" python3 scripts/ws_test_py.py
```

Expected: the scripts will print messages received from the server. Look for a JSON message with "type":"context_built" and an `ms` value (latency in milliseconds).

**Manual smoke test: KB extract → apply → list**
- 1) Call extract (suggestions from transcript):

```bash
curl -s -X POST "http://localhost:8000/api/v1/kb/extract" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"1","transcript":"My name is Alice and I work as a nurse. I want to save money for a house."}' | jq
```

- 2) Apply items (example payload returned by extract or edited manually):

```bash
curl -s -X POST "http://localhost:8000/api/v1/kb/apply" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"1","domain":"identity","items":[{"key":"name","value":"Alice","confidence":0.95}]}' | jq
```

- 3) List items for a domain:

```bash
curl -s "http://localhost:8000/api/v1/kb/items/identity/1" | jq
```

**Frontend / Unit tests**
- Install and run JS tests (root):

```bash
npm install
npm test -- --watchAll=false
```

- Backend Python tests (if any):

```bash
cd backend
./.venv/bin/python -m pip install -r requirements.txt
pytest -q
```

**Useful debug commands**
- Stream Docker logs:

```bash
docker-compose logs -f
```

- Backend server logs (if run via uvicorn): watch the uvicorn console where you started the server.

**If something fails**
- Confirm Docker services are healthy and reachable (Postgres/Redis). If migrations fail, check `backend/alembic/env.py` and the DB URL in `backend/app/core/config.py`.
- If you see import errors while starting uvicorn, ensure you start it from the `backend/` folder and that `backend/.venv` dependencies are installed.

---
If you want I can also add a short script to run the full smoke sequence automatically and summarize `context_built` latencies across N runs.
