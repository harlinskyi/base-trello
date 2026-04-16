"""
Pydantic-схеми для Card.
"""

import uuid
from datetime import datetime, date
from typing import Annotated

from pydantic import BaseModel, Field

from app.schemas.user import UserResponse

# Sentinel для розрізнення "не передано" від "null"
UNSET = object()


class CardCreate(BaseModel):
    """Схема для створення картки."""

    title: str
    description: str | None = ""
    tags: list[str] = []
    assignee_id: uuid.UUID | None = None
    priority: str | None = None
    color: str | None = None
    estimate: float | None = None
    due_date: date | None = None
    card_type: str | None = None


class CardUpdate(BaseModel):
    """Схема для оновлення картки."""

    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    assignee_id: uuid.UUID | None = Field(
        default=None, json_schema_extra={"nullable": True}
    )
    priority: str | None = None
    color: str | None = None
    estimate: float | None = None
    due_date: date | None = Field(default=None, json_schema_extra={"nullable": True})
    card_type: str | None = None

    # Треку які поля явно передані
    _explicitly_set: set = set()

    def model_post_init(self, __context) -> None:
        """Зберігаємо список явно переданих полів."""
        pass


class CardMove(BaseModel):
    """Схема для переміщення картки (Drag-and-Drop)."""

    column_id: uuid.UUID
    position: int


class CardResponse(BaseModel):
    """Схема відповіді з даними картки."""

    id: uuid.UUID
    title: str
    description: str | None
    position: int
    tags: list[str] | None
    column_id: uuid.UUID
    assignee_id: uuid.UUID | None
    assignee: UserResponse | None = None
    priority: str | None = None
    color: str | None = None
    estimate: float | None = None
    due_date: date | None = None
    card_type: str | None = None
    created_at: datetime
    updated_at: datetime
    comments_count: int = 0
    logged_hours: float = 0.0

    model_config = {"from_attributes": True}
