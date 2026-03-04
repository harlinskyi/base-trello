"""
Патерн Unit of Work (GoF) — координує роботу кількох репозиторіїв
у межах однієї транзакції бази даних.

Обґрунтування вибору:
- Гарантує атомарність операцій (все або нічого).
- Єдина точка управління транзакціями.
- Спрощує тестування — можна замінити на mock UoW.
- Дотримання принципу SRP (SOLID): логіка транзакцій ізольована.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.user_repository import UserRepository
from app.repositories.board_repository import BoardRepository
from app.repositories.card_repository import CardRepository
from app.repositories.notification_repository import (
    NotificationRepository,
    InvitationRepository,
)
from app.repositories.base import BaseRepository
from app.models.column import Column
from app.models.comment import Comment
from app.models.worklog import Worklog


class UnitOfWork:
    """
    Координатор транзакцій.
    Надає доступ до всіх репозиторіїв та керує commit/rollback.
    """

    def __init__(self, session: AsyncSession):
        self._session = session
        self.users = UserRepository(session)
        self.boards = BoardRepository(session)
        self.cards = CardRepository(session)
        self.columns = BaseRepository(Column, session)
        self.comments = BaseRepository(Comment, session)
        self.worklogs = BaseRepository(Worklog, session)
        self.notifications = NotificationRepository(session)
        self.invitations = InvitationRepository(session)

    async def commit(self) -> None:
        """Зберегти всі зміни в базі даних."""
        await self._session.commit()

    async def rollback(self) -> None:
        """Відкатити всі зміни."""
        await self._session.rollback()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            await self.rollback()
