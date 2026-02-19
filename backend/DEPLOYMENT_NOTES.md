Deployment notes for Celery worker supervision and push service

1) Run with Docker Compose (development)

   - Ensure `backend/Dockerfile` exists (not included here). The compose file uses `build: ./backend` for `backend` service.
   - Start all services:

```bash
docker-compose up --build
```

2) Production recommendations

- Run Celery workers under a process supervisor (systemd, Kubernetes Deployment, or Docker Compose with restart policies).
- Use at least 2 worker replicas for high availability and configure concurrency appropriately.
- Run Celery Beat as a separate process (or use scheduler like `celery-beat` with robust persistence).
- Use Redis for broker and result backend with persistence and proper maxmemory policy.

3) Push sending resilience

- The `push_service` implements retries and batching, but production should:
  - Use exponential backoff and circuit-breaker patterns.
  - Persist failed messages to a durable queue (e.g., Redis streams) and implement dead-letter handling.
  - Batch tokens and dedupe across devices for a single user.

4) Monitoring

- Monitor Celery task failures and retry counts (Sentry metrics are helpful).
- Track push success/failure rates and token validity.
