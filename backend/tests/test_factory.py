"""
Unit-тести для патерну Factory (GoF).
Тестує: CardFactory, BoardFactory, пресети, Singleton.
"""

import uuid
import pytest

from app.patterns.factory import CardFactory, BoardFactory, card_factory, board_factory
from app.patterns.singleton import SingletonMeta
from app.models.card import Card
from app.models.board import Board
from app.models.column import Column


class TestCardFactory:
    """Тести фабрики карток."""

    def setup_method(self):
        """Ініціалізація фабрики перед кожним тестом."""
        self.factory = CardFactory()
        self.column_id = uuid.uuid4()

    def test_create_basic_card(self):
        """Створення базової картки з пресетом 'basic'."""
        card = self.factory.create_card(
            title="Test Card",
            column_id=self.column_id,
        )
        assert isinstance(card, Card)
        assert card.title == "Test Card"
        assert card.column_id == self.column_id
        assert card.card_type == "basic"

    def test_create_urgent_card(self):
        """Створення термінової картки — має теги та червоний колір."""
        card = self.factory.create_card(
            title="Urgent Card",
            column_id=self.column_id,
            card_type="urgent",
        )
        assert card.card_type == "urgent"
        assert card.priority == "high"
        assert card.color == "#ef4444"
        assert "терміново" in card.tags
        assert "пріоритет" in card.tags

    def test_create_bug_card(self):
        """Створення картки-бага — має теги бага та помаранчевий колір."""
        card = self.factory.create_card(
            title="Bug Card",
            column_id=self.column_id,
            card_type="bug",
        )
        assert card.card_type == "bug"
        assert card.priority == "high"
        assert card.color == "#f97316"
        assert "баг" in card.tags

    def test_create_feature_card(self):
        """Створення картки-фічі — має теги фічі та синій колір."""
        card = self.factory.create_card(
            title="Feature Card",
            column_id=self.column_id,
            card_type="feature",
        )
        assert card.card_type == "feature"
        assert card.priority == "medium"
        assert card.color == "#3b82f6"
        assert "фіча" in card.tags

    def test_custom_tags_appended_to_preset(self):
        """Кастомні теги додаються до тегів пресету."""
        card = self.factory.create_card(
            title="Card",
            column_id=self.column_id,
            card_type="urgent",
            tags=["custom_tag"],
        )
        assert "терміново" in card.tags
        assert "custom_tag" in card.tags

    def test_custom_priority_overrides_preset(self):
        """Кастомний пріоритет перевизначає пресетний."""
        card = self.factory.create_card(
            title="Card",
            column_id=self.column_id,
            card_type="urgent",
            priority="low",
        )
        assert card.priority == "low"

    def test_custom_color_overrides_preset(self):
        """Кастомний колір перевизначає пресетний."""
        card = self.factory.create_card(
            title="Card",
            column_id=self.column_id,
            card_type="bug",
            color="#00ff00",
        )
        assert card.color == "#00ff00"

    def test_card_with_assignee(self):
        """Картка з призначеним виконавцем."""
        assignee_id = uuid.uuid4()
        card = self.factory.create_card(
            title="Card",
            column_id=self.column_id,
            assignee_id=assignee_id,
        )
        assert card.assignee_id == assignee_id

    def test_card_with_estimate_and_due_date(self):
        """Картка з estimate та дедлайном."""
        from datetime import date

        due = date(2026, 12, 31)
        card = self.factory.create_card(
            title="Card",
            column_id=self.column_id,
            estimate=8.0,
            due_date=due,
        )
        assert card.estimate == 8.0
        assert card.due_date == due

    def test_card_position(self):
        """Картка зберігає передану позицію."""
        card = self.factory.create_card(
            title="Card",
            column_id=self.column_id,
            position=5,
        )
        assert card.position == 5

    def test_unknown_preset_falls_back_to_basic(self):
        """Невідомий пресет використовує 'basic' за замовчуванням."""
        card = self.factory.create_card(
            title="Card",
            column_id=self.column_id,
            card_type="nonexistent",
        )
        assert card.tags == []  # basic preset has empty tags

    def test_presets_dict_has_expected_keys(self):
        """Словник пресетів містить очікувані типи."""
        assert "basic" in CardFactory.PRESETS
        assert "urgent" in CardFactory.PRESETS
        assert "bug" in CardFactory.PRESETS
        assert "feature" in CardFactory.PRESETS


class TestBoardFactory:
    """Тести фабрики дошок."""

    def test_create_board(self):
        """Створення дошки з правильним title та owner_id."""
        owner_id = uuid.uuid4()
        board, columns = BoardFactory.create_board("My Board", owner_id)

        assert isinstance(board, Board)
        assert board.title == "My Board"
        assert board.owner_id == owner_id

    def test_creates_default_columns(self):
        """Дошка створюється зі стандартними колонками."""
        owner_id = uuid.uuid4()
        board, columns = BoardFactory.create_board("Board", owner_id)

        assert len(columns) == 3
        column_names = [c.name for c in columns]
        assert "To Do" in column_names
        assert "In Progress" in column_names
        assert "Done" in column_names

    def test_columns_have_correct_positions(self):
        """Колонки мають послідовні позиції."""
        owner_id = uuid.uuid4()
        board, columns = BoardFactory.create_board("Board", owner_id)

        positions = [c.position for c in columns]
        assert positions == [0, 1, 2]

    def test_columns_linked_to_board(self):
        """Колонки пов'язані з дошкою через board_id."""
        owner_id = uuid.uuid4()
        board, columns = BoardFactory.create_board("Board", owner_id)

        for col in columns:
            assert col.board_id == board.id

    def test_default_columns_list(self):
        """DEFAULT_COLUMNS містить правильні значення."""
        assert BoardFactory.DEFAULT_COLUMNS == ["To Do", "In Progress", "Done"]


class TestFactorySingleton:
    """Тести Singleton для фабрик."""

    def test_card_factory_is_singleton(self):
        """CardFactory повертає один і той самий екземпляр."""
        factory1 = CardFactory()
        factory2 = CardFactory()
        assert factory1 is factory2

    def test_global_card_factory_is_same_instance(self):
        """Глобальний card_factory є тим самим Singleton-екземпляром."""
        factory = CardFactory()
        assert factory is card_factory
