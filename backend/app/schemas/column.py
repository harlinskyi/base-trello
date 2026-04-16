"""
Pydantic-схеми для Column.
"""

import uuid

from pydantic import BaseModel


class ColumnCreate(BaseModel):
    """Схема для створення колонки."""

    name: str
    color: str | None = None
    position: int = 0


class ColumnUpdate(BaseModel):
    """Схема для оновлення колонки."""

    name: str | None = None
    color: str | None = None
    position: int | None = None


class ColumnResponse(BaseModel):
    """Схема відповіді з даними колонки."""

    id: uuid.UUID
    name: str
    color: str | None = None
    position: int
    board_id: uuid.UUID

    model_config = {"from_attributes": True}
