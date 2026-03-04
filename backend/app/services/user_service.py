"""
Сервіс для роботи з користувачами (User Service).
Принцип SRP: відповідає лише за бізнес-логіку управління користувачами.
"""

import uuid

from fastapi import HTTPException, status

from app.schemas.user import UserUpdate, UserResponse, ChangePassword
from app.repositories.unit_of_work import UnitOfWork
from app.utils.security import verify_password, hash_password


class UserService:
    """Сервіс управління користувачами (для адмін-панелі та профілю)."""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def get_all_users(self) -> list[UserResponse]:
        """Отримати список усіх користувачів."""
        users = await self._uow.users.get_all()
        return [UserResponse.model_validate(u) for u in users]

    async def get_user_by_id(self, user_id: uuid.UUID) -> UserResponse:
        """Отримати користувача за ID."""
        user = await self._uow.users.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Користувача не знайдено",
            )
        return UserResponse.model_validate(user)

    async def update_user(self, user_id: uuid.UUID, data: UserUpdate) -> UserResponse:
        """Оновити дані користувача."""
        user = await self._uow.users.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Користувача не знайдено",
            )

        if data.username is not None:
            user.username = data.username
        if data.email is not None:
            user.email = data.email
        if data.role is not None:
            user.role = data.role

        await self._uow.users.update(user)
        await self._uow.commit()
        return UserResponse.model_validate(user)

    async def delete_user(self, user_id: uuid.UUID) -> None:
        """Видалити користувача."""
        user = await self._uow.users.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Користувача не знайдено",
            )
        await self._uow.users.delete(user_id)
        await self._uow.commit()

    async def change_password(self, user_id: uuid.UUID, data: ChangePassword) -> None:
        """Змінити пароль користувача."""
        user = await self._uow.users.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Користувача не знайдено",
            )
        if not verify_password(data.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Невірний поточний пароль",
            )
        if len(data.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Новий пароль має містити щонайменше 6 символів",
            )
        user.hashed_password = hash_password(data.new_password)
        await self._uow.users.update(user)
        await self._uow.commit()
