"""
Unit-тести для патерну Strategy (GoF).
Тестує: NotificationStrategy, DatabaseNotificationStrategy, LogNotificationStrategy.
"""

import uuid
import logging
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.patterns.strategy import (
    NotificationStrategy,
    DatabaseNotificationStrategy,
    LogNotificationStrategy,
)
from app.models.notification import NotificationType


class TestDatabaseNotificationStrategy:
    """Тести стратегії збереження у БД."""

    @pytest.mark.asyncio
    async def test_send_creates_notification(self):
        """Стратегія створює Notification через UoW."""
        strategy = DatabaseNotificationStrategy()
        mock_uow = MagicMock()
        mock_uow.notifications = AsyncMock()

        user_id = uuid.uuid4()
        result = await strategy.send(
            user_id=user_id,
            ntype=NotificationType.CARD_ASSIGNED,
            title="Test",
            message="Test message",
            uow=mock_uow,
        )

        assert result is not None
        assert result.user_id == user_id
        assert result.title == "Test"
        mock_uow.notifications.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_without_uow_raises_error(self):
        """Без UoW стратегія викидає ValueError."""
        strategy = DatabaseNotificationStrategy()

        with pytest.raises(ValueError, match="uow"):
            await strategy.send(
                user_id=uuid.uuid4(),
                ntype=NotificationType.CARD_ASSIGNED,
                title="Test",
                message="Test",
            )

    @pytest.mark.asyncio
    async def test_send_with_link_and_related_id(self):
        """Стратегія зберігає link та related_id."""
        strategy = DatabaseNotificationStrategy()
        mock_uow = MagicMock()
        mock_uow.notifications = AsyncMock()

        related = uuid.uuid4()
        result = await strategy.send(
            user_id=uuid.uuid4(),
            ntype=NotificationType.BOARD_INVITATION,
            title="Invite",
            message="Запрошення",
            link="/board/123",
            related_id=related,
            uow=mock_uow,
        )

        assert result.link == "/board/123"
        assert result.related_id == related


class TestLogNotificationStrategy:
    """Тести стратегії логування."""

    @pytest.mark.asyncio
    async def test_send_returns_none(self):
        """Логуюча стратегія повертає None."""
        strategy = LogNotificationStrategy()

        result = await strategy.send(
            user_id=uuid.uuid4(),
            ntype=NotificationType.CARD_MOVED,
            title="Moved",
            message="Card moved",
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_send_logs_info(self, caplog):
        """Стратегія записує інформацію у лог."""
        strategy = LogNotificationStrategy()

        with caplog.at_level(logging.INFO):
            await strategy.send(
                user_id=uuid.uuid4(),
                ntype=NotificationType.CARD_UPDATED,
                title="Updated",
                message="Card updated",
            )

        assert "Updated" in caplog.text
        assert "Card updated" in caplog.text


class TestNotificationStrategyInterface:
    """Тести абстрактного інтерфейсу NotificationStrategy."""

    def test_cannot_instantiate_abstract(self):
        """Неможливо створити екземпляр абстрактної стратегії."""
        with pytest.raises(TypeError):
            NotificationStrategy()

    def test_database_is_subclass(self):
        """DatabaseNotificationStrategy є підкласом NotificationStrategy."""
        assert issubclass(DatabaseNotificationStrategy, NotificationStrategy)

    def test_log_is_subclass(self):
        """LogNotificationStrategy є підкласом NotificationStrategy."""
        assert issubclass(LogNotificationStrategy, NotificationStrategy)
