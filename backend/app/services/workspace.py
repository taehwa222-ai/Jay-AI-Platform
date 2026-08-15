from __future__ import annotations

import asyncio
import io
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from fastapi import HTTPException, status

from app.config import Settings
from app.schemas.workspace import (
    BackupPublic,
    ContentVersionPublic,
    DataStatus,
    GlobalSearchResult,
    StockBriefingPublic,
    TaskCreateRequest,
    TaskPublic,
    TaskUpdateRequest,
)
from app.services.auth import User
from app.services.backup import backup_database, verify_database
from app.services.content_ops import ContentOpsService
from app.services.database import connect_database
from app.services.disclosures import Disclosure, DisclosureService
from app.services.stocks import StockService
from app.services.telegram import TelegramService

IMPORTANT_DISCLOSURE_KEYWORDS = (
    "주요사항보고서",
    "유상증자",
    "무상증자",
    "합병",
    "분할",
    "최대주주",
    "영업정지",
    "상장폐지",
    "횡령",
    "배임",
    "감사보고서",
    "잠정실적",
)


class WorkspaceService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = settings.database_path
        self.content_dir = settings.content_dir

    def connect(self) -> sqlite3.Connection:
        return connect_database(self.db_path)

    def init_db(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS work_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'todo',
                    priority TEXT NOT NULL DEFAULT 'normal',
                    due_date TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_work_tasks_user_status
                    ON work_tasks(user_id, status, updated_at DESC);

                CREATE TABLE IF NOT EXISTS content_document_versions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL,
                    slug TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    created_by_user_id INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_content_versions_document
                    ON content_document_versions(kind, slug, filename, id DESC);

                CREATE TABLE IF NOT EXISTS stock_briefings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    briefing_date TEXT NOT NULL,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    holding_count INTEGER NOT NULL,
                    watchlist_count INTEGER NOT NULL,
                    analysis_count INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(user_id, briefing_date)
                );

                CREATE TABLE IF NOT EXISTS daily_stock_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    run_date TEXT NOT NULL,
                    status TEXT NOT NULL,
                    price_updated_count INTEGER NOT NULL DEFAULT 0,
                    price_failed_count INTEGER NOT NULL DEFAULT 0,
                    watchlist_count INTEGER NOT NULL DEFAULT 0,
                    disclosure_count INTEGER NOT NULL DEFAULT 0,
                    disclosure_failed_count INTEGER NOT NULL DEFAULT 0,
                    task_created_count INTEGER NOT NULL DEFAULT 0,
                    telegram_sent INTEGER NOT NULL DEFAULT 0,
                    summary TEXT NOT NULL DEFAULT '',
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    UNIQUE(user_id, run_date)
                );
                CREATE INDEX IF NOT EXISTS idx_daily_stock_runs_user_date
                    ON daily_stock_runs(user_id, run_date DESC);
                """
            )
            ensure_column(connection, "work_tasks", "source_type", "TEXT")
            ensure_column(connection, "work_tasks", "source_ref", "TEXT")
            connection.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_work_tasks_source
                ON work_tasks(user_id, source_type, source_ref)
                WHERE source_ref IS NOT NULL
                """
            )

    def search(
        self,
        user: User,
        content_service: ContentOpsService,
        query: str,
        limit: int,
    ) -> list[GlobalSearchResult]:
        normalized = query.strip().casefold()
        results: list[GlobalSearchResult] = []
        if user.can_access_stocks:
            results.extend(self._search_stocks(user.id, normalized))
        if user.can_access_content_ops:
            results.extend(self._search_content(content_service, normalized))
        results.extend(self._search_tasks(user.id, normalized))
        results.sort(key=lambda item: (-item.score, item.title.casefold()))
        return results[:limit]

    def _search_stocks(self, user_id: int, query: str) -> list[GlobalSearchResult]:
        specs = (
            ("stock_holdings", "holding", "holdings", "ticker", "name", "investment_thesis"),
            ("stock_watchlist_items", "watchlist", "watchlist", "ticker", "name", "note"),
            ("stock_analysis_records", "analysis", "analysis", "ticker", "name", "summary"),
            ("stock_reports", "report", "reports", "ticker", "title", "body"),
        )
        results: list[GlobalSearchResult] = []
        with self.connect() as connection:
            for table, kind, section, ticker_col, title_col, detail_col in specs:
                rows = connection.execute(
                    f"SELECT id, {ticker_col} ticker, {title_col} title, {detail_col} detail "
                    f"FROM {table} WHERE user_id = ? ORDER BY id DESC LIMIT 100",
                    (user_id,),
                ).fetchall()
                for row in rows:
                    title = str(row["title"] or row["ticker"])
                    detail = str(row["detail"] or "")
                    haystack = f"{row['ticker']} {title} {detail}".casefold()
                    if query not in haystack:
                        continue
                    score = 100 if query in f"{row['ticker']} {title}".casefold() else 60
                    results.append(
                        GlobalSearchResult(
                            id=f"{kind}:{row['id']}",
                            kind=kind,
                            title=f"{title} ({row['ticker']})",
                            description=self._snippet(detail, query),
                            view="stocks",
                            section=section,
                            resource_id=str(row["id"]),
                            score=score,
                        )
                    )
        return results

    def _search_content(
        self,
        content_service: ContentOpsService,
        query: str,
    ) -> list[GlobalSearchResult]:
        results: list[GlobalSearchResult] = []
        projects = [
            ("youtube", project.slug) for project in content_service.list_youtube_projects()
        ] + [("emoticon", project.slug) for project in content_service.list_emoticon_projects()]
        for kind, slug in projects[:100]:
            documents = content_service.list_documents(kind, slug) or []
            for document in documents:
                haystack = f"{slug} {document.filename} {document.content}".casefold()
                if query not in haystack:
                    continue
                score = 90 if query in f"{slug} {document.filename}".casefold() else 50
                results.append(
                    GlobalSearchResult(
                        id=f"{kind}:{slug}:{document.filename}",
                        kind=f"{kind}_document",
                        title=f"{slug} / {document.filename}",
                        description=self._snippet(document.content, query),
                        view="contentOps",
                        section=kind,
                        resource_id=f"{slug}/{document.filename}",
                        score=score,
                    )
                )
        return results

    def _search_tasks(self, user_id: int, query: str) -> list[GlobalSearchResult]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT id, title, description, status FROM work_tasks WHERE user_id = ?",
                (user_id,),
            ).fetchall()
        return [
            GlobalSearchResult(
                id=f"task:{row['id']}",
                kind="task",
                title=str(row["title"]),
                description=self._snippet(str(row["description"]), query),
                view="tasks",
                section=str(row["status"]),
                resource_id=str(row["id"]),
                score=85 if query in str(row["title"]).casefold() else 45,
            )
            for row in rows
            if query in f"{row['title']} {row['description']}".casefold()
        ]

    @staticmethod
    def _snippet(value: str, query: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            return "관련 기록 열기"
        index = cleaned.casefold().find(query)
        start = max(index - 40, 0) if index >= 0 else 0
        return cleaned[start : start + 140]

    def list_tasks(self, user: User) -> list[TaskPublic]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM work_tasks WHERE user_id = ?
                ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END,
                         CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
                         COALESCE(due_date, '9999-12-31'), updated_at DESC
                """,
                (user.id,),
            ).fetchall()
        return [self._task_public(row) for row in rows]

    def create_task(self, user: User, payload: TaskCreateRequest) -> TaskPublic:
        now = now_iso()
        due_date = validate_date(payload.due_date)
        with self.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO work_tasks
                    (user_id, title, description, priority, due_date, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user.id,
                    payload.title.strip(),
                    payload.description.strip(),
                    payload.priority,
                    due_date,
                    now,
                    now,
                ),
            )
            row = connection.execute(
                "SELECT * FROM work_tasks WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
        assert row is not None
        return self._task_public(row)

    def update_task(self, user: User, task_id: int, payload: TaskUpdateRequest) -> TaskPublic:
        changes = payload.model_dump(exclude_unset=True)
        if not changes:
            raise HTTPException(status_code=400, detail="No update fields provided.")
        with self.connect() as connection:
            row = connection.execute(
                "SELECT * FROM work_tasks WHERE id = ? AND user_id = ?", (task_id, user.id)
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Task not found.")
            values = dict(row)
            values.update(changes)
            values["title"] = str(values["title"]).strip()
            values["description"] = str(values["description"]).strip()
            values["due_date"] = validate_date(values.get("due_date"))
            values["updated_at"] = now_iso()
            values["completed_at"] = values["updated_at"] if values["status"] == "done" else None
            connection.execute(
                """
                UPDATE work_tasks SET title = :title, description = :description,
                    status = :status, priority = :priority, due_date = :due_date,
                    updated_at = :updated_at, completed_at = :completed_at
                WHERE id = :id AND user_id = :user_id
                """,
                values,
            )
            updated = connection.execute(
                "SELECT * FROM work_tasks WHERE id = ?", (task_id,)
            ).fetchone()
        assert updated is not None
        return self._task_public(updated)

    def delete_task(self, user: User, task_id: int) -> None:
        with self.connect() as connection:
            cursor = connection.execute(
                "DELETE FROM work_tasks WHERE id = ? AND user_id = ?", (task_id, user.id)
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Task not found.")

    def sync_content_tasks(
        self,
        user: User,
        content_service: ContentOpsService,
    ) -> tuple[int, int, list[TaskPublic]]:
        if not user.can_access_content_ops:
            return 0, 0, self.list_tasks(user)
        desired: list[tuple[str, str, str, str]] = []
        youtube_steps = (
            ("research", "리서치"),
            ("ideas", "기획안"),
            ("qa", "기획 검수"),
            ("script", "대본"),
            ("production", "제작"),
            ("review", "성과 검토"),
        )
        for project in content_service.list_youtube_projects():
            for field, label in youtube_steps:
                if not getattr(project, f"has_{field}"):
                    desired.append(
                        (
                            f"youtube:{project.slug}:{field}",
                            f"YouTube {project.slug}: {label} 진행",
                            f"Content Ops에서 {label} 문서를 작성하거나 검토하세요.",
                            f"youtube:{project.slug}:%",
                        )
                    )
                    break
        emoticon_steps = (
            ("character", "캐릭터 정의"),
            ("research", "시장조사"),
            ("qa", "기획 검수"),
            ("friends", "관계 캐릭터"),
            ("review", "출시 검토"),
        )
        for project in content_service.list_emoticon_projects():
            for field, label in emoticon_steps:
                if not getattr(project, f"has_{field}"):
                    desired.append(
                        (
                            f"emoticon:{project.slug}:{field}",
                            f"이모티콘 {project.slug}: {label} 진행",
                            f"Content Ops에서 {label} 문서를 작성하거나 검토하세요.",
                            f"emoticon:{project.slug}:%",
                        )
                    )
                    break

        now = now_iso()
        created_count = 0
        completed_count = 0
        with self.connect() as connection:
            for source_ref, title, description, project_pattern in desired:
                cursor = connection.execute(
                    """
                    UPDATE work_tasks
                    SET status = 'done', completed_at = ?, updated_at = ?
                    WHERE user_id = ? AND source_type = 'content'
                      AND source_ref LIKE ? AND source_ref != ? AND status != 'done'
                    """,
                    (now, now, user.id, project_pattern, source_ref),
                )
                completed_count += cursor.rowcount
                cursor = connection.execute(
                    """
                    INSERT OR IGNORE INTO work_tasks (
                        user_id, title, description, status, priority, due_date,
                        created_at, updated_at, source_type, source_ref
                    ) VALUES (?, ?, ?, 'todo', 'normal', NULL, ?, ?, 'content', ?)
                    """,
                    (user.id, title, description, now, now, source_ref),
                )
                created_count += cursor.rowcount
        return created_count, completed_count, self.list_tasks(user)

    def record_disclosure_tasks(
        self,
        user: User,
        ticker: str,
        disclosures: list[Disclosure],
    ) -> int:
        normalized_ticker = ticker.strip().upper()
        important = [
            disclosure
            for disclosure in disclosures
            if any(keyword in disclosure.title for keyword in IMPORTANT_DISCLOSURE_KEYWORDS)
        ]
        now = now_iso()
        created_count = 0
        with self.connect() as connection:
            for disclosure in important:
                cursor = connection.execute(
                    """
                    INSERT OR IGNORE INTO work_tasks (
                        user_id, title, description, status, priority, due_date,
                        created_at, updated_at, source_type, source_ref
                    ) VALUES (?, ?, ?, 'todo', 'high', ?, ?, ?, 'disclosure', ?)
                    """,
                    (
                        user.id,
                        f"{normalized_ticker} 주요 공시 검토",
                        f"{disclosure.title} · {disclosure.url}",
                        disclosure.date,
                        now,
                        now,
                        f"dart:{disclosure.receipt_no}",
                    ),
                )
                created_count += cursor.rowcount
        return created_count

    @staticmethod
    def _task_public(row: sqlite3.Row) -> TaskPublic:
        return TaskPublic(**{key: row[key] for key in TaskPublic.model_fields})

    def record_content_version(
        self,
        user: User,
        kind: str,
        slug: str,
        filename: str,
        content: str,
    ) -> None:
        with self.connect() as connection:
            latest = connection.execute(
                """
                SELECT content FROM content_document_versions
                WHERE kind = ? AND slug = ? AND filename = ?
                ORDER BY id DESC LIMIT 1
                """,
                (kind, slug, filename),
            ).fetchone()
            if latest is not None and latest["content"] == content:
                return
            connection.execute(
                """
                INSERT INTO content_document_versions
                    (kind, slug, filename, content, created_at, created_by_user_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (kind, slug, filename, content, now_iso(), user.id),
            )

    def list_content_versions(
        self, kind: str, slug: str, filename: str
    ) -> list[ContentVersionPublic]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM content_document_versions
                WHERE kind = ? AND slug = ? AND filename = ?
                ORDER BY id DESC LIMIT 50
                """,
                (kind, slug, filename),
            ).fetchall()
        return [ContentVersionPublic(**dict(row)) for row in rows]

    def get_content_version(self, version_id: int) -> ContentVersionPublic:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT * FROM content_document_versions WHERE id = ?", (version_id,)
            ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Document version not found.")
        return ContentVersionPublic(**dict(row))

    def get_or_create_briefing(self, user: User, refresh: bool = False) -> StockBriefingPublic:
        today = date.today().isoformat()
        with self.connect() as connection:
            existing = connection.execute(
                "SELECT * FROM stock_briefings WHERE user_id = ? AND briefing_date = ?",
                (user.id, today),
            ).fetchone()
            if existing is not None and not refresh:
                return StockBriefingPublic(**dict(existing))
            counts = {
                "holding_count": connection.execute(
                    "SELECT COUNT(*) FROM stock_holdings WHERE user_id = ?", (user.id,)
                ).fetchone()[0],
                "watchlist_count": connection.execute(
                    "SELECT COUNT(*) FROM stock_watchlist_items WHERE user_id = ?", (user.id,)
                ).fetchone()[0],
                "analysis_count": connection.execute(
                    "SELECT COUNT(*) FROM stock_analysis_records WHERE user_id = ?", (user.id,)
                ).fetchone()[0],
            }
            top = connection.execute(
                """
                SELECT name, ticker, score, rating_label FROM stock_analysis_records
                WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
                """,
                (user.id,),
            ).fetchone()
            body = (
                f"보유종목 {counts['holding_count']}개, 관심종목 {counts['watchlist_count']}개, "
                f"누적 분석 {counts['analysis_count']}건입니다."
            )
            if top is not None:
                body += (
                    f" 최근 분석은 {top['name']}({top['ticker']}) "
                    f"{top['score']}점 · {top['rating_label']}입니다."
                )
            body += " 오늘은 관심종목의 최신 공시와 보유종목 가격을 먼저 동기화하세요."
            now = now_iso()
            connection.execute(
                """
                INSERT INTO stock_briefings
                    (user_id, briefing_date, title, body, holding_count,
                     watchlist_count, analysis_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, briefing_date) DO UPDATE SET
                    title = excluded.title, body = excluded.body,
                    holding_count = excluded.holding_count,
                    watchlist_count = excluded.watchlist_count,
                    analysis_count = excluded.analysis_count,
                    created_at = excluded.created_at
                """,
                (
                    user.id,
                    today,
                    f"{today} 주식 운영 브리핑",
                    body,
                    counts["holding_count"],
                    counts["watchlist_count"],
                    counts["analysis_count"],
                    now,
                ),
            )
            row = connection.execute(
                "SELECT * FROM stock_briefings WHERE user_id = ? AND briefing_date = ?",
                (user.id, today),
            ).fetchone()
        assert row is not None
        return StockBriefingPublic(**dict(row))

    def get_daily_stock_run(self, user: User, run_date: str | None = None):
        from app.schemas.workspace import DailyStockRunPublic

        target_date = run_date or daily_run_date()
        with self.connect() as connection:
            row = connection.execute(
                "SELECT * FROM daily_stock_runs WHERE user_id = ? AND run_date = ?",
                (user.id, target_date),
            ).fetchone()
        return DailyStockRunPublic(**self._daily_stock_run_values(row)) if row else None

    async def run_daily_stock_automation(
        self,
        user: User,
        stock_service: StockService,
        disclosure_service: DisclosureService,
        telegram_service: TelegramService,
    ):
        from app.schemas.workspace import DailyStockRunPublic

        run_date = daily_run_date()
        reserved, existing = self._reserve_daily_stock_run(user.id, run_date)
        if not reserved:
            assert existing is not None
            return DailyStockRunPublic(**self._daily_stock_run_values(existing)), True

        price_updated = 0
        price_failed = 0
        watchlist_count = 0
        disclosure_count = 0
        disclosure_failed = 0
        task_created = 0
        telegram_sent = False
        errors: list[str] = []
        try:
            price_result = await stock_service.refresh_holding_prices(user)
            price_updated = len(price_result.updated)
            price_failed = len(price_result.failed)
            if price_failed:
                errors.append(f"시세 {price_failed}건 실패")

            watchlist = await asyncio.to_thread(stock_service.list_watchlist, user)
            watchlist_count = len(watchlist)
            if watchlist and disclosure_service.settings.opendart_api_key.strip():
                semaphore = asyncio.Semaphore(4)

                async def load_disclosures(ticker: str):
                    async with semaphore:
                        try:
                            disclosures = await disclosure_service.get_recent_disclosures(ticker)
                            return ticker, disclosures, None
                        except Exception as exc:  # One ticker must not stop the daily run.
                            return ticker, [], exc

                results = await asyncio.gather(
                    *(load_disclosures(item.ticker) for item in watchlist)
                )
                for ticker, disclosures, error in results:
                    if error is not None:
                        disclosure_failed += 1
                        continue
                    disclosure_count += len(disclosures)
                    task_created += await asyncio.to_thread(
                        self.record_disclosure_tasks,
                        user,
                        ticker,
                        disclosures,
                    )
                if disclosure_failed:
                    errors.append(f"공시 {disclosure_failed}종목 실패")
            elif watchlist:
                errors.append("OpenDART API 키 미설정")

            briefing = await asyncio.to_thread(self.get_or_create_briefing, user, True)
            if telegram_service.configured:
                message = "\n".join(
                    [
                        f"[Jay AI] {run_date} 주식 데일리 브리핑",
                        f"보유종목 시세 갱신 {price_updated}건, 실패 {price_failed}건",
                        f"관심종목 {watchlist_count}개 · 공시 {disclosure_count}건 확인",
                        f"검토 업무 {task_created}건 생성",
                        briefing.body,
                    ]
                )
                telegram_sent = await telegram_service.send_and_record(
                    event_type="daily_stock_briefing",
                    title=f"{run_date} 주식 데일리 브리핑",
                    message=message,
                    item_count=disclosure_count,
                )
                if not telegram_sent:
                    errors.append("텔레그램 발송 실패")

            summary = (
                f"시세 {price_updated}건 갱신, 관심종목 {watchlist_count}개 공시 확인, "
                f"검토 업무 {task_created}건 생성"
            )
            if errors:
                summary += f" ({', '.join(errors)})"
            run_status = "partial" if errors else "completed"
        except Exception as exc:
            run_status = "failed"
            summary = f"데일리 자동화 실패: {type(exc).__name__}"

        row = self._finish_daily_stock_run(
            user.id,
            run_date,
            status=run_status,
            price_updated_count=price_updated,
            price_failed_count=price_failed,
            watchlist_count=watchlist_count,
            disclosure_count=disclosure_count,
            disclosure_failed_count=disclosure_failed,
            task_created_count=task_created,
            telegram_sent=telegram_sent,
            summary=summary,
        )
        return DailyStockRunPublic(**self._daily_stock_run_values(row)), False

    def _reserve_daily_stock_run(self, user_id: int, run_date: str):
        with self.connect() as connection:
            existing = connection.execute(
                "SELECT * FROM daily_stock_runs WHERE user_id = ? AND run_date = ?",
                (user_id, run_date),
            ).fetchone()
            if existing is not None:
                return False, existing
            connection.execute(
                """
                INSERT INTO daily_stock_runs (user_id, run_date, status, started_at)
                VALUES (?, ?, 'running', ?)
                """,
                (user_id, run_date, now_iso()),
            )
        return True, None

    def _finish_daily_stock_run(self, user_id: int, run_date: str, **values):
        values["completed_at"] = now_iso()
        values["user_id"] = user_id
        values["run_date"] = run_date
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE daily_stock_runs
                SET status = :status,
                    price_updated_count = :price_updated_count,
                    price_failed_count = :price_failed_count,
                    watchlist_count = :watchlist_count,
                    disclosure_count = :disclosure_count,
                    disclosure_failed_count = :disclosure_failed_count,
                    task_created_count = :task_created_count,
                    telegram_sent = :telegram_sent,
                    summary = :summary,
                    completed_at = :completed_at
                WHERE user_id = :user_id AND run_date = :run_date
                """,
                values,
            )
            row = connection.execute(
                "SELECT * FROM daily_stock_runs WHERE user_id = ? AND run_date = ?",
                (user_id, run_date),
            ).fetchone()
        assert row is not None
        return row

    @staticmethod
    def _daily_stock_run_values(row: sqlite3.Row) -> dict[str, object]:
        values = dict(row)
        values.pop("id", None)
        values["telegram_sent"] = bool(values["telegram_sent"])
        return values

    def data_status(self) -> DataStatus:
        content_files = (
            [
                path
                for path in self.content_dir.rglob("*.md")
                if path.is_file() and not path.is_symlink()
            ]
            if self.content_dir.is_dir()
            else []
        )
        with self.connect() as connection:
            mode = str(connection.execute("PRAGMA journal_mode").fetchone()[0]).lower()
        return DataStatus(
            database_size_bytes=self.db_path.stat().st_size if self.db_path.exists() else 0,
            content_file_count=len(content_files),
            content_size_bytes=sum(path.stat().st_size for path in content_files),
            wal_enabled=mode == "wal",
            backups=self.list_backups(),
        )

    def create_backup(self) -> tuple[BackupPublic, bool]:
        path, created = backup_database(self.settings.data_dir)
        verify_database(path)
        return self._backup_public(path, "ok"), created

    def list_backups(self) -> list[BackupPublic]:
        backup_dir = self.settings.data_dir / "backups"
        if not backup_dir.is_dir():
            return []
        return [
            self._backup_public(path)
            for path in sorted(backup_dir.glob("*.db"), reverse=True)
            if path.is_file()
            and not path.is_symlink()
            and path.name.startswith(("jay_ai_platform-", "pre-restore-"))
        ]

    def backup_path(self, filename: str) -> Path:
        if Path(filename).name != filename or not filename.startswith(
            ("jay_ai_platform-", "pre-restore-")
        ):
            raise HTTPException(status_code=404, detail="Backup not found.")
        path = self.settings.data_dir / "backups" / filename
        if not path.is_file() or path.is_symlink():
            raise HTTPException(status_code=404, detail="Backup not found.")
        return path

    def verify_backup(self, filename: str) -> BackupPublic:
        path = self.backup_path(filename)
        try:
            verify_database(path)
        except sqlite3.Error as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Backup integrity check failed.",
            ) from exc
        return self._backup_public(path, "ok")

    def export_bundle(self) -> bytes:
        with tempfile.TemporaryDirectory(prefix="jay-ai-export-") as temporary_dir:
            snapshot = Path(temporary_dir) / "jay_ai_platform.db"
            source_uri = f"file:{self.db_path.resolve().as_posix()}?mode=ro"
            with (
                closing(sqlite3.connect(source_uri, uri=True)) as source,
                closing(sqlite3.connect(snapshot)) as destination,
            ):
                source.backup(destination)
            verify_database(snapshot)
            output = io.BytesIO()
            with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
                archive.write(snapshot, "data/jay_ai_platform.db")
                if self.content_dir.is_dir():
                    for path in self.content_dir.rglob("*.md"):
                        if path.is_file() and not path.is_symlink():
                            archive.write(
                                path,
                                Path("content") / path.relative_to(self.content_dir),
                            )
            return output.getvalue()

    def restore_backup(self, filename: str, confirmation: str) -> str:
        expected = f"RESTORE {filename}"
        if confirmation != expected:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Type '{expected}' to confirm restore.",
            )
        source_path = self.backup_path(filename)
        verify_database(source_path)
        backup_dir = self.settings.data_dir / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        safety_path = backup_dir / (f"pre-restore-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}.db")
        current_uri = f"file:{self.db_path.resolve().as_posix()}?mode=ro"
        with (
            closing(sqlite3.connect(current_uri, uri=True)) as current,
            closing(sqlite3.connect(safety_path)) as safety,
        ):
            current.backup(safety)
        verify_database(safety_path)
        source_uri = f"file:{source_path.resolve().as_posix()}?mode=ro"
        with (
            closing(sqlite3.connect(source_uri, uri=True)) as source,
            closing(sqlite3.connect(self.db_path)) as destination,
        ):
            source.backup(destination)
        verify_database(self.db_path)
        return safety_path.name

    @staticmethod
    def _backup_public(path: Path, integrity: str = "unchecked") -> BackupPublic:
        return BackupPublic(
            filename=path.name,
            size_bytes=path.stat().st_size,
            created_at=datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat(),
            integrity=integrity,
        )


def validate_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="due_date must use YYYY-MM-DD.") from exc


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def daily_run_date() -> str:
    return (datetime.now(UTC) + timedelta(hours=9)).date().isoformat()


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
