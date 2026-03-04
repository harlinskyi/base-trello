"""
Unit-тести для патерну Observer (GoF).
Тестує: EventManager, EventObserver, підписку та сповіщення.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.patterns.observer import (
    EventManager,
    EventObserver,
    CardStatusObserver,
    CardAssignmentObserver,
    event_manager,
)
from app.patterns.singleton import SingletonMeta


class MockObserver(EventObserver):
    """Mock-спостерігач для тестування."""

    def __init__(self):
        self.handled_events = []

    async def handle(self, event: str, data: dict) -> None:
        self.handled_events.append((event, data))


class TestEventManager:
    """Тести менеджера подій (Subject)."""

    def setup_method(self):
        """Створюємо ізольований EventManager для кожного тесту."""
        # Скидаємо Singleton щоб мати чистий стан
        SingletonMeta._reset(EventManager)
        self.manager = EventManager()

    def teardown_method(self):
        """Скидаємо Singleton після тесту."""
        SingletonMeta._reset(EventManager)

    def test_subscribe_observer(self):
        """Підписка спостерігача на подію."""
        observer = MockObserver()
        self.manager.subscribe("test.event", observer)
        assert "test.event" in self.manager._observers
        assert observer in self.manager._observers["test.event"]

    def test_unsubscribe_observer(self):
        """Відписка спостерігача від події."""
        observer = MockObserver()
        self.manager.subscribe("test.event", observer)
        self.manager.unsubscribe("test.event", observer)
        assert observer not in self.manager._observers["test.event"]

    @pytest.mark.asyncio
    async def test_notify_calls_observer(self):
        """Сповіщення викликає обробник спостерігача."""
        observer = MockObserver()
        self.manager.subscribe("test.event", observer)

        await self.manager.notify("test.event", {"key": "value"})

        assert len(observer.handled_events) == 1
        assert observer.handled_events[0] == ("test.event", {"key": "value"})

    @pytest.mark.asyncio
    async def test_notify_multiple_observers(self):
        """Сповіщення кількох спостерігачів одночасно."""
        observer1 = MockObserver()
        observer2 = MockObserver()
        self.manager.subscribe("test.event", observer1)
        self.manager.subscribe("test.event", observer2)

        await self.manager.notify("test.event", {"data": 42})

        assert len(observer1.handled_events) == 1
        assert len(observer2.handled_events) == 1

    @pytest.mark.asyncio
    async def test_notify_only_subscribed_event(self):
        """Спостерігач отримує лише ті події, на які підписаний."""
        observer = MockObserver()
        self.manager.subscribe("event.a", observer)

        await self.manager.notify("event.b", {"data": "test"})

        assert len(observer.handled_events) == 0

    @pytest.mark.asyncio
    async def test_notify_nonexistent_event_no_error(self):
        """Сповіщення про неіснуючу подію не викликає помилки."""
        await self.manager.notify("nonexistent", {})  # No error


class TestCardStatusObserver:
    """Тести спостерігача зміни статусу картки."""

    @pytest.mark.asyncio
    async def test_handle_logs_status_change(self, caplog):
        """Обробник логує переміщення картки."""
        observer = CardStatusObserver()
        import logging

        with caplog.at_level(logging.INFO):
            await observer.handle(
                "card.status_changed",
                {
                    "card_title": "Task 1",
                    "old_column": "To Do",
                    "new_column": "In Progress",
                },
            )
        assert "Task 1" in caplog.text
        assert "To Do" in caplog.text
        assert "In Progress" in caplog.text


class TestCardAssignmentObserver:
    """Тести спостерігача призначення виконавця."""

    @pytest.mark.asyncio
    async def test_handle_logs_assignment(self, caplog):
        """Обробник логує призначення виконавця."""
        observer = CardAssignmentObserver()
        import logging

        with caplog.at_level(logging.INFO):
            await observer.handle(
                "card.assigned",
                {
                    "card_title": "Bug Fix",
                    "assignee_username": "john_doe",
                },
            )
        assert "Bug Fix" in caplog.text
        assert "john_doe" in caplog.text


class TestSingleton:
    """Тести Singleton для EventManager."""

    def setup_method(self):
        SingletonMeta._reset(EventManager)

    def teardown_method(self):
        SingletonMeta._reset(EventManager)

    def test_event_manager_is_singleton(self):
        """EventManager повертає один і той самий екземпляр."""
        em1 = EventManager()
        em2 = EventManager()
        assert em1 is em2

    def test_singleton_reset(self):
        """Після _reset створюється новий екземпляр."""
        em1 = EventManager()
        SingletonMeta._reset(EventManager)
        em2 = EventManager()
        assert em1 is not em2
