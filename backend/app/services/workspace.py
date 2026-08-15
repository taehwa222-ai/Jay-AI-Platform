from __future__ import annotations

import io
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from datetime import UTC, date, datetime
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
        ] + [
            ("emoticon", project.slug) for project in content_service.list_emoticon_projects()
        ]
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
            values["completed_at"] = (
                values["updated_at"] if values["status"] == "done" else None
            )
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

    def data_status(self) -> DataStatus:
        content_files = [
            path
            for path in self.content_dir.rglob("*.md")
            if path.is_file() and not path.is_symlink()
        ] if self.content_dir.is_dir() else []
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
        safety_path = backup_dir / (
            f"pre-restore-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}.db"
        )
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
