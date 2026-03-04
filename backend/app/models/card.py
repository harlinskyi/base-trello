"""
Модель Card — представляє картку на Kanban-дошці.
Принцип SRP: модель описує структуру картки та її зв'язки.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func, Float, Date
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Card(Base):
    """
    Сутність картки.
    Поля: назва, опис, теги, виконавець, пріоритет, колір, estimate, дати створення/зміни.
    Зв'язки:
    - column: колонка (статус) картки (Many-to-One)
    - assignee: виконавець картки (Many-to-One до User)
    - comments: коментарі до картки (One-to-Many)
    - worklogs: записи обліку часу (One-to-Many)
    """

    __tablename__ = "cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String), default=list)

    # Нові поля
    priority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(30), nullable=True)
    estimate: Mapped[float | None] = mapped_column(Float, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    card_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default="basic"
    )

    column_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("columns.id", ondelete="CASCADE"), nullable=False
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    column = relationship("Column", back_populates="cards")
    assignee = relationship("User", back_populates="assigned_cards")
    comments = relationship(
        "Comment",
        back_populates="card",
        cascade="all, delete-orphan",
        order_by="Comment.created_at",
    )
    worklogs = relationship(
        "Worklog",
        back_populates="card",
        cascade="all, delete-orphan",
        order_by="Worklog.created_at",
    )

    def update_status(self, new_column_id: uuid.UUID) -> None:
        """Переміщує картку до іншої колонки (зміна статусу)."""
        self.column_id = new_column_id

    def __repr__(self) -> str:
        return f"<Card(id={self.id}, title={self.title})>"
