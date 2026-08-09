from __future__ import annotations

import logging
import sqlite3
import uuid
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import Settings
from app.services.auth import now_iso

logger = logging.getLogger(__name__)
TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm"


@dataclass(frozen=True)
class Payment:
    id: int
    user_id: int
    order_id: str
    amount: int
    status: str
    payment_key: str | None
    created_at: str
    approved_at: str | None

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "order_id": self.order_id,
            "amount": self.amount,
            "status": self.status,
            "created_at": self.created_at,
            "approved_at": self.approved_at,
        }


class PaymentService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = settings.database_path

    def init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    order_id TEXT NOT NULL UNIQUE,
                    amount INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'failed')),
                    payment_key TEXT,
                    created_at TEXT NOT NULL,
                    approved_at TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_payments_user_created
                ON payments(user_id, created_at DESC, id DESC)
                """
            )

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def create_pending_payment(self, user_id: int, amount: int) -> Payment:
        now = now_iso()
        order_id = str(uuid.uuid4())
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO payments (user_id, order_id, amount, status, created_at)
                VALUES (?, ?, ?, 'pending', ?)
                """,
                (user_id, order_id, amount, now),
            )
            payment = self.get_payment(cursor.lastrowid, conn)

        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Payment order creation failed.",
            )
        return payment

    def confirm_payment(self, order_id: str, payment_key: str, amount: int) -> Payment:
        pending = self.get_pending_payment(order_id)
        if pending is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Pending payment order not found.",
            )
        if pending.amount != amount:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Payment amount does not match the order.",
            )

        try:
            response = httpx.post(
                TOSS_CONFIRM_URL,
                auth=(self.settings.toss_secret_key, ""),
                json={
                    "paymentKey": payment_key,
                    "orderId": order_id,
                    "amount": amount,
                },
                timeout=15.0,
            )
        except httpx.HTTPError as exc:
            self._mark_failed(order_id)
            logger.exception("Toss payment confirmation request failed for %s", order_id)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Toss payment confirmation request failed: {exc}",
            ) from exc

        if response.status_code != status.HTTP_200_OK:
            response_body = response.text
            self._mark_failed(order_id)
            logger.warning(
                "Toss payment confirmation failed for %s with status %s: %s",
                order_id,
                response.status_code,
                response_body,
            )
            error_status = (
                status.HTTP_422_UNPROCESSABLE_ENTITY
                if 400 <= response.status_code < 500
                else status.HTTP_502_BAD_GATEWAY
            )
            raise HTTPException(
                status_code=error_status,
                detail=f"Toss payment confirmation failed: {response_body}",
            )

        return self._approve_payment(order_id, payment_key)

    def get_pending_payment(self, order_id: str) -> Payment | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT id, user_id, order_id, amount, status, payment_key, created_at, approved_at
                FROM payments
                WHERE order_id = ? AND status = 'pending'
                """,
                (order_id,),
            ).fetchone()
        return row_to_payment(row) if row is not None else None

    def get_my_payments(self, user_id: int) -> list[Payment]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT id, user_id, order_id, amount, status, payment_key, created_at, approved_at
                FROM payments
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                """,
                (user_id,),
            ).fetchall()
        return [row_to_payment(row) for row in rows]

    def get_payment(
        self,
        payment_id: int,
        conn: sqlite3.Connection | None = None,
    ) -> Payment | None:
        active_conn = conn or self.connect()
        close_conn = conn is None
        try:
            row = active_conn.execute(
                """
                SELECT id, user_id, order_id, amount, status, payment_key, created_at, approved_at
                FROM payments
                WHERE id = ?
                """,
                (payment_id,),
            ).fetchone()
            return row_to_payment(row) if row is not None else None
        finally:
            if close_conn:
                active_conn.close()

    def _mark_failed(self, order_id: str) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                UPDATE payments
                SET status = 'failed'
                WHERE order_id = ? AND status = 'pending'
                """,
                (order_id,),
            )

    def _approve_payment(self, order_id: str, payment_key: str) -> Payment:
        with self.connect() as conn:
            approved_at = now_iso()
            cursor = conn.execute(
                """
                UPDATE payments
                SET status = 'approved', payment_key = ?, approved_at = ?
                WHERE order_id = ? AND status = 'pending'
                """,
                (payment_key, approved_at, order_id),
            )
            if cursor.rowcount != 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Payment is no longer pending.",
                )

            payment = self.get_payment_by_order_id(order_id, conn)
            if payment is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Approved payment could not be loaded.",
                )

            conn.execute("UPDATE users SET plan = 'pro' WHERE id = ?", (payment.user_id,))
            return payment

    def get_payment_by_order_id(
        self,
        order_id: str,
        conn: sqlite3.Connection | None = None,
    ) -> Payment | None:
        active_conn = conn or self.connect()
        close_conn = conn is None
        try:
            row = active_conn.execute(
                """
                SELECT id, user_id, order_id, amount, status, payment_key, created_at, approved_at
                FROM payments
                WHERE order_id = ?
                """,
                (order_id,),
            ).fetchone()
            return row_to_payment(row) if row is not None else None
        finally:
            if close_conn:
                active_conn.close()


def row_to_payment(row: sqlite3.Row) -> Payment:
    return Payment(
        id=int(row["id"]),
        user_id=int(row["user_id"]),
        order_id=str(row["order_id"]),
        amount=int(row["amount"]),
        status=str(row["status"]),
        payment_key=str(row["payment_key"]) if row["payment_key"] is not None else None,
        created_at=str(row["created_at"]),
        approved_at=str(row["approved_at"]) if row["approved_at"] is not None else None,
    )
