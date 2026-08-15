import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import FileResponse

from app.routers.auth import get_current_user, require_admin, require_stock_access
from app.schemas.workspace import (
    BackupActionResponse,
    BackupPublic,
    DataStatus,
    GlobalSearchResponse,
    RestoreRequest,
    RestoreResponse,
    StockBriefingPublic,
    TaskCreateRequest,
    TaskPublic,
    TaskUpdateRequest,
)
from app.services.auth import User
from app.services.content_ops import ContentOpsService
from app.services.workspace import WorkspaceService

router = APIRouter(prefix="/api/v1/workspace", tags=["workspace"])


def get_workspace_service(request: Request) -> WorkspaceService:
    return request.app.state.workspace_service


def get_content_service(request: Request) -> ContentOpsService:
    return request.app.state.content_service


@router.get("/search", response_model=GlobalSearchResponse)
async def global_search(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
    content_service: Annotated[ContentOpsService, Depends(get_content_service)],
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
) -> GlobalSearchResponse:
    results = await asyncio.to_thread(service.search, user, content_service, q, limit)
    return GlobalSearchResponse(query=q, results=results)


@router.get("/tasks", response_model=list[TaskPublic])
async def list_tasks(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> list[TaskPublic]:
    return service.list_tasks(user)


@router.post("/tasks", response_model=TaskPublic, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> TaskPublic:
    return service.create_task(user, payload)


@router.patch("/tasks/{task_id}", response_model=TaskPublic)
async def update_task(
    task_id: int,
    payload: TaskUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> TaskPublic:
    return service.update_task(user, task_id, payload)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> Response:
    service.delete_task(user, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/stock-briefing", response_model=StockBriefingPublic)
async def stock_briefing(
    user: Annotated[User, Depends(require_stock_access)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
    refresh: bool = False,
) -> StockBriefingPublic:
    return service.get_or_create_briefing(user, refresh=refresh)


@router.get("/data", response_model=DataStatus)
async def data_status(
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> DataStatus:
    return service.data_status()


@router.post("/data/backups", response_model=BackupActionResponse)
async def create_backup(
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> BackupActionResponse:
    backup, created = service.create_backup()
    return BackupActionResponse(
        backup=backup,
        created=created,
        message=(
            "백업을 생성하고 무결성을 확인했습니다."
            if created
            else "오늘 백업이 이미 존재하며 정상입니다."
        ),
    )


@router.post("/data/backups/{filename}/verify", response_model=BackupPublic)
async def verify_backup(
    filename: str,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> BackupPublic:
    return service.verify_backup(filename)


@router.get("/data/backups/{filename}/download", response_class=FileResponse)
async def download_backup(
    filename: str,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> FileResponse:
    path = service.backup_path(filename)
    return FileResponse(path, filename=path.name, media_type="application/vnd.sqlite3")


@router.get("/data/export")
async def export_data(
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> Response:
    return Response(
        content=service.export_bundle(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=jay-ai-export.zip"},
    )


@router.post("/data/backups/{filename}/restore", response_model=RestoreResponse)
async def restore_backup(
    filename: str,
    payload: RestoreRequest,
    _: Annotated[User, Depends(require_admin)],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> RestoreResponse:
    safety_backup = service.restore_backup(filename, payload.confirmation)
    return RestoreResponse(
        restored_from=filename,
        safety_backup=safety_backup,
        message="복원을 완료했으며 복원 직전 안전 백업을 별도로 보존했습니다.",
    )
