"""
Application configuration using Pydantic Settings
"""
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import field_validator
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
    groq_api_key: Optional[str] = None
    deepgram_api_key: Optional[str] = None
    pinecone_api_key: Optional[str] = None
    pinecone_environment: str = "us-east-1-aws"
    kokoro_model_path: str = str(Path(__file__).resolve().parents[2] / "models" / "kokoro" / "kokoro-v1.0.int8.onnx")
    kokoro_voices_path: str = str(Path(__file__).resolve().parents[2] / "models" / "kokoro" / "voices-v1.0.bin")
    kokoro_default_voice: str = "af_sarah"
    kokoro_default_language: str = "en-us"
    kokoro_default_speed: float = 1.0
    
    # Security
    secret_key: str = "development-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days
    
    # Monitoring
    sentry_dsn: Optional[str] = None
    
    # App settings
    debug: bool = True
    app_env: str = "development"
    app_name: str = "J.A.R.V.I.S."
    app_version: str = "1.0.0"
    cors_allowed_origins: list[str] = ["http://localhost:8081", "http://localhost:19006"]
    # Notifications
    max_proactive_notifications_per_day: int = 3
    # Test helpers
    test_mode: bool = False  # When true, use local stubs for external services
    allow_insecure_dev_auth: bool = False
    dev_auth_secret: Optional[str] = None

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return bool(value)

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def parse_cors_allowed_origins(cls, value: object) -> list[str]:
        if value is None:
            return ["http://localhost:8081", "http://localhost:19006"]
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str):
            origins = [item.strip() for item in value.split(",") if item.strip()]
            return origins or ["http://localhost:8081", "http://localhost:19006"]
        return ["http://localhost:8081", "http://localhost:19006"]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
