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

LOGIN_FAILURE_LIMIT = 5
LOGIN_LOCK_MINUTES = 15


@dataclass(frozen=True)
class User:
    id: int
    email: str
    name: str
    role: str
    password_hash: str
    is_active: bool
    approval_status: str
    can_access_stocks: bool
    can_access_content_ops: bool
    token_version: int
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
            "can_access_stocks": self.can_access_stocks,
            "can_access_content_ops": self.can_access_content_ops,
            "created_at": self.created_at,
            "last_login_at": self.last_login_at,
        }


@dataclass(frozen=True)
class AuditLog:
    id: int
    event_type: str
    actor_user_id: int | None
    actor_name: str | None
    target_user_id: int | None
    target_name: str | None
    details: dict[str, Any]
    created_at: str


@dataclass(frozen=True)
class Invitation:
    id: int
    email: str
    role: str
    can_access_stocks: bool
    can_access_content_ops: bool
    expires_at: str
    used_at: str | None
    revoked_at: str | None
    created_at: str

    def public(self, token: str | None = None) -> dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "can_access_stocks": self.can_access_stocks,
            "can_access_content_ops": self.can_access_content_ops,
            "expires_at": self.expires_at,
            "used_at": self.used_at,
            "revoked_at": self.revoked_at,
            "created_at": self.created_at,
            "token": token,
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
                    can_access_stocks INTEGER NOT NULL DEFAULT 1,
                    can_access_content_ops INTEGER NOT NULL DEFAULT 1,
                    token_version INTEGER NOT NULL DEFAULT 0,
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
            ensure_column(connection, "users", "can_access_stocks", "INTEGER NOT NULL DEFAULT 1")
            ensure_column(
                connection,
                "users",
                "can_access_content_ops",
                "INTEGER NOT NULL DEFAULT 1",
            )
            ensure_column(connection, "users", "token_version", "INTEGER NOT NULL DEFAULT 0")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_login_attempts (
                    email TEXT PRIMARY KEY,
                    failed_count INTEGER NOT NULL,
                    first_failed_at TEXT NOT NULL,
                    locked_until TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    actor_user_id INTEGER,
                    target_user_id INTEGER,
                    details TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_invitations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    token_hash TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'member',
                    can_access_stocks INTEGER NOT NULL DEFAULT 1,
                    can_access_content_ops INTEGER NOT NULL DEFAULT 1,
                    expires_at TEXT NOT NULL,
                    used_at TEXT,
                    revoked_at TEXT,
                    created_by_user_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "UPDATE users SET role = 'member' WHERE role NOT IN ('owner', 'admin', 'member')"
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
                    SELECT id FROM users
                    ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id ASC
                    LIMIT 1
                    """
                ).fetchone()
                if first_user is not None:
                    connection.execute(
                        """
                        UPDATE users
                        SET role = 'owner', is_active = 1, approval_status = 'approved',
                            can_access_stocks = 1, can_access_content_ops = 1
                        WHERE id = ?
                        """,
                        (int(first_user["id"]),),
                    )
            connection.execute(
                """
                UPDATE users
                SET can_access_stocks = 1, can_access_content_ops = 1
                WHERE role = 'owner'
                """
            )
            connection.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_auth_audit_created
                ON auth_audit_logs(created_at DESC)
                """
            )

    def connect(self) -> sqlite3.Connection:
        return connect_database(self.db_path)

    def create_user(
        self,
        email: str,
        password: str,
        name: str,
        invite_token: str | None = None,
    ) -> User:
        normalized_email = normalize_email(email)
        created_at = now_iso()
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            is_first_user = self.user_count(connection) == 0
            invitation = None
            if not is_first_user and invite_token:
                invitation = self._valid_invitation(
                    connection, invite_token, normalized_email
                )
            role = "owner" if is_first_user else invitation.role if invitation else "member"
            is_active = int(is_first_user or invitation is not None)
            approval_status = "approved" if is_active else "pending"
            stock_access = int(
                is_first_user or bool(invitation and invitation.can_access_stocks)
            )
            content_access = int(
                is_first_user or bool(invitation and invitation.can_access_content_ops)
            )
            try:
                cursor = connection.execute(
                    """
                    INSERT INTO users (
                        email, name, role, password_hash, is_active, approval_status,
                        can_access_stocks, can_access_content_ops, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        normalized_email,
                        name.strip(),
                        role,
                        hash_password(password),
                        is_active,
                        approval_status,
                        stock_access,
                        content_access,
                        created_at,
                    ),
                )
            except sqlite3.IntegrityError as exc:
                raise HTTPException(status_code=409, detail="Email is already registered.") from exc
            user = self.get_user_by_id(cursor.lastrowid, connection)
            if user is None:
                raise HTTPException(status_code=500, detail="User account creation failed.")
            if invitation is not None:
                connection.execute(
                    "UPDATE auth_invitations SET used_at = ? WHERE id = ?",
                    (created_at, invitation.id),
                )
            self._write_audit(
                connection,
                "account_created",
                actor_user_id=user.id if is_first_user else None,
                target_user_id=user.id,
                details={"role": role, "approval_status": approval_status},
            )
            return user

    def create_invitation(
        self,
        actor: User,
        email: str,
        role: str,
        can_access_stocks: bool,
        can_access_content_ops: bool,
        expires_in_days: int,
    ) -> tuple[Invitation, str]:
        if role == "admin" and actor.role != "owner":
            raise HTTPException(status_code=403, detail="Owner role is required.")
        token = secrets.token_urlsafe(32)
        created_at = now_iso()
        expires_at = (datetime.now(UTC) + timedelta(days=expires_in_days)).isoformat()
        normalized_email = normalize_email(email)
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE auth_invitations SET revoked_at = ?
                WHERE email = ? AND used_at IS NULL AND revoked_at IS NULL
                """,
                (created_at, normalized_email),
            )
            cursor = connection.execute(
                """
                INSERT INTO auth_invitations (
                    token_hash, email, role, can_access_stocks,
                    can_access_content_ops, expires_at, created_by_user_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    invitation_token_hash(token),
                    normalized_email,
                    role,
                    int(can_access_stocks),
                    int(can_access_content_ops),
                    expires_at,
                    actor.id,
                    created_at,
                ),
            )
            invitation = self._get_invitation(int(cursor.lastrowid), connection)
            self._write_audit(
                connection,
                "invitation_created",
                actor.id,
                None,
                {"email": normalized_email, "role": role},
            )
        assert invitation is not None
        return invitation, token

    def list_invitations(self) -> list[Invitation]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM auth_invitations ORDER BY created_at DESC, id DESC LIMIT 100"
            ).fetchall()
        return [row_to_invitation(row) for row in rows]

    def revoke_invitation(self, invitation_id: int, actor: User) -> Invitation:
        with self.connect() as connection:
            invitation = self._get_invitation(invitation_id, connection)
            if invitation is None:
                raise HTTPException(status_code=404, detail="Invitation not found.")
            if invitation.used_at is not None:
                raise HTTPException(status_code=409, detail="Invitation has already been used.")
            connection.execute(
                "UPDATE auth_invitations SET revoked_at = ? WHERE id = ?",
                (now_iso(), invitation_id),
            )
            self._write_audit(
                connection,
                "invitation_revoked",
                actor.id,
                None,
                {"email": invitation.email},
            )
            updated = self._get_invitation(invitation_id, connection)
        assert updated is not None
        return updated

    def _valid_invitation(
        self,
        connection: sqlite3.Connection,
        token: str,
        email: str,
    ) -> Invitation:
        row = connection.execute(
            "SELECT * FROM auth_invitations WHERE token_hash = ?",
            (invitation_token_hash(token),),
        ).fetchone()
        invitation = row_to_invitation(row) if row is not None else None
        if invitation is None:
            raise HTTPException(status_code=400, detail="Invitation is invalid.")
        if invitation.email != email:
            raise HTTPException(status_code=400, detail="Invitation email does not match.")
        if invitation.used_at is not None or invitation.revoked_at is not None:
            raise HTTPException(status_code=400, detail="Invitation is no longer active.")
        if datetime.fromisoformat(invitation.expires_at) <= datetime.now(UTC):
            raise HTTPException(status_code=400, detail="Invitation has expired.")
        return invitation

    @staticmethod
    def _get_invitation(
        invitation_id: int,
        connection: sqlite3.Connection,
    ) -> Invitation | None:
        row = connection.execute(
            "SELECT * FROM auth_invitations WHERE id = ?", (invitation_id,)
        ).fetchone()
        return row_to_invitation(row) if row is not None else None

    def authenticate(self, email: str, password: str) -> User:
        normalized_email = normalize_email(email)
        with self.connect() as connection:
            self._raise_if_login_locked(connection, normalized_email)
            user = self.get_user_by_email(normalized_email, connection)
            if user is None or not verify_password(password, user.password_hash):
                locked = self._record_login_failure(connection, normalized_email)
                connection.commit()
                if locked:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Too many login attempts. Try again in 15 minutes.",
                    )
                raise HTTPException(status_code=401, detail="Invalid email or password.")
            connection.execute(
                "DELETE FROM auth_login_attempts WHERE email = ?",
                (normalized_email,),
            )
            connection.commit()
            if user.approval_status == "pending":
                raise HTTPException(
                    status_code=403,
                    detail="Account is pending administrator approval.",
                )
            if not user.is_active or user.approval_status != "approved":
                raise HTTPException(status_code=403, detail="Account is disabled.")
            connection.execute(
                "UPDATE users SET last_login_at = ? WHERE id = ?",
                (now_iso(), user.id),
            )
            self._write_audit(
                connection,
                "login_succeeded",
                actor_user_id=user.id,
                target_user_id=user.id,
                details={},
            )
            refreshed = self.get_user_by_id(user.id, connection)
        if refreshed is None:
            raise invalid_token()
        return refreshed

    def create_token(self, user: User) -> str:
        expires_at = datetime.now(UTC) + timedelta(minutes=self.settings.access_token_minutes)
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "ver": user.token_version,
            "exp": int(expires_at.timestamp()),
        }
        payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
        payload_part = base64url_encode(payload_bytes)
        return f"{payload_part}.{sign_value(payload_part, self.settings.auth_secret_key)}"

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
            token_version = int(payload.get("ver", 0))
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            raise invalid_token() from exc
        if expires_at < int(datetime.now(UTC).timestamp()):
            raise HTTPException(status_code=401, detail="Token expired.")
        user = self.get_user_by_id(user_id)
        if (
            user is None
            or not user.is_active
            or user.approval_status != "approved"
            or user.token_version != token_version
        ):
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
                f"""
                {user_select()}
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
        can_access_stocks: bool | None,
        can_access_content_ops: bool | None,
    ) -> User:
        values = (role, is_active, can_access_stocks, can_access_content_ops)
        if all(value is None for value in values):
            raise HTTPException(status_code=400, detail="No update fields provided.")
        with self.connect() as connection:
            target = self.get_user_by_id(user_id, connection)
            self._validate_managed_target(actor, target, role=role)
            assert target is not None
            next_role = role or target.role
            if next_role not in {"admin", "member"}:
                raise HTTPException(status_code=422, detail="Invalid role.")
            next_active = target.is_active if is_active is None else is_active
            next_status = target.approval_status
            if is_active is True:
                next_status = "approved"
            elif is_active is False:
                next_status = "disabled"
            next_stocks = (
                target.can_access_stocks
                if can_access_stocks is None
                else can_access_stocks
            )
            next_content = (
                target.can_access_content_ops
                if can_access_content_ops is None
                else can_access_content_ops
            )
            connection.execute(
                """
                UPDATE users
                SET role = ?, is_active = ?, approval_status = ?,
                    can_access_stocks = ?, can_access_content_ops = ?,
                    token_version = token_version + ?
                WHERE id = ?
                """,
                (
                    next_role,
                    int(next_active),
                    next_status,
                    int(next_stocks),
                    int(next_content),
                    int(is_active is False),
                    target.id,
                ),
            )
            changes = {
                key: value
                for key, value in {
                    "role": role,
                    "is_active": is_active,
                    "can_access_stocks": can_access_stocks,
                    "can_access_content_ops": can_access_content_ops,
                }.items()
                if value is not None
            }
            self._write_audit(connection, "user_updated", actor.id, target.id, changes)
            updated = self.get_user_by_id(target.id, connection)
        if updated is None:
            raise HTTPException(status_code=500, detail="User update failed.")
        return updated

    def change_password(self, user: User, current_password: str, new_password: str) -> None:
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE users
                SET password_hash = ?, token_version = token_version + 1
                WHERE id = ?
                """,
                (hash_password(new_password), user.id),
            )
            self._write_audit(connection, "password_changed", user.id, user.id, {})

    def reset_password(self, user_id: int, actor: User, new_password: str) -> None:
        if actor.role != "owner":
            raise HTTPException(status_code=403, detail="Owner role is required.")
        with self.connect() as connection:
            target = self.get_user_by_id(user_id, connection)
            self._validate_managed_target(actor, target, role=None)
            assert target is not None
            connection.execute(
                """
                UPDATE users
                SET password_hash = ?, token_version = token_version + 1
                WHERE id = ?
                """,
                (hash_password(new_password), target.id),
            )
            self._write_audit(connection, "password_reset", actor.id, target.id, {})

    def revoke_sessions(self, user_id: int, actor: User) -> None:
        with self.connect() as connection:
            target = self.get_user_by_id(user_id, connection)
            if target is None:
                raise HTTPException(status_code=404, detail="User not found.")
            if target.id != actor.id:
                self._validate_managed_target(actor, target, role=None)
            connection.execute(
                "UPDATE users SET token_version = token_version + 1 WHERE id = ?",
                (target.id,),
            )
            self._write_audit(connection, "sessions_revoked", actor.id, target.id, {})

    def list_audit_logs(self, limit: int = 50) -> list[AuditLog]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT logs.id, logs.event_type, logs.actor_user_id, logs.target_user_id,
                       logs.details, logs.created_at,
                       actor.name AS actor_name, target.name AS target_name
                FROM auth_audit_logs AS logs
                LEFT JOIN users AS actor ON actor.id = logs.actor_user_id
                LEFT JOIN users AS target ON target.id = logs.target_user_id
                ORDER BY logs.id DESC
                LIMIT ?
                """,
                (max(1, min(limit, 200)),),
            ).fetchall()
        return [row_to_audit_log(row) for row in rows]

    def get_user_by_email(
        self,
        email: str,
        connection: sqlite3.Connection | None = None,
    ) -> User | None:
        active_connection = connection or self.connect()
        should_close = connection is None
        try:
            row = active_connection.execute(
                f"{user_select()} WHERE email = ?",
                (email,),
            ).fetchone()
            return row_to_user(row) if row is not None else None
        finally:
            if should_close:
                active_connection.close()

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
                f"{user_select()} WHERE id = ?",
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

    @staticmethod
    def _validate_managed_target(actor: User, target: User | None, *, role: str | None) -> None:
        if target is None:
            raise HTTPException(status_code=404, detail="User not found.")
        if target.id == actor.id:
            raise HTTPException(status_code=400, detail="You cannot change your own access.")
        if target.role == "owner":
            raise HTTPException(status_code=400, detail="The owner account cannot be changed.")
        if actor.role == "admin" and (target.role != "member" or role not in (None, "member")):
            raise HTTPException(status_code=403, detail="Admins can only manage member access.")

    @staticmethod
    def _write_audit(
        connection: sqlite3.Connection,
        event_type: str,
        actor_user_id: int | None,
        target_user_id: int | None,
        details: dict[str, Any],
    ) -> None:
        connection.execute(
            """
            INSERT INTO auth_audit_logs (
                event_type, actor_user_id, target_user_id, details, created_at
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                event_type,
                actor_user_id,
                target_user_id,
                json.dumps(details, ensure_ascii=False, sort_keys=True),
                now_iso(),
            ),
        )

    @staticmethod
    def _raise_if_login_locked(connection: sqlite3.Connection, email: str) -> None:
        row = connection.execute(
            "SELECT locked_until FROM auth_login_attempts WHERE email = ?",
            (email,),
        ).fetchone()
        if row is None or row["locked_until"] is None:
            return
        if parse_iso(str(row["locked_until"])) > datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Try again in 15 minutes.",
            )
        connection.execute("DELETE FROM auth_login_attempts WHERE email = ?", (email,))

    @staticmethod
    def _record_login_failure(connection: sqlite3.Connection, email: str) -> bool:
        row = connection.execute(
            "SELECT failed_count, first_failed_at FROM auth_login_attempts WHERE email = ?",
            (email,),
        ).fetchone()
        now = datetime.now(UTC)
        if row is None or parse_iso(str(row["first_failed_at"])) < now - timedelta(minutes=15):
            failed_count = 1
            first_failed_at = now.isoformat()
        else:
            failed_count = int(row["failed_count"]) + 1
            first_failed_at = str(row["first_failed_at"])
        locked_until = (
            (now + timedelta(minutes=LOGIN_LOCK_MINUTES)).isoformat()
            if failed_count >= LOGIN_FAILURE_LIMIT
            else None
        )
        connection.execute(
            """
            INSERT INTO auth_login_attempts (email, failed_count, first_failed_at, locked_until)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                failed_count = excluded.failed_count,
                first_failed_at = excluded.first_failed_at,
                locked_until = excluded.locked_until
            """,
            (email, failed_count, first_failed_at, locked_until),
        )
        return locked_until is not None


def user_select() -> str:
    return """
        SELECT id, email, name, role, password_hash, is_active, approval_status,
               can_access_stocks, can_access_content_ops, token_version,
               created_at, last_login_at
        FROM users
    """


def normalize_email(email: str) -> str:
    return email.strip().lower()


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def invitation_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def row_to_invitation(row: sqlite3.Row) -> Invitation:
    return Invitation(
        id=int(row["id"]),
        email=str(row["email"]),
        role=str(row["role"]),
        can_access_stocks=bool(row["can_access_stocks"]),
        can_access_content_ops=bool(row["can_access_content_ops"]),
        expires_at=str(row["expires_at"]),
        used_at=str(row["used_at"]) if row["used_at"] else None,
        revoked_at=str(row["revoked_at"]) if row["revoked_at"] else None,
        created_at=str(row["created_at"]),
    )


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


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
        can_access_stocks=bool(row["can_access_stocks"]),
        can_access_content_ops=bool(row["can_access_content_ops"]),
        token_version=int(row["token_version"]),
        created_at=str(row["created_at"]),
        last_login_at=str(row["last_login_at"]) if row["last_login_at"] is not None else None,
    )


def row_to_audit_log(row: sqlite3.Row) -> AuditLog:
    try:
        details = json.loads(str(row["details"]))
    except json.JSONDecodeError:
        details = {}
    return AuditLog(
        id=int(row["id"]),
        event_type=str(row["event_type"]),
        actor_user_id=int(row["actor_user_id"]) if row["actor_user_id"] is not None else None,
        actor_name=str(row["actor_name"]) if row["actor_name"] is not None else None,
        target_user_id=int(row["target_user_id"]) if row["target_user_id"] is not None else None,
        target_name=str(row["target_name"]) if row["target_name"] is not None else None,
        details=details if isinstance(details, dict) else {},
        created_at=str(row["created_at"]),
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
