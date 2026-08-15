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
    approval_status: str
    created_at: str
    last_login_at: str | None

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "is_active": self.is_active,
            "approval_status": self.approval_status,
            "created_at": self.created_at,
            "last_login_at": self.last_login_at,
        }


class AuthService:
    """Authentication for one internal organization with managed user access."""

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
                    role TEXT NOT NULL DEFAULT 'member',
                    password_hash TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    approval_status TEXT NOT NULL DEFAULT 'approved',
                    created_at TEXT NOT NULL,
                    last_login_at TEXT
                )
                """
            )
            ensure_column(
                connection,
                "users",
                "approval_status",
                "TEXT NOT NULL DEFAULT 'approved'",
            )
            connection.execute(
                """
                UPDATE users
                SET role = 'member'
                WHERE role NOT IN ('owner', 'admin', 'member')
                """
            )
            connection.execute(
                """
                UPDATE users
                SET approval_status = 'disabled'
                WHERE is_active = 0 AND approval_status = 'approved'
                """
            )
            if self.owner_id(connection) is None:
                first_user = connection.execute(
                    """
                    SELECT id
                    FROM users
                    ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id ASC
                    LIMIT 1
                    """
                ).fetchone()
                if first_user is not None:
                    connection.execute(
                        """
                        UPDATE users
                        SET role = 'owner', is_active = 1, approval_status = 'approved'
                        WHERE id = ?
                        """,
                        (int(first_user["id"]),),
                    )
            connection.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

    def connect(self) -> sqlite3.Connection:
        return connect_database(self.db_path)

    def create_user(self, email: str, password: str, name: str) -> User:
        normalized_email = normalize_email(email)
        now = now_iso()

        with self.connect() as connection:
            # Serialize the bootstrap decision so concurrent signups cannot create two owners.
            connection.execute("BEGIN IMMEDIATE")
            is_first_user = self.user_count(connection) == 0
            role = "owner" if is_first_user else "member"
            is_active = 1 if is_first_user else 0
            approval_status = "approved" if is_first_user else "pending"
            try:
                cursor = connection.execute(
                    """
                    INSERT INTO users (
                        email, name, role, password_hash, is_active, approval_status, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        normalized_email,
                        name.strip(),
                        role,
                        hash_password(password),
                        is_active,
                        approval_status,
                        now,
                    ),
                )
            except sqlite3.IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email is already registered.",
                ) from exc

            user = self.get_user_by_id(cursor.lastrowid, connection)
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="User account creation failed.",
                )
            return user

    def authenticate(self, email: str, password: str) -> User:
        user = self.get_user_by_email(normalize_email(email))
        if user is None or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if user.approval_status == "pending":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is pending administrator approval.",
            )
        if not user.is_active or user.approval_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled.",
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
            "role": user.role,
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
        if user is None or not user.is_active or user.approval_status != "approved":
            raise invalid_token()
        return user

    def owner_id(self, connection: sqlite3.Connection | None = None) -> int | None:
        active_connection = connection or self.connect()
        should_close = connection is None
        try:
            row = active_connection.execute(
                "SELECT id FROM users WHERE role = 'owner' ORDER BY id ASC LIMIT 1"
            ).fetchone()
        finally:
            if should_close:
                active_connection.close()
        return int(row["id"]) if row is not None else None

    def list_users(self) -> list[User]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT id, email, name, role, password_hash, is_active,
                       approval_status, created_at, last_login_at
                FROM users
                ORDER BY CASE approval_status WHEN 'pending' THEN 0 ELSE 1 END,
                         created_at DESC, id DESC
                """
            ).fetchall()
        return [row_to_user(row) for row in rows]

    def update_user(
        self,
        user_id: int,
        actor: User,
        *,
        role: str | None,
        is_active: bool | None,
    ) -> User:
        if role is None and is_active is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update fields provided.",
            )

        with self.connect() as connection:
            target = self.get_user_by_id(user_id, connection)
            if target is None:
                raise HTTPException(status_code=404, detail="User not found.")
            if target.id == actor.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot change your own access.",
                )
            if target.role == "owner":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The owner account cannot be changed.",
                )
            if actor.role == "admin" and (target.role != "member" or role not in (None, "member")):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admins can only manage member access.",
                )

            next_role = role or target.role
            next_active = target.is_active if is_active is None else is_active
            if next_role not in {"admin", "member"}:
                raise HTTPException(status_code=422, detail="Invalid role.")
            next_status = target.approval_status
            if is_active is True:
                next_status = "approved"
            elif is_active is False:
                next_status = "disabled"

            connection.execute(
                """
                UPDATE users
                SET role = ?, is_active = ?, approval_status = ?
                WHERE id = ?
                """,
                (next_role, int(next_active), next_status, target.id),
            )
            updated = self.get_user_by_id(target.id, connection)
        if updated is None:
            raise HTTPException(status_code=500, detail="User update failed.")
        return updated

    def get_user_by_email(self, email: str) -> User | None:
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT id, email, name, role, password_hash, is_active,
                       approval_status, created_at, last_login_at
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
                SELECT id, email, name, role, password_hash, is_active,
                       approval_status, created_at, last_login_at
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
        approval_status=str(row["approval_status"]),
        created_at=str(row["created_at"]),
        last_login_at=str(row["last_login_at"]) if row["last_login_at"] is not None else None,
    )


def invalid_token() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")


def ensure_column(
    connection: sqlite3.Connection,
    table_name: str,
    column_name: str,
    ddl: str,
) -> None:
    columns = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    if any(str(column["name"]) == column_name for column in columns):
        return
    connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}")
