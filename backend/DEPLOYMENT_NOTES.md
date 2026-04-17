# Deployment & Operations Guide

This document turns the high-level Celery notes into an actionable runbook for the FastAPI backend, Celery workers, and push service.

## Topology
| Component | Purpose | Scaling Guidance |
| --- | --- | --- |
| FastAPI app (uvicorn/gunicorn) | Hosts REST + WebSocket endpoints | 2+ pods/VMs behind a load balancer; enable sticky sessions for WebSocket traffic |
| Celery workers (`voice`, `push`) | Long-running tasks, push fan-out | Start with 2 workers × concurrency 4; autoscale based on queue depth |
| Celery Beat / Scheduler | Periodic clean-up, retries | Run as a dedicated container/process |
| Redis | Broker + result backend | Enable AOF persistence, `maxmemory-policy noeviction` |
| PostgreSQL | Knowledge + memory storage | Standard managed Postgres with PITR |

## Worker Management
1. Build the backend Docker image (multi-stage, non-root) and push to your registry.
2. Deploy with your orchestrator of choice:
   - **Docker Compose:**
     ```bash
     docker-compose up -d backend worker beat
     ```
   - **Kubernetes:** separate Deployments for `api`, `worker`, `beat`; share ConfigMaps/Secrets for env vars.
3. Enable health/liveness probes:
   - API: `GET /healthz`
   - Worker: `celery inspect ping`
4. Use restart policies (`on-failure` or `always`) so workers recover automatically.

## Push Service Hardening
- `push_service` already retries and batches tokens; production should also:
  - Persist failed sends to Redis Streams or another durable queue for reprocessing.
  - Apply exponential backoff + circuit breakers around vendor calls.
  - Deduplicate device tokens per user before enqueueing.
- Maintain a DLQ (dead-letter queue) with alerting when messages exceed max retry count.

## Configuration Checklist
- Secrets supplied through environment variables or a secrets manager; never bake keys into images.
- Validate `secret_key` ≠ default when `app_env=production`.
- Enforce WebSocket auth (JWT or session token) before exposing `/ws/voice`.
- Store Kokoro model files on a persistent volume mounted at the paths configured in env vars.

## Observability & Alerting
| Signal | Target | Tooling |
| --- | --- | --- |
| Celery task failures | < 1% over 10 min | Sentry metrics / Prometheus alert |
| Queue depth (`voice`, `push`) | Drains within 1 min | Prometheus exporter or Celery Flower |
| Push success rate | > 98% | Custom push_service counter |
| API latency (p95) | < 800ms for text, < 3s for voice round-trip | APM (Datadog, OpenTelemetry) |
| WebSocket context build | Logged `context_built` message with `ms` field | Centralized logs (JSON preferred) |

## Monitoring Checklist
- Aggregate logs using structured JSON logging (e.g., `python-json-logger`).
- Export metrics via Prometheus or StatsD and dashboard STT latency, TTS generation, context build duration.
- Create alerts for:
  - 429/5xx spikes on API
  - Worker restarts > N per hour
  - DLQ size > 0 for push jobs

## Disaster Recovery
- Enable Redis AOF + snapshots, Postgres automated backups with PITR.
- Store Kokoro binaries in object storage so instances can rehydrate on redeploy.
- Document manual failover steps for push vendors (FCM/APNs) in your ops wiki.

## References
- `docker-compose.yml` — local orchestration example
- `scripts/WSTEST.md` — voice WebSocket validation
- `plans/project-improvements.md` — roadmap items for security & scaling
