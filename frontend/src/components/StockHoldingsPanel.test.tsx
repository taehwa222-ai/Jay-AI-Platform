import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StockHoldingsPanel } from './StockHoldingsPanel';
import type { StockHolding } from '../types';

const holding: StockHolding = {
  id: 1,
  ticker: '005930',
  name: '삼성전자',
  quantity: 10,
  average_price: 70000,
  current_price: 80000,
  cost_basis: 700000,
  market_value: 800000,
  profit_loss: 100000,
  profit_loss_percent: 14.28,
  investment_thesis: '반도체 업황 회복',
  risk_memo: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function baseProps() {
  return {
    holdings: [holding],
    holdingForm: {
      ticker: '',
      name: '',
      quantity: '',
      average_price: '',
      current_price: '',
      investment_thesis: '',
      risk_memo: '',
    },
    onFormChange: vi.fn(),
    onCreate: vi.fn((event: FormEvent) => event.preventDefault()),
    holdingLoading: false,
    holdingMessage: null,
    holdingRefreshLoading: false,
    onRefreshPrices: vi.fn(),
    currentPriceDrafts: {},
    onCurrentPriceDraftChange: vi.fn(),
    savingCurrentPriceId: null,
    onSaveCurrentPrice: vi.fn(),
    prefillAnalysisLoadingKey: null,
    onAnalyze: vi.fn(),
    quickAnalysisLoadingKey: null,
    onQuickAnalyze: vi.fn(),
    onDelete: vi.fn(),
    portfolioTotals: { cost: 700000, value: 800000, profit: 100000 },
    portfolioProfitPercent: 14.28,
    portfolioBreakdown: [{ ...holding, allocationPercent: 100 }],
    maxHoldingProfitPercent: 14.28,
  };
}

describe('StockHoldingsPanel', () => {
  it('shows an empty state when there are no holdings', () => {
    render(
      <StockHoldingsPanel {...baseProps()} holdings={[]} portfolioBreakdown={[]} />,
    );
    expect(screen.getByText('아직 저장된 보유 종목이 없습니다.')).toBeInTheDocument();
  });

  it('lists a holding with its quantity and average price', () => {
    render(<StockHoldingsPanel {...baseProps()} />);
    expect(screen.getByText(/10주 · 평단 70,000원/)).toBeInTheDocument();
  });

  it('disables the refresh-prices button when there are no holdings', () => {
    render(
      <StockHoldingsPanel {...baseProps()} holdings={[]} portfolioBreakdown={[]} />,
    );
    expect(screen.getByRole('button', { name: /현재가 전체 갱신/ })).toBeDisabled();
  });

  it('calls onAnalyze with the holding when clicking 분석', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockHoldingsPanel {...props} />);

    await user.click(screen.getByRole('button', { name: /분석/ }));

    expect(props.onAnalyze).toHaveBeenCalledWith(holding);
  });

  it('calls onDelete with the holding id', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockHoldingsPanel {...props} />);

    await user.click(screen.getByTitle('삭제'));

    expect(props.onDelete).toHaveBeenCalledWith(1);
  });

  it('calls onCurrentPriceDraftChange when editing the price input', () => {
    const props = baseProps();
    render(<StockHoldingsPanel {...props} />);

    const priceInput = screen.getByDisplayValue('80000');
    fireEvent.change(priceInput, { target: { value: '90000' } });

    expect(props.onCurrentPriceDraftChange).toHaveBeenCalledWith(1, '90000');
  });
});
