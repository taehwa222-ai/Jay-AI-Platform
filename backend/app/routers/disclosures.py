from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.routers.auth import require_stock_access as get_current_user
from app.schemas.disclosures import DisclosureItem
from app.services.auth import User
from app.services.disclosures import DisclosureService
from app.services.workspace import WorkspaceService

router = APIRouter(prefix="/api/v1/disclosures", tags=["disclosures"])


def get_disclosure_service(request: Request) -> DisclosureService:
    return request.app.state.disclosure_service


def get_workspace_service(request: Request) -> WorkspaceService:
    return request.app.state.workspace_service


@router.get("/{ticker}", response_model=list[DisclosureItem])
async def recent_disclosures(
    ticker: str,
    user: Annotated[User, Depends(get_current_user)],
    disclosure_service: Annotated[DisclosureService, Depends(get_disclosure_service)],
    workspace_service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> list[DisclosureItem]:
    disclosures = await disclosure_service.get_recent_disclosures(ticker)
    workspace_service.record_disclosure_tasks(user, ticker, disclosures)
    return [DisclosureItem(**disclosure.__dict__) for disclosure in disclosures]
