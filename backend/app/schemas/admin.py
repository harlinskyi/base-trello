"""Pydantic-схеми для адмінської статистики."""

from datetime import datetime

from pydantic import BaseModel


class StatsBucket(BaseModel):
    """Елемент розподілу для агрегованої статистики."""

    label: str
    value: int
    percentage: float


class AdminOverviewStats(BaseModel):
    """Зведені KPI адмін-панелі."""

    total_users: int
    admin_users: int
    total_boards: int
    total_columns: int
    total_cards: int
    assigned_cards: int
    unassigned_cards: int
    overdue_cards: int
    due_this_week_cards: int
    total_comments: int
    total_worklog_entries: int
    tracked_hours_total: float
    estimated_hours_total: float
    unread_notifications: int
    pending_invitations: int
    avg_cards_per_board: float
    avg_members_per_board: float


class AdminRecentActivityStats(BaseModel):
    """Зміни за останні 30 днів."""

    new_users_last_30_days: int
    new_boards_last_30_days: int
    new_cards_last_30_days: int
    new_comments_last_30_days: int


class AdminTopUserStats(BaseModel):
    """Топ користувачів за навантаженням та внеском."""

    id: str
    username: str
    role: str
    owned_boards: int
    assigned_cards: int
    comments_count: int
    worklog_entries: int
    logged_hours: float


class AdminTopBoardStats(BaseModel):
    """Топ дощок за наповненням та активністю."""

    id: str
    title: str
    owner_username: str
    members_count: int
    columns_count: int
    cards_count: int
    estimated_hours_total: float
    tracked_hours_total: float


class AdminActivityPoint(BaseModel):
    """Щоденна активність для короткого таймлайну."""

    date: str
    users: int
    boards: int
    cards: int
    comments: int


class AdminStatsResponse(BaseModel):
    """Повна відповідь для сторінки адмін-аналітики."""

    generated_at: datetime
    overview: AdminOverviewStats
    recent_activity: AdminRecentActivityStats
    users_by_role: list[StatsBucket]
    cards_by_priority: list[StatsBucket]
    cards_by_type: list[StatsBucket]
    cards_by_status: list[StatsBucket]
    invitations_by_status: list[StatsBucket]
    notifications_by_type: list[StatsBucket]
    top_users: list[AdminTopUserStats]
    top_boards: list[AdminTopBoardStats]
    activity_timeline: list[AdminActivityPoint]
