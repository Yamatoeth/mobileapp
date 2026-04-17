"""
Utilities for structured exception handling across the application.
Provides common exception types and error context.
"""

import asyncio
import logging
from typing import Callable, TypeVar, Any, cast
from functools import wraps

logger = logging.getLogger(__name__)

# Exception type hierarchy for better error handling
class JarvisError(Exception):
    """Base exception for all Jarvis-specific errors."""
    pass


class AudioProcessingError(JarvisError):
    """Raised when audio recording or processing fails."""
    pass


class STTError(JarvisError):
    """Raised when speech-to-text transcription fails."""
    pass


class LLMError(JarvisError):
    """Raised when LLM API calls fail."""
    pass


class TTSError(JarvisError):
    """Raised when text-to-speech synthesis fails."""
    pass


class ExternalServiceError(JarvisError):
    """Raised when external service calls fail (OpenAI, Deepgram, etc)."""
    pass


class NetworkError(JarvisError):
    """Raised when network-related operations fail."""
    pass


# Common exception catch patterns
def handle_service_errors(logger_instance: logging.Logger | None = None):
    """
    Decorator to handle common service errors with logging.
    Catches specific exceptions and logs them appropriately.
    
    Usage:
        @handle_service_errors()
        async def my_service_call():
            ...
    """
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return await func(*args, **kwargs)
            except asyncio.TimeoutError:
                log = logger_instance or logger
                log.warning(f"{func.__name__} timed out")
                raise
            except (ConnectionError, OSError, asyncio.CancelledError) as e:
                log = logger_instance or logger
                log.error(f"{func.__name__} network error: {type(e).__name__}")
                raise NetworkError(str(e)) from e
            except Exception as e:
                log = logger_instance or logger
                log.exception(f"Unexpected error in {func.__name__}")
                raise

        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return func(*args, **kwargs)
            except asyncio.TimeoutError:
                log = logger_instance or logger
                log.warning(f"{func.__name__} timed out")
                raise
            except (ConnectionError, OSError) as e:
                log = logger_instance or logger
                log.error(f"{func.__name__} network error: {type(e).__name__}")
                raise NetworkError(str(e)) from e
            except Exception as e:
                log = logger_instance or logger
                log.exception(f"Unexpected error in {func.__name__}")
                raise

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator
