from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

from app.config import Settings


@dataclass(frozen=True)
class User:
    id: int
    email: str
    name: str
    role: str
    plan: str
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
            "plan": self.plan,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "last_login_at": self.last_login_at,
        }


class AuthService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = settings.database_path

    def init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'member',
                    plan TEXT NOT NULL DEFAULT 'free',
                    password_hash TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    last_login_at TEXT
                )
                """
            )
            ensure_column(conn, "users", "plan", "TEXT NOT NULL DEFAULT 'free'")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def create_user(self, email: str, password: str, name: str) -> User:
        normalized_email = normalize_email(email)
        now = now_iso()

        with self.connect() as conn:
            role = "admin" if self.user_count(conn) == 0 else "member"
            try:
                cursor = conn.execute(
                    """
                    INSERT INTO users (email, name, role, plan, password_hash, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        normalized_email,
                        name.strip(),
                        role,
                        "pro" if role == "admin" else "free",
                        hash_password(password),
                        now,
                    ),
                )
            except sqlite3.IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email is already registered.",
                ) from exc

            user = self.get_user_by_id(cursor.lastrowid, conn)
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="User creation failed.",
                )
            return user

    def authenticate(self, email: str, password: str) -> User:
        user = self.get_user_by_email(normalize_email(email))
        if user is None or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is disabled.",
            )

        with self.connect() as conn:
            conn.execute(
                "UPDATE users SET last_login_at = ? WHERE id = ?",
                (now_iso(), user.id),
            )

        refreshed = self.get_user_by_id(user.id)
        if refreshed is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
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
        except (ValueError, json.JSONDecodeError) as exc:
            raise invalid_token() from exc

        if int(payload.get("exp", 0)) < int(datetime.now(UTC).timestamp()):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired.",
            )

        user = self.get_user_by_id(int(payload.get("sub", 0)))
        if user is None or not user.is_active:
            raise invalid_token()
        return user

    def list_users(self) -> list[User]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    id, email, name, role, plan, password_hash,
                    is_active, created_at, last_login_at
                FROM users
                ORDER BY created_at DESC, id DESC
                """
            ).fetchall()
        return [row_to_user(row) for row in rows]

    def list_user_usage(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    users.id,
                    users.email,
                    users.name,
                    users.role,
                    users.plan,
                    users.is_active,
                    users.created_at,
                    users.last_login_at,
                    COUNT(stock_analysis_records.id) AS analysis_count,
                    MAX(stock_analysis_records.created_at) AS latest_analysis_at
                FROM users
                LEFT JOIN stock_analysis_records
                    ON stock_analysis_records.user_id = users.id
                GROUP BY
                    users.id,
                    users.email,
                    users.name,
                    users.role,
                    users.plan,
                    users.is_active,
                    users.created_at,
                    users.last_login_at
                ORDER BY analysis_count DESC, latest_analysis_at DESC, users.created_at DESC
                """
            ).fetchall()
        return [
            {
                "id": int(row["id"]),
                "email": str(row["email"]),
                "name": str(row["name"]),
                "role": str(row["role"]),
                "plan": str(row["plan"]),
                "is_active": bool(row["is_active"]),
                "analysis_count": int(row["analysis_count"]),
                "latest_analysis_at": (
                    str(row["latest_analysis_at"])
                    if row["latest_analysis_at"] is not None
                    else None
                ),
                "created_at": str(row["created_at"]),
                "last_login_at": (
                    str(row["last_login_at"]) if row["last_login_at"] is not None else None
                ),
            }
            for row in rows
        ]

    def update_user(
        self,
        user_id: int,
        actor: User,
        role: str | None = None,
        plan: str | None = None,
        is_active: bool | None = None,
    ) -> User:
        if role is None and plan is None and is_active is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update fields provided.",
            )

        with self.connect() as conn:
            target = self.get_user_by_id(user_id, conn)
            if target is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found.",
                )

            if target.id == actor.id:
                if role is not None and role != target.role:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="You cannot change your own role.",
                    )
                if is_active is False:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="You cannot disable your own account.",
                    )

            removing_active_admin = target.role == "admin" and (
                (role is not None and role != "admin") or is_active is False
            )
            if removing_active_admin and self.active_admin_count(conn) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="At least one active admin is required.",
                )

            next_role = role if role is not None else target.role
            next_plan = plan if plan is not None else target.plan
            next_active = int(is_active) if is_active is not None else int(target.is_active)
            conn.execute(
                """
                UPDATE users
                SET role = ?, plan = ?, is_active = ?
                WHERE id = ?
                """,
                (next_role, next_plan, next_active, target.id),
            )

            updated = self.get_user_by_id(target.id, conn)
            if updated is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="User update failed.",
                )
            return updated

    def get_user_by_email(self, email: str) -> User | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT
                    id, email, name, role, plan, password_hash,
                    is_active, created_at, last_login_at
                FROM users
                WHERE email = ?
                """,
                (email,),
            ).fetchone()
        return row_to_user(row) if row else None

    def get_user_by_id(self, user_id: int, conn: sqlite3.Connection | None = None) -> User | None:
        active_conn = conn or self.connect()
        close_conn = conn is None
        try:
            row = active_conn.execute(
                """
                SELECT
                    id, email, name, role, plan, password_hash,
                    is_active, created_at, last_login_at
                FROM users
                WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
            return row_to_user(row) if row else None
        finally:
            if close_conn:
                active_conn.close()

    @staticmethod
    def user_count(conn: sqlite3.Connection) -> int:
        row = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()
        return int(row["count"])

    @staticmethod
    def active_admin_count(conn: sqlite3.Connection) -> int:
        row = conn.execute(
            "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1"
        ).fetchone()
        return int(row["count"])


def normalize_email(email: str) -> str:
    return email.strip().lower()


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 210_000)
    return f"pbkdf2_sha256$210000${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected_hash = stored_hash.split("$", 3)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iterations),
    )
    return hmac.compare_digest(digest.hex(), expected_hash)


def sign_value(value: str, secret_key: str) -> str:
    signature = hmac.new(secret_key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).digest()
    return base64url_encode(signature)


def base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def row_to_user(row: sqlite3.Row) -> User:
    return User(
        id=int(row["id"]),
        email=str(row["email"]),
        name=str(row["name"]),
        role=str(row["role"]),
        plan=str(row["plan"]),
        password_hash=str(row["password_hash"]),
        is_active=bool(row["is_active"]),
        created_at=str(row["created_at"]),
        last_login_at=str(row["last_login_at"]) if row["last_login_at"] is not None else None,
    )


def invalid_token() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token.",
    )


def ensure_data_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def ensure_column(conn: sqlite3.Connection, table_name: str, column_name: str, ddl: str) -> None:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    if any(str(row["name"]) == column_name for row in rows):
        return
    conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}")
