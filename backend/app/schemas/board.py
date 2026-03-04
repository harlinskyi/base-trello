"""
Pydantic-схеми для Board.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserResponse
from app.schemas.column import ColumnResponse


class BoardCreate(BaseModel):
    """Схема для створення нової дошки."""

    title: str


class BoardUpdate(BaseModel):
    """Схема для оновлення дошки."""

    title: str | None = None


class BoardResponse(BaseModel):
    """Схема відповіді з даними дошки."""

    id: uuid.UUID
    title: str
    owner_id: uuid.UUID
    created_at: datetime
    columns: list[ColumnResponse] = []
    members: list[UserResponse] = []

    model_config = {"from_attributes": True}


class BoardListResponse(BaseModel):
    """Короткий формат дошки для списків."""

    id: uuid.UUID
    title: str
    owner_id: uuid.UUID
    owner: UserResponse | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
