import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { StockBriefingPanel } from './StockBriefingPanel';

const api = vi.hoisted(() => ({
  getDailyStockRun: vi.fn(),
  getStockBriefing: vi.fn(),
  runDailyStockAutomation: vi.fn(),
}));

vi.mock('../api', () => api);

const briefing = {
  id: 1,
  briefing_date: '2026-08-15',
  title: '오늘의 주식 운영 브리핑',
  body: '보유 종목과 관심 종목을 확인하세요.',
  holding_count: 2,
  watchlist_count: 3,
  analysis_count: 1,
  created_at: '2026-08-15T01:00:00Z',
};

const dailyRun = {
  run_date: '2026-08-15',
  status: 'completed' as const,
  price_updated_count: 2,
  price_failed_count: 0,
  watchlist_count: 3,
  disclosure_count: 1,
  disclosure_failed_count: 0,
  task_created_count: 1,
  telegram_sent: true,
  summary: '시세 2건 갱신, 관심종목 3개 공시 확인, 검토 업무 1건 생성',
  started_at: '2026-08-15T01:00:00Z',
  completed_at: '2026-08-15T01:01:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getStockBriefing.mockResolvedValue(briefing);
  api.getDailyStockRun.mockResolvedValue(null);
  api.runDailyStockAutomation.mockResolvedValue({ run: dailyRun, already_ran: false });
});

it('shows the daily sync action before it has run', async () => {
  render(<StockBriefingPanel token="owner-token" />);

  expect(await screen.findByText('오늘의 시세·공시 동기화')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /오늘 동기화 실행/ })).toBeInTheDocument();
});

it('runs the daily stock automation and shows its result', async () => {
  const user = userEvent.setup();
  render(<StockBriefingPanel token="owner-token" />);
  await screen.findByRole('button', { name: /오늘 동기화 실행/ });

  await user.click(screen.getByRole('button', { name: /오늘 동기화 실행/ }));

  await waitFor(() => {
    expect(api.runDailyStockAutomation).toHaveBeenCalledWith('owner-token');
  });
  expect(await screen.findByText(/텔레그램 발송됨/)).toBeInTheDocument();
});
