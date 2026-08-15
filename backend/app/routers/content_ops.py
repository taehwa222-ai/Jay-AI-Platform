from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.routers.auth import get_current_user
from app.schemas.content_ops import (
    ContentDocument,
    ContentDocumentUpdate,
    EmoticonProjectDetail,
    EmoticonProjectSummary,
    YoutubeProjectDetail,
    YoutubeProjectSummary,
)
from app.services.auth import User
from app.services.content_ops import ContentOpsService

router = APIRouter(prefix="/api/v1/content-ops", tags=["content-ops"])


def get_content_service(request: Request) -> ContentOpsService:
    return request.app.state.content_service


@router.get("/documents/{kind}/{slug}", response_model=list[ContentDocument])
async def list_documents(
    kind: str,
    slug: str,
    _: Annotated[User, Depends(get_current_user)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
) -> list[ContentDocument]:
    documents = content_service.list_documents(kind, slug)
    if documents is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return documents


@router.put("/documents/{kind}/{slug}/{filename}", response_model=ContentDocument)
async def save_document(
    kind: str,
    slug: str,
    filename: str,
    payload: ContentDocumentUpdate,
    _: Annotated[User, Depends(get_current_user)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
) -> ContentDocument:
    try:
        document = content_service.save_document(kind, slug, filename, payload.content)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    if document is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return document


@router.get("/youtube", response_model=list[YoutubeProjectSummary])
async def list_youtube_projects(
    _: Annotated[User, Depends(get_current_user)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
) -> list[YoutubeProjectSummary]:
    return content_service.list_youtube_projects()


@router.get("/youtube/{slug}", response_model=YoutubeProjectDetail)
async def get_youtube_project(
    slug: str,
    _: Annotated[User, Depends(get_current_user)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
) -> YoutubeProjectDetail:
    project = content_service.get_youtube_project(slug)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


@router.get("/emoticon", response_model=list[EmoticonProjectSummary])
async def list_emoticon_projects(
    _: Annotated[User, Depends(get_current_user)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
) -> list[EmoticonProjectSummary]:
    return content_service.list_emoticon_projects()


@router.get("/emoticon/{slug}", response_model=EmoticonProjectDetail)
async def get_emoticon_project(
    slug: str,
    _: Annotated[User, Depends(get_current_user)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
) -> EmoticonProjectDetail:
    project = content_service.get_emoticon_project(slug)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project
