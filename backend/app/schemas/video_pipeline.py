from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

PipelineStage = Literal[
    "research",
    "planning",
    "qa",
    "awaiting_approval",
    "approved",
    "script",
    "production",
    "rendering",
    "ready_for_upload",
    "uploading",
    "uploaded",
    "discarded",
    "failed",
]
VideoFormat = Literal["shorts", "longform"]
ApprovalDecision = Literal["approve", "request_changes", "hold", "discard"]
AssetType = Literal["image", "video", "audio", "captions", "thumbnail", "rendered_video"]
UploadVisibility = Literal["private", "unlisted", "public"]
TaskType = Literal["automation", "render", "youtube_upload"]
TaskStatus = Literal["queued", "running", "succeeded", "failed"]


class VideoJobCreate(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    format: VideoFormat = "shorts"
    slug: str | None = Field(default=None, min_length=3, max_length=80)


class StageUpdate(BaseModel):
    stage: PipelineStage
    note: str | None = Field(default=None, max_length=1_000)


class ApprovalUpdate(BaseModel):
    decision: ApprovalDecision
    note: str | None = Field(default=None, max_length=2_000)


class AssetRegister(BaseModel):
    asset_type: AssetType
    storage_uri: str = Field(min_length=1, max_length=2_000)
    mime_type: str = Field(min_length=1, max_length=120)
    duration_seconds: float | None = Field(default=None, ge=0, le=86_400)
    width: int | None = Field(default=None, ge=1, le=32_000)
    height: int | None = Field(default=None, ge=1, le=32_000)


class UploadIntentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=5_000)
    tags: list[str] = Field(default_factory=list, max_length=30)
    visibility: UploadVisibility = "private"
    scheduled_at: datetime | None = None


class VideoAsset(BaseModel):
    id: int
    asset_type: AssetType
    storage_uri: str
    mime_type: str
    duration_seconds: float | None
    width: int | None
    height: int | None
    created_at: str


class UploadIntent(BaseModel):
    id: int
    title: str
    description: str
    tags: list[str]
    visibility: UploadVisibility
    scheduled_at: str | None
    status: Literal["pending", "uploaded", "failed"]
    youtube_video_id: str | None
    created_at: str


class VideoTask(BaseModel):
    id: int
    job_slug: str
    task_type: TaskType
    status: TaskStatus
    error: str | None
    created_at: str
    started_at: str | None
    finished_at: str | None
    options: dict[str, bool] = Field(default_factory=dict)


class VideoJobSummary(BaseModel):
    slug: str
    topic: str
    format: VideoFormat
    stage: PipelineStage
    created_at: str
    updated_at: str


class VideoJobDetail(VideoJobSummary):
    approval_note: str | None
    assets: list[VideoAsset]
    upload_intent: UploadIntent | None
    automation_task: VideoTask | None
    render_task: VideoTask | None
    upload_task: VideoTask | None


class UploadIntentResponse(BaseModel):
    job: VideoJobDetail
    message: str


class AutomationRequest(BaseModel):
    regenerate_voice: bool = False
    regenerate_images: bool = False
    pipeline_config: dict[str, Any] | None = None


class ProviderStatus(BaseModel):
    gemini_image_configured: bool
    narration_configured: bool
    youtube_oauth_configured: bool
    ffmpeg_configured: bool


class AutomationResponse(BaseModel):
    job: VideoJobDetail
    message: str
