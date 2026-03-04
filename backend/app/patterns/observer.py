"""
Патерн Observer (Спостерігач) — GoF.

Обґрунтування вибору:
- Забезпечує слабку зв'язність (Loose Coupling) між компонентами.
- Коли картка змінює статус або призначається виконавець,
  Observer-и отримують сповіщення без жорсткої залежності.
- Дотримання принципу OCP (SOLID): нові обробники додаються
  без модифікації існуючого коду — достатньо зареєструвати
  нового підписника.

Використання у проєкті:
- CardStatusObserver: логує зміну статусу картки.
- CardAssignmentObserver: сповіщає виконавця при призначенні.
"""

from abc import ABC, abstractmethod
from typing import Any
import logging

from app.patterns.singleton import SingletonMeta

logger = logging.getLogger(__name__)


class EventObserver(ABC):
    """
    Абстрактний спостерігач (інтерфейс Observer).
    Принцип LSP (SOLID): будь-який нащадок може бути
    використаний замість базового класу.
    """

    @abstractmethod
    async def handle(self, event: str, data: dict[str, Any]) -> None:
        """Обробити подію."""
        pass


class EventManager(metaclass=SingletonMeta):
    """
    Менеджер подій (Subject у термінах GoF).
    Керує підпискою та розсилкою подій спостерігачам.
    Використовує SingletonMeta — гарантує єдиний екземпляр.
    """

    def __init__(self):
        self._observers: dict[str, list[EventObserver]] = {}

    def subscribe(self, event: str, observer: EventObserver) -> None:
        """Підписати спостерігача на подію."""
        if event not in self._observers:
            self._observers[event] = []
        self._observers[event].append(observer)

    def unsubscribe(self, event: str, observer: EventObserver) -> None:
        """Відписати спостерігача від події."""
        if event in self._observers:
            self._observers[event].remove(observer)

    async def notify(self, event: str, data: dict[str, Any]) -> None:
        """Сповістити всіх підписаних спостерігачів про подію."""
        if event in self._observers:
            for observer in self._observers[event]:
                await observer.handle(event, data)


# --- Конкретні спостерігачі ---


class CardStatusObserver(EventObserver):
    """
    Спостерігач зміни статусу картки.
    Логує переміщення картки між колонками.
    """

    async def handle(self, event: str, data: dict[str, Any]) -> None:
        card_title = data.get("card_title", "Unknown")
        old_column = data.get("old_column", "Unknown")
        new_column = data.get("new_column", "Unknown")
        logger.info(
            f"[Observer] Картка '{card_title}' переміщена: "
            f"'{old_column}' -> '{new_column}'"
        )


class CardAssignmentObserver(EventObserver):
    """
    Спостерігач призначення виконавця.
    Логує (або надсилає сповіщення) коли картку призначено на користувача.
    """

    async def handle(self, event: str, data: dict[str, Any]) -> None:
        card_title = data.get("card_title", "Unknown")
        assignee = data.get("assignee_username", "Unknown")
        logger.info(f"[Observer] Картку '{card_title}' призначено на: {assignee}")


# Глобальний менеджер подій (Singleton через SingletonMeta)
event_manager = EventManager()

# Реєстрація спостерігачів
event_manager.subscribe("card.status_changed", CardStatusObserver())
event_manager.subscribe("card.assigned", CardAssignmentObserver())
