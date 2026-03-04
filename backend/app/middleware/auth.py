"""
Middleware для JWT-авторизації.
Dependency Injection (DI) — принцип DIP із SOLID.
"""

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.utils.security import decode_access_token
from app.repositories.unit_of_work import UnitOfWork
from app.models.user import User, Role

security = HTTPBearer()


async def get_uow(session: AsyncSession = Depends(get_session)) -> UnitOfWork:
    """DI: створює UnitOfWork для кожного запиту."""
    return UnitOfWork(session)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    uow: UnitOfWork = Depends(get_uow),
) -> User:
    """
    DI: отримує поточного авторизованого користувача з JWT-токена.
    Використовується як залежність у маршрутах.
    """
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалідний або прострочений токен",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалідний токен",
        )

    user = await uow.users.get_by_id(uuid.UUID(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Користувача не знайдено",
        )
    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """DI: перевіряє, що поточний користувач має роль Admin."""
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ лише для адміністраторів",
        )
    return current_user
