"""
Pydantic-схеми для Comment.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserResponse


class CommentCreate(BaseModel):
    """Схема для створення коментаря."""

    text: str


class CommentResponse(BaseModel):
    """Схема відповіді з даними коментаря."""

    id: uuid.UUID
    text: str
    card_id: uuid.UUID
    author_id: uuid.UUID
    author: UserResponse | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
