from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.routers.auth import require_admin
from app.schemas.auth import (
    AdminUserUpdateRequest,
    AuditLogPublic,
    MessageResponse,
    PasswordResetRequest,
    UserPublic,
)
from app.services.auth import AuthService, User

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def get_auth_service(request: Request) -> AuthService:
    return request.app.state.auth_service


@router.get("/users", response_model=list[UserPublic])
async def list_users(
    _: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> list[UserPublic]:
    return [UserPublic(**user.public()) for user in auth_service.list_users()]


@router.patch("/users/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: int,
    payload: AdminUserUpdateRequest,
    actor: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> UserPublic:
    user = auth_service.update_user(
        user_id,
        actor,
        role=payload.role,
        is_active=payload.is_active,
        can_access_stocks=payload.can_access_stocks,
        can_access_content_ops=payload.can_access_content_ops,
    )
    return UserPublic(**user.public())


@router.post("/users/{user_id}/sessions/revoke", response_model=MessageResponse)
async def revoke_user_sessions(
    user_id: int,
    actor: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    auth_service.revoke_sessions(user_id, actor)
    return MessageResponse(message="User sessions revoked.")


@router.post("/users/{user_id}/password/reset", response_model=MessageResponse)
async def reset_user_password(
    user_id: int,
    payload: PasswordResetRequest,
    actor: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    auth_service.reset_password(user_id, actor, payload.new_password)
    return MessageResponse(message="Password reset. Existing sessions were revoked.")


@router.get("/audit-logs", response_model=list[AuditLogPublic])
async def audit_logs(
    _: Annotated[User, Depends(require_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    limit: int = 50,
) -> list[AuditLogPublic]:
    return [AuditLogPublic(**log.__dict__) for log in auth_service.list_audit_logs(limit)]
