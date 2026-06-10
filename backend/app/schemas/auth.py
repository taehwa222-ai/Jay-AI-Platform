from typing import Literal

from pydantic import BaseModel, Field

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class UserPublic(BaseModel):
    id: int
    email: str
    name: str
    role: str
    plan: str
    is_active: bool
    created_at: str
    last_login_at: str | None = None


class SignupRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class AdminUserUpdateRequest(BaseModel):
    role: Literal["admin", "member"] | None = None
    plan: Literal["free", "pro"] | None = None
    is_active: bool | None = None


class AdminUserUsagePublic(BaseModel):
    id: int
    email: str
    name: str
    role: str
    plan: str
    is_active: bool
    analysis_count: int
    latest_analysis_at: str | None = None
    created_at: str
    last_login_at: str | None = None
