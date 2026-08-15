from datetime import datetime

from pydantic import BaseModel


class RuntimeStatus(BaseModel):
    started_at: datetime
    uptime_seconds: int
    total_requests: int
    completed_requests: int
    in_flight_requests: int
    server_error_count: int
    telemetry_write_failures: int
    average_duration_ms: float
    status_counts: dict[str, int]


class DatabaseStatus(BaseModel):
    healthy: bool
    file_name: str
    journal_mode: str
    integrity_check: str
    size_bytes: int
    disk_free_bytes: int
    disk_free_percent: float


class BackupStatus(BaseModel):
    available: bool
    latest_file: str | None
    latest_created_at: datetime | None
    age_hours: float | None
    backup_count: int


class AIUsageDay(BaseModel):
    usage_date: str
    request_count: int


class AIUsageStatus(BaseModel):
    today_count: int
    daily_limit: int
    remaining: int
    usage_percent: float
    history: list[AIUsageDay]


class CacheStatus(BaseModel):
    name: str
    ttl_seconds: float
    entries: int
    requests: int
    hits: int
    misses: int
    loads: int
    load_errors: int
    coalesced_waits: int
    hit_rate: float
    last_hit_at: datetime | None
    last_miss_at: datetime | None
    last_load_at: datetime | None


class IntegrationStatus(BaseModel):
    name: str
    configured: bool
    detail: str


class OperationalError(BaseModel):
    id: int
    occurred_at: datetime
    method: str
    path: str
    status_code: int
    error_type: str
    duration_ms: float


class OperationsOverview(BaseModel):
    generated_at: datetime
    status: str
    runtime: RuntimeStatus
    database: DatabaseStatus
    backup: BackupStatus
    ai_usage: AIUsageStatus
    caches: list[CacheStatus]
    integrations: list[IntegrationStatus]
    errors_last_24h: int
    recent_errors: list[OperationalError]
