import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StockMarketPanel } from './StockMarketPanel';
import type { StockReportMarketItem } from '../types';

const publishedReport: StockReportMarketItem = {
  id: 1,
  analysis_record_id: 1,
  ticker: '005930',
  name: '삼성전자',
  title: '삼성전자 리포트',
  body: 'report body',
  score: 80,
  rating: 'candidate',
  rating_label: '관심 후보',
  report_type: 'analysis',
  access_level: 'free',
  is_published: true,
  created_at: '2026-01-01T00:00:00Z',
  can_view: true,
  locked_reason: '',
};

describe('StockMarketPanel', () => {
  it('shows an empty state when there are no market reports', () => {
    render(<StockMarketPanel marketMessage={null} marketReports={[]} onRefresh={vi.fn()} />);
    expect(
      screen.getByText('Published stock reports will appear here after you publish drafts.'),
    ).toBeInTheDocument();
  });

  it('renders a viewable report body', () => {
    render(
      <StockMarketPanel marketMessage={null} marketReports={[publishedReport]} onRefresh={vi.fn()} />,
    );
    expect(screen.getByText('삼성전자 리포트')).toBeInTheDocument();
    expect(screen.getByText('report body')).toBeInTheDocument();
  });

  it('shows a locked placeholder instead of the body when can_view is false', () => {
    render(
      <StockMarketPanel
        marketMessage={null}
        marketReports={[{ ...publishedReport, can_view: false, locked_reason: 'Pro 전용입니다' }]}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText('Pro members only')).toBeInTheDocument();
    expect(screen.getByText('Pro 전용입니다')).toBeInTheDocument();
    expect(screen.queryByText('report body')).not.toBeInTheDocument();
  });

  it('calls onRefresh when the refresh button is clicked', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(<StockMarketPanel marketMessage={null} marketReports={[]} onRefresh={onRefresh} />);

    await user.click(screen.getByRole('button', { name: /Refresh/ }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
