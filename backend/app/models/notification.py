"""
Модель Notification — сповіщення користувача.
Модель BoardInvitation — запрошення на дошку.
Принцип SRP (SOLID): моделі відповідають лише за структуру даних.
"""

import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Text, Boolean, Enum as SAEnum, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InvitationStatus(str, enum.Enum):
    """Статус запрошення на дошку."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class NotificationType(str, enum.Enum):
    """Тип сповіщення."""

    BOARD_INVITATION = "board_invitation"
    CARD_ASSIGNED = "card_assigned"
    CARD_MOVED = "card_moved"
    CARD_UPDATED = "card_updated"
    CARD_COMMENTED = "card_commented"


class BoardInvitation(Base):
    """
    Запрошення користувача на дошку.
    Зв'язки:
    - board: дошка, на яку запрошують (Many-to-One)
    - inviter: хто запросив (Many-to-One до User)
    - invitee: кого запросили (Many-to-One до User)
    """

    __tablename__ = "board_invitations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False
    )
    inviter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invitee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[InvitationStatus] = mapped_column(
        SAEnum(InvitationStatus, name="invitation_status"),
        default=InvitationStatus.PENDING,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    board = relationship("Board", backref="invitations")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])

    def __repr__(self) -> str:
        return f"<BoardInvitation(id={self.id}, status={self.status})>"


class Notification(Base):
    """
    Сповіщення для користувача.
    Зв'язки:
    - user: отримувач сповіщення (Many-to-One до User)
    """

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType, name="notification_type"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    related_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user = relationship("User", backref="notifications")

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, type={self.type}, is_read={self.is_read})>"
