from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.routers.auth import require_admin
from app.schemas.auth import (
    AdminContentStatsPublic,
    AdminUserUpdateRequest,
    AdminUserUsagePublic,
    ProUpgradeRequestPublic,
    ProUpgradeRequestUpdate,
    UserPublic,
)
from app.services.auth import AuthService, User

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def get_auth_service(request: Request) -> AuthService:
    return request.app.state.auth_service


@router.get("/users", response_model=list[UserPublic])
async def users(
    _: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> list[UserPublic]:
    return [UserPublic(**user.public()) for user in auth_service.list_users()]


@router.get("/user-usage", response_model=list[AdminUserUsagePublic])
async def user_usage(
    _: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> list[AdminUserUsagePublic]:
    return [AdminUserUsagePublic(**usage) for usage in auth_service.list_user_usage()]


@router.get("/content-stats", response_model=AdminContentStatsPublic)
async def content_stats(
    _: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AdminContentStatsPublic:
    return AdminContentStatsPublic(**auth_service.content_stats())


@router.get("/pro-requests", response_model=list[ProUpgradeRequestPublic])
async def pro_requests(
    _: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> list[ProUpgradeRequestPublic]:
    return [
        ProUpgradeRequestPublic(**request)
        for request in auth_service.list_pro_upgrade_requests()
    ]


@router.patch("/pro-requests/{request_id}", response_model=ProUpgradeRequestPublic)
async def update_pro_request(
    request_id: int,
    payload: ProUpgradeRequestUpdate,
    _: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> ProUpgradeRequestPublic:
    request = auth_service.update_pro_upgrade_request(
        request_id,
        payload.status,
        payload.admin_note,
    )
    return ProUpgradeRequestPublic(**request)


@router.patch("/users/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: int,
    payload: AdminUserUpdateRequest,
    actor: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> UserPublic:
    user = auth_service.update_user(
        user_id=user_id,
        actor=actor,
        role=payload.role,
        plan=payload.plan,
        is_active=payload.is_active,
    )
    return UserPublic(**user.public())
