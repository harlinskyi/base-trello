"""
Сервіс для роботи з нотифікаціями та запрошеннями.
Принцип SRP: відповідає лише за бізнес-логіку сповіщень.
Використовує патерн Strategy для доставки сповіщень.
"""

import uuid

from fastapi import HTTPException, status

from app.schemas.notification import (
    NotificationResponse,
    InvitationResponse,
    InvitationAction,
)
from app.repositories.unit_of_work import UnitOfWork
from app.models.notification import (
    Notification,
    BoardInvitation,
    InvitationStatus,
    NotificationType,
)
from app.models.user import Role
from app.patterns.strategy import (
    NotificationStrategy,
    DatabaseNotificationStrategy,
    LogNotificationStrategy,
)


class NotificationService:
    """
    Сервіс управління сповіщеннями та запрошеннями.
    Використовує Strategy для доставки — за замовчуванням
    зберігає у БД та логує.
    """

    def __init__(
        self,
        uow: UnitOfWork,
        strategies: list[NotificationStrategy] | None = None,
    ):
        self._uow = uow
        # Стратегії доставки (DIP: залежність від абстракцій)
        self._strategies: list[NotificationStrategy] = strategies or [
            DatabaseNotificationStrategy(),
            LogNotificationStrategy(),
        ]

    # ---------- Notifications ----------

    async def get_notifications(
        self, user_id: uuid.UUID, unread_only: bool = False
    ) -> list[NotificationResponse]:
        """Отримати сповіщення користувача."""
        items = await self._uow.notifications.get_by_user(user_id, unread_only)
        return [NotificationResponse.model_validate(n) for n in items]

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        """Кількість непрочитаних сповіщень."""
        return await self._uow.notifications.count_unread(user_id)

    async def mark_read(
        self, notification_ids: list[uuid.UUID], user_id: uuid.UUID
    ) -> None:
        """Позначити сповіщення як прочитані."""
        await self._uow.notifications.mark_read(notification_ids, user_id)
        await self._uow.commit()

    async def mark_all_read(self, user_id: uuid.UUID) -> None:
        """Позначити усі як прочитані."""
        await self._uow.notifications.mark_all_read(user_id)
        await self._uow.commit()

    async def create_notification(
        self,
        user_id: uuid.UUID,
        ntype: NotificationType,
        title: str,
        message: str,
        link: str | None = None,
        related_id: uuid.UUID | None = None,
    ) -> Notification | None:
        """
        Створити нове сповіщення через усі зареєстровані стратегії.
        Патерн Strategy: кожна стратегія обробляє доставку по-своєму.
        """
        result = None
        for strategy in self._strategies:
            notification = await strategy.send(
                user_id=user_id,
                ntype=ntype,
                title=title,
                message=message,
                link=link,
                related_id=related_id,
                uow=self._uow,
            )
            if notification is not None and result is None:
                result = notification
        return result

    # ---------- Invitations ----------

    async def invite_to_board(
        self, board_id: uuid.UUID, invitee_id: uuid.UUID, inviter_id: uuid.UUID
    ) -> InvitationResponse:
        """Надіслати запрошення на дошку."""
        board = await self._uow.boards.get_by_id(board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Дошку не знайдено")

        # Адмін або власник може запрошувати
        inviter = await self._uow.users.get_by_id(inviter_id)
        is_admin = inviter is not None and inviter.role == Role.ADMIN
        if board.owner_id != inviter_id and not is_admin:
            raise HTTPException(
                status_code=403, detail="Тільки власник може запрошувати"
            )
        if invitee_id == inviter_id:
            raise HTTPException(
                status_code=400, detail="Не можна запросити самого себе"
            )

        invitee = await self._uow.users.get_by_id(invitee_id)
        if not invitee:
            raise HTTPException(status_code=404, detail="Користувача не знайдено")

        # Адміністратор не може бути учасником дошки
        if invitee.role == Role.ADMIN:
            raise HTTPException(
                status_code=400,
                detail="Адміністратор не може бути учасником дошки",
            )

        # Перевірка: чи вже є pending/accepted запрошення
        existing = await self._uow.invitations.get_by_board_and_user(
            board_id, invitee_id
        )
        if existing:
            if existing.status == InvitationStatus.PENDING:
                raise HTTPException(status_code=400, detail="Запрошення вже надіслано")
            if existing.status == InvitationStatus.ACCEPTED:
                raise HTTPException(
                    status_code=400, detail="Користувач вже є учасником"
                )
            # Якщо declined — оновлюємо на pending
            existing.status = InvitationStatus.PENDING
            await self._uow.invitations.update(existing)
        else:
            invitation = BoardInvitation(
                board_id=board_id,
                inviter_id=inviter_id,
                invitee_id=invitee_id,
                status=InvitationStatus.PENDING,
            )
            await self._uow.invitations.create(invitation)
            existing = invitation

        # Створюємо нотифікацію
        await self.create_notification(
            user_id=invitee_id,
            ntype=NotificationType.BOARD_INVITATION,
            title="Запрошення на дошку",
            message=f"{inviter.username} запрошує вас на дошку «{board.title}»",
            link=f"/board/{board_id}",
            related_id=existing.id,
        )

        await self._uow.commit()

        return InvitationResponse(
            id=existing.id,
            board_id=existing.board_id,
            inviter_id=existing.inviter_id,
            invitee_id=existing.invitee_id,
            status=existing.status,
            created_at=existing.created_at,
            board_title=board.title,
            inviter_username=inviter.username,
        )

    async def get_my_invitations(self, user_id: uuid.UUID) -> list[InvitationResponse]:
        """Отримати непрочитані запрошення."""
        invitations = await self._uow.invitations.get_pending_for_user(user_id)
        result = []
        for inv in invitations:
            result.append(
                InvitationResponse(
                    id=inv.id,
                    board_id=inv.board_id,
                    inviter_id=inv.inviter_id,
                    invitee_id=inv.invitee_id,
                    status=inv.status,
                    created_at=inv.created_at,
                    board_title=inv.board.title if inv.board else None,
                    inviter_username=inv.inviter.username if inv.inviter else None,
                )
            )
        return result

    async def respond_to_invitation(
        self, invitation_id: uuid.UUID, action: InvitationAction, user_id: uuid.UUID
    ) -> InvitationResponse:
        """Прийняти або відхилити запрошення."""
        invitation = await self._uow.invitations.get_by_id(invitation_id)
        if not invitation:
            raise HTTPException(status_code=404, detail="Запрошення не знайдено")
        if invitation.invitee_id != user_id:
            raise HTTPException(status_code=403, detail="Це не ваше запрошення")
        if invitation.status != InvitationStatus.PENDING:
            raise HTTPException(status_code=400, detail="Запрошення вже оброблено")

        if action.action == "accept":
            invitation.status = InvitationStatus.ACCEPTED
            # Додаємо користувача до дошки
            board = await self._uow.boards.get_by_id_with_relations(invitation.board_id)
            user = await self._uow.users.get_by_id(user_id)
            if board and user:
                board.add_member(user)
                # Нотифікація для owner
                await self.create_notification(
                    user_id=invitation.inviter_id,
                    ntype=NotificationType.BOARD_INVITATION,
                    title="Запрошення прийнято",
                    message=f"{user.username} приєднався до дошки «{board.title}»",
                    link=f"/board/{board.id}",
                )
        elif action.action == "decline":
            invitation.status = InvitationStatus.DECLINED
            board = await self._uow.boards.get_by_id(invitation.board_id)
            user = await self._uow.users.get_by_id(user_id)
            if board and user:
                await self.create_notification(
                    user_id=invitation.inviter_id,
                    ntype=NotificationType.BOARD_INVITATION,
                    title="Запрошення відхилено",
                    message=f"{user.username} відхилив запрошення на дошку «{board.title}»",
                    link=f"/board/{board.id}",
                )
        else:
            raise HTTPException(
                status_code=400, detail="Дія має бути 'accept' або 'decline'"
            )

        await self._uow.invitations.update(invitation)
        await self._uow.commit()

        return InvitationResponse(
            id=invitation.id,
            board_id=invitation.board_id,
            inviter_id=invitation.inviter_id,
            invitee_id=invitation.invitee_id,
            status=invitation.status,
            created_at=invitation.created_at,
        )
