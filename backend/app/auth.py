"""
JWT auth helpers

Provides token creation and verification utilities and a FastAPI
dependency helper to obtain the current user from a Bearer token.

This module uses `jwt` (PyJWT). If the `jwt` package is not installed the
functions will raise an informative RuntimeError.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, status

from app.core.config import get_settings
from app.db.database import async_session_maker
from app.db.models import User

settings = get_settings()

try:
    import jwt
except Exception:  # pragma: no cover - runtime dependency check
    jwt = None


def _ensure_jwt():
    if jwt is None:
        raise RuntimeError(
            "PyJWT is required for JWT operations. Install with `pip install PyJWT`"
        )


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    _ensure_jwt()
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=60))
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)
    # PyJWT may return bytes on some versions
    if isinstance(token, bytes):
        token = token.decode()
    return token


def decode_token(token: str) -> Dict[str, Any]:
    _ensure_jwt()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate token")


async def get_current_user(token: str = Depends(lambda: None)) -> User:  # placeholder for dependency wiring
    """Dependency that decodes a Bearer token from the Authorization header and returns the User.

    Note: In FastAPI, you typically use `oauth2_scheme = OAuth2PasswordBearer(...)` and then
    declare `token: str = Depends(oauth2_scheme)`. Here we provide a simple helper that callers
    should wrap with the appropriate dependency.
    """
    raise RuntimeError("Use the provided helpers from `backend/app/api/auth.py` which wire FastAPI dependencies.")


async def get_user_by_id(user_id: str) -> Optional[User]:
    async with async_session_maker() as session:
        user = await session.get(User, user_id)
        return user


__all__ = ["create_access_token", "decode_token", "get_current_user", "get_user_by_id"]
