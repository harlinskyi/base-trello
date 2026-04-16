"""
Точка входу FastAPI-додатку.
Архітектурний патерн MVC: Routers = Controllers, Services = Model, Frontend = View.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.database import engine, Base, async_session_factory
from app.routers import auth, users, boards, cards, notifications

# Імпорт моделей для створення таблиць
from app.models.user import User  # noqa: F401
from app.models.board import Board  # noqa: F401
from app.models.column import Column  # noqa: F401
from app.models.card import Card  # noqa: F401
from app.models.comment import Comment  # noqa: F401
from app.models.worklog import Worklog  # noqa: F401
from app.models.notification import Notification, BoardInvitation  # noqa: F401

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Створення таблиць при старті (для розробки)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_columns_color_column)
    logger.info("Database tables created")
    await seed_admin()
    yield


def _ensure_columns_color_column(sync_conn):
    """Легка схема-міграція для dev: додає columns.color, якщо поля ще немає."""
    inspector = inspect(sync_conn)
    columns = {col["name"] for col in inspector.get_columns("columns")}
    if "color" not in columns:
        sync_conn.execute(text("ALTER TABLE columns ADD COLUMN color VARCHAR(7) NULL"))


async def seed_admin():
    """Створити адміністратора при першому запуску, якщо його ще немає."""
    from sqlalchemy import select
    from app.models.user import User, Role
    from app.utils.security import hash_password

    async with async_session_factory() as session:
        result = await session.execute(
            select(User).where(User.username == settings.ADMIN_USERNAME)
        )
        if result.scalar_one_or_none() is None:
            admin = User(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role=Role.ADMIN,
            )
            session.add(admin)
            await session.commit()
            logger.info("Admin user '%s' created", settings.ADMIN_USERNAME)
        else:
            logger.info("Admin user '%s' already exists", settings.ADMIN_USERNAME)


app = FastAPI(
    title=settings.APP_NAME,
    description="Kanban Board API — курсова робота з ООП",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

# CORS для фронтенду
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Реєстрація маршрутів (Controllers)
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(boards.router, prefix="/api")
app.include_router(cards.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Перевірка стану API."""
    return {"status": "ok", "app": settings.APP_NAME}
