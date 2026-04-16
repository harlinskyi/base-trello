"""
Сервіс для роботи з картками (Card Service).
Використовує:
- CardFactory (патерн Factory) для створення карток.
- EventManager (патерн Observer) для сповіщень при зміні статусу/призначенні.
- NotificationService для створення реальних нотифікацій у БД.
"""

import uuid

from fastapi import HTTPException, status

from app.schemas.card import CardCreate, CardUpdate, CardMove, CardResponse
from app.schemas.comment import CommentCreate, CommentResponse
from app.schemas.worklog import WorklogCreate, WorklogResponse
from app.repositories.unit_of_work import UnitOfWork
from app.patterns.factory import card_factory
from app.patterns.observer import event_manager
from app.models.comment import Comment
from app.models.worklog import Worklog
from app.models.notification import NotificationType
from app.models.user import Role


class CardService:
    """Сервіс управління картками та коментарями."""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def _is_admin(self, user_id: uuid.UUID) -> bool:
        """Перевірити, чи є користувач адміністратором."""
        user = await self._uow.users.get_by_id(user_id)
        return user is not None and user.role == Role.ADMIN

    async def _get_board_for_column(self, column_id: uuid.UUID):
        """Отримати дошку для колонки."""
        column = await self._uow.columns.get_by_id(column_id)
        if not column:
            return None, None
        board = await self._uow.boards.get_by_id_with_relations(column.board_id)
        return column, board

    async def _notify_card_users(
        self,
        card,
        board,
        actor_id: uuid.UUID,
        ntype: NotificationType,
        title: str,
        message: str,
    ):
        """Надіслати нотифікацію owner/assignee дошки (крім самого актора)."""
        from app.services.notification_service import NotificationService

        notif_service = NotificationService(self._uow)
        recipients = set()

        # Owner дошки
        if board and board.owner_id != actor_id:
            recipients.add(board.owner_id)

        # Assignee картки
        if card.assignee_id and card.assignee_id != actor_id:
            recipients.add(card.assignee_id)

        for user_id in recipients:
            await notif_service.create_notification(
                user_id=user_id,
                ntype=ntype,
                title=title,
                message=message,
                link=f"/board/{board.id}" if board else None,
            )

    async def _check_edit_permission(
        self, card, user_id: uuid.UUID
    ) -> tuple[bool, bool]:
        """
        Перевірити права на редагування.
        Повертає (is_owner, is_member).
        Owner може редагувати name, assignee, tags.
        Member може лише переміщувати між колонками.
        """
        column = await self._uow.columns.get_by_id(card.column_id)
        if not column:
            return False, False
        board = await self._uow.boards.get_by_id_with_relations(column.board_id)
        if not board:
            return False, False

        is_owner = board.owner_id == user_id
        member_ids = {m.id for m in board.members}
        is_member = user_id in member_ids

        # Адмін має повні права як власник
        if await self._is_admin(user_id):
            is_owner = True

        return is_owner, is_member

    # --- Card CRUD ---

    async def create_card(
        self, column_id: uuid.UUID, data: CardCreate, user_id: uuid.UUID
    ) -> CardResponse:
        """Створити нову картку з використанням CardFactory."""
        column, board = await self._get_board_for_column(column_id)
        if not column:
            raise HTTPException(status_code=404, detail="Колонку не знайдено")

        # Визначаємо позицію (в кінець колонки)
        cards = await self._uow.cards.get_by_column(column_id)
        position = len(cards)

        # Перевірка: assignee має бути member або owner дошки, але не адмін
        if data.assignee_id:
            assignee_user = await self._uow.users.get_by_id(data.assignee_id)
            if assignee_user and assignee_user.role == Role.ADMIN:
                raise HTTPException(
                    status_code=400,
                    detail="Адміністратор не може бути призначений виконавцем",
                )
            allowed_ids = {board.owner_id} | {m.id for m in board.members}
            if data.assignee_id not in allowed_ids:
                raise HTTPException(
                    status_code=400,
                    detail="Виконавцем можна призначити лише учасника дошки",
                )

        card = card_factory.create_card(
            title=data.title,
            column_id=column_id,
            description=data.description or "",
            assignee_id=data.assignee_id,
            tags=data.tags,
            position=position,
            priority=data.priority,
            color=data.color,
            estimate=data.estimate,
            due_date=data.due_date,
            card_type=data.card_type,
        )

        await self._uow.cards.create(card)

        # Observer: сповіщення при призначенні
        if data.assignee_id:
            assignee = await self._uow.users.get_by_id(data.assignee_id)
            if assignee:
                await event_manager.notify(
                    "card.assigned",
                    {
                        "card_title": card.title,
                        "assignee_username": assignee.username,
                    },
                )

        # Реальна нотифікація для assignee
        if data.assignee_id and data.assignee_id != user_id:
            actor = await self._uow.users.get_by_id(user_id)
            from app.services.notification_service import NotificationService

            notif_service = NotificationService(self._uow)
            await notif_service.create_notification(
                user_id=data.assignee_id,
                ntype=NotificationType.CARD_ASSIGNED,
                title="Вас призначено виконавцем",
                message=f"{actor.username if actor else 'Хтось'} призначив вас на картку «{card.title}»",
                link=f"/board/{board.id}" if board else None,
            )

        await self._uow.commit()

        card_full = await self._uow.cards.get_by_id_with_relations(card.id)
        return CardResponse.model_validate(card_full)

    async def get_cards_by_column(self, column_id: uuid.UUID) -> list[CardResponse]:
        """Отримати картки колонки."""
        cards = await self._uow.cards.get_by_column(column_id)
        result = []
        for c in cards:
            r = CardResponse.model_validate(c)
            r.comments_count = len(c.comments) if c.comments else 0
            r.logged_hours = sum(w.hours for w in c.worklogs) if c.worklogs else 0.0
            result.append(r)
        return result

    async def get_card_detail(self, card_id: uuid.UUID) -> CardResponse:
        """Отримати деталі картки."""
        card = await self._uow.cards.get_by_id_with_relations(card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Картку не знайдено")
        r = CardResponse.model_validate(card)
        r.comments_count = len(card.comments) if card.comments else 0
        r.logged_hours = sum(w.hours for w in card.worklogs) if card.worklogs else 0.0
        return r

    async def update_card(
        self, card_id: uuid.UUID, data: CardUpdate, user_id: uuid.UUID
    ) -> CardResponse:
        """
        Оновити картку.
        Owner може: title, tags, assignee_id.
        Member: не може редагувати напряму (лише move).
        """
        card = await self._uow.cards.get_by_id(card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Картку не знайдено")

        is_owner, is_member = await self._check_edit_permission(card, user_id)
        if not is_owner:
            raise HTTPException(
                status_code=403,
                detail="Тільки власник дошки може редагувати картки",
            )

        # Перевірка: assignee має бути member або owner дошки, але не адмін
        assignee_explicitly_set = "assignee_id" in data.model_fields_set
        if assignee_explicitly_set and data.assignee_id is not None:
            assignee_user = await self._uow.users.get_by_id(data.assignee_id)
            if assignee_user and assignee_user.role == Role.ADMIN:
                raise HTTPException(
                    status_code=400,
                    detail="Адміністратор не може бути призначений виконавцем",
                )
            column, board = await self._get_board_for_column(card.column_id)
            if board:
                allowed_ids = {board.owner_id} | {m.id for m in board.members}
                if data.assignee_id not in allowed_ids:
                    raise HTTPException(
                        status_code=400,
                        detail="Виконавцем можна призначити лише учасника дошки",
                    )

        old_assignee_id = card.assignee_id

        if data.title is not None:
            card.title = data.title
        if data.description is not None:
            card.description = data.description
        if data.tags is not None:
            card.tags = data.tags
        # assignee_id: підтримка явного скидання на null
        if assignee_explicitly_set:
            card.assignee_id = data.assignee_id
        if data.priority is not None:
            card.priority = data.priority
        if data.color is not None:
            card.color = data.color
        if data.estimate is not None:
            card.estimate = data.estimate
        if data.due_date is not None or "due_date" in data.model_fields_set:
            card.due_date = data.due_date
        if data.card_type is not None:
            card.card_type = data.card_type

        await self._uow.cards.update(card)

        # Observer: сповіщення при зміні виконавця
        if data.assignee_id and data.assignee_id != old_assignee_id:
            assignee = await self._uow.users.get_by_id(data.assignee_id)
            if assignee:
                await event_manager.notify(
                    "card.assigned",
                    {
                        "card_title": card.title,
                        "assignee_username": assignee.username,
                    },
                )

        # Нотифікація для нового assignee
        if (
            data.assignee_id
            and data.assignee_id != old_assignee_id
            and data.assignee_id != user_id
        ):
            actor = await self._uow.users.get_by_id(user_id)
            column, board = await self._get_board_for_column(card.column_id)
            from app.services.notification_service import NotificationService

            notif_service = NotificationService(self._uow)
            await notif_service.create_notification(
                user_id=data.assignee_id,
                ntype=NotificationType.CARD_ASSIGNED,
                title="Вас призначено виконавцем",
                message=f"{actor.username if actor else 'Хтось'} призначив вас на картку «{card.title}»",
                link=f"/board/{board.id}" if board else None,
            )

        # Нотифікація owner/assignee про зміну картки
        column, board = await self._get_board_for_column(card.column_id)
        await self._notify_card_users(
            card,
            board,
            user_id,
            NotificationType.CARD_UPDATED,
            "Картку оновлено",
            f"Картку «{card.title}» було оновлено",
        )

        await self._uow.commit()

        card_full = await self._uow.cards.get_by_id_with_relations(card.id)
        return CardResponse.model_validate(card_full)

    async def move_card(
        self, card_id: uuid.UUID, data: CardMove, user_id: uuid.UUID
    ) -> CardResponse:
        """
        Переміщення картки (Drag-and-Drop / Select).
        Дозволено для owner та member дошки.
        """
        card = await self._uow.cards.get_by_id(card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Картку не знайдено")

        is_owner, is_member = await self._check_edit_permission(card, user_id)
        if not is_owner and not is_member:
            raise HTTPException(
                status_code=403,
                detail="Тільки власник або учасник дошки може переміщувати картки",
            )

        old_column = await self._uow.columns.get_by_id(card.column_id)
        new_column = await self._uow.columns.get_by_id(data.column_id)
        if not new_column:
            raise HTTPException(status_code=404, detail="Цільову колонку не знайдено")

        old_column_name = old_column.name if old_column else "Unknown"
        new_column_name = new_column.name
        old_column_id = card.column_id

        # Перерахунок позицій
        if old_column_id == data.column_id:
            # Переміщення всередині однієї колонки
            cards_in_col = await self._uow.cards.get_by_column(data.column_id)
            old_pos = card.position
            new_pos = data.position
            for c in cards_in_col:
                if c.id == card.id:
                    continue
                if old_pos < new_pos:
                    if old_pos < c.position <= new_pos:
                        c.position -= 1
                        await self._uow.cards.update(c)
                else:
                    if new_pos <= c.position < old_pos:
                        c.position += 1
                        await self._uow.cards.update(c)
        else:
            # Переміщення між колонками — зсув у старій і новій
            old_cards = await self._uow.cards.get_by_column(old_column_id)
            for c in old_cards:
                if c.id == card.id:
                    continue
                if c.position > card.position:
                    c.position -= 1
                    await self._uow.cards.update(c)

            new_cards = await self._uow.cards.get_by_column(data.column_id)
            for c in new_cards:
                if c.position >= data.position:
                    c.position += 1
                    await self._uow.cards.update(c)

        # Зміна статусу картки
        card.update_status(data.column_id)
        card.position = data.position

        await self._uow.cards.update(card)

        # Observer: сповіщення про зміну статусу
        await event_manager.notify(
            "card.status_changed",
            {
                "card_title": card.title,
                "old_column": old_column_name,
                "new_column": new_column_name,
            },
        )

        # Нотифікація owner/assignee
        _, board = await self._get_board_for_column(data.column_id)
        await self._notify_card_users(
            card,
            board,
            user_id,
            NotificationType.CARD_MOVED,
            "Картку переміщено",
            f"Картку «{card.title}» переміщено з «{old_column_name}» до «{new_column_name}»",
        )

        await self._uow.commit()

        card_full = await self._uow.cards.get_by_id_with_relations(card.id)
        return CardResponse.model_validate(card_full)

    async def delete_card(self, card_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Видалити картку (owner/admin)."""
        card = await self._uow.cards.get_by_id(card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Картку не знайдено")

        is_owner, _ = await self._check_edit_permission(card, user_id)
        if not is_owner:
            raise HTTPException(
                status_code=403,
                detail="Тільки власник дошки може видаляти картки",
            )

        await self._uow.cards.delete(card_id)
        await self._uow.commit()

    # --- Comments ---

    async def add_comment(
        self, card_id: uuid.UUID, data: CommentCreate, author_id: uuid.UUID
    ) -> CommentResponse:
        """Додати коментар до картки."""
        card = await self._uow.cards.get_by_id(card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Картку не знайдено")

        comment = Comment(
            text=data.text,
            card_id=card_id,
            author_id=author_id,
        )
        await self._uow.comments.create(comment)

        # Нотифікація owner/assignee про коментар
        column, board = await self._get_board_for_column(card.column_id)
        await self._notify_card_users(
            card,
            board,
            author_id,
            NotificationType.CARD_COMMENTED,
            "Новий коментар",
            f"Новий коментар до картки «{card.title}»",
        )

        await self._uow.commit()
        return CommentResponse.model_validate(comment)

    async def get_comments(self, card_id: uuid.UUID) -> list[CommentResponse]:
        """Отримати коментарі картки."""
        card = await self._uow.cards.get_by_id_with_relations(card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Картку не знайдено")
        return [CommentResponse.model_validate(c) for c in card.comments]

    # --- Worklogs ---

    async def add_worklog(
        self, card_id: uuid.UUID, data: WorklogCreate, author_id: uuid.UUID
    ) -> WorklogResponse:
        """Додати запис обліку часу до картки."""
        card = await self._uow.cards.get_by_id(card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Картку не знайдено")

        worklog = Worklog(
            hours=data.hours,
            description=data.description or "",
            card_id=card_id,
            author_id=author_id,
        )
        await self._uow.worklogs.create(worklog)
        await self._uow.commit()

        wl = await self._uow.worklogs.get_by_id(worklog.id)
        return WorklogResponse.model_validate(wl)

    async def get_worklogs(self, card_id: uuid.UUID) -> list[WorklogResponse]:
        """Отримати worklogs картки."""
        card = await self._uow.cards.get_by_id_with_relations(card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Картку не знайдено")
        return [WorklogResponse.model_validate(w) for w in card.worklogs]
