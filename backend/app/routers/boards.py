"""
Маршрути для управління дошками, колонками та членством.
"""

import uuid

from fastapi import APIRouter, Depends

from app.schemas.board import BoardCreate, BoardUpdate, BoardResponse, BoardListResponse
from app.schemas.column import ColumnCreate, ColumnUpdate, ColumnResponse
from app.schemas.notification import InvitationResponse
from app.services.board_service import BoardService
from app.middleware.auth import get_uow, get_current_user
from app.repositories.unit_of_work import UnitOfWork
from app.models.user import User

router = APIRouter(prefix="/boards", tags=["Boards"])


# --- Board CRUD ---


@router.post("", response_model=BoardResponse)
async def create_board(
    data: BoardCreate,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Створити нову дошку."""
    service = BoardService(uow)
    return await service.create_board(data, current_user.id)


@router.get("", response_model=list[BoardListResponse])
async def get_my_boards(
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Отримати дошки поточного користувача (owned + member)."""
    service = BoardService(uow)
    return await service.get_boards_for_user(current_user.id)


@router.get("/{board_id}", response_model=BoardResponse)
async def get_board(
    board_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Отримати деталі дошки."""
    service = BoardService(uow)
    return await service.get_board_detail(board_id, current_user.id)


@router.put("/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: uuid.UUID,
    data: BoardUpdate,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Оновити дошку (тільки owner)."""
    service = BoardService(uow)
    return await service.update_board(board_id, data, current_user.id)


@router.delete("/{board_id}")
async def delete_board(
    board_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Видалити дошку (тільки owner)."""
    service = BoardService(uow)
    await service.delete_board(board_id, current_user.id)
    return {"detail": "Дошку видалено"}


# --- Members ---


@router.post("/{board_id}/members/{member_id}", response_model=InvitationResponse)
async def invite_member(
    board_id: uuid.UUID,
    member_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Надіслати запрошення на дошку (тільки owner)."""
    service = BoardService(uow)
    return await service.invite_member(board_id, member_id, current_user.id)


@router.delete("/{board_id}/members/{member_id}", response_model=BoardResponse)
async def remove_member(
    board_id: uuid.UUID,
    member_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Видалити учасника з дошки (тільки owner)."""
    service = BoardService(uow)
    return await service.remove_member(board_id, member_id, current_user.id)


# --- Columns ---


@router.post("/{board_id}/columns", response_model=ColumnResponse)
async def create_column(
    board_id: uuid.UUID,
    data: ColumnCreate,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Створити колонку на дошці."""
    service = BoardService(uow)
    return await service.create_column(board_id, data, current_user.id)


@router.put("/columns/{column_id}", response_model=ColumnResponse)
async def update_column(
    column_id: uuid.UUID,
    data: ColumnUpdate,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Оновити колонку."""
    service = BoardService(uow)
    return await service.update_column(column_id, data, current_user.id)


@router.delete("/columns/{column_id}")
async def delete_column(
    column_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Видалити колонку."""
    service = BoardService(uow)
    await service.delete_column(column_id, current_user.id)
    return {"detail": "Колонку видалено"}
