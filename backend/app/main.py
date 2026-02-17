"""
J.A.R.V.I.S. Backend - FastAPI Application
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.redis_client import redis_client
from app.db.pinecone_client import pinecone_client
from fastapi import APIRouter

# import routers
from app.api.conversations import router as conversations_router
from app.api.voice import router as voice_router
from app.api.knowledge import router as knowledge_router
from app.api.onboarding import router as onboarding_router
from app.api.auth import router as auth_router
from app.api.memory import router as memory_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    await redis_client.connect()
    if pinecone_client.is_configured:
        pinecone_client.connect()
    yield
    # Shutdown
    await redis_client.close()


app = FastAPI(
    title="J.A.R.V.I.S. API",
    description="Proactive AI Executive Assistant Backend",
    version=settings.app_version,
    lifespan=lifespan,
)

# Register API routers
app.include_router(conversations_router, prefix="/api/v1", tags=["conversations"])
app.include_router(voice_router, prefix="/api/v1", tags=["voice"])
app.include_router(knowledge_router, prefix="/api/v1", tags=["knowledge"])
app.include_router(onboarding_router, prefix="/api/v1", tags=["onboarding"])
app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
app.include_router(memory_router, prefix="/api/v1", tags=["memory"])

# CORS middleware for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    pinecone_healthy = False
    
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
            "database": "configured",  # Will check on actual connection
        }
    }
