from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.routers.auth import require_admin
from app.schemas.operations import OperationsOverview
from app.services.auth import User
from app.services.operations import OperationsService

router = APIRouter(prefix="/api/v1/admin/operations", tags=["operations"])


@router.get("", response_model=OperationsOverview)
async def operations_overview(
    _: Annotated[User, Depends(require_admin)],
    request: Request,
) -> OperationsOverview:
    service: OperationsService = request.app.state.operations_service
    return service.overview(
        ai_guardrail=request.app.state.ai_guardrail,
        stock_service=request.app.state.stock_service,
        disclosure_service=request.app.state.disclosure_service,
        telegram_service=request.app.state.telegram_service,
    )
