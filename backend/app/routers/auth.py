from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    PasswordChangeRequest,
    SignupRequest,
    SignupResponse,
    UserPublic,
)
from app.services.auth import AuthService, User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def get_auth_service(request: Request) -> AuthService:
    return request.app.state.auth_service


def get_current_user(
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token is required.",
        )
    return auth_service.user_from_token(authorization.removeprefix("Bearer ").strip())


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role not in {"owner", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required.",
        )
    return user


def require_stock_access(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.can_access_stocks:
        raise HTTPException(status_code=403, detail="Stock Lab access is required.")
    return user


def require_content_ops_access(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.can_access_content_ops:
        raise HTTPException(status_code=403, detail="Content Ops access is required.")
    return user


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> SignupResponse:
    user = auth_service.create_user(payload.email, payload.password, payload.name)
    approved = user.approval_status == "approved"
    return SignupResponse(
        user=UserPublic(**user.public()),
        approval_status="approved" if approved else "pending",
        access_token=auth_service.create_token(user) if approved else None,
        message=(
            "Owner account created."
            if approved
            else "Registration received. Wait for administrator approval."
        ),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthResponse:
    user = auth_service.authenticate(payload.email, payload.password)
    return AuthResponse(
        access_token=auth_service.create_token(user),
        user=UserPublic(**user.public()),
    )


@router.get("/me", response_model=UserPublic)
async def me(user: Annotated[User, Depends(get_current_user)]) -> UserPublic:
    return UserPublic(**user.public())


@router.post("/password", response_model=MessageResponse)
async def change_password(
    payload: PasswordChangeRequest,
    user: Annotated[User, Depends(get_current_user)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    auth_service.change_password(user, payload.current_password, payload.new_password)
    return MessageResponse(message="Password changed. Sign in again.")


@router.post("/sessions/revoke", response_model=MessageResponse)
async def revoke_own_sessions(
    user: Annotated[User, Depends(get_current_user)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    auth_service.revoke_sessions(user.id, user)
    return MessageResponse(message="All sessions revoked.")
