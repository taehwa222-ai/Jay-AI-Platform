import importlib.util
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.routers.auth import require_admin
from app.schemas.video_pipeline import (
    ApprovalUpdate,
    AssetRegister,
    AutomationRequest,
    AutomationResponse,
    ProviderStatus,
    StageUpdate,
    UploadIntentCreate,
    UploadIntentResponse,
    VideoJobCreate,
    VideoJobDetail,
    VideoJobSummary,
)
from app.services.auth import User
from app.services.video_pipeline import (
    VideoPipelineConflict,
    VideoPipelineNotFound,
    VideoPipelineService,
)

router = APIRouter(prefix="/api/v1/video-pipeline", tags=["video-pipeline"])


def get_service(request: Request) -> VideoPipelineService:
    return request.app.state.video_pipeline_service


def handle_error(error: Exception) -> HTTPException:
    if isinstance(error, VideoPipelineNotFound):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, VideoPipelineConflict):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error))


@router.post("/youtube/jobs", response_model=VideoJobDetail, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: VideoJobCreate,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> VideoJobDetail:
    try:
        return service.create_job(payload)
    except (ValueError, VideoPipelineConflict) as error:
        raise handle_error(error) from error


@router.get("/youtube/jobs", response_model=list[VideoJobSummary])
async def list_jobs(
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> list[VideoJobSummary]:
    return service.list_jobs()


@router.get("/youtube/jobs/{slug}", response_model=VideoJobDetail)
async def get_job(
    slug: str,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> VideoJobDetail:
    try:
        return service.get_job(slug)
    except VideoPipelineNotFound as error:
        raise handle_error(error) from error


@router.post("/youtube/jobs/{slug}/stage", response_model=VideoJobDetail)
async def advance_stage(
    slug: str,
    payload: StageUpdate,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> VideoJobDetail:
    try:
        return service.advance_stage(slug, payload)
    except (ValueError, VideoPipelineConflict, VideoPipelineNotFound) as error:
        raise handle_error(error) from error


@router.post("/youtube/jobs/{slug}/approval", response_model=VideoJobDetail)
async def record_approval(
    slug: str,
    payload: ApprovalUpdate,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> VideoJobDetail:
    try:
        return service.record_approval(slug, payload)
    except (ValueError, VideoPipelineConflict, VideoPipelineNotFound) as error:
        raise handle_error(error) from error


@router.post("/youtube/jobs/{slug}/assets", response_model=VideoJobDetail)
async def register_asset(
    slug: str,
    payload: AssetRegister,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> VideoJobDetail:
    try:
        return service.register_asset(slug, payload)
    except (ValueError, VideoPipelineConflict, VideoPipelineNotFound) as error:
        raise handle_error(error) from error


@router.post("/youtube/jobs/{slug}/render", response_model=VideoJobDetail)
async def request_render(
    slug: str,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> VideoJobDetail:
    try:
        return service.request_render(slug)
    except (ValueError, VideoPipelineConflict, VideoPipelineNotFound) as error:
        raise handle_error(error) from error


@router.post("/youtube/jobs/{slug}/automate", response_model=AutomationResponse)
async def request_automation(
    slug: str,
    payload: AutomationRequest,
    __: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> AutomationResponse:
    """Queue image, narration, captions, render, and metadata generation."""
    try:
        job = service.request_automation(slug, payload)
        return AutomationResponse(
            job=job,
            message=(
                "자동 제작 작업이 큐에 등록되었습니다. "
                "video-worker를 실행하면 렌더링을 시작합니다."
            ),
        )
    except (ValueError, VideoPipelineConflict, VideoPipelineNotFound) as error:
        raise handle_error(error) from error


@router.post("/youtube/jobs/{slug}/render-ready", response_model=VideoJobDetail)
async def mark_render_ready(
    slug: str,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> VideoJobDetail:
    try:
        return service.mark_render_ready(slug)
    except (ValueError, VideoPipelineConflict, VideoPipelineNotFound) as error:
        raise handle_error(error) from error


@router.post("/youtube/jobs/{slug}/upload-intent", response_model=UploadIntentResponse)
async def create_upload_intent(
    slug: str,
    payload: UploadIntentCreate,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> UploadIntentResponse:
    try:
        service.create_upload_intent(slug, payload)
        return UploadIntentResponse(
            job=service.get_job(slug),
            message=(
                "업로드 준비가 저장되었습니다. YouTube OAuth 연결 후 워커가 이 intent를 처리합니다."
            ),
        )
    except (ValueError, VideoPipelineConflict, VideoPipelineNotFound) as error:
        raise handle_error(error) from error


@router.post("/youtube/jobs/{slug}/upload", response_model=UploadIntentResponse)
async def queue_upload(
    slug: str,
    payload: UploadIntentCreate,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[VideoPipelineService, Depends(get_service)],
) -> UploadIntentResponse:
    """Queue a YouTube upload after the rendered video is ready."""
    try:
        service.create_upload_intent(slug, payload)
        return UploadIntentResponse(
            job=service.get_job(slug),
            message="YouTube 업로드가 큐에 등록되었습니다. 승인된 작업만 업로드됩니다.",
        )
    except (ValueError, VideoPipelineConflict, VideoPipelineNotFound) as error:
        raise handle_error(error) from error


@router.get("/youtube/provider-status", response_model=ProviderStatus)
async def provider_status(
    _: Annotated[User, Depends(require_admin)],
    request: Request,
) -> ProviderStatus:
    settings = request.app.state.video_pipeline_service.settings
    ffmpeg_configured = bool(settings.ffmpeg_binary.strip())
    youtube_oauth_configured = all(
        value.strip()
        for value in (
            settings.youtube_client_id,
            settings.youtube_client_secret,
            settings.youtube_refresh_token,
        )
    )
    return ProviderStatus(
        gemini_image_configured=bool(settings.gemini_api_key.strip()),
        narration_configured=bool(settings.google_cloud_access_token.strip())
        or importlib.util.find_spec("edge_tts") is not None,
        youtube_oauth_configured=youtube_oauth_configured,
        ffmpeg_configured=ffmpeg_configured,
    )
