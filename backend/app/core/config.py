"""
Application configuration using Pydantic Settings
"""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://jarvis:jarvis_dev@localhost:5432/jarvis_db"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # API Keys
    openai_api_key: Optional[str] = None
    deepgram_api_key: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    pinecone_api_key: Optional[str] = None
    pinecone_environment: str = "us-east-1-aws"
    
    # Security
    secret_key: str = "development-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days
    
    # Monitoring
    sentry_dsn: Optional[str] = None
    
    # App settings
    debug: bool = True
    app_name: str = "J.A.R.V.I.S."
    app_version: str = "1.0.0"
    # Notifications
    max_proactive_notifications_per_day: int = 3
    # Test helpers
    test_mode: bool = False  # When true, use local stubs for external services


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
