"""
Сервіс для роботи з дошками (Board Service).
Принцип SRP: відповідає лише за бізнес-логіку дошок.
Використовує патерн Factory для створення дошок зі стандартними колонками.
"""

import uuid

from fastapi import HTTPException, status

from app.schemas.board import BoardCreate, BoardUpdate, BoardResponse, BoardListResponse
from app.schemas.column import ColumnCreate, ColumnUpdate, ColumnResponse
from app.schemas.notification import InvitationResponse
from app.repositories.unit_of_work import UnitOfWork
from app.patterns.factory import board_factory
from app.models.column import Column
from app.models.user import Role
from app.services.notification_service import NotificationService


class BoardService:
    """Сервіс управління дошками та колонками."""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def _is_admin(self, user_id: uuid.UUID) -> bool:
        """Перевірити, чи є користувач адміністратором."""
        user = await self._uow.users.get_by_id(user_id)
        return user is not None and user.role == Role.ADMIN

    # --- Board CRUD ---

    async def create_board(
        self, data: BoardCreate, owner_id: uuid.UUID
    ) -> BoardResponse:
        """Створити нову дошку з використанням BoardFactory."""
        board, columns = board_factory.create_board(data.title, owner_id)

        await self._uow.boards.create(board)
        for col in columns:
            col.board_id = board.id
            await self._uow.columns.create(col)

        await self._uow.commit()

        board_full = await self._uow.boards.get_by_id_with_relations(board.id)
        return BoardResponse.model_validate(board_full)

    async def get_boards_for_user(self, user_id: uuid.UUID) -> list[BoardListResponse]:
        """Отримати всі дошки, доступні користувачу. Адмін бачить усі."""
        if await self._is_admin(user_id):
            boards = await self._uow.boards.get_all_with_owner()
        else:
            boards = await self._uow.boards.get_boards_for_user(user_id)
        return [BoardListResponse.model_validate(b) for b in boards]

    async def _check_board_access(self, board, user_id: uuid.UUID) -> None:
        """Перевірити, чи має користувач доступ до дошки."""
        if await self._is_admin(user_id):
            return
        if board.owner_id == user_id:
            return
        member_ids = {m.id for m in board.members}
        if user_id in member_ids:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас немає доступу до цієї дошки",
        )

    async def get_board_detail(
        self, board_id: uuid.UUID, user_id: uuid.UUID
    ) -> BoardResponse:
        """Отримати деталі дошки (тільки owner/member/admin)."""
        board = await self._uow.boards.get_by_id_with_relations(board_id)
        if not board:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Дошку не знайдено",
            )
        await self._check_board_access(board, user_id)
        return BoardResponse.model_validate(board)

    async def update_board(
        self, board_id: uuid.UUID, data: BoardUpdate, user_id: uuid.UUID
    ) -> BoardResponse:
        """Оновити дошку (тільки owner)."""
        board = await self._uow.boards.get_by_id(board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Дошку не знайдено")
        if board.owner_id != user_id and not await self._is_admin(user_id):
            raise HTTPException(
                status_code=403, detail="Тільки власник може редагувати дошку"
            )

        if data.title is not None:
            board.title = data.title

        await self._uow.boards.update(board)
        await self._uow.commit()

        board_full = await self._uow.boards.get_by_id_with_relations(board.id)
        return BoardResponse.model_validate(board_full)

    async def delete_board(self, board_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Видалити дошку (owner або admin)."""
        board = await self._uow.boards.get_by_id(board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Дошку не знайдено")
        if board.owner_id != user_id and not await self._is_admin(user_id):
            raise HTTPException(
                status_code=403, detail="Тільки власник може видалити дошку"
            )

        await self._uow.boards.delete(board_id)
        await self._uow.commit()

    # --- Members ---

    async def invite_member(
        self, board_id: uuid.UUID, member_id: uuid.UUID, user_id: uuid.UUID
    ):
        """Надіслати запрошення на дошку (замість прямого додавання)."""
        notif_service = NotificationService(self._uow)
        return await notif_service.invite_to_board(board_id, member_id, user_id)

    async def remove_member(
        self, board_id: uuid.UUID, member_id: uuid.UUID, user_id: uuid.UUID
    ) -> BoardResponse:
        """Видалити учасника з дошки (тільки owner)."""
        board = await self._uow.boards.get_by_id_with_relations(board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Дошку не знайдено")
        if board.owner_id != user_id and not await self._is_admin(user_id):
            raise HTTPException(
                status_code=403, detail="Тільки власник може видаляти учасників"
            )

        member = await self._uow.users.get_by_id(member_id)
        if not member:
            raise HTTPException(status_code=404, detail="Користувача не знайдено")

        board.remove_member(member)
        await self._uow.commit()

        board = await self._uow.boards.get_by_id_with_relations(board_id)
        return BoardResponse.model_validate(board)

    async def get_pending_invitations(
        self, board_id: uuid.UUID, user_id: uuid.UUID
    ) -> list[InvitationResponse]:
        """Отримати pending-запрошення дошки (тільки owner/admin)."""
        board = await self._uow.boards.get_by_id(board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Дошку не знайдено")

        if board.owner_id != user_id and not await self._is_admin(user_id):
            raise HTTPException(
                status_code=403,
                detail="Тільки власник може переглядати запрошення",
            )

        invitations = await self._uow.invitations.get_pending_for_board(board_id)
        return [
            InvitationResponse(
                id=inv.id,
                board_id=inv.board_id,
                inviter_id=inv.inviter_id,
                invitee_id=inv.invitee_id,
                status=inv.status,
                created_at=inv.created_at,
            )
            for inv in invitations
        ]

    # --- Columns ---

    async def create_column(
        self, board_id: uuid.UUID, data: ColumnCreate, user_id: uuid.UUID
    ) -> ColumnResponse:
        """Створити нову колонку на дошці (owner/admin)."""
        board = await self._uow.boards.get_by_id_with_relations(board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Дошку не знайдено")
        if board.owner_id != user_id and not await self._is_admin(user_id):
            raise HTTPException(
                status_code=403,
                detail="Тільки власник може створювати колонки",
            )

        column = Column(
            name=data.name,
            position=data.position,
            board_id=board_id,
        )
        await self._uow.columns.create(column)
        await self._uow.commit()
        return ColumnResponse.model_validate(column)

    async def update_column(
        self, column_id: uuid.UUID, data: ColumnUpdate, user_id: uuid.UUID
    ) -> ColumnResponse:
        """Оновити колонку (owner/admin)."""
        column = await self._uow.columns.get_by_id(column_id)
        if not column:
            raise HTTPException(status_code=404, detail="Колонку не знайдено")
        board = await self._uow.boards.get_by_id_with_relations(column.board_id)
        if board and board.owner_id != user_id and not await self._is_admin(user_id):
            raise HTTPException(
                status_code=403,
                detail="Тільки власник може редагувати колонки",
            )

        if data.name is not None:
            column.name = data.name
        if data.position is not None:
            column.position = data.position

        await self._uow.columns.update(column)
        await self._uow.commit()
        return ColumnResponse.model_validate(column)

    async def delete_column(self, column_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Видалити колонку (owner/admin)."""
        column = await self._uow.columns.get_by_id(column_id)
        if not column:
            raise HTTPException(status_code=404, detail="Колонку не знайдено")
        board = await self._uow.boards.get_by_id_with_relations(column.board_id)
        if board and board.owner_id != user_id and not await self._is_admin(user_id):
            raise HTTPException(
                status_code=403,
                detail="Тільки власник може видаляти колонки",
            )

        await self._uow.columns.delete(column_id)
        await self._uow.commit()
