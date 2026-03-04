"""
Маршрути авторизації: реєстрація та вхід.
"""

from fastapi import APIRouter, Depends

from app.schemas.user import UserCreate, UserLogin, TokenResponse
from app.services.auth_service import AuthService
from app.middleware.auth import get_uow
from app.repositories.unit_of_work import UnitOfWork

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate, uow: UnitOfWork = Depends(get_uow)):
    """Реєстрація нового користувача."""
    service = AuthService(uow)
    return await service.register(data)


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, uow: UnitOfWork = Depends(get_uow)):
    """Авторизація (вхід)."""
    service = AuthService(uow)
    return await service.login(data)
