from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.routers.auth import require_admin
from app.schemas.auth import UserPublic
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
