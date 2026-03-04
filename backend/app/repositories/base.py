"""
Базовий репозиторій (патерн Repository — GoF).

Патерн Repository забезпечує абстракцію доступу до даних,
ізолюючи бізнес-логіку від деталей роботи з ORM.
Це дотримання принципу DIP (SOLID): залежність від абстракцій.

Обґрунтування вибору:
- Забезпечує єдину точку доступу до даних для кожної сутності.
- Полегшує тестування (можна підставити mock-репозиторій).
- Дозволяє змінити ORM без зміни бізнес-логіки.
"""

import uuid
from typing import TypeVar, Generic, Type, Sequence

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Узагальнений (Generic) репозиторій для CRUD-операцій.
    Принцип OCP (SOLID): клас відкритий для розширення,
    закритий для модифікації — нащадки додають специфічну логіку.
    """

    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self._model = model
        self._session = session

    async def get_by_id(self, entity_id: uuid.UUID) -> ModelType | None:
        """Отримати сутність за ID."""
        return await self._session.get(self._model, entity_id)

    async def get_all(self) -> Sequence[ModelType]:
        """Отримати всі сутності."""
        result = await self._session.execute(select(self._model))
        return result.scalars().all()

    async def create(self, entity: ModelType) -> ModelType:
        """Створити нову сутність."""
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def update(self, entity: ModelType) -> ModelType:
        """Оновити існуючу сутність."""
        await self._session.flush()
        return entity

    async def delete(self, entity_id: uuid.UUID) -> None:
        """Видалити сутність за ID."""
        await self._session.execute(
            delete(self._model).where(self._model.id == entity_id)
        )
        await self._session.flush()
