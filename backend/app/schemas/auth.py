from typing import Any, Literal

from pydantic import BaseModel, Field

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class UserPublic(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool
    approval_status: str
    can_access_stocks: bool
    can_access_content_ops: bool
    created_at: str
    last_login_at: str | None = None


class SignupRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    invite_token: str | None = Field(default=None, min_length=20, max_length=200)


class LoginRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class SignupResponse(BaseModel):
    user: UserPublic
    approval_status: Literal["approved", "pending"]
    message: str
    access_token: str | None = None
    token_type: str = "bearer"


class AdminUserUpdateRequest(BaseModel):
    role: Literal["admin", "member"] | None = None
    is_active: bool | None = None
    can_access_stocks: bool | None = None
    can_access_content_ops: bool | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str


class AuditLogPublic(BaseModel):
    id: int
    event_type: str
    actor_user_id: int | None
    actor_name: str | None
    target_user_id: int | None
    target_name: str | None
    details: dict[str, Any]
    created_at: str


class InvitationCreateRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    role: Literal["admin", "member"] = "member"
    can_access_stocks: bool = True
    can_access_content_ops: bool = True
    expires_in_days: int = Field(default=7, ge=1, le=30)


class InvitationPublic(BaseModel):
    id: int
    email: str
    role: str
    can_access_stocks: bool
    can_access_content_ops: bool
    expires_at: str
    used_at: str | None
    revoked_at: str | None
    created_at: str
    token: str | None = None
