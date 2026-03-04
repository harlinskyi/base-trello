"""
Репозиторій для Board.
"""

import uuid

from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.board import Board, board_members
from app.repositories.base import BaseRepository


class BoardRepository(BaseRepository[Board]):
    """Репозиторій для роботи з дошками."""

    def __init__(self, session: AsyncSession):
        super().__init__(Board, session)

    async def get_by_id_with_relations(self, board_id: uuid.UUID) -> Board | None:
        """Отримати дошку з усіма зв'язками (columns, members)."""
        result = await self._session.execute(
            select(Board)
            .options(
                selectinload(Board.columns),
                selectinload(Board.members),
                selectinload(Board.owner),
            )
            .where(Board.id == board_id)
        )
        return result.scalar_one_or_none()

    async def get_boards_for_user(self, user_id: uuid.UUID):
        """Отримати всі дошки, доступні користувачу (owned + member)."""
        member_board_ids = select(board_members.c.board_id).where(
            board_members.c.user_id == user_id
        )
        stmt = (
            select(Board)
            .where(
                or_(
                    Board.owner_id == user_id,
                    Board.id.in_(member_board_ids),
                )
            )
            .options(selectinload(Board.owner))
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_all_with_owner(self):
        """Отримати всі дошки (для адміна)."""
        stmt = select(Board).options(selectinload(Board.owner))
        result = await self._session.execute(stmt)
        return result.scalars().all()
