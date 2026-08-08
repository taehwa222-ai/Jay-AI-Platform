import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StockWatchlistPanel } from './StockWatchlistPanel';
import type { StockWatchlistItem } from '../types';

const item: StockWatchlistItem = {
  id: 1,
  ticker: '005930',
  name: '삼성전자',
  note: '거래량 급증 시 확인',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function baseProps() {
  return {
    watchlist: [item],
    watchlistForm: { ticker: '', name: '', note: '' },
    onFormChange: vi.fn(),
    onCreate: vi.fn((event: FormEvent) => event.preventDefault()),
    watchlistLoading: false,
    watchlistMessage: null,
    scanLoading: false,
    onScanWatchlist: vi.fn(),
    prefillAnalysisLoadingKey: null,
    onAnalyze: vi.fn(),
    quickAnalysisLoadingKey: null,
    onQuickAnalyze: vi.fn(),
    deletingWatchlistId: null,
    onDelete: vi.fn(),
  };
}

describe('StockWatchlistPanel', () => {
  it('shows an empty state when the watchlist is empty', () => {
    render(<StockWatchlistPanel {...baseProps()} watchlist={[]} />);
    expect(screen.getByText('아직 저장된 관심종목이 없습니다.')).toBeInTheDocument();
  });

  it('lists watchlist items with their note', () => {
    render(<StockWatchlistPanel {...baseProps()} />);
    expect(screen.getByText('거래량 급증 시 확인')).toBeInTheDocument();
  });

  it('calls onAnalyze with the item when clicking 분석', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockWatchlistPanel {...props} />);

    await user.click(screen.getByRole('button', { name: /분석/ }));

    expect(props.onAnalyze).toHaveBeenCalledWith(item);
  });

  it('calls onQuickAnalyze with the item when clicking 즉시', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockWatchlistPanel {...props} />);

    await user.click(screen.getByRole('button', { name: '즉시' }));

    expect(props.onQuickAnalyze).toHaveBeenCalledWith(item);
  });

  it('calls onDelete with the item id', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockWatchlistPanel {...props} />);

    await user.click(screen.getByTitle('삭제'));

    expect(props.onDelete).toHaveBeenCalledWith(1);
  });

  it('disables 전체 스캔 when the watchlist is empty', () => {
    render(<StockWatchlistPanel {...baseProps()} watchlist={[]} />);
    expect(screen.getByRole('button', { name: /관심종목 전체 스캔/ })).toBeDisabled();
  });
});
