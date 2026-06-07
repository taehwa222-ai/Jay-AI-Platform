from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.routers.auth import get_current_user
from app.schemas.stocks import (
    StockAnalysisRequest,
    StockAnalysisResponse,
    StockHoldingCreateRequest,
    StockHoldingPublic,
    StockHoldingUpdateRequest,
    StockMarketSnapshot,
    StockScanRequest,
    StockScanResponse,
)
from app.services.auth import User
from app.services.stocks import StockService

router = APIRouter(prefix="/api/v1/stocks", tags=["stocks"])


def get_stock_service(request: Request) -> StockService:
    return request.app.state.stock_service


@router.get("/holdings", response_model=list[StockHoldingPublic])
async def holdings(
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> list[StockHoldingPublic]:
    return stock_service.list_holdings(user)


@router.post("/holdings", response_model=StockHoldingPublic, status_code=status.HTTP_201_CREATED)
async def create_holding(
    payload: StockHoldingCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockHoldingPublic:
    return stock_service.create_holding(user, payload)


@router.patch("/holdings/{holding_id}", response_model=StockHoldingPublic)
async def update_holding(
    holding_id: int,
    payload: StockHoldingUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockHoldingPublic:
    return stock_service.update_holding(holding_id, user, payload)


@router.delete("/holdings/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holding(
    holding_id: int,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> None:
    stock_service.delete_holding(holding_id, user)


@router.get("/market/{ticker}", response_model=StockMarketSnapshot)
async def market_snapshot(
    ticker: str,
    _: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockMarketSnapshot:
    return await stock_service.market_snapshot(ticker)


@router.post("/scan", response_model=StockScanResponse)
async def scan_stocks(
    payload: StockScanRequest,
    _: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockScanResponse:
    return await stock_service.scan(payload)


@router.post("/analyze", response_model=StockAnalysisResponse)
async def analyze_stock(
    payload: StockAnalysisRequest,
    _: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockAnalysisResponse:
    return await stock_service.analyze(payload)
