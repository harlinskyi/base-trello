"""
Модель Worklog — запис обліку часу для картки.
Принцип SRP: модель описує лише структуру worklog-запису.
"""

import uuid
from datetime import datetime

from sqlalchemy import Float, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Worklog(Base):
    """
    Сутність запису обліку часу.
    Зв'язки:
    - card: картка, до якої належить запис (Many-to-One)
    - author: автор запису (Many-to-One до User)
    """

    __tablename__ = "worklogs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hours: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default="")
    card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    card = relationship("Card", back_populates="worklogs")
    author = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Worklog(id={self.id}, hours={self.hours})>"
