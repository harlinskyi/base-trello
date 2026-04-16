"""Сервіс адмінської статистики."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import Date, and_, case, cast, desc, func, select

from app.models.board import Board, board_members
from app.models.card import Card
from app.models.column import Column
from app.models.comment import Comment
from app.models.notification import (
    BoardInvitation,
    InvitationStatus,
    Notification,
    NotificationType,
)
from app.models.user import Role, User
from app.models.worklog import Worklog
from app.repositories.unit_of_work import UnitOfWork
from app.schemas.admin import (
    AdminActivityPoint,
    AdminOverviewStats,
    AdminRecentActivityStats,
    AdminStatsResponse,
    AdminTopBoardStats,
    AdminTopUserStats,
    StatsBucket,
)


class AdminStatsService:
    """Обчислює статистику для адмін-панелі."""

    def __init__(self, uow: UnitOfWork):
        self._session = uow._session

    async def get_dashboard_stats(self) -> AdminStatsResponse:
        """Зібрати всі агрегати для сторінки адмін-аналітики."""
        today = date.today()
        now = datetime.now(timezone.utc)
        week_ahead = today + timedelta(days=7)
        last_30_days = now - timedelta(days=30)

        overview = await self._get_overview(today, week_ahead)
        recent_activity = await self._get_recent_activity(last_30_days)
        activity_timeline = await self._get_activity_timeline(days=7)

        return AdminStatsResponse(
            generated_at=now,
            overview=overview,
            recent_activity=recent_activity,
            users_by_role=await self._get_users_by_role(),
            cards_by_priority=await self._get_cards_by_priority(),
            cards_by_type=await self._get_cards_by_type(),
            cards_by_status=await self._get_cards_by_status(),
            invitations_by_status=await self._get_invitations_by_status(),
            notifications_by_type=await self._get_notifications_by_type(),
            top_users=await self._get_top_users(),
            top_boards=await self._get_top_boards(),
            activity_timeline=activity_timeline,
        )

    async def _get_overview(
        self,
        today: date,
        week_ahead: date,
    ) -> AdminOverviewStats:
        total_users = await self._count(User)
        admin_users = await self._count(User, User.role == Role.ADMIN)
        total_boards = await self._count(Board)
        total_columns = await self._count(Column)
        total_cards = await self._count(Card)
        total_comments = await self._count(Comment)
        total_worklog_entries = await self._count(Worklog)
        unread_notifications = await self._count(
            Notification, Notification.is_read.is_(False)
        )
        pending_invitations = await self._count(
            BoardInvitation,
            BoardInvitation.status == InvitationStatus.PENDING,
        )

        card_stmt = select(
            func.coalesce(
                func.sum(case((Card.assignee_id.is_not(None), 1), else_=0)),
                0,
            ).label("assigned_cards"),
            func.coalesce(
                func.sum(case((Card.assignee_id.is_(None), 1), else_=0)),
                0,
            ).label("unassigned_cards"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(Card.due_date.is_not(None), Card.due_date < today),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("overdue_cards"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                Card.due_date.is_not(None),
                                Card.due_date >= today,
                                Card.due_date <= week_ahead,
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("due_this_week_cards"),
            func.coalesce(func.sum(Card.estimate), 0.0).label("estimated_hours_total"),
        )
        card_row = (await self._session.execute(card_stmt)).one()

        tracked_hours_total = await self._sum(Worklog.hours)
        total_memberships = await self._count_from_table(board_members)

        avg_cards_per_board = (
            round(total_cards / total_boards, 2) if total_boards else 0.0
        )
        avg_members_per_board = (
            round(total_memberships / total_boards, 2) if total_boards else 0.0
        )

        return AdminOverviewStats(
            total_users=total_users,
            admin_users=admin_users,
            total_boards=total_boards,
            total_columns=total_columns,
            total_cards=total_cards,
            assigned_cards=int(card_row.assigned_cards or 0),
            unassigned_cards=int(card_row.unassigned_cards or 0),
            overdue_cards=int(card_row.overdue_cards or 0),
            due_this_week_cards=int(card_row.due_this_week_cards or 0),
            total_comments=total_comments,
            total_worklog_entries=total_worklog_entries,
            tracked_hours_total=round(tracked_hours_total, 2),
            estimated_hours_total=round(float(card_row.estimated_hours_total or 0), 2),
            unread_notifications=unread_notifications,
            pending_invitations=pending_invitations,
            avg_cards_per_board=avg_cards_per_board,
            avg_members_per_board=avg_members_per_board,
        )

    async def _get_recent_activity(
        self,
        last_30_days: datetime,
    ) -> AdminRecentActivityStats:
        return AdminRecentActivityStats(
            new_users_last_30_days=await self._count(
                User, User.created_at >= last_30_days
            ),
            new_boards_last_30_days=await self._count(
                Board, Board.created_at >= last_30_days
            ),
            new_cards_last_30_days=await self._count(
                Card, Card.created_at >= last_30_days
            ),
            new_comments_last_30_days=await self._count(
                Comment,
                Comment.created_at >= last_30_days,
            ),
        )

    async def _get_users_by_role(self) -> list[StatsBucket]:
        stmt = (
            select(User.role, func.count(User.id))
            .group_by(User.role)
            .order_by(desc(func.count(User.id)))
        )
        rows = (await self._session.execute(stmt)).all()
        return self._build_buckets(
            rows, {Role.ADMIN: "Адміністратори", Role.USER: "Користувачі"}
        )

    async def _get_cards_by_priority(self) -> list[StatsBucket]:
        label = func.coalesce(func.nullif(Card.priority, ""), "Без пріоритету")
        stmt = (
            select(label.label("label"), func.count(Card.id))
            .group_by(label)
            .order_by(desc(func.count(Card.id)), label)
        )
        rows = (await self._session.execute(stmt)).all()
        return self._build_buckets(
            rows, {"low": "Low", "medium": "Medium", "high": "High"}
        )

    async def _get_cards_by_type(self) -> list[StatsBucket]:
        label = func.coalesce(func.nullif(Card.card_type, ""), "Без типу")
        stmt = (
            select(label.label("label"), func.count(Card.id))
            .group_by(label)
            .order_by(desc(func.count(Card.id)), label)
        )
        rows = (await self._session.execute(stmt)).all()
        return self._build_buckets(rows)

    async def _get_cards_by_status(self) -> list[StatsBucket]:
        stmt = (
            select(Column.name, func.count(Card.id))
            .select_from(Column)
            .outerjoin(Card, Card.column_id == Column.id)
            .group_by(Column.name)
            .order_by(desc(func.count(Card.id)), Column.name)
        )
        rows = (await self._session.execute(stmt)).all()
        return self._build_buckets(rows)

    async def _get_invitations_by_status(self) -> list[StatsBucket]:
        stmt = (
            select(BoardInvitation.status, func.count(BoardInvitation.id))
            .group_by(BoardInvitation.status)
            .order_by(desc(func.count(BoardInvitation.id)))
        )
        rows = (await self._session.execute(stmt)).all()
        return self._build_buckets(
            rows,
            {
                InvitationStatus.PENDING: "Очікують",
                InvitationStatus.ACCEPTED: "Прийняті",
                InvitationStatus.DECLINED: "Відхилені",
            },
        )

    async def _get_notifications_by_type(self) -> list[StatsBucket]:
        stmt = (
            select(Notification.type, func.count(Notification.id))
            .group_by(Notification.type)
            .order_by(desc(func.count(Notification.id)))
        )
        rows = (await self._session.execute(stmt)).all()
        return self._build_buckets(
            rows,
            {
                NotificationType.BOARD_INVITATION: "Запрошення на дошку",
                NotificationType.CARD_ASSIGNED: "Призначення картки",
                NotificationType.CARD_MOVED: "Переміщення картки",
                NotificationType.CARD_UPDATED: "Оновлення картки",
                NotificationType.CARD_COMMENTED: "Коментарі до картки",
            },
        )

    async def _get_top_users(self) -> list[AdminTopUserStats]:
        owned_boards_sq = (
            select(
                Board.owner_id.label("user_id"),
                func.count(Board.id).label("owned_boards"),
            )
            .group_by(Board.owner_id)
            .subquery()
        )
        assigned_cards_sq = (
            select(
                Card.assignee_id.label("user_id"),
                func.count(Card.id).label("assigned_cards"),
            )
            .where(Card.assignee_id.is_not(None))
            .group_by(Card.assignee_id)
            .subquery()
        )
        comments_sq = (
            select(
                Comment.author_id.label("user_id"),
                func.count(Comment.id).label("comments_count"),
            )
            .group_by(Comment.author_id)
            .subquery()
        )
        worklogs_sq = (
            select(
                Worklog.author_id.label("user_id"),
                func.count(Worklog.id).label("worklog_entries"),
                func.coalesce(func.sum(Worklog.hours), 0.0).label("logged_hours"),
            )
            .group_by(Worklog.author_id)
            .subquery()
        )

        owned_boards = func.coalesce(owned_boards_sq.c.owned_boards, 0)
        assigned_cards = func.coalesce(assigned_cards_sq.c.assigned_cards, 0)
        comments_count = func.coalesce(comments_sq.c.comments_count, 0)
        worklog_entries = func.coalesce(worklogs_sq.c.worklog_entries, 0)
        logged_hours = func.coalesce(worklogs_sq.c.logged_hours, 0.0)

        stmt = (
            select(
                User.id,
                User.username,
                User.role,
                owned_boards.label("owned_boards"),
                assigned_cards.label("assigned_cards"),
                comments_count.label("comments_count"),
                worklog_entries.label("worklog_entries"),
                logged_hours.label("logged_hours"),
            )
            .outerjoin(owned_boards_sq, owned_boards_sq.c.user_id == User.id)
            .outerjoin(assigned_cards_sq, assigned_cards_sq.c.user_id == User.id)
            .outerjoin(comments_sq, comments_sq.c.user_id == User.id)
            .outerjoin(worklogs_sq, worklogs_sq.c.user_id == User.id)
            .order_by(
                desc(assigned_cards),
                desc(logged_hours),
                desc(owned_boards),
                User.username,
            )
            .limit(6)
        )
        rows = (await self._session.execute(stmt)).all()

        return [
            AdminTopUserStats(
                id=str(row.id),
                username=row.username,
                role=row.role.value if hasattr(row.role, "value") else str(row.role),
                owned_boards=int(row.owned_boards or 0),
                assigned_cards=int(row.assigned_cards or 0),
                comments_count=int(row.comments_count or 0),
                worklog_entries=int(row.worklog_entries or 0),
                logged_hours=round(float(row.logged_hours or 0), 2),
            )
            for row in rows
        ]

    async def _get_top_boards(self) -> list[AdminTopBoardStats]:
        members_sq = (
            select(
                board_members.c.board_id.label("board_id"),
                func.count(board_members.c.user_id).label("members_count"),
            )
            .group_by(board_members.c.board_id)
            .subquery()
        )
        columns_sq = (
            select(
                Column.board_id.label("board_id"),
                func.count(Column.id).label("columns_count"),
            )
            .group_by(Column.board_id)
            .subquery()
        )
        cards_sq = (
            select(
                Column.board_id.label("board_id"),
                func.count(Card.id).label("cards_count"),
                func.coalesce(func.sum(Card.estimate), 0.0).label(
                    "estimated_hours_total"
                ),
            )
            .select_from(Column)
            .outerjoin(Card, Card.column_id == Column.id)
            .group_by(Column.board_id)
            .subquery()
        )
        worklogs_sq = (
            select(
                Column.board_id.label("board_id"),
                func.coalesce(func.sum(Worklog.hours), 0.0).label(
                    "tracked_hours_total"
                ),
            )
            .select_from(Column)
            .join(Card, Card.column_id == Column.id)
            .join(Worklog, Worklog.card_id == Card.id)
            .group_by(Column.board_id)
            .subquery()
        )

        members_count = func.coalesce(members_sq.c.members_count, 0)
        columns_count = func.coalesce(columns_sq.c.columns_count, 0)
        cards_count = func.coalesce(cards_sq.c.cards_count, 0)
        estimated_hours_total = func.coalesce(cards_sq.c.estimated_hours_total, 0.0)
        tracked_hours_total = func.coalesce(worklogs_sq.c.tracked_hours_total, 0.0)

        stmt = (
            select(
                Board.id,
                Board.title,
                User.username.label("owner_username"),
                members_count.label("members_count"),
                columns_count.label("columns_count"),
                cards_count.label("cards_count"),
                estimated_hours_total.label("estimated_hours_total"),
                tracked_hours_total.label("tracked_hours_total"),
            )
            .join(User, User.id == Board.owner_id)
            .outerjoin(members_sq, members_sq.c.board_id == Board.id)
            .outerjoin(columns_sq, columns_sq.c.board_id == Board.id)
            .outerjoin(cards_sq, cards_sq.c.board_id == Board.id)
            .outerjoin(worklogs_sq, worklogs_sq.c.board_id == Board.id)
            .order_by(
                desc(cards_count), desc(tracked_hours_total), Board.created_at.desc()
            )
            .limit(6)
        )
        rows = (await self._session.execute(stmt)).all()

        return [
            AdminTopBoardStats(
                id=str(row.id),
                title=row.title,
                owner_username=row.owner_username,
                members_count=int(row.members_count or 0),
                columns_count=int(row.columns_count or 0),
                cards_count=int(row.cards_count or 0),
                estimated_hours_total=round(float(row.estimated_hours_total or 0), 2),
                tracked_hours_total=round(float(row.tracked_hours_total or 0), 2),
            )
            for row in rows
        ]

    async def _get_activity_timeline(self, days: int) -> list[AdminActivityPoint]:
        end_date = date.today()
        start_date = end_date - timedelta(days=days - 1)

        users_map = await self._get_daily_counts(User, User.created_at, start_date)
        boards_map = await self._get_daily_counts(Board, Board.created_at, start_date)
        cards_map = await self._get_daily_counts(Card, Card.created_at, start_date)
        comments_map = await self._get_daily_counts(
            Comment, Comment.created_at, start_date
        )

        points: list[AdminActivityPoint] = []
        current = start_date
        while current <= end_date:
            key = current.isoformat()
            points.append(
                AdminActivityPoint(
                    date=key,
                    users=users_map.get(key, 0),
                    boards=boards_map.get(key, 0),
                    cards=cards_map.get(key, 0),
                    comments=comments_map.get(key, 0),
                )
            )
            current += timedelta(days=1)

        return points

    async def _get_daily_counts(
        self, model, column, start_date: date
    ) -> dict[str, int]:
        start_at = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        day_column = cast(column, Date)
        stmt = (
            select(day_column.label("day"), func.count(model.id))
            .where(column >= start_at)
            .group_by(day_column)
            .order_by(day_column)
        )
        rows = (await self._session.execute(stmt)).all()
        return {row.day.isoformat(): int(row[1]) for row in rows}

    async def _count(self, model, *conditions) -> int:
        stmt = select(func.count(model.id))
        if conditions:
            stmt = stmt.where(*conditions)
        value = await self._session.scalar(stmt)
        return int(value or 0)

    async def _count_from_table(self, table) -> int:
        value = await self._session.scalar(select(func.count()).select_from(table))
        return int(value or 0)

    async def _sum(self, column) -> float:
        value = await self._session.scalar(select(func.coalesce(func.sum(column), 0.0)))
        return float(value or 0.0)

    def _build_buckets(self, rows, labels_map: dict | None = None) -> list[StatsBucket]:
        normalized_rows: list[tuple[str, int]] = []
        total = 0

        for raw_label, raw_value in rows:
            label = self._normalize_label(raw_label, labels_map)
            value = int(raw_value or 0)
            normalized_rows.append((label, value))
            total += value

        if total == 0:
            return []

        return [
            StatsBucket(
                label=label,
                value=value,
                percentage=round((value / total) * 100, 1),
            )
            for label, value in normalized_rows
        ]

    @staticmethod
    def _normalize_label(raw_label, labels_map: dict | None = None) -> str:
        if labels_map and raw_label in labels_map:
            return labels_map[raw_label]
        if hasattr(raw_label, "value"):
            return str(raw_label.value)
        return str(raw_label)
