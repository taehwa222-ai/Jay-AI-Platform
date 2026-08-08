import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StockScanPanel } from './StockScanPanel';
import type { StockScanResult } from '../types';

const scanResult: StockScanResult = {
  candidates: [
    {
      ticker: '005930',
      name: '삼성전자',
      provider_symbol: '005930.KS',
      latest_trading_day: '2026-01-01',
      current_price: 80000,
      previous_close: 78000,
      price_change_percent: 2.5,
      volume_multiplier: 2.1,
      rsi: 60,
      macd: 1,
      macd_signal: 0.5,
      score: 80,
      rating: 'candidate',
      rating_label: '관심 후보',
      summary: '거래량 급증',
      signals: [],
      risk_notes: [],
    },
  ],
  failed: [{ ticker: '000000', reason: 'not found' }],
  disclaimer: '투자 조언이 아닙니다.',
};

function baseProps() {
  return {
    scanTickers: '005930',
    onScanTickersChange: vi.fn(),
    scanMemo: '',
    onScanMemoChange: vi.fn(),
    onScan: vi.fn((event: FormEvent) => event.preventDefault()),
    scanLoading: false,
    scanMessage: null,
    scanResult: null,
  };
}

describe('StockScanPanel', () => {
  it('renders without a result initially', () => {
    render(<StockScanPanel {...baseProps()} />);
    expect(screen.queryByText('투자 조언이 아닙니다.')).not.toBeInTheDocument();
  });

  it('renders scan candidates and failures once a result exists', () => {
    render(<StockScanPanel {...baseProps()} scanResult={scanResult} />);

    expect(screen.getByText('삼성전자')).toBeInTheDocument();
    expect(screen.getByText('조회 실패')).toBeInTheDocument();
    expect(screen.getByText('000000: not found')).toBeInTheDocument();
    expect(screen.getByText('투자 조언이 아닙니다.')).toBeInTheDocument();
  });

  it('calls onScanTickersChange as the user types', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockScanPanel {...props} scanTickers="" />);

    await user.type(screen.getByPlaceholderText('005930,000660,035720'), 'a');

    expect(props.onScanTickersChange).toHaveBeenCalledWith('a');
  });

  it('calls onScan on submit', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockScanPanel {...props} />);

    await user.click(screen.getByRole('button', { name: /후보 스캔 실행/ }));

    expect(props.onScan).toHaveBeenCalledTimes(1);
  });
});
