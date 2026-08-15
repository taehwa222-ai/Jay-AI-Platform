import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.schemas.video_pipeline import UploadIntent
from app.services.google_providers import (
    GeminiImageProvider,
    ProviderNotConfigured,
    YouTubeUploadProvider,
)
from app.services.video_pipeline import VideoPipelineService


def create_admin(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "video-admin@example.com", "password": "password123", "name": "Video Admin"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def test_video_pipeline_enforces_approval_and_render_upload_flow():
    with TestClient(app) as client:
        token = create_admin(client)
        headers = {"Authorization": f"Bearer {token}"}

        created = client.post(
            "/api/v1/video-pipeline/youtube/jobs",
            headers=headers,
            json={"topic": "AI 영상 자동 제작", "format": "shorts", "slug": "2026-08-15-ai-video"},
        )
        assert created.status_code == 201
        assert created.json()["stage"] == "research"
        project_dir = get_settings().content_dir / "youtube" / "2026-08-15-ai-video"
        assert (project_dir / "approval.md").is_file()
        assert (project_dir / "production.md").is_file()

        for stage in ("planning", "qa", "awaiting_approval"):
            response = client.post(
                "/api/v1/video-pipeline/youtube/jobs/2026-08-15-ai-video/stage",
                headers=headers,
                json={"stage": stage},
            )
            assert response.status_code == 200

        blocked = client.post(
            "/api/v1/video-pipeline/youtube/jobs/2026-08-15-ai-video/stage",
            headers=headers,
            json={"stage": "approved"},
        )
        assert blocked.status_code == 422

        approved = client.post(
            "/api/v1/video-pipeline/youtube/jobs/2026-08-15-ai-video/approval",
            headers=headers,
            json={"decision": "approve", "note": "숏폼 제작 승인"},
        )
        assert approved.status_code == 200
        assert approved.json()["stage"] == "approved"
        assert "숏폼 제작 승인" in (project_dir / "approval.md").read_text(encoding="utf-8")

        for stage in ("script", "production"):
            response = client.post(
                "/api/v1/video-pipeline/youtube/jobs/2026-08-15-ai-video/stage",
                headers=headers,
                json={"stage": stage},
            )
            assert response.status_code == 200

        rendering = client.post(
            "/api/v1/video-pipeline/youtube/jobs/2026-08-15-ai-video/render",
            headers=headers,
        )
        assert rendering.status_code == 200
        assert rendering.json()["stage"] == "rendering"
        assert rendering.json()["render_task"]["status"] == "queued"
        claimed = VideoPipelineService(get_settings()).claim_next_task()
        assert claimed is not None
        assert claimed.job_slug == "2026-08-15-ai-video"
        assert claimed.status == "running"

        asset = client.post(
            "/api/v1/video-pipeline/youtube/jobs/2026-08-15-ai-video/assets",
            headers=headers,
            json={
                "asset_type": "rendered_video",
                "storage_uri": "file://renders/2026-08-15-ai-video.mp4",
                "mime_type": "video/mp4",
                "duration_seconds": 42,
                "width": 1080,
                "height": 1920,
            },
        )
        assert asset.status_code == 200

        ready = client.post(
            "/api/v1/video-pipeline/youtube/jobs/2026-08-15-ai-video/render-ready",
            headers=headers,
        )
        assert ready.status_code == 200
        assert ready.json()["stage"] == "ready_for_upload"
        assert ready.json()["render_task"]["status"] == "succeeded"

        intent = client.post(
            "/api/v1/video-pipeline/youtube/jobs/2026-08-15-ai-video/upload-intent",
            headers=headers,
            json={
                "title": "AI 영상 자동 제작 테스트",
                "description": "자동 업로드 준비 테스트",
                "tags": ["AI", "shorts"],
                "visibility": "private",
            },
        )
        assert intent.status_code == 200
        assert intent.json()["job"]["upload_intent"]["status"] == "pending"
        assert intent.json()["job"]["stage"] == "ready_for_upload"
        assert intent.json()["job"]["upload_task"]["status"] == "queued"


def test_video_pipeline_requires_admin_authentication():
    with TestClient(app) as client:
        response = client.get("/api/v1/video-pipeline/youtube/jobs")

    assert response.status_code == 401


def test_external_providers_fail_closed_without_credentials():
    settings = get_settings()
    with pytest.raises(ProviderNotConfigured):
        asyncio.run(
            GeminiImageProvider(settings).generate_image(
                "test prompt", Path("test.png")
            )
        )

    intent = UploadIntent(
        id=1,
        title="Test",
        description="",
        tags=[],
        visibility="private",
        scheduled_at=None,
        status="pending",
        youtube_video_id=None,
        created_at="2026-08-15T00:00:00+00:00",
    )
    with pytest.raises(ProviderNotConfigured):
        asyncio.run(
            YouTubeUploadProvider(settings).upload_video(Path("missing.mp4"), intent)
        )
