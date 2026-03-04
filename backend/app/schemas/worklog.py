"""
Pydantic-схеми для Worklog.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.user import UserResponse


class WorklogCreate(BaseModel):
    """Схема для створення запису обліку часу."""

    hours: float
    description: str | None = ""

    @field_validator("hours")
    @classmethod
    def hours_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Час має бути більше 0")
        if v > 744:  # max ~31 day * 24h
            raise ValueError("Занадто велике значення часу")
        return round(v, 4)


class WorklogResponse(BaseModel):
    """Схема відповіді з даними worklog."""

    id: uuid.UUID
    hours: float
    description: str | None
    card_id: uuid.UUID
    author_id: uuid.UUID
    author: UserResponse | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
