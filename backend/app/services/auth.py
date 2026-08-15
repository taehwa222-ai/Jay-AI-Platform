from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status

from app.config import Settings
from app.services.database import connect_database


@dataclass(frozen=True)
class User:
    id: int
    email: str
    name: str
    role: str
    password_hash: str
    is_active: bool
    created_at: str
    last_login_at: str | None

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "last_login_at": self.last_login_at,
        }


class AuthService:
    """Authentication for a single owner-operated internal system."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = settings.database_path

    def init_db(self) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'admin',
                    password_hash TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    last_login_at TEXT
                )
                """
            )
            connection.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

    def connect(self) -> sqlite3.Connection:
        return connect_database(self.db_path)

    def create_user(self, email: str, password: str, name: str) -> User:
        normalized_email = normalize_email(email)
        now = now_iso()

        with self.connect() as connection:
            if self.user_count(connection) > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The owner account is already initialized.",
                )
            try:
                cursor = connection.execute(
                    """
                    INSERT INTO users (email, name, role, password_hash, created_at)
                    VALUES (?, ?, 'admin', ?, ?)
                    """,
                    (normalized_email, name.strip(), hash_password(password), now),
                )
            except sqlite3.IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The owner account is already initialized.",
                ) from exc

            user = self.get_user_by_id(cursor.lastrowid, connection)
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Owner account creation failed.",
                )
            return user

    def authenticate(self, email: str, password: str) -> User:
        user = self.get_user_by_email(normalize_email(email))
        if user is None or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active or user.role != "admin" or user.id != self.owner_id():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the active owner account can access this system.",
            )

        with self.connect() as connection:
            connection.execute(
                "UPDATE users SET last_login_at = ? WHERE id = ?",
                (now_iso(), user.id),
            )

        refreshed = self.get_user_by_id(user.id)
        if refreshed is None:
            raise invalid_token()
        return refreshed

    def create_token(self, user: User) -> str:
        expires_at = datetime.now(UTC) + timedelta(minutes=self.settings.access_token_minutes)
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": "admin",
            "exp": int(expires_at.timestamp()),
        }
        payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        payload_part = base64url_encode(payload_bytes)
        signature = sign_value(payload_part, self.settings.auth_secret_key)
        return f"{payload_part}.{signature}"

    def user_from_token(self, token: str) -> User:
        try:
            payload_part, signature = token.split(".", 1)
        except ValueError as exc:
            raise invalid_token() from exc

        expected_signature = sign_value(payload_part, self.settings.auth_secret_key)
        if not hmac.compare_digest(signature, expected_signature):
            raise invalid_token()

        try:
            payload = json.loads(base64url_decode(payload_part))
            expires_at = int(payload.get("exp", 0))
            user_id = int(payload.get("sub", 0))
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            raise invalid_token() from exc

        if expires_at < int(datetime.now(UTC).timestamp()):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired.")

        user = self.get_user_by_id(user_id)
        if (
            user is None
            or not user.is_active
            or user.role != "admin"
            or user.id != self.owner_id()
        ):
            raise invalid_token()
        return user

    def owner_id(self) -> int | None:
        """Return the single effective owner without rewriting legacy account rows."""
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT id
                FROM users
                WHERE role = 'admin'
                ORDER BY id ASC
                LIMIT 1
                """
            ).fetchone()
        return int(row["id"]) if row is not None else None

    def get_user_by_email(self, email: str) -> User | None:
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT id, email, name, role, password_hash, is_active, created_at, last_login_at
                FROM users
                WHERE email = ?
                """,
                (email,),
            ).fetchone()
        return row_to_user(row) if row is not None else None

    def get_user_by_id(
        self,
        user_id: int | None,
        connection: sqlite3.Connection | None = None,
    ) -> User | None:
        if user_id is None:
            return None
        active_connection = connection or self.connect()
        should_close = connection is None
        try:
            row = active_connection.execute(
                """
                SELECT id, email, name, role, password_hash, is_active, created_at, last_login_at
                FROM users
                WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
            return row_to_user(row) if row is not None else None
        finally:
            if should_close:
                active_connection.close()

    @staticmethod
    def user_count(connection: sqlite3.Connection) -> int:
        row = connection.execute("SELECT COUNT(*) AS count FROM users").fetchone()
        return int(row["count"])


def normalize_email(email: str) -> str:
    return email.strip().lower()


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 210_000)
    return f"pbkdf2_sha256$210000${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected_hash = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            salt.encode(),
            int(iterations),
        )
    except (TypeError, ValueError):
        return False
    return hmac.compare_digest(digest.hex(), expected_hash)


def sign_value(value: str, secret_key: str) -> str:
    signature = hmac.new(secret_key.encode(), value.encode(), hashlib.sha256).digest()
    return base64url_encode(signature)


def base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def base64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def row_to_user(row: sqlite3.Row) -> User:
    return User(
        id=int(row["id"]),
        email=str(row["email"]),
        name=str(row["name"]),
        role=str(row["role"]),
        password_hash=str(row["password_hash"]),
        is_active=bool(row["is_active"]),
        created_at=str(row["created_at"]),
        last_login_at=str(row["last_login_at"]) if row["last_login_at"] is not None else None,
    )


def invalid_token() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")
