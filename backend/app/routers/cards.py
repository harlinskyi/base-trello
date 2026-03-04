"""
Маршрути для управління картками та коментарями.
"""

import uuid

from fastapi import APIRouter, Depends

from app.schemas.card import CardCreate, CardUpdate, CardMove, CardResponse
from app.schemas.comment import CommentCreate, CommentResponse
from app.schemas.worklog import WorklogCreate, WorklogResponse
from app.services.card_service import CardService
from app.middleware.auth import get_uow, get_current_user
from app.repositories.unit_of_work import UnitOfWork
from app.models.user import User

router = APIRouter(prefix="/cards", tags=["Cards"])


# --- Card CRUD ---


@router.post("/column/{column_id}", response_model=CardResponse)
async def create_card(
    column_id: uuid.UUID,
    data: CardCreate,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Створити картку в колонці."""
    service = CardService(uow)
    return await service.create_card(column_id, data, current_user.id)


@router.get("/column/{column_id}", response_model=list[CardResponse])
async def get_cards_by_column(
    column_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Отримати картки колонки."""
    service = CardService(uow)
    return await service.get_cards_by_column(column_id)


@router.get("/{card_id}", response_model=CardResponse)
async def get_card(
    card_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Отримати деталі картки."""
    service = CardService(uow)
    return await service.get_card_detail(card_id)


@router.put("/{card_id}", response_model=CardResponse)
async def update_card(
    card_id: uuid.UUID,
    data: CardUpdate,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Оновити картку."""
    service = CardService(uow)
    return await service.update_card(card_id, data, current_user.id)


@router.patch("/{card_id}/move", response_model=CardResponse)
async def move_card(
    card_id: uuid.UUID,
    data: CardMove,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Переміщення картки (Drag-and-Drop)."""
    service = CardService(uow)
    return await service.move_card(card_id, data, current_user.id)


@router.delete("/{card_id}")
async def delete_card(
    card_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Видалити картку."""
    service = CardService(uow)
    await service.delete_card(card_id, current_user.id)
    return {"detail": "Картку видалено"}


# --- Comments ---


@router.post("/{card_id}/comments", response_model=CommentResponse)
async def add_comment(
    card_id: uuid.UUID,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Додати коментар до картки."""
    service = CardService(uow)
    return await service.add_comment(card_id, data, current_user.id)


@router.get("/{card_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    card_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Отримати коментарі картки."""
    service = CardService(uow)
    return await service.get_comments(card_id)


# --- Worklogs ---


@router.post("/{card_id}/worklogs", response_model=WorklogResponse)
async def add_worklog(
    card_id: uuid.UUID,
    data: WorklogCreate,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Додати запис обліку часу до картки."""
    service = CardService(uow)
    return await service.add_worklog(card_id, data, current_user.id)


@router.get("/{card_id}/worklogs", response_model=list[WorklogResponse])
async def get_worklogs(
    card_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Отримати worklogs картки."""
    service = CardService(uow)
    return await service.get_worklogs(card_id)
