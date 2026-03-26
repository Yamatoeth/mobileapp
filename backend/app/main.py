"""
J.A.R.V.I.S. Backend - FastAPI Application
"""
import logging
import uuid
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.logging import LoggingIntegration

from app.core.config import get_settings
from app.db.pinecone_client import pinecone_client
from app.db.redis_client import redis_client
from app.api.conversations import router as conversations_router
from app.api.voice import router as voice_router
from app.api.knowledge import router as knowledge_router
from app.api.onboarding import router as onboarding_router
from app.api.auth import router as auth_router
from app.api.memory import router as memory_router
from app.api.notifications import router as notifications_router
from app.api.users import router as users_router
from app.api.conversations_rest import router as conversations_rest_router
from app.api.messages import router as messages_router

settings = get_settings()

# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------
try:
    from pythonjsonlogger import jsonlogger  # type: ignore

    _handler = logging.StreamHandler()
    _handler.setFormatter(
        jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
    )
    logging.root.handlers = [_handler]
except ImportError:
    logging.basicConfig(level=logging.INFO)

logging.root.setLevel(logging.DEBUG if settings.debug else logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sentry
# ---------------------------------------------------------------------------
try:
    if settings.sentry_dsn:
        sentry_logging = LoggingIntegration(level=None, event_level=None)
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            send_default_pii=True,
            integrations=[sentry_logging],
            enable_logs=True,
            traces_sample_rate=1.0,
            profile_session_sample_rate=1.0,
            profile_lifecycle="trace",
        )
except Exception:
    pass


# ---------------------------------------------------------------------------
# Rate limiting (slowapi)
# ---------------------------------------------------------------------------
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler  # type: ignore
    from slowapi.errors import RateLimitExceeded  # type: ignore
    from slowapi.util import get_remote_address  # type: ignore

    limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
    _SLOWAPI_AVAILABLE = True
except ImportError:
    limiter = None  # type: ignore
    _SLOWAPI_AVAILABLE = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    yield
    try:
        await redis_client.close()
    except Exception:
        pass


app = FastAPI(
    title="J.A.R.V.I.S. API",
    description="Proactive AI Executive Assistant Backend",
    version=settings.app_version,
    lifespan=lifespan,
)

# Rate limiter state
if _SLOWAPI_AVAILABLE and limiter is not None:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

# Register API routers
app.include_router(conversations_router, prefix="/api/v1", tags=["conversations"])
app.include_router(voice_router, prefix="/api/v1", tags=["voice"])
app.include_router(knowledge_router, prefix="/api/v1", tags=["knowledge"])
app.include_router(onboarding_router, prefix="/api/v1", tags=["onboarding"])
app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
app.include_router(memory_router, prefix="/api/v1", tags=["memory"])
app.include_router(notifications_router, prefix="/api/v1", tags=["notifications"])
app.include_router(users_router, prefix="/api/v1", tags=["users"])
app.include_router(conversations_rest_router, prefix="/api/v1", tags=["conversations_rest"])
app.include_router(messages_router, prefix="/api/v1", tags=["messages"])

# CORS middleware for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials="*" not in settings.cors_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request ID middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# Optionally attach ASGI middleware for Sentry
try:
    from sentry_sdk.integrations.asgi import SentryAsgiMiddleware
    asgi_app = SentryAsgiMiddleware(app)
except Exception:
    asgi_app = app


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "debug": settings.debug,
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": f"{settings.app_name} API is running"}


@app.get("/api/v1/status")
async def api_status():
    """API status with service health checks."""
    redis_healthy = False
    try:
        await redis_client.client.ping()
        redis_healthy = True
    except Exception:
        pass

    pinecone_healthy = pinecone_client.is_configured

    return {
        "api": "healthy",
        "version": settings.app_version,
        "services": {
            "redis": "connected" if redis_healthy else "disconnected",
            "pinecone": "configured" if pinecone_healthy else "not_configured",
            "database": "configured",
        },
    }
