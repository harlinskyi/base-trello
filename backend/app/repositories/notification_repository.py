"""
Репозиторій для Notification та BoardInvitation.
"""

import uuid

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, BoardInvitation, InvitationStatus
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    """Репозиторій для сповіщень."""

    def __init__(self, session: AsyncSession):
        super().__init__(Notification, session)

    async def get_by_user(
        self, user_id: uuid.UUID, unread_only: bool = False
    ) -> list[Notification]:
        """Отримати сповіщення користувача."""
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
        )
        if unread_only:
            stmt = stmt.where(Notification.is_read == False)  # noqa: E712
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_unread(self, user_id: uuid.UUID) -> int:
        """Кількість непрочитаних сповіщень."""
        from sqlalchemy import func

        stmt = (
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user_id, Notification.is_read == False
            )  # noqa: E712
        )
        result = await self._session.execute(stmt)
        return result.scalar() or 0

    async def mark_read(
        self, notification_ids: list[uuid.UUID], user_id: uuid.UUID
    ) -> None:
        """Позначити сповіщення як прочитані."""
        await self._session.execute(
            update(Notification)
            .where(
                Notification.id.in_(notification_ids),
                Notification.user_id == user_id,
            )
            .values(is_read=True)
        )
        await self._session.flush()

    async def mark_all_read(self, user_id: uuid.UUID) -> None:
        """Позначити усі сповіщення як прочитані."""
        await self._session.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id, Notification.is_read == False
            )  # noqa: E712
            .values(is_read=True)
        )
        await self._session.flush()


class InvitationRepository(BaseRepository[BoardInvitation]):
    """Репозиторій для запрошень на дошку."""

    def __init__(self, session: AsyncSession):
        super().__init__(BoardInvitation, session)

    async def get_pending_for_user(self, user_id: uuid.UUID) -> list[BoardInvitation]:
        """Отримати непрочитані запрошення."""
        stmt = (
            select(BoardInvitation)
            .options(
                selectinload(BoardInvitation.board),
                selectinload(BoardInvitation.inviter),
            )
            .where(
                BoardInvitation.invitee_id == user_id,
                BoardInvitation.status == InvitationStatus.PENDING,
            )
            .order_by(BoardInvitation.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_board_and_user(
        self, board_id: uuid.UUID, user_id: uuid.UUID
    ) -> BoardInvitation | None:
        """Знайти запрошення за дошкою і користувачем."""
        stmt = select(BoardInvitation).where(
            BoardInvitation.board_id == board_id,
            BoardInvitation.invitee_id == user_id,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def has_accepted_invitation(
        self, board_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Перевірити чи користувач прийняв запрошення."""
        stmt = select(BoardInvitation).where(
            BoardInvitation.board_id == board_id,
            BoardInvitation.invitee_id == user_id,
            BoardInvitation.status == InvitationStatus.ACCEPTED,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None
