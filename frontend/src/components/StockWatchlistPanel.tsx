import { BarChartOutlined, BookOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { FormEvent } from 'react';
import type { StockWatchlistItem } from '../types';

export type WatchlistForm = {
  ticker: string;
  name: string;
  note: string;
};

export function StockWatchlistPanel({
  watchlist,
  watchlistForm,
  onFormChange,
  onCreate,
  watchlistLoading,
  watchlistMessage,
  scanLoading,
  onScanWatchlist,
  prefillAnalysisLoadingKey,
  onAnalyze,
  quickAnalysisLoadingKey,
  onQuickAnalyze,
  deletingWatchlistId,
  onDelete,
}: {
  watchlist: StockWatchlistItem[];
  watchlistForm: WatchlistForm;
  onFormChange: (form: WatchlistForm) => void;
  onCreate: (event: FormEvent) => void;
  watchlistLoading: boolean;
  watchlistMessage: string | null;
  scanLoading: boolean;
  onScanWatchlist: () => void;
  prefillAnalysisLoadingKey: string | null;
  onAnalyze: (item: StockWatchlistItem) => void;
  quickAnalysisLoadingKey: string | null;
  onQuickAnalyze: (item: StockWatchlistItem) => void;
  deletingWatchlistId: number | null;
  onDelete: (itemId: number) => void;
}) {
  return (
    <article className="tool-pane stock-pane">
      <div className="pane-title">
        <BookOutlined />
        <h3>관심종목</h3>
      </div>
      <div className="pane-body">
        <details className="stock-form-disclosure">
          <summary>
            <span><PlusOutlined /> 관심종목 추가</span>
            <small>분석 전에 추적할 종목과 조건 메모 입력</small>
          </summary>
          <form className="watchlist-form" onSubmit={onCreate}>
          <label>
            <span>종목코드</span>
            <input
              onChange={(event) => onFormChange({ ...watchlistForm, ticker: event.target.value })}
              placeholder="005930"
              required
              value={watchlistForm.ticker}
            />
          </label>
          <label>
            <span>종목명</span>
            <input
              onChange={(event) => onFormChange({ ...watchlistForm, name: event.target.value })}
              placeholder="삼성전자"
              value={watchlistForm.name}
            />
          </label>
          <label className="wide-field">
            <span>메모</span>
            <input
              onChange={(event) => onFormChange({ ...watchlistForm, note: event.target.value })}
              placeholder="예: 거래량 급증 시 확인"
              value={watchlistForm.note}
            />
          </label>
          <button className="primary-button" disabled={watchlistLoading} type="submit">
            <PlusOutlined />
            관심종목 저장
          </button>
          <button
            className="secondary-button"
            disabled={scanLoading || watchlist.length === 0}
            onClick={onScanWatchlist}
            type="button"
          >
            <BarChartOutlined />
            관심종목 전체 스캔
          </button>
          </form>
        </details>

        <div className="watchlist-list">
          {watchlist.map((item) => (
            <div className="watchlist-row" key={item.id}>
              <div>
                <strong>
                  {item.name || item.ticker} <span>{item.ticker}</span>
                </strong>
                {item.note && <p>{item.note}</p>}
              </div>
              <button
                className="secondary-button row-action-button"
                disabled={prefillAnalysisLoadingKey === `watchlist-${item.id}`}
                onClick={() => onAnalyze(item)}
                type="button"
              >
                <BarChartOutlined />
                분석
              </button>
              <button
                className="primary-button row-action-button"
                disabled={quickAnalysisLoadingKey === `watchlist-${item.id}`}
                onClick={() => onQuickAnalyze(item)}
                type="button"
              >
                즉시
              </button>
              <button
                className="icon-danger-button"
                disabled={deletingWatchlistId === item.id}
                onClick={() => onDelete(item.id)}
                title="삭제"
                type="button"
              >
                <DeleteOutlined />
              </button>
            </div>
          ))}
          {watchlist.length === 0 && <div className="empty-state">아직 저장된 관심종목이 없습니다.</div>}
        </div>
        {watchlistMessage && <div className="inline-message">{watchlistMessage}</div>}
      </div>
    </article>
  );
}
