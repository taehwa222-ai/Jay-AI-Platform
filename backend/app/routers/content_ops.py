from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.routers.auth import require_content_ops_access as get_current_user
from app.schemas.content_ops import (
    ContentDocument,
    ContentDocumentUpdate,
    EmoticonProjectDetail,
    EmoticonProjectSummary,
    YoutubeProjectDetail,
    YoutubeProjectSummary,
)
from app.schemas.workspace import ContentVersionPublic
from app.services.auth import User
from app.services.content_ops import ContentOpsService
from app.services.workspace import WorkspaceService

router = APIRouter(prefix="/api/v1/content-ops", tags=["content-ops"])


def get_content_service(request: Request) -> ContentOpsService:
    return request.app.state.content_service


def get_workspace_service(request: Request) -> WorkspaceService:
    return request.app.state.workspace_service


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
    user: Annotated[User, Depends(get_current_user)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
    workspace_service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> ContentDocument:
    documents = content_service.list_documents(kind, slug)
    if documents is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    current = next((item for item in documents if item.filename == filename), None)
    if current is not None and current.content != payload.content:
        workspace_service.record_content_version(
            user, kind, slug, filename, current.content
        )
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


@router.get(
    "/documents/{kind}/{slug}/{filename}/versions",
    response_model=list[ContentVersionPublic],
)
async def list_document_versions(
    kind: str,
    slug: str,
    filename: str,
    _: Annotated[User, Depends(get_current_user)],
    workspace_service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> list[ContentVersionPublic]:
    return workspace_service.list_content_versions(kind, slug, filename)


@router.post(
    "/documents/{kind}/{slug}/{filename}/versions/{version_id}/restore",
    response_model=ContentDocument,
)
async def restore_document_version(
    kind: str,
    slug: str,
    filename: str,
    version_id: int,
    user: Annotated[User, Depends(get_current_user)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
    workspace_service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> ContentDocument:
    version = workspace_service.get_content_version(version_id)
    if (version.kind, version.slug, version.filename) != (kind, slug, filename):
        raise HTTPException(status_code=404, detail="Document version not found.")
    documents = content_service.list_documents(kind, slug)
    if documents is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    current = next((item for item in documents if item.filename == filename), None)
    if current is not None:
        workspace_service.record_content_version(
            user, kind, slug, filename, current.content
        )
    document = content_service.save_document(kind, slug, filename, version.content)
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
