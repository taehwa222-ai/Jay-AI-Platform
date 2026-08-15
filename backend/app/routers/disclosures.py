from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.routers.auth import require_stock_access as get_current_user
from app.schemas.disclosures import DisclosureItem
from app.services.auth import User
from app.services.disclosures import DisclosureService

router = APIRouter(prefix="/api/v1/disclosures", tags=["disclosures"])


def get_disclosure_service(request: Request) -> DisclosureService:
    return request.app.state.disclosure_service


@router.get("/{ticker}", response_model=list[DisclosureItem])
async def recent_disclosures(
    ticker: str,
    _: Annotated[User, Depends(get_current_user)],
    disclosure_service: Annotated[DisclosureService, Depends(get_disclosure_service)],
) -> list[DisclosureItem]:
    disclosures = await disclosure_service.get_recent_disclosures(ticker)
    return [DisclosureItem(**disclosure.__dict__) for disclosure in disclosures]
