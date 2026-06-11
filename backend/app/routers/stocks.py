from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.routers.auth import get_current_user
from app.schemas.stocks import (
    StockAnalysisRecordPublic,
    StockAnalysisRequest,
    StockAnalysisResponse,
    StockHoldingCreateRequest,
    StockHoldingPriceRefreshResponse,
    StockHoldingPublic,
    StockHoldingUpdateRequest,
    StockMarketSnapshot,
    StockReportPublic,
    StockReportPublishRequest,
    StockScanRequest,
    StockScanResponse,
    StockWatchlistCreateRequest,
    StockWatchlistItemPublic,
    StockWatchlistUpdateRequest,
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


@router.post("/holdings/refresh-prices", response_model=StockHoldingPriceRefreshResponse)
async def refresh_holding_prices(
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockHoldingPriceRefreshResponse:
    return await stock_service.refresh_holding_prices(user)


@router.delete("/holdings/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holding(
    holding_id: int,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> None:
    stock_service.delete_holding(holding_id, user)


@router.get("/watchlist", response_model=list[StockWatchlistItemPublic])
async def watchlist(
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> list[StockWatchlistItemPublic]:
    return stock_service.list_watchlist(user)


@router.post(
    "/watchlist",
    response_model=StockWatchlistItemPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_watchlist_item(
    payload: StockWatchlistCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockWatchlistItemPublic:
    return stock_service.create_watchlist_item(user, payload)


@router.patch("/watchlist/{item_id}", response_model=StockWatchlistItemPublic)
async def update_watchlist_item(
    item_id: int,
    payload: StockWatchlistUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockWatchlistItemPublic:
    return stock_service.update_watchlist_item(item_id, user, payload)


@router.delete("/watchlist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist_item(
    item_id: int,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> None:
    stock_service.delete_watchlist_item(item_id, user)


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
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockAnalysisResponse:
    return await stock_service.analyze(payload, user)


@router.get("/analysis-records", response_model=list[StockAnalysisRecordPublic])
async def analysis_records(
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> list[StockAnalysisRecordPublic]:
    return stock_service.list_analysis_records(user)


@router.delete("/analysis-records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_analysis_record(
    record_id: int,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> None:
    stock_service.delete_analysis_record(record_id, user)


@router.get("/reports", response_model=list[StockReportPublic])
async def reports(
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> list[StockReportPublic]:
    return stock_service.list_reports(user)


@router.post(
    "/reports/from-analysis/{record_id}",
    response_model=StockReportPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_report_from_analysis(
    record_id: int,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockReportPublic:
    return stock_service.create_report_from_analysis(record_id, user)


@router.patch("/reports/{report_id}/publish", response_model=StockReportPublic)
async def update_report_publish(
    report_id: int,
    payload: StockReportPublishRequest,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> StockReportPublic:
    return stock_service.update_report_publish(report_id, user, payload)


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: int,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> None:
    stock_service.delete_report(report_id, user)


@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: int,
    user: Annotated[User, Depends(get_current_user)],
    stock_service: Annotated[StockService, Depends(get_stock_service)],
) -> Response:
    filename, body = stock_service.export_report_markdown(report_id, user)
    return Response(
        content=body,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
