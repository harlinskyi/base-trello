"""
Патерн Factory (Фабрика) — GoF.

Обґрунтування вибору:
- Інкапсулює логіку створення об'єктів. Клієнтський код
  не залежить від конкретних параметрів конструктора.
- Дає можливість створювати картки з різними пресетами
  ("Термінова", "Базова") та ініціалізувати стандартні
  колонки для нової дошки.
- Дотримання принципу OCP (SOLID): нові типи пресетів
  додаються без зміни існуючого коду фабрики.

Використання у проєкті:
- CardFactory: створює картки з пресетами (urgent, basic, bug).
- BoardFactory: створює дошку зі стандартним набором колонок.
"""

import uuid
from abc import ABC, abstractmethod

from app.models.card import Card
from app.models.column import Column
from app.models.board import Board
from app.patterns.singleton import SingletonMeta


class AbstractCardFactory(ABC):
    """
    Абстрактна фабрика для створення карток.
    Принцип LSP (SOLID): нащадки можуть замінити базовий клас.
    """

    @abstractmethod
    def create_card(self, title: str, column_id: uuid.UUID, **kwargs) -> Card:
        """Створити картку."""
        pass


class CardFactory(AbstractCardFactory, metaclass=SingletonMeta):
    """
    Конкретна фабрика для створення карток з різними пресетами.
    Використовує SingletonMeta для гарантії єдиного екземпляра.
    """

    # Пресети тегів для різних типів карток
    PRESETS = {
        "basic": {"tags": [], "priority": None, "color": None},
        "urgent": {
            "tags": ["терміново", "пріоритет"],
            "priority": "high",
            "color": "#ef4444",
        },
        "bug": {"tags": ["баг", "виправлення"], "priority": "high", "color": "#f97316"},
        "feature": {
            "tags": ["фіча", "розробка"],
            "priority": "medium",
            "color": "#3b82f6",
        },
    }

    def create_card(
        self,
        title: str,
        column_id: uuid.UUID,
        preset: str = "basic",
        description: str = "",
        assignee_id: uuid.UUID | None = None,
        tags: list[str] | None = None,
        position: int = 0,
        priority: str | None = None,
        color: str | None = None,
        estimate: float | None = None,
        due_date=None,
        card_type: str | None = None,
    ) -> Card:
        """
        Створити картку з обраним пресетом.
        Якщо передано кастомні tags, вони додаються до пресетних.
        Пресет задає теги, пріоритет, колір за замовчуванням.
        """
        actual_type = card_type or preset
        preset_data = dict(self.PRESETS.get(actual_type, self.PRESETS["basic"]))
        preset_tags = list(preset_data.get("tags", []))
        if tags:
            preset_tags.extend(tags)

        return Card(
            title=title,
            description=description,
            column_id=column_id,
            assignee_id=assignee_id,
            tags=preset_tags,
            position=position,
            priority=priority or preset_data.get("priority"),
            color=color or preset_data.get("color"),
            estimate=estimate,
            due_date=due_date,
            card_type=actual_type,
        )


class BoardFactory:
    """
    Фабрика для створення дошки зі стандартним набором колонок.
    Принцип SRP: відповідає лише за ініціалізацію дошки.
    """

    DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"]

    @staticmethod
    def create_board(title: str, owner_id: uuid.UUID) -> tuple[Board, list[Column]]:
        """
        Створити нову дошку зі стандартними колонками.
        Повертає кортеж (board, columns).
        """
        board = Board(title=title, owner_id=owner_id)

        columns = [
            Column(name=col_name, position=idx, board_id=board.id)
            for idx, col_name in enumerate(BoardFactory.DEFAULT_COLUMNS)
        ]

        return board, columns


# Глобальні фабрики (Singleton через SingletonMeta)
card_factory = CardFactory()
board_factory = BoardFactory()
