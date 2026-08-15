import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { StockReport } from '../types';
import { StockReportsPanel } from './StockReportsPanel';

const report: StockReport = {
  id: 1,
  analysis_record_id: 2,
  ticker: '005930',
  name: '삼성전자',
  title: '삼성전자 내부 분석',
  body: '# Internal report',
  score: 80,
  rating: 'candidate',
  rating_label: '후보',
  report_type: 'internal_analysis',
  created_at: '2026-08-15T00:00:00Z',
};

it('renders owner-only report actions without publishing controls', async () => {
  const user = userEvent.setup();
  const onDownload = vi.fn();
  render(
    <StockReportsPanel
      deletingReportId={null}
      downloadingReportId={null}
      onDelete={vi.fn()}
      onDownload={onDownload}
      onRefresh={vi.fn()}
      reportMessage={null}
      stockReports={[report]}
    />,
  );

  expect(screen.getByText('OWNER ONLY')).toBeInTheDocument();
  expect(screen.queryByText(/Publish|Pro members|Free members/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Markdown 저장/ }));
  expect(onDownload).toHaveBeenCalledWith(report);
});
