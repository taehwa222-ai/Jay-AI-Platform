from __future__ import annotations

import shutil
from collections import Counter
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from threading import Lock
from typing import TYPE_CHECKING

from app.config import Settings
from app.schemas.operations import (
    AIUsageStatus,
    BackupStatus,
    CacheStatus,
    DatabaseStatus,
    IntegrationStatus,
    OperationalError,
    OperationsOverview,
    RuntimeStatus,
)
from app.services.database import connect_database

if TYPE_CHECKING:
    from app.services.ai_guardrail import AIGuardrailService
    from app.services.disclosures import DisclosureService
    from app.services.stocks import StockService
    from app.services.telegram import TelegramService


class OperationsService:
    """Collect privacy-safe runtime and persisted operational health metrics."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = settings.database_path
        self.started_at = datetime.now(UTC)
        self._lock = Lock()
        self._total_requests = 0
        self._completed_requests = 0
        self._in_flight_requests = 0
        self._server_error_count = 0
        self._telemetry_write_failures = 0
        self._total_duration_ms = 0.0
        self._status_counts: Counter[str] = Counter()

    def init_db(self) -> None:
        with connect_database(self.db_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS operations_error_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    occurred_at TEXT NOT NULL,
                    method TEXT NOT NULL,
                    path TEXT NOT NULL,
                    status_code INTEGER NOT NULL,
                    error_type TEXT NOT NULL,
                    duration_ms REAL NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_operations_errors_occurred
                ON operations_error_events(occurred_at DESC)
                """
            )
            cutoff = (datetime.now(UTC) - timedelta(days=30)).isoformat()
            connection.execute(
                "DELETE FROM operations_error_events WHERE occurred_at < ?",
                (cutoff,),
            )

    def request_started(self) -> None:
        with self._lock:
            self._total_requests += 1
            self._in_flight_requests += 1

    def request_finished(
        self,
        *,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        error_type: str | None = None,
    ) -> None:
        status_group = f"{status_code // 100}xx"
        with self._lock:
            self._completed_requests += 1
            self._in_flight_requests = max(0, self._in_flight_requests - 1)
            self._total_duration_ms += duration_ms
            self._status_counts[status_group] += 1
            if status_code >= 500:
                self._server_error_count += 1

        if status_code >= 500:
            try:
                self._record_error(
                    method=method,
                    path=path,
                    status_code=status_code,
                    error_type=error_type or "HTTPError",
                    duration_ms=duration_ms,
                )
            except Exception:
                with self._lock:
                    self._telemetry_write_failures += 1

    def overview(
        self,
        *,
        ai_guardrail: AIGuardrailService,
        stock_service: StockService,
        disclosure_service: DisclosureService,
        telegram_service: TelegramService,
    ) -> OperationsOverview:
        generated_at = datetime.now(UTC)
        runtime = self._runtime_status(generated_at)
        database = self._database_status()
        backup = self._backup_status(generated_at)
        today_count = ai_guardrail.today_count()
        daily_limit = ai_guardrail.settings.ai_daily_limit
        remaining = max(daily_limit - today_count, 0) if daily_limit > 0 else 0
        usage_percent = (
            round(min(today_count / daily_limit, 1.0) * 100, 1)
            if daily_limit > 0
            else 0.0
        )
        ai_usage = AIUsageStatus(
            today_count=today_count,
            daily_limit=daily_limit,
            remaining=remaining,
            usage_percent=usage_percent,
            history=ai_guardrail.usage_history(),
        )
        caches = [
            CacheStatus(**asdict(stock_service.market_cache.snapshot())),
            CacheStatus(**asdict(disclosure_service.disclosure_cache.snapshot())),
        ]
        integrations = [
            IntegrationStatus(
                name="Yahoo Finance",
                configured=True,
                detail="Public market data endpoint",
            ),
            IntegrationStatus(
                name="OpenDART",
                configured=bool(self.settings.opendart_api_key.strip()),
                detail="Disclosure API key",
            ),
            IntegrationStatus(
                name="OpenAI",
                configured=bool(self.settings.openai_api_key.strip()),
                detail=self.settings.openai_model,
            ),
            IntegrationStatus(
                name="Telegram",
                configured=telegram_service.configured,
                detail="Personal notification channel",
            ),
        ]
        errors_last_24h = self._error_count_since(generated_at - timedelta(hours=24))
        recent_errors = self._recent_errors()
        needs_attention = (
            not database.healthy
            or database.disk_free_percent < 10
            or errors_last_24h > 0
            or (daily_limit > 0 and today_count >= daily_limit)
        )
        return OperationsOverview(
            generated_at=generated_at,
            status="attention" if needs_attention else "healthy",
            runtime=runtime,
            database=database,
            backup=backup,
            ai_usage=ai_usage,
            caches=caches,
            integrations=integrations,
            errors_last_24h=errors_last_24h,
            recent_errors=recent_errors,
        )

    def _runtime_status(self, now: datetime) -> RuntimeStatus:
        with self._lock:
            completed = self._completed_requests
            average_duration = self._total_duration_ms / completed if completed else 0.0
            return RuntimeStatus(
                started_at=self.started_at,
                uptime_seconds=max(0, int((now - self.started_at).total_seconds())),
                total_requests=self._total_requests,
                completed_requests=completed,
                in_flight_requests=self._in_flight_requests,
                server_error_count=self._server_error_count,
                telemetry_write_failures=self._telemetry_write_failures,
                average_duration_ms=round(average_duration, 2),
                status_counts=dict(self._status_counts),
            )

    def _database_status(self) -> DatabaseStatus:
        integrity_check = "unavailable"
        journal_mode = "unknown"
        try:
            with connect_database(self.db_path) as connection:
                journal_mode = str(connection.execute("PRAGMA journal_mode").fetchone()[0])
                integrity_check = str(connection.execute("PRAGMA quick_check").fetchone()[0])
        except Exception as exc:
            integrity_check = type(exc).__name__

        disk = shutil.disk_usage(self.settings.data_dir)
        free_percent = (disk.free / disk.total * 100) if disk.total else 0.0
        return DatabaseStatus(
            healthy=integrity_check == "ok" and journal_mode.lower() == "wal",
            file_name=self.db_path.name,
            journal_mode=journal_mode,
            integrity_check=integrity_check,
            size_bytes=self.db_path.stat().st_size if self.db_path.exists() else 0,
            disk_free_bytes=disk.free,
            disk_free_percent=round(free_percent, 1),
        )

    def _backup_status(self, now: datetime) -> BackupStatus:
        backup_dir = self.settings.data_dir / "backups"
        backups = sorted(
            backup_dir.glob("jay_ai_platform-*.db") if backup_dir.exists() else [],
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        if not backups:
            return BackupStatus(
                available=False,
                latest_file=None,
                latest_created_at=None,
                age_hours=None,
                backup_count=0,
            )
        latest = backups[0]
        created_at = datetime.fromtimestamp(latest.stat().st_mtime, UTC)
        return BackupStatus(
            available=True,
            latest_file=latest.name,
            latest_created_at=created_at,
            age_hours=round(max(0.0, (now - created_at).total_seconds() / 3600), 1),
            backup_count=len(backups),
        )

    def _record_error(
        self,
        *,
        method: str,
        path: str,
        status_code: int,
        error_type: str,
        duration_ms: float,
    ) -> None:
        with connect_database(self.db_path) as connection:
            connection.execute(
                """
                INSERT INTO operations_error_events (
                    occurred_at, method, path, status_code, error_type, duration_ms
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    datetime.now(UTC).isoformat(),
                    method[:10],
                    path[:300],
                    status_code,
                    error_type[:100],
                    round(duration_ms, 2),
                ),
            )

    def _error_count_since(self, since: datetime) -> int:
        with connect_database(self.db_path) as connection:
            row = connection.execute(
                "SELECT COUNT(*) AS count FROM operations_error_events WHERE occurred_at >= ?",
                (since.isoformat(),),
            ).fetchone()
        return int(row["count"])

    def _recent_errors(self, limit: int = 20) -> list[OperationalError]:
        with connect_database(self.db_path) as connection:
            rows = connection.execute(
                """
                SELECT id, occurred_at, method, path, status_code, error_type, duration_ms
                FROM operations_error_events
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [OperationalError.model_validate(dict(row)) for row in rows]
