from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.schemas.auth import AuthResponse, LoginRequest, SignupRequest, UserPublic
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
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required.",
        )
    return user


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthResponse:
    user = auth_service.create_user(payload.email, payload.password, payload.name)
    return AuthResponse(
        access_token=auth_service.create_token(user),
        user=UserPublic(**user.public()),
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
