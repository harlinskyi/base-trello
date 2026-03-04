"""
Pydantic-схеми для Notification та BoardInvitation.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.notification import InvitationStatus, NotificationType


class InvitationResponse(BaseModel):
    """Відповідь із даними запрошення."""

    id: uuid.UUID
    board_id: uuid.UUID
    inviter_id: uuid.UUID
    invitee_id: uuid.UUID
    status: InvitationStatus
    created_at: datetime
    board_title: str | None = None
    inviter_username: str | None = None

    model_config = {"from_attributes": True}


class InvitationAction(BaseModel):
    """Дія над запрошенням (прийняти/відхилити)."""

    action: str  # "accept" | "decline"


class NotificationResponse(BaseModel):
    """Відповідь із даними сповіщення."""

    id: uuid.UUID
    user_id: uuid.UUID
    type: NotificationType
    title: str
    message: str
    is_read: bool
    link: str | None
    related_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationMarkRead(BaseModel):
    """Позначити сповіщення як прочитані."""

    notification_ids: list[uuid.UUID]
