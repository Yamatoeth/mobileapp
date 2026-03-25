"""
Auth router: token issuance and current-user endpoints

This minimal implementation issues JWTs when provided a `user_id` and exposes
an authenticated endpoint `/auth/me` to return user info. It intentionally
keeps password handling out of scope to avoid leaking secret handling policies
— you can replace `/auth/token` with a proper username/password flow later.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, decode_token, get_user_by_id, verify_password
from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import User

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
settings = get_settings()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenRequest(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    user_id: Optional[str] = None
    dev_auth_secret: Optional[str] = None


@router.post("/auth/token", response_model=TokenResponse)
async def token_endpoint(
    request: TokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Issue a JWT for a validated user.

    Supported flows:
    - Standard: {"email": "...", "password": "..."}
    - Test mode only: {"user_id": "<id>"}
    - Explicitly enabled insecure dev mode:
      {"user_id": "<id>", "dev_auth_secret": "<shared secret>"}
    """
    if request.email and request.password:
        stmt = select(User).where(User.email == request.email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if not verify_password(request.password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        data = {"sub": user.id}
        token = create_access_token(data)
        return TokenResponse(access_token=token)

    if request.user_id and settings.test_mode:
        token = create_access_token({"sub": request.user_id})
        return TokenResponse(access_token=token)

    if request.user_id and settings.allow_insecure_dev_auth:
        if not settings.dev_auth_secret or request.dev_auth_secret != settings.dev_auth_secret:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid development auth secret")
        token = create_access_token({"sub": request.user_id})
        return TokenResponse(access_token=token)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Use email/password authentication. user_id bootstrap is disabled unless test_mode or allow_insecure_dev_auth is enabled.",
    )


async def _get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.get("/auth/me")
async def me(current_user: User = Depends(_get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "full_name": current_user.full_name}
