"""
Патерн Strategy (Стратегія) — GoF.

Обґрунтування вибору:
- Визначає сімейство алгоритмів, інкапсулює кожен із них
  і робить їх взаємозамінними.
- Дозволяє змінювати спосіб доставки сповіщень (In-App, Log)
  без модифікації NotificationService.
- Дотримання принципів OCP та DIP (SOLID):
  сервіс залежить від абстракції NotificationStrategy,
  а не від конкретної реалізації.

Використання у проєкті:
- DatabaseNotificationStrategy: зберігає сповіщення у БД (In-App).
- LogNotificationStrategy: логує сповіщення (для розробки/тестів).
- NotificationService використовує список стратегій для доставки.
"""

import uuid
import logging
from abc import ABC, abstractmethod
from typing import Any

from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)


class NotificationStrategy(ABC):
    """
    Абстрактна стратегія доставки сповіщень.
    Принцип LSP (SOLID): будь-яка конкретна стратегія
    може замінити базовий клас.
    """

    @abstractmethod
    async def send(
        self,
        user_id: uuid.UUID,
        ntype: NotificationType,
        title: str,
        message: str,
        link: str | None = None,
        related_id: uuid.UUID | None = None,
        **kwargs: Any,
    ) -> Notification | None:
        """Доставити сповіщення. Повертає Notification або None."""
        pass


class DatabaseNotificationStrategy(NotificationStrategy):
    """
    Стратегія збереження сповіщення у базу даних (In-App).
    Створює запис Notification, який показується у UI.
    """

    async def send(
        self,
        user_id: uuid.UUID,
        ntype: NotificationType,
        title: str,
        message: str,
        link: str | None = None,
        related_id: uuid.UUID | None = None,
        **kwargs: Any,
    ) -> Notification:
        uow = kwargs.get("uow")
        if not uow:
            raise ValueError("DatabaseNotificationStrategy потребує 'uow' у kwargs")

        notification = Notification(
            user_id=user_id,
            type=ntype,
            title=title,
            message=message,
            link=link,
            related_id=related_id,
        )
        await uow.notifications.create(notification)
        return notification


class LogNotificationStrategy(NotificationStrategy):
    """
    Стратегія логування сповіщень (для розробки та тестування).
    Виводить інформацію про сповіщення у лог-файл.
    """

    async def send(
        self,
        user_id: uuid.UUID,
        ntype: NotificationType,
        title: str,
        message: str,
        link: str | None = None,
        related_id: uuid.UUID | None = None,
        **kwargs: Any,
    ) -> None:
        logger.info(
            f"[Notification] user={user_id} type={ntype.value} "
            f"title='{title}' message='{message}' link={link}"
        )
        return None
