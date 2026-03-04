"""
Маршрути для сповіщень та запрошень.
"""

import uuid

from fastapi import APIRouter, Depends, Query

from app.schemas.notification import (
    NotificationResponse,
    NotificationMarkRead,
    InvitationResponse,
    InvitationAction,
)
from app.services.notification_service import NotificationService
from app.middleware.auth import get_uow, get_current_user
from app.repositories.unit_of_work import UnitOfWork
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# --- Notifications ---


@router.get("", response_model=list[NotificationResponse])
async def get_notifications(
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Отримати сповіщення поточного користувача."""
    service = NotificationService(uow)
    return await service.get_notifications(current_user.id, unread_only)


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Кількість непрочитаних сповіщень."""
    service = NotificationService(uow)
    count = await service.get_unread_count(current_user.id)
    return {"count": count}


@router.post("/mark-read")
async def mark_read(
    data: NotificationMarkRead,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Позначити сповіщення як прочитані."""
    service = NotificationService(uow)
    await service.mark_read(data.notification_ids, current_user.id)
    return {"detail": "Позначено як прочитані"}


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Позначити всі як прочитані."""
    service = NotificationService(uow)
    await service.mark_all_read(current_user.id)
    return {"detail": "Усі позначено як прочитані"}


# --- Invitations ---


@router.get("/invitations", response_model=list[InvitationResponse])
async def get_invitations(
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Отримати запрошення на дошки."""
    service = NotificationService(uow)
    return await service.get_my_invitations(current_user.id)


@router.post("/invitations/{invitation_id}", response_model=InvitationResponse)
async def respond_invitation(
    invitation_id: uuid.UUID,
    data: InvitationAction,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Прийняти або відхилити запрошення."""
    service = NotificationService(uow)
    return await service.respond_to_invitation(invitation_id, data, current_user.id)
