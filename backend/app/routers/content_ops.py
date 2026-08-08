from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.routers.auth import require_admin
from app.schemas.content_ops import YoutubeProjectDetail, YoutubeProjectSummary
from app.services.auth import User
from app.services.content_ops import ContentOpsService

router = APIRouter(prefix="/api/v1/content-ops", tags=["content-ops"])


def get_content_service(request: Request) -> ContentOpsService:
    return request.app.state.content_service


@router.get("/youtube", response_model=list[YoutubeProjectSummary])
async def list_youtube_projects(
    _: Annotated[User, Depends(require_admin)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
) -> list[YoutubeProjectSummary]:
    return content_service.list_youtube_projects()


@router.get("/youtube/{slug}", response_model=YoutubeProjectDetail)
async def get_youtube_project(
    slug: str,
    _: Annotated[User, Depends(require_admin)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
) -> YoutubeProjectDetail:
    project = content_service.get_youtube_project(slug)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project
