"""
Конфігурація додатку.
Принцип DIP (SOLID): залежність від абстракцій, а не від конкретних значень.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Налаштування додатку, завантажуються з .env або змінних середовища."""

    APP_NAME: str = "Base Kanban Trello"
    DEBUG: bool = True

    # Database
    # Локальний дефолт для запуску бекенду з хоста.
    # У Docker Compose це значення перевизначається через environment (host = db).
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kanban"

    # JWT
    SECRET_KEY: str = "super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Default admin
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@kanban.com"
    ADMIN_PASSWORD: str = "admin123"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
