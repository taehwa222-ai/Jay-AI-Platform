from __future__ import annotations

from datetime import UTC, datetime

from app.config import Settings
from app.services.database import connect_database


class AIDailyLimitReached(Exception):
    pass


class AIGuardrailService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = settings.database_path

    def init_db(self) -> None:
        with connect_database(self.db_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_usage_daily (
                    usage_date TEXT PRIMARY KEY,
                    request_count INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                )
                """
            )

    def reserve(self) -> int:
        """Atomically reserve one AI call for today and return the new count."""
        limit = self.settings.ai_daily_limit
        if limit <= 0:
            return 0

        now = datetime.now(UTC)
        today = now.date().isoformat()
        with connect_database(self.db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT request_count FROM ai_usage_daily WHERE usage_date = ?",
                (today,),
            ).fetchone()
            current = int(row["request_count"]) if row is not None else 0
            if current >= limit:
                raise AIDailyLimitReached
            next_count = current + 1
            connection.execute(
                """
                INSERT INTO ai_usage_daily (usage_date, request_count, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(usage_date) DO UPDATE SET
                    request_count = excluded.request_count,
                    updated_at = excluded.updated_at
                """,
                (today, next_count, now.isoformat()),
            )
        return next_count

    def today_count(self) -> int:
        today = datetime.now(UTC).date().isoformat()
        with connect_database(self.db_path) as connection:
            row = connection.execute(
                "SELECT request_count FROM ai_usage_daily WHERE usage_date = ?",
                (today,),
            ).fetchone()
        return int(row["request_count"]) if row is not None else 0
