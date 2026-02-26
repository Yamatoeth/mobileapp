
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db import models
from app.schemas.user import UserResponse

router = APIRouter()

@router.put("/users/{user_id}", response_model=UserResponse)
async def get_or_create_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(models.User, user_id)
    if user is None:
        user = models.User(id=user_id)
        db.add(user)
        await db.flush()
    return UserResponse(id=user.id, email=getattr(user, "email", None))
