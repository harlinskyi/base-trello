"""
Pydantic-схеми для Column.
"""

import uuid

from pydantic import BaseModel


class ColumnCreate(BaseModel):
    """Схема для створення колонки."""

    name: str
    position: int = 0


class ColumnUpdate(BaseModel):
    """Схема для оновлення колонки."""

    name: str | None = None
    position: int | None = None


class ColumnResponse(BaseModel):
    """Схема відповіді з даними колонки."""

    id: uuid.UUID
    name: str
    position: int
    board_id: uuid.UUID

    model_config = {"from_attributes": True}
