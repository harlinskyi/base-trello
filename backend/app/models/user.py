"""
Модель User — представляє користувача системи.
Принцип SRP (SOLID): модель відповідає лише за опис структури даних користувача.
"""

import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Enum as SAEnum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Role(str, enum.Enum):
    """Перелік ролей користувачів у системі."""

    ADMIN = "admin"
    USER = "user"


class User(Base):
    """
    Сутність користувача.
    Зв'язки:
    - owned_boards: дошки, що належать користувачу (One-to-Many)
    - assigned_cards: картки, призначені на користувача (One-to-Many)
    - comments: коментарі, залишені користувачем (One-to-Many)
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(
        SAEnum(Role, name="user_role"), default=Role.USER, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    owned_boards = relationship(
        "Board", back_populates="owner", cascade="all, delete-orphan"
    )
    assigned_cards = relationship("Card", back_populates="assignee")
    comments = relationship(
        "Comment", back_populates="author", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username}, role={self.role})>"
