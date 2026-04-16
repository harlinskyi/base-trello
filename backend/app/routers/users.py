"""
Маршрути для управління користувачами.
Адмін-панель та профіль.
"""

from fastapi import APIRouter, Depends

from app.schemas.admin import AdminStatsResponse
from app.schemas.user import UserUpdate, UserResponse, ChangePassword
from app.services.user_service import UserService
from app.services.admin_service import AdminStatsService
from app.middleware.auth import get_uow, get_current_user, require_admin
from app.repositories.unit_of_work import UnitOfWork
from app.models.user import User

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Отримати профіль поточного користувача."""
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Оновити профіль поточного користувача."""
    service = UserService(uow)
    # Не дозволяємо користувачу змінювати свою роль
    data.role = None
    return await service.update_user(current_user.id, data)


@router.post("/me/change-password")
async def change_password(
    data: ChangePassword,
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Змінити пароль поточного користувача."""
    service = UserService(uow)
    await service.change_password(current_user.id, data)
    return {"detail": "Пароль успішно змінено"}


@router.get("", response_model=list[UserResponse])
async def get_all_users(
    current_user: User = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Отримати список усіх користувачів (для вибору members)."""
    service = UserService(uow)
    return await service.get_all_users()


# --- Admin routes ---


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    admin: User = Depends(require_admin),
    uow: UnitOfWork = Depends(get_uow),
):
    """[Admin] Отримати агреговану статистику системи."""
    service = AdminStatsService(uow)
    return await service.get_dashboard_stats()


@router.put("/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: str,
    data: UserUpdate,
    admin: User = Depends(require_admin),
    uow: UnitOfWork = Depends(get_uow),
):
    """[Admin] Оновити дані користувача."""
    import uuid

    service = UserService(uow)
    return await service.update_user(uuid.UUID(user_id), data)


@router.delete("/{user_id}")
async def admin_delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    uow: UnitOfWork = Depends(get_uow),
):
    """[Admin] Видалити користувача."""
    import uuid

    service = UserService(uow)
    await service.delete_user(uuid.UUID(user_id))
    return {"detail": "Користувача видалено"}
