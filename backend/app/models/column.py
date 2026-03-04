"""
Модель Column — представляє колонку (статус) на Kanban-дошці.
Принцип SRP: модель описує лише структуру та позицію колонки.
"""

import uuid

from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Column(Base):
    """
    Сутність колонки дошки. Визначає статус карток.
    Зв'язки:
    - board: дошка, до якої належить колонка (Many-to-One)
    - cards: картки в цій колонці (One-to-Many)
    """

    __tablename__ = "columns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    board = relationship("Board", back_populates="columns")
    cards = relationship(
        "Card",
        back_populates="column",
        cascade="all, delete-orphan",
        order_by="Card.position",
    )

    def __repr__(self) -> str:
        return f"<Column(id={self.id}, name={self.name}, position={self.position})>"
