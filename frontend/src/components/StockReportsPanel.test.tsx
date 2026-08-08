import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StockReportsPanel } from './StockReportsPanel';
import type { StockReport } from '../types';

const draftReport: StockReport = {
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
  access_level: 'private',
  is_published: false,
  created_at: '2026-01-01T00:00:00Z',
};

function baseProps() {
  return {
    reportMessage: null,
    stockReports: [draftReport],
    onRefresh: vi.fn(),
    updatingReportPublishId: null,
    onUpdatePublish: vi.fn(),
    downloadingReportId: null,
    onDownload: vi.fn(),
    deletingReportId: null,
    onDelete: vi.fn(),
  };
}

describe('StockReportsPanel', () => {
  it('shows an empty state when there are no drafts', () => {
    render(<StockReportsPanel {...baseProps()} stockReports={[]} />);
    expect(
      screen.getByText('Create a report from a saved analysis record to build paid content drafts.'),
    ).toBeInTheDocument();
  });

  it('shows Publish Pro for a private draft and Hide for a published one', () => {
    const { rerender } = render(<StockReportsPanel {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Publish Pro' })).toBeInTheDocument();

    rerender(
      <StockReportsPanel
        {...baseProps()}
        stockReports={[{ ...draftReport, is_published: true, access_level: 'pro' }]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });

  it('calls onUpdatePublish with pro/true when clicking Publish Pro', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockReportsPanel {...props} />);

    await user.click(screen.getByRole('button', { name: 'Publish Pro' }));

    expect(props.onUpdatePublish).toHaveBeenCalledWith(draftReport, 'pro', true);
  });

  it('calls onDelete with the report id', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockReportsPanel {...props} />);

    await user.click(screen.getByTitle('Delete report'));

    expect(props.onDelete).toHaveBeenCalledWith(1);
  });

  it('calls onDownload with the report', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockReportsPanel {...props} />);

    await user.click(screen.getByRole('button', { name: /Download \.md/ }));

    expect(props.onDownload).toHaveBeenCalledWith(draftReport);
  });
});
