"""
Конфігурація pytest та загальні фікстури для тестування.
"""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.models.user import User, Role
from app.models.board import Board
from app.models.column import Column
from app.models.card import Card
from app.models.comment import Comment
from app.models.worklog import Worklog
from app.models.notification import Notification, NotificationType


@pytest.fixture
def sample_user_id():
    """UUID для тестового користувача."""
    return uuid.uuid4()


@pytest.fixture
def sample_admin_id():
    """UUID для тестового адміністратора."""
    return uuid.uuid4()


@pytest.fixture
def sample_board_id():
    """UUID для тестової дошки."""
    return uuid.uuid4()


@pytest.fixture
def sample_column_id():
    """UUID для тестової колонки."""
    return uuid.uuid4()


@pytest.fixture
def sample_card_id():
    """UUID для тестової картки."""
    return uuid.uuid4()


@pytest.fixture
def sample_user(sample_user_id):
    """Тестовий користувач."""
    user = MagicMock(spec=User)
    user.id = sample_user_id
    user.username = "testuser"
    user.email = "test@example.com"
    user.hashed_password = "$2b$12$mock_hash"
    user.role = Role.USER
    user.created_at = datetime.now(timezone.utc)
    return user


@pytest.fixture
def sample_admin(sample_admin_id):
    """Тестовий адміністратор."""
    admin = MagicMock(spec=User)
    admin.id = sample_admin_id
    admin.username = "admin"
    admin.email = "admin@kanban.com"
    admin.hashed_password = "$2b$12$mock_hash"
    admin.role = Role.ADMIN
    admin.created_at = datetime.now(timezone.utc)
    return admin


@pytest.fixture
def sample_board(sample_board_id, sample_user_id):
    """Тестова дошка."""
    board = MagicMock(spec=Board)
    board.id = sample_board_id
    board.title = "Test Board"
    board.owner_id = sample_user_id
    board.members = []
    board.columns = []
    board.created_at = datetime.now(timezone.utc)
    return board


@pytest.fixture
def sample_column(sample_column_id, sample_board_id):
    """Тестова колонка."""
    column = MagicMock(spec=Column)
    column.id = sample_column_id
    column.name = "To Do"
    column.position = 0
    column.board_id = sample_board_id
    return column


@pytest.fixture
def sample_card(sample_card_id, sample_column_id):
    """Тестова картка."""
    card = MagicMock(spec=Card)
    card.id = sample_card_id
    card.title = "Test Card"
    card.description = "Test description"
    card.position = 0
    card.tags = ["test"]
    card.priority = "medium"
    card.color = "#3b82f6"
    card.estimate = 4.0
    card.due_date = None
    card.card_type = "basic"
    card.column_id = sample_column_id
    card.assignee_id = None
    card.created_at = datetime.now(timezone.utc)
    card.updated_at = datetime.now(timezone.utc)
    return card


@pytest.fixture
def mock_uow():
    """Mock Unit of Work з усіма репозиторіями."""
    uow = MagicMock()
    uow.users = AsyncMock()
    uow.boards = AsyncMock()
    uow.cards = AsyncMock()
    uow.columns = AsyncMock()
    uow.comments = AsyncMock()
    uow.worklogs = AsyncMock()
    uow.notifications = AsyncMock()
    uow.invitations = AsyncMock()
    uow.commit = AsyncMock()
    uow.rollback = AsyncMock()
    return uow
