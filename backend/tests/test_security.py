"""
Unit-тести для модуля безпеки (JWT та хешування паролів).
Тестує: hash_password, verify_password, create_access_token, decode_access_token.
"""

import pytest
from unittest.mock import patch
from datetime import datetime, timedelta, timezone

from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


class TestHashPassword:
    """Тести хешування паролів (bcrypt)."""

    def test_hash_returns_string(self):
        """Хеш-функція повертає рядок."""
        result = hash_password("my_password")
        assert isinstance(result, str)

    def test_hash_not_equal_to_plain(self):
        """Хеш не дорівнює відкритому паролю."""
        plain = "my_password"
        hashed = hash_password(plain)
        assert hashed != plain

    def test_different_passwords_different_hashes(self):
        """Різні паролі дають різні хеші (через сіль)."""
        hash1 = hash_password("password1")
        hash2 = hash_password("password2")
        assert hash1 != hash2

    def test_same_password_different_hashes(self):
        """Один пароль дає різні хеші через випадкову сіль."""
        hash1 = hash_password("same")
        hash2 = hash_password("same")
        assert hash1 != hash2  # bcrypt uses random salt


class TestVerifyPassword:
    """Тести верифікації паролів."""

    def test_correct_password_returns_true(self):
        """Правильний пароль проходить верифікацію."""
        plain = "correct_password"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_wrong_password_returns_false(self):
        """Неправильний пароль не проходить верифікацію."""
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_empty_password(self):
        """Порожній пароль хешується та верифікується."""
        hashed = hash_password("")
        assert verify_password("", hashed) is True
        assert verify_password("notempty", hashed) is False


class TestCreateAccessToken:
    """Тести створення JWT-токенів."""

    def test_returns_string(self):
        """Токен повертається як рядок."""
        token = create_access_token({"sub": "user123"})
        assert isinstance(token, str)

    def test_token_not_empty(self):
        """Токен не порожній."""
        token = create_access_token({"sub": "user123"})
        assert len(token) > 0

    def test_token_has_three_parts(self):
        """JWT-токен складається з 3-х частин (header.payload.signature)."""
        token = create_access_token({"sub": "user123"})
        parts = token.split(".")
        assert len(parts) == 3


class TestDecodeAccessToken:
    """Тести декодування JWT-токенів."""

    def test_valid_token_decoded(self):
        """Валідний токен декодується у payload."""
        token = create_access_token({"sub": "user123"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user123"

    def test_expired_token_returns_none(self):
        """Протермінований токен повертає None."""
        with patch("app.utils.security.settings") as mock_settings:
            mock_settings.SECRET_KEY = "test-secret"
            mock_settings.ALGORITHM = "HS256"
            mock_settings.ACCESS_TOKEN_EXPIRE_MINUTES = -1  # Вже протермінований
            token = create_access_token({"sub": "user123"})

        # Декодування з оригінальними налаштуваннями поверне None
        result = decode_access_token(token)
        # Token created with -1 minute expiry = already expired
        assert result is None

    def test_invalid_token_returns_none(self):
        """Невалідний токен повертає None."""
        result = decode_access_token("invalid.token.here")
        assert result is None

    def test_empty_token_returns_none(self):
        """Порожній токен повертає None."""
        result = decode_access_token("")
        assert result is None

    def test_payload_contains_exp(self):
        """Payload містить поле exp (expiration)."""
        token = create_access_token({"sub": "user123"})
        payload = decode_access_token(token)
        assert "exp" in payload
