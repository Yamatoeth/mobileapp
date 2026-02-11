# Development setup

Quick notes to start local Postgres and Redis for development.

1. Ensure Docker is running.
2. From the repo root run:

```bash
docker compose up -d postgres redis
docker compose ps
```

3. Verify services:

```bash
docker compose exec -T redis redis-cli ping    # should return PONG
docker compose exec -T postgres pg_isready -U jarvis -d jarvis_db
```

4. Env file

The backend reads `.env` in `backend/`. Example (already added): [backend/.env](backend/.env)

5. Stop services

```bash
docker compose down
```

Notes:
- `docker compose` (v2) warns if a top-level `version` key exists; it is unnecessary and removed from `docker-compose.yml`.
