from typing import Literal

from pydantic import BaseModel, Field


class GlobalSearchResult(BaseModel):
    id: str
    kind: str
    title: str
    description: str
    view: Literal["stocks", "contentOps", "tasks"]
    section: str
    resource_id: str
    score: int


class GlobalSearchResponse(BaseModel):
    query: str
    results: list[GlobalSearchResult]


class TaskCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2000)
    priority: Literal["low", "normal", "high"] = "normal"
    due_date: str | None = Field(default=None, max_length=10)


class TaskUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    status: Literal["todo", "doing", "done"] | None = None
    priority: Literal["low", "normal", "high"] | None = None
    due_date: str | None = Field(default=None, max_length=10)


class TaskPublic(BaseModel):
    id: int
    title: str
    description: str
    status: str
    priority: str
    due_date: str | None
    created_at: str
    updated_at: str
    completed_at: str | None
    source_type: str | None = None
    source_ref: str | None = None


class TaskSyncResponse(BaseModel):
    created_count: int
    completed_count: int
    tasks: list[TaskPublic]


class ContentVersionPublic(BaseModel):
    id: int
    kind: str
    slug: str
    filename: str
    content: str
    created_at: str
    created_by_user_id: int


class StockBriefingPublic(BaseModel):
    id: int
    briefing_date: str
    title: str
    body: str
    holding_count: int
    watchlist_count: int
    analysis_count: int
    created_at: str


class DailyStockRunPublic(BaseModel):
    run_date: str
    status: Literal["running", "completed", "partial", "failed"]
    price_updated_count: int
    price_failed_count: int
    watchlist_count: int
    disclosure_count: int
    disclosure_failed_count: int
    task_created_count: int
    telegram_sent: bool
    summary: str
    started_at: str
    completed_at: str | None


class DailyStockRunResponse(BaseModel):
    run: DailyStockRunPublic
    already_ran: bool


class BackupPublic(BaseModel):
    filename: str
    size_bytes: int
    created_at: str
    integrity: Literal["unchecked", "ok", "failed"] = "unchecked"


class DataStatus(BaseModel):
    database_size_bytes: int
    content_file_count: int
    content_size_bytes: int
    wal_enabled: bool
    backups: list[BackupPublic]


class BackupActionResponse(BaseModel):
    backup: BackupPublic
    created: bool = False
    message: str


class RestoreRequest(BaseModel):
    confirmation: str = Field(min_length=10, max_length=300)


class RestoreResponse(BaseModel):
    restored_from: str
    safety_backup: str
    message: str
