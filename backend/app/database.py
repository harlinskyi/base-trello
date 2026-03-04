"""
Налаштування підключення до бази даних.
Використовується async SQLAlchemy для неблокуючого доступу до PostgreSQL.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)

async_session_factory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    """Базовий клас для всіх ORM-моделей."""

    pass


async def get_session() -> AsyncSession:  # type: ignore
    """Dependency Injection: надає сесію БД для кожного запиту."""
    async with async_session_factory() as session:
        yield session
