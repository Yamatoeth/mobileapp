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

from app.auth import create_access_token, decode_token, get_user_by_id
from app.db.models import User

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenRequest(BaseModel):
    user_id: Optional[str] = None
    # In future add username/password fields


@router.post("/auth/token", response_model=TokenResponse)
async def token_endpoint(request: TokenRequest):
    """Issue a JWT for the given `user_id`. This is intentionally minimal.

    Expected input: {"user_id": "<id>"}
    """
    if not request.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id required")

    # Create token with subject = user_id
    data = {"sub": request.user_id}
    token = create_access_token(data)
    return TokenResponse(access_token=token)


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
