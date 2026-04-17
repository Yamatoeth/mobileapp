"""
Application configuration using Pydantic Settings
"""
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import field_validator, model_validator
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
    local_memory_path: str = str(Path(__file__).resolve().parents[2] / "data" / "conversation_memory")

    # Provider selection
    stt_provider: str = "deepgram"
    llm_provider: str = "groq"
    tts_provider: str = "deepgram"
    embedding_provider: str = "openai"
    groq_chat_model: str = "openai/gpt-oss-120b"
    groq_fallback_model: str = "llama-3.1-8b-instant"
    groq_stt_model: str = "whisper-large-v3-turbo"
    deepgram_stt_model: str = "nova-3"
    deepgram_tts_model: str = "aura-2-thalia-en"
    
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

    # Context builder per-layer timeouts (seconds)
    ctx_timeout_character: float = 1.0
    ctx_timeout_knowledge: float = 1.0
    ctx_timeout_conversation: float = 0.8
    ctx_timeout_working_memory: float = 0.5
    ctx_timeout_episodic: float = 1.0

    @model_validator(mode="after")
    def _validate_production_secret(self) -> "Settings":
        """Prevent starting in production with the default insecure secret key."""
        _default = "development-secret-key-change-in-production"
        if self.app_env in {"production", "prod"} and self.secret_key == _default:
            raise ValueError(
                "secret_key must be explicitly set to a strong value in production. "
                "Set the SECRET_KEY environment variable."
            )
        return self

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
