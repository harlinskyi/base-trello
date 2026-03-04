"""
Репозиторій для Card.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card
from app.repositories.base import BaseRepository


class CardRepository(BaseRepository[Card]):
    """Репозиторій для роботи з картками."""

    def __init__(self, session: AsyncSession):
        super().__init__(Card, session)

    async def get_by_column(self, column_id: uuid.UUID):
        """Отримати всі картки колонки, відсортовані за позицією."""
        result = await self._session.execute(
            select(Card)
            .options(
                selectinload(Card.assignee),
                selectinload(Card.comments),
                selectinload(Card.worklogs),
            )
            .where(Card.column_id == column_id)
            .order_by(Card.position)
        )
        return result.scalars().all()

    async def get_by_id_with_relations(self, card_id: uuid.UUID) -> Card | None:
        """Отримати картку з усіма зв'язками."""
        result = await self._session.execute(
            select(Card)
            .options(
                selectinload(Card.assignee),
                selectinload(Card.comments),
                selectinload(Card.worklogs),
            )
            .where(Card.id == card_id)
        )
        return result.scalar_one_or_none()
