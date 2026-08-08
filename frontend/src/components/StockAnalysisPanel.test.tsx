import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StockAnalysisPanel } from './StockAnalysisPanel';
import type { StockAnalysisRecord, StockAnalysisResult } from '../types';

const analysisResult: StockAnalysisResult = {
  ticker: '005930',
  name: '삼성전자',
  score: 80,
  rating: 'candidate',
  rating_label: '관심 후보',
  summary: '거래량 급증',
  ai_summary: 'AI 요약입니다',
  ai_powered: true,
  price_change_percent: 2.5,
  volume_multiplier: 2.1,
  signals: ['거래량 증가'],
  risk_notes: ['변동성 확대'],
  action_checklist: ['공시 확인'],
  disclaimer: '투자 조언이 아닙니다.',
};

const record: StockAnalysisRecord = {
  ...analysisResult,
  id: 1,
  memo: '실적 발표 전',
  created_at: '2026-01-01T00:00:00Z',
};

function baseProps() {
  return {
    analysisForm: {
      ticker: '005930',
      name: '삼성전자',
      current_price: '80000',
      previous_close: '78000',
      volume: '1000000',
      previous_volume: '500000',
      rsi: '60',
      macd: '1',
      macd_signal: '0.5',
      memo: '',
    },
    onFormChange: vi.fn(),
    onSubmit: vi.fn((event: FormEvent) => event.preventDefault()),
    onLoadMarketSnapshot: vi.fn(),
    marketLoading: false,
    analysisLoading: false,
    analysisMessage: null,
    marketSnapshot: null,
    analysisResult: null,
    topAnalysisCandidates: [],
    watchlistTickerSet: new Set<string>(),
    onCreateWatchlistFromAnalysis: vi.fn(),
    analysisRecordQuery: '',
    onQueryChange: vi.fn(),
    analysisRecordRatingFilter: 'all',
    onRatingFilterChange: vi.fn(),
    filteredAnalysisRecords: [record],
    analysisRecords: [record],
    onRefreshRecords: vi.fn(),
    creatingReportRecordId: null,
    onCreateReport: vi.fn(),
    deletingAnalysisRecordId: null,
    onDeleteRecord: vi.fn(),
  };
}

describe('StockAnalysisPanel', () => {
  it('does not render a result panel before analyzing', () => {
    render(<StockAnalysisPanel {...baseProps()} />);
    expect(screen.queryByText('AI 요약입니다')).not.toBeInTheDocument();
  });

  it('renders the analysis result once available', () => {
    render(<StockAnalysisPanel {...baseProps()} analysisResult={analysisResult} />);

    expect(screen.getByText('AI 요약입니다')).toBeInTheDocument();
    expect(screen.getByText('OpenAI 요약 사용')).toBeInTheDocument();
    expect(screen.getByText('거래량 증가')).toBeInTheDocument();
  });

  it('lists saved analysis records and calls onDeleteRecord', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockAnalysisPanel {...props} />);

    expect(screen.getByText(/실적 발표 전/)).toBeInTheDocument();
    await user.click(screen.getByTitle('분석 기록 삭제'));

    expect(props.onDeleteRecord).toHaveBeenCalledWith(1);
  });

  it('calls onCreateReport with the record id', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockAnalysisPanel {...props} />);

    await user.click(screen.getByRole('button', { name: /Report/ }));

    expect(props.onCreateReport).toHaveBeenCalledWith(1);
  });

  it('disables the watchlist-save button for records already on the watchlist', () => {
    render(
      <StockAnalysisPanel {...baseProps()} watchlistTickerSet={new Set(['005930'])} />,
    );
    expect(screen.getByRole('button', { name: /관심/ })).toBeDisabled();
  });

  it('calls onQueryChange when typing in the search box', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockAnalysisPanel {...props} />);

    await user.type(screen.getByPlaceholderText('종목명/코드 검색'), 'a');

    expect(props.onQueryChange).toHaveBeenCalledWith('a');
  });

  it('shows the top-candidates leaderboard when there are any', () => {
    render(<StockAnalysisPanel {...baseProps()} topAnalysisCandidates={[record]} />);
    expect(screen.getByText('추천 후보 상위 기록')).toBeInTheDocument();
  });

  it('calls onSubmit when submitting the analysis form', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockAnalysisPanel {...props} />);

    await user.click(screen.getByRole('button', { name: /분석 실행/ }));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });
});
