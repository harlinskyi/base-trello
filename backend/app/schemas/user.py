"""
Pydantic-схеми для User.
Принцип ISP (SOLID): окремі схеми для створення, оновлення та відповіді.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import Role


class UserCreate(BaseModel):
    """Схема для реєстрації нового користувача."""

    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    """Схема для авторизації."""

    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Схема для оновлення профілю користувача."""

    username: str | None = None
    email: EmailStr | None = None
    role: Role | None = None


class ChangePassword(BaseModel):
    """Схема для зміни пароля."""

    current_password: str
    new_password: str


class UserResponse(BaseModel):
    """Схема відповіді з даними користувача."""

    id: uuid.UUID
    username: str
    email: str
    role: Role
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Схема відповіді з JWT-токеном."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
