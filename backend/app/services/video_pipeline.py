from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from datetime import UTC, datetime

from app.config import Settings
from app.schemas.video_pipeline import (
    ApprovalUpdate,
    AssetRegister,
    StageUpdate,
    UploadIntent,
    UploadIntentCreate,
    VideoAsset,
    VideoJobCreate,
    VideoJobDetail,
    VideoJobSummary,
    VideoTask,
)
from app.services.database import connect_database

PROJECT_SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{2,79}$")
STORAGE_URI = re.compile(r"^(?:gs|s3|https?|file)://[^\s]+$", re.IGNORECASE)

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "research": {"planning", "failed", "discarded"},
    "planning": {"qa", "failed", "discarded"},
    "qa": {"awaiting_approval", "planning", "failed", "discarded"},
    "awaiting_approval": {"failed", "discarded"},
    "approved": {"script", "failed", "discarded"},
    "script": {"production", "failed", "discarded"},
    "production": {"failed", "discarded"},
    "rendering": {"failed", "discarded"},
    "ready_for_upload": {"uploading", "failed", "discarded"},
    "uploading": {"uploaded", "failed", "discarded"},
    "uploaded": {"failed", "discarded"},
    "failed": {"research", "discarded"},
    "discarded": set(),
}

PROJECT_TEMPLATES = {
    "research.md": "# 시장조사\n\n## 주제\n\n## 공식 출처\n\n## 후보 이슈\n",
    "ideas.md": "# 아이디어\n\n## TOP 3\n\n## 대표 승인 대기\n",
    "qa.md": "# 검수\n\n- 판정: 대기\n- 검수 메모:\n",
    "approval.md": "# 대표 승인 기록\n\n- 결정: 대기\n- 결정 시각:\n- 메모:\n",
    "script.md": "# 대본\n\n> 대표 승인 후 작성\n",
    "production.md": "# 제작 계획\n\n> 대본 승인 후 작성\n",
    "review.md": "# 성과 리뷰\n\n> 게시 48시간 후 작성\n",
}


class VideoPipelineNotFound(LookupError):
    pass


class VideoPipelineConflict(ValueError):
    pass


class VideoPipelineService:
    """Persist safe, provider-neutral video production jobs.

    This service deliberately does not call an image model, renderer, or YouTube yet.
    Workers can register generated files and consume upload intents without changing the
    approval rules or exposing provider credentials to the frontend.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = settings.database_path
        self.youtube_dir = settings.content_dir / "youtube"

    def connect(self) -> sqlite3.Connection:
        return connect_database(self.db_path)

    def init_db(self) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS video_jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL UNIQUE,
                    topic TEXT NOT NULL,
                    format TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    approval_note TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS video_assets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id INTEGER NOT NULL,
                    asset_type TEXT NOT NULL,
                    storage_uri TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    duration_seconds REAL,
                    width INTEGER,
                    height INTEGER,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (job_id) REFERENCES video_jobs(id) ON DELETE CASCADE
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS youtube_upload_intents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    tags_json TEXT NOT NULL,
                    visibility TEXT NOT NULL,
                    scheduled_at TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (job_id) REFERENCES video_jobs(id) ON DELETE CASCADE
                )
                """
            )
            ensure_column(connection, "youtube_upload_intents", "youtube_video_id", "TEXT")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS video_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id INTEGER NOT NULL,
                    task_type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'queued',
                    error TEXT,
                    created_at TEXT NOT NULL,
                    started_at TEXT,
                    finished_at TEXT,
                    FOREIGN KEY (job_id) REFERENCES video_jobs(id) ON DELETE CASCADE
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_video_jobs_updated ON video_jobs(updated_at DESC)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_video_assets_job ON video_assets(job_id)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_video_tasks_status ON video_tasks(status, id)"
            )

    def create_job(self, payload: VideoJobCreate) -> VideoJobDetail:
        slug = self._resolve_slug(payload)
        if not PROJECT_SLUG.fullmatch(slug):
            raise ValueError("slug must contain only lowercase letters, numbers, and hyphens.")

        project_dir = self.youtube_dir / slug
        now = now_iso()
        with self.connect() as connection:
            existing = connection.execute(
                "SELECT 1 FROM video_jobs WHERE slug = ?", (slug,)
            ).fetchone()
            if existing is not None or project_dir.exists():
                raise VideoPipelineConflict(f"A video project already exists for '{slug}'.")

            project_dir.mkdir(parents=True, exist_ok=False)
            for filename, template in PROJECT_TEMPLATES.items():
                (project_dir / filename).write_text(
                    template.replace("## 주제", f"## 주제\n{payload.topic}"),
                    encoding="utf-8",
                    newline="\n",
                )
            connection.execute(
                """
                INSERT INTO video_jobs
                    (slug, topic, format, stage, created_at, updated_at)
                VALUES (?, ?, ?, 'research', ?, ?)
                """,
                (slug, payload.topic.strip(), payload.format, now, now),
            )
        return self.get_job(slug)

    def list_jobs(self) -> list[VideoJobSummary]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT slug, topic, format, stage, created_at, updated_at
                FROM video_jobs
                ORDER BY updated_at DESC, id DESC
                """
            ).fetchall()
        return [self._summary(row) for row in rows]

    def get_job(self, slug: str) -> VideoJobDetail:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT * FROM video_jobs WHERE slug = ?", (slug,)
            ).fetchone()
            if row is None:
                raise VideoPipelineNotFound("Video project not found.")
            assets = connection.execute(
                """
                SELECT id, asset_type, storage_uri, mime_type, duration_seconds,
                       width, height, created_at
                FROM video_assets
                WHERE job_id = ?
                ORDER BY id ASC
                """,
                (row["id"],),
            ).fetchall()
            upload_row = connection.execute(
                """
                SELECT id, title, description, tags_json, visibility,
                       scheduled_at, status, youtube_video_id, created_at
                FROM youtube_upload_intents
                WHERE job_id = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (row["id"],),
            ).fetchone()
            task_rows = connection.execute(
                """
                SELECT id, task_type, status, error, created_at, started_at, finished_at
                FROM video_tasks
                WHERE job_id = ?
                ORDER BY id DESC
                """,
                (row["id"],),
            ).fetchall()
        tasks_by_type: dict[str, VideoTask] = {}
        for task in task_rows:
            tasks_by_type.setdefault(
                str(task["task_type"]), self._task(task, str(row["slug"]))
            )
        return VideoJobDetail(
            **self._summary(row).model_dump(),
            approval_note=row["approval_note"],
            assets=[self._asset(item) for item in assets],
            upload_intent=self._upload_intent(upload_row) if upload_row else None,
            render_task=tasks_by_type.get("render"),
            upload_task=tasks_by_type.get("youtube_upload"),
        )

    def advance_stage(self, slug: str, payload: StageUpdate) -> VideoJobDetail:
        if payload.stage in {"approved"}:
            raise ValueError("Use the approval endpoint to enter the approved stage.")
        with self.connect() as connection:
            row = self._get_row(connection, slug)
            current = str(row["stage"])
            if payload.stage not in ALLOWED_TRANSITIONS.get(current, set()):
                raise VideoPipelineConflict(
                    f"Cannot move a project from {current} to {payload.stage}."
                )
            self._set_stage(connection, int(row["id"]), payload.stage)
        return self.get_job(slug)

    def record_approval(self, slug: str, payload: ApprovalUpdate) -> VideoJobDetail:
        with self.connect() as connection:
            row = self._get_row(connection, slug)
            if row["stage"] != "awaiting_approval":
                raise VideoPipelineConflict(
                    "A project can be approved only while awaiting approval."
                )
            stage = {
                "approve": "approved",
                "request_changes": "qa",
                "hold": "awaiting_approval",
                "discard": "discarded",
            }[payload.decision]
            now = now_iso()
            note = payload.note.strip() if payload.note else None
            connection.execute(
                "UPDATE video_jobs SET stage = ?, approval_note = ?, updated_at = ? WHERE id = ?",
                (stage, note, now, row["id"]),
            )
            approval_path = self.youtube_dir / slug / "approval.md"
            approval_path.write_text(
                "\n".join(
                    [
                        "# 대표 승인 기록",
                        "",
                        f"- 결정: {payload.decision}",
                        f"- 결정 시각: {now}",
                        f"- 메모: {note or '없음'}",
                        "",
                    ]
                ),
                encoding="utf-8",
                newline="\n",
            )
        return self.get_job(slug)

    def register_asset(self, slug: str, payload: AssetRegister) -> VideoJobDetail:
        if not STORAGE_URI.fullmatch(payload.storage_uri):
            raise ValueError("storage_uri must use gs://, s3://, http(s)://, or file://.")
        with self.connect() as connection:
            row = self._get_row(connection, slug)
            if row["stage"] in {"discarded", "failed"}:
                raise VideoPipelineConflict(
                    "Assets cannot be added to a discarded or failed project."
                )
            connection.execute(
                """
                INSERT INTO video_assets
                    (job_id, asset_type, storage_uri, mime_type, duration_seconds,
                     width, height, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["id"],
                    payload.asset_type,
                    payload.storage_uri,
                    payload.mime_type,
                    payload.duration_seconds,
                    payload.width,
                    payload.height,
                    now_iso(),
                ),
            )
            self._touch(connection, int(row["id"]))
        return self.get_job(slug)

    def request_render(self, slug: str) -> VideoJobDetail:
        with self.connect() as connection:
            row = self._get_row(connection, slug)
            if row["stage"] != "production":
                raise VideoPipelineConflict(
                    "Rendering can start only after the production plan is ready."
                )
            production_path = self.youtube_dir / slug / "production.md"
            script_path = self.youtube_dir / slug / "script.md"
            if not production_path.is_file() or not script_path.is_file():
                raise VideoPipelineConflict(
                    "script.md and production.md are required before rendering."
                )
            pending_task = connection.execute(
                """
                SELECT 1 FROM video_tasks
                WHERE job_id = ? AND task_type = 'render'
                  AND status IN ('queued', 'running')
                LIMIT 1
                """,
                (row["id"],),
            ).fetchone()
            if pending_task is not None:
                raise VideoPipelineConflict("A render task is already queued or running.")
            now = now_iso()
            connection.execute(
                """
                INSERT INTO video_tasks
                    (job_id, task_type, status, created_at)
                VALUES (?, 'render', 'queued', ?)
                """,
                (row["id"], now),
            )
            self._set_stage(connection, int(row["id"]), "rendering")
        return self.get_job(slug)

    def mark_render_ready(self, slug: str) -> VideoJobDetail:
        with self.connect() as connection:
            row = self._get_row(connection, slug)
            if row["stage"] != "rendering":
                raise VideoPipelineConflict("The project is not currently rendering.")
            rendered = connection.execute(
                """
                SELECT 1 FROM video_assets
                WHERE job_id = ? AND asset_type = 'rendered_video'
                LIMIT 1
                """,
                (row["id"],),
            ).fetchone()
            if rendered is None:
                raise VideoPipelineConflict(
                    "Register a rendered_video asset before marking it ready."
                )
            task = connection.execute(
                """
                SELECT id, status
                FROM video_tasks
                WHERE job_id = ? AND task_type = 'render'
                ORDER BY id DESC
                LIMIT 1
                """,
                (row["id"],),
            ).fetchone()
            if task is None:
                raise VideoPipelineConflict("No render task exists for this project.")
            now = now_iso()
            connection.execute(
                """
                UPDATE video_tasks
                SET status = 'succeeded', finished_at = ?, error = NULL
                WHERE id = ?
                """,
                (now, task["id"]),
            )
            self._set_stage(connection, int(row["id"]), "ready_for_upload")
        return self.get_job(slug)

    def create_upload_intent(self, slug: str, payload: UploadIntentCreate) -> UploadIntent:
        with self.connect() as connection:
            row = self._get_row(connection, slug)
            if row["stage"] != "ready_for_upload":
                raise VideoPipelineConflict(
                    "An upload intent requires a rendered video ready for upload."
                )
            rendered = connection.execute(
                """
                SELECT 1 FROM video_assets
                WHERE job_id = ? AND asset_type = 'rendered_video'
                LIMIT 1
                """,
                (row["id"],),
            ).fetchone()
            if rendered is None:
                raise VideoPipelineConflict(
                    "Register a rendered_video asset before creating an upload intent."
                )
            pending_task = connection.execute(
                """
                SELECT 1 FROM video_tasks
                WHERE job_id = ? AND task_type = 'youtube_upload'
                  AND status IN ('queued', 'running')
                LIMIT 1
                """,
                (row["id"],),
            ).fetchone()
            if pending_task is not None:
                raise VideoPipelineConflict("A YouTube upload task is already queued or running.")
            now = now_iso()
            cursor = connection.execute(
                """
                INSERT INTO youtube_upload_intents
                    (job_id, title, description, tags_json, visibility,
                     scheduled_at, status, youtube_video_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?)
                """,
                (
                    row["id"],
                    payload.title.strip(),
                    payload.description,
                    json.dumps(payload.tags, ensure_ascii=False),
                    payload.visibility,
                    payload.scheduled_at.isoformat() if payload.scheduled_at else None,
                    now,
                ),
            )
            connection.execute(
                """
                INSERT INTO video_tasks
                    (job_id, task_type, status, created_at)
                VALUES (?, 'youtube_upload', 'queued', ?)
                """,
                (row["id"], now),
            )
            intent_id = int(cursor.lastrowid)
            self._touch(connection, int(row["id"]))
            intent_row = connection.execute(
                "SELECT * FROM youtube_upload_intents WHERE id = ?", (intent_id,)
            ).fetchone()
        return self._upload_intent(intent_row)

    def get_upload_intent(self, slug: str) -> UploadIntent | None:
        with self.connect() as connection:
            row = self._get_row(connection, slug)
            intent = connection.execute(
                """
                SELECT id, title, description, tags_json, visibility,
                       scheduled_at, status, youtube_video_id, created_at
                FROM youtube_upload_intents
                WHERE job_id = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (row["id"],),
            ).fetchone()
        return self._upload_intent(intent) if intent else None

    def claim_next_task(self, task_type: str = "render") -> VideoTask | None:
        if task_type not in {"render", "youtube_upload"}:
            raise ValueError("Unsupported task type.")
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT id
                FROM video_tasks
                WHERE task_type = ? AND status = 'queued'
                ORDER BY id ASC
                LIMIT 1
                """,
                (task_type,),
            ).fetchone()
            if row is None:
                return None
            now = now_iso()
            connection.execute(
                """
                UPDATE video_tasks
                SET status = 'running', started_at = ?, error = NULL
                WHERE id = ? AND status = 'queued'
                """,
                (now, row["id"]),
            )
            if task_type == "youtube_upload":
                connection.execute(
                    """
                    UPDATE video_jobs
                    SET stage = 'uploading', updated_at = ?
                    WHERE id = (
                        SELECT job_id FROM video_tasks WHERE id = ?
                    ) AND stage = 'ready_for_upload'
                    """,
                    (now, row["id"]),
                )
            claimed = connection.execute(
                """
                SELECT video_tasks.id, video_jobs.slug AS job_slug,
                       video_tasks.task_type, video_tasks.status, video_tasks.error,
                       video_tasks.created_at, video_tasks.started_at, video_tasks.finished_at
                FROM video_tasks
                JOIN video_jobs ON video_jobs.id = video_tasks.job_id
                WHERE video_tasks.id = ?
                """,
                (row["id"],),
            ).fetchone()
        return self._task(claimed, str(claimed["job_slug"]))

    def fail_task(self, task_id: int, error: str) -> None:
        message = error.strip()[:2_000] or "The worker failed without a message."
        with self.connect() as connection:
            task = connection.execute(
                "SELECT job_id FROM video_tasks WHERE id = ?", (task_id,)
            ).fetchone()
            if task is None:
                raise VideoPipelineNotFound("Video task not found.")
            now = now_iso()
            connection.execute(
                """
                UPDATE video_tasks
                SET status = 'failed', error = ?, finished_at = ?
                WHERE id = ?
                """,
                (message, now, task_id),
            )
            connection.execute(
                """
                UPDATE video_jobs
                SET stage = 'failed', updated_at = ?
                WHERE id = ? AND stage IN ('rendering', 'ready_for_upload', 'uploading')
                """,
                (now, task["job_id"]),
            )
            connection.execute(
                """
                UPDATE youtube_upload_intents
                SET status = 'failed'
                WHERE job_id = ? AND status = 'pending'
                """,
                (task["job_id"],),
            )

    def mark_upload_succeeded(self, task_id: int, youtube_video_id: str) -> None:
        video_id = youtube_video_id.strip()
        if not video_id:
            raise ValueError("YouTube returned an empty video id.")
        with self.connect() as connection:
            task = connection.execute(
                """
                SELECT id, job_id, task_type
                FROM video_tasks
                WHERE id = ?
                """,
                (task_id,),
            ).fetchone()
            if task is None:
                raise VideoPipelineNotFound("Video task not found.")
            if task["task_type"] != "youtube_upload":
                raise VideoPipelineConflict("Only YouTube upload tasks can be completed this way.")
            now = now_iso()
            connection.execute(
                """
                UPDATE video_tasks
                SET status = 'succeeded', finished_at = ?, error = NULL
                WHERE id = ?
                """,
                (now, task_id),
            )
            connection.execute(
                """
                UPDATE youtube_upload_intents
                SET status = 'uploaded', youtube_video_id = ?
                WHERE job_id = ? AND status = 'pending'
                """,
                (video_id, task["job_id"]),
            )
            connection.execute(
                """
                UPDATE video_jobs
                SET stage = 'uploaded', updated_at = ?
                WHERE id = ?
                """,
                (now, task["job_id"]),
            )

    def _resolve_slug(self, payload: VideoJobCreate) -> str:
        if payload.slug:
            return payload.slug.strip().lower()
        digest = hashlib.sha1(payload.topic.strip().encode("utf-8")).hexdigest()[:8]
        date = datetime.now(UTC).date().isoformat()
        return f"{date}-video-{digest}"

    @staticmethod
    def _get_row(connection: sqlite3.Connection, slug: str) -> sqlite3.Row:
        row = connection.execute("SELECT * FROM video_jobs WHERE slug = ?", (slug,)).fetchone()
        if row is None:
            raise VideoPipelineNotFound("Video project not found.")
        return row

    @staticmethod
    def _set_stage(connection: sqlite3.Connection, job_id: int, stage: str) -> None:
        connection.execute(
            "UPDATE video_jobs SET stage = ?, updated_at = ? WHERE id = ?",
            (stage, now_iso(), job_id),
        )

    @staticmethod
    def _touch(connection: sqlite3.Connection, job_id: int) -> None:
        connection.execute("UPDATE video_jobs SET updated_at = ? WHERE id = ?", (now_iso(), job_id))

    @staticmethod
    def _summary(row: sqlite3.Row) -> VideoJobSummary:
        return VideoJobSummary(
            slug=str(row["slug"]),
            topic=str(row["topic"]),
            format=str(row["format"]),
            stage=str(row["stage"]),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )

    @staticmethod
    def _asset(row: sqlite3.Row) -> VideoAsset:
        return VideoAsset(
            id=int(row["id"]),
            asset_type=str(row["asset_type"]),
            storage_uri=str(row["storage_uri"]),
            mime_type=str(row["mime_type"]),
            duration_seconds=row["duration_seconds"],
            width=row["width"],
            height=row["height"],
            created_at=str(row["created_at"]),
        )

    @staticmethod
    def _upload_intent(row: sqlite3.Row) -> UploadIntent:
        raw_tags = json.loads(str(row["tags_json"]))
        tags = [str(tag) for tag in raw_tags] if isinstance(raw_tags, list) else []
        return UploadIntent(
            id=int(row["id"]),
            title=str(row["title"]),
            description=str(row["description"]),
            tags=tags,
            visibility=str(row["visibility"]),
            scheduled_at=str(row["scheduled_at"]) if row["scheduled_at"] else None,
            status=str(row["status"]),
            youtube_video_id=(
                str(row["youtube_video_id"]) if row["youtube_video_id"] else None
            ),
            created_at=str(row["created_at"]),
        )

    @staticmethod
    def _task(row: sqlite3.Row, job_slug: str) -> VideoTask:
        return VideoTask(
            id=int(row["id"]),
            job_slug=job_slug,
            task_type=str(row["task_type"]),
            status=str(row["status"]),
            error=str(row["error"]) if row["error"] else None,
            created_at=str(row["created_at"]),
            started_at=str(row["started_at"]) if row["started_at"] else None,
            finished_at=str(row["finished_at"]) if row["finished_at"] else None,
        )


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def ensure_column(
    connection: sqlite3.Connection,
    table: str,
    column: str,
    definition: str,
) -> None:
    columns = {
        str(row["name"])
        for row in connection.execute(f"PRAGMA table_info({table})").fetchall()
    }
    if column not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
