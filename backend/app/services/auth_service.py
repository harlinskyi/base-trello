"""
Сервіс авторизації (Auth Service).
Шар бізнес-логіки для реєстрації та входу.
Принцип SRP (SOLID): сервіс відповідає лише за auth-логіку.
"""

from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, TokenResponse, UserResponse
from app.repositories.unit_of_work import UnitOfWork
from app.utils.security import hash_password, verify_password, create_access_token


class AuthService:
    """Сервіс для реєстрації та авторизації користувачів."""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def register(self, data: UserCreate) -> TokenResponse:
        """Реєстрація нового користувача."""
        # Перевірка унікальності email
        existing = await self._uow.users.get_by_email(data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Користувач з таким email вже існує",
            )

        # Перевірка унікальності username
        existing = await self._uow.users.get_by_username(data.username)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Користувач з таким username вже існує",
            )

        user = User(
            username=data.username,
            email=data.email,
            hashed_password=hash_password(data.password),
        )
        await self._uow.users.create(user)
        await self._uow.commit()

        token = create_access_token({"sub": str(user.id)})
        return TokenResponse(
            access_token=token,
            user=UserResponse.model_validate(user),
        )

    async def login(self, data: UserLogin) -> TokenResponse:
        """Авторизація користувача."""
        user = await self._uow.users.get_by_email(data.email)
        if not user or not verify_password(data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Невірний email або пароль",
            )

        token = create_access_token({"sub": str(user.id)})
        return TokenResponse(
            access_token=token,
            user=UserResponse.model_validate(user),
        )
