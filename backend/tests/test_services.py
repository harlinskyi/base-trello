"""
Unit-тести для сервісного шару (Services).
Тестує бізнес-логіку з мокованим Unit of Work.
"""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from fastapi import HTTPException

from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.services.board_service import BoardService
from app.services.card_service import CardService
from app.schemas.user import UserCreate, UserLogin, ChangePassword
from app.schemas.board import BoardCreate
from app.schemas.card import CardCreate, CardUpdate, CardMove
from app.models.user import User, Role
from app.models.board import Board
from app.models.card import Card
from app.models.column import Column


# ==================== AuthService ====================


class TestAuthService:
    """Тести сервісу авторизації."""

    @pytest.mark.asyncio
    async def test_register_success(self, mock_uow):
        """Успішна реєстрація нового користувача."""
        import uuid
        from datetime import datetime, timezone

        mock_uow.users.get_by_email = AsyncMock(return_value=None)
        mock_uow.users.get_by_username = AsyncMock(return_value=None)

        async def fake_create(user):
            user.id = uuid.uuid4()
            user.role = "user"
            user.created_at = datetime.now(timezone.utc)
            return user

        mock_uow.users.create = AsyncMock(side_effect=fake_create)

        service = AuthService(mock_uow)
        data = UserCreate(username="newuser", email="new@test.com", password="pass123")

        result = await service.register(data)

        assert result.access_token is not None
        assert result.user.username == "newuser"
        mock_uow.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, mock_uow, sample_user):
        """Реєстрація з існуючим email викликає помилку."""
        mock_uow.users.get_by_email = AsyncMock(return_value=sample_user)

        service = AuthService(mock_uow)
        data = UserCreate(
            username="newuser", email="test@example.com", password="pass123"
        )

        with pytest.raises(HTTPException) as exc:
            await service.register(data)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, mock_uow, sample_user):
        """Реєстрація з існуючим username викликає помилку."""
        mock_uow.users.get_by_email = AsyncMock(return_value=None)
        mock_uow.users.get_by_username = AsyncMock(return_value=sample_user)

        service = AuthService(mock_uow)
        data = UserCreate(
            username="testuser", email="other@test.com", password="pass123"
        )

        with pytest.raises(HTTPException) as exc:
            await service.register(data)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_login_success(self, mock_uow):
        """Успішна авторизація з правильними даними."""
        from app.utils.security import hash_password

        user = MagicMock(spec=User)
        user.id = uuid.uuid4()
        user.username = "testuser"
        user.email = "test@test.com"
        user.hashed_password = hash_password("correct")
        user.role = Role.USER
        user.created_at = datetime.now(timezone.utc)

        mock_uow.users.get_by_email = AsyncMock(return_value=user)

        service = AuthService(mock_uow)
        data = UserLogin(email="test@test.com", password="correct")

        result = await service.login(data)
        assert result.access_token is not None

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, mock_uow):
        """Авторизація з невірним паролем викликає помилку."""
        from app.utils.security import hash_password

        user = MagicMock(spec=User)
        user.hashed_password = hash_password("correct")

        mock_uow.users.get_by_email = AsyncMock(return_value=user)

        service = AuthService(mock_uow)
        data = UserLogin(email="test@test.com", password="wrong")

        with pytest.raises(HTTPException) as exc:
            await service.login(data)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_login_user_not_found(self, mock_uow):
        """Авторизація неіснуючого користувача викликає помилку."""
        mock_uow.users.get_by_email = AsyncMock(return_value=None)

        service = AuthService(mock_uow)
        data = UserLogin(email="noone@test.com", password="pass")

        with pytest.raises(HTTPException) as exc:
            await service.login(data)
        assert exc.value.status_code == 401


# ==================== UserService ====================


class TestUserService:
    """Тести сервісу користувачів."""

    @pytest.mark.asyncio
    async def test_get_all_users(self, mock_uow, sample_user):
        """Отримання списку всіх користувачів."""
        mock_uow.users.get_all = AsyncMock(return_value=[sample_user])

        service = UserService(mock_uow)
        result = await service.get_all_users()

        assert len(result) == 1
        assert result[0].username == "testuser"

    @pytest.mark.asyncio
    async def test_get_user_by_id(self, mock_uow, sample_user):
        """Отримання користувача за ID."""
        mock_uow.users.get_by_id = AsyncMock(return_value=sample_user)

        service = UserService(mock_uow)
        result = await service.get_user_by_id(sample_user.id)

        assert result.id == sample_user.id

    @pytest.mark.asyncio
    async def test_get_user_not_found(self, mock_uow):
        """Пошук неіснуючого користувача викликає 404."""
        mock_uow.users.get_by_id = AsyncMock(return_value=None)

        service = UserService(mock_uow)

        with pytest.raises(HTTPException) as exc:
            await service.get_user_by_id(uuid.uuid4())
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_change_password_success(self, mock_uow):
        """Успішна зміна пароля."""
        from app.utils.security import hash_password

        user = MagicMock(spec=User)
        user.id = uuid.uuid4()
        user.hashed_password = hash_password("old_password")
        mock_uow.users.get_by_id = AsyncMock(return_value=user)

        service = UserService(mock_uow)
        data = ChangePassword(current_password="old_password", new_password="new_password")

        await service.change_password(user.id, data)
        mock_uow.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, mock_uow):
        """Зміна пароля з невірним поточним — помилка 400."""
        from app.utils.security import hash_password

        user = MagicMock(spec=User)
        user.hashed_password = hash_password("real_password")
        mock_uow.users.get_by_id = AsyncMock(return_value=user)

        service = UserService(mock_uow)
        data = ChangePassword(current_password="wrong", new_password="newpass")

        with pytest.raises(HTTPException) as exc:
            await service.change_password(user.id, data)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_change_password_too_short(self, mock_uow):
        """Новий пароль занадто короткий — помилка 400."""
        from app.utils.security import hash_password

        user = MagicMock(spec=User)
        user.hashed_password = hash_password("old_pass")
        mock_uow.users.get_by_id = AsyncMock(return_value=user)

        service = UserService(mock_uow)
        data = ChangePassword(current_password="old_pass", new_password="ab")

        with pytest.raises(HTTPException) as exc:
            await service.change_password(user.id, data)
        assert exc.value.status_code == 400


# ==================== BoardService ====================


class TestBoardService:
    """Тести сервісу дошок."""

    @pytest.mark.asyncio
    async def test_create_board(self, mock_uow, sample_user_id):
        """Створення дошки (BoardFactory)."""
        mock_uow.boards.create = AsyncMock(side_effect=lambda b: b)
        mock_uow.columns.create = AsyncMock(side_effect=lambda c: c)

        board_mock = MagicMock(spec=Board)
        board_mock.id = uuid.uuid4()
        board_mock.title = "New Board"
        board_mock.owner_id = sample_user_id
        board_mock.columns = []
        board_mock.members = []
        board_mock.created_at = datetime.now(timezone.utc)
        mock_uow.boards.get_by_id_with_relations = AsyncMock(return_value=board_mock)

        service = BoardService(mock_uow)
        data = BoardCreate(title="New Board")

        result = await service.create_board(data, sample_user_id)

        assert result.title == "New Board"
        mock_uow.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_board_owner(self, mock_uow, sample_board, sample_user):
        """Власник може видалити дошку."""
        mock_uow.boards.get_by_id = AsyncMock(return_value=sample_board)
        mock_uow.users.get_by_id = AsyncMock(return_value=sample_user)

        service = BoardService(mock_uow)

        await service.delete_board(sample_board.id, sample_user.id)
        mock_uow.boards.delete.assert_called_once()
        mock_uow.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_board_not_owner(self, mock_uow, sample_board):
        """Не-власник не може видалити дошку."""
        other_user = MagicMock(spec=User)
        other_user.id = uuid.uuid4()
        other_user.role = Role.USER

        mock_uow.boards.get_by_id = AsyncMock(return_value=sample_board)
        mock_uow.users.get_by_id = AsyncMock(return_value=other_user)

        service = BoardService(mock_uow)

        with pytest.raises(HTTPException) as exc:
            await service.delete_board(sample_board.id, other_user.id)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_board_admin_allowed(self, mock_uow, sample_board, sample_admin):
        """Адмін може видалити будь-яку дошку."""
        mock_uow.boards.get_by_id = AsyncMock(return_value=sample_board)
        mock_uow.users.get_by_id = AsyncMock(return_value=sample_admin)

        service = BoardService(mock_uow)

        await service.delete_board(sample_board.id, sample_admin.id)
        mock_uow.boards.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_board_not_found(self, mock_uow, sample_user_id):
        """Запит неіснуючої дошки повертає 404."""
        mock_uow.boards.get_by_id_with_relations = AsyncMock(return_value=None)

        service = BoardService(mock_uow)

        with pytest.raises(HTTPException) as exc:
            await service.get_board_detail(uuid.uuid4(), sample_user_id)
        assert exc.value.status_code == 404


# ==================== CardService ====================


class TestCardService:
    """Тести сервісу карток."""

    @pytest.mark.asyncio
    async def test_delete_card_owner(self, mock_uow, sample_card, sample_board, sample_column, sample_user):
        """Власник дошки може видалити картку."""
        mock_uow.cards.get_by_id = AsyncMock(return_value=sample_card)
        mock_uow.columns.get_by_id = AsyncMock(return_value=sample_column)
        mock_uow.boards.get_by_id_with_relations = AsyncMock(return_value=sample_board)
        mock_uow.users.get_by_id = AsyncMock(return_value=sample_user)

        service = CardService(mock_uow)

        await service.delete_card(sample_card.id, sample_user.id)
        mock_uow.cards.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_card_not_owner(self, mock_uow, sample_card, sample_board, sample_column):
        """Не-власник не може видалити картку."""
        other_user = MagicMock(spec=User)
        other_id = uuid.uuid4()
        other_user.id = other_id
        other_user.role = Role.USER

        sample_board.owner_id = uuid.uuid4()  # інший owner
        sample_board.members = []

        mock_uow.cards.get_by_id = AsyncMock(return_value=sample_card)
        mock_uow.columns.get_by_id = AsyncMock(return_value=sample_column)
        mock_uow.boards.get_by_id_with_relations = AsyncMock(return_value=sample_board)
        mock_uow.users.get_by_id = AsyncMock(return_value=other_user)

        service = CardService(mock_uow)

        with pytest.raises(HTTPException) as exc:
            await service.delete_card(sample_card.id, other_id)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_card_not_found(self, mock_uow):
        """Видалення неіснуючої картки — 404."""
        mock_uow.cards.get_by_id = AsyncMock(return_value=None)

        service = CardService(mock_uow)

        with pytest.raises(HTTPException) as exc:
            await service.delete_card(uuid.uuid4(), uuid.uuid4())
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_card_detail(self, mock_uow, sample_card):
        """Отримання деталей картки."""
        sample_card.assignee = None
        sample_card.comments = []
        sample_card.worklogs = []
        mock_uow.cards.get_by_id_with_relations = AsyncMock(return_value=sample_card)

        service = CardService(mock_uow)
        result = await service.get_card_detail(sample_card.id)

        assert result.title == "Test Card"

    @pytest.mark.asyncio
    async def test_get_card_not_found(self, mock_uow):
        """Запит неіснуючої картки — 404."""
        mock_uow.cards.get_by_id_with_relations = AsyncMock(return_value=None)

        service = CardService(mock_uow)

        with pytest.raises(HTTPException) as exc:
            await service.get_card_detail(uuid.uuid4())
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_move_card_not_found(self, mock_uow):
        """Переміщення неіснуючої картки — 404."""
        mock_uow.cards.get_by_id = AsyncMock(return_value=None)

        service = CardService(mock_uow)
        data = CardMove(column_id=uuid.uuid4(), position=0)

        with pytest.raises(HTTPException) as exc:
            await service.move_card(uuid.uuid4(), data, uuid.uuid4())
        assert exc.value.status_code == 404
