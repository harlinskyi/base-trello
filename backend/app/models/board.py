"""
Модель Board — представляє Kanban-дошку.
Принцип SRP: модель відповідає лише за структуру дошки та її зв'язки.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Table, Column as SAColumn, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# Таблиця зв'язку Many-to-Many: Board <-> User (members)
board_members = Table(
    "board_members",
    Base.metadata,
    SAColumn(
        "board_id",
        UUID(as_uuid=True),
        ForeignKey("boards.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    SAColumn(
        "user_id",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Board(Base):
    """
    Сутність Kanban-дошки.
    Зв'язки:
    - owner: власник дошки (Many-to-One до User)
    - members: учасники дошки (Many-to-Many до User через board_members)
    - columns: колонки дошки (One-to-Many до Column)
    """

    __tablename__ = "boards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    owner = relationship("User", back_populates="owned_boards")
    members = relationship("User", secondary=board_members, lazy="selectin")
    columns = relationship(
        "Column",
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="Column.position",
    )

    def add_member(self, user) -> None:
        """Додає учасника до дошки, якщо він ще не є учасником."""
        if user not in self.members:
            self.members.append(user)

    def remove_member(self, user) -> None:
        """Видаляє учасника з дошки."""
        if user in self.members:
            self.members.remove(user)

    def __repr__(self) -> str:
        return f"<Board(id={self.id}, title={self.title})>"
