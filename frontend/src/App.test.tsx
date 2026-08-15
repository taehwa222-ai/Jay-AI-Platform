import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import App, { buildAnalysisPayload, buildHoldingPayload } from './App';

const api = vi.hoisted(() => ({
  getHealth: vi.fn().mockResolvedValue({ ok: true, app: 'Jay AI', env: 'test', time: '' }),
  getMe: vi.fn(),
  getStockHoldings: vi.fn().mockResolvedValue([]),
  getStockWatchlist: vi.fn().mockResolvedValue([]),
  getStockAnalysisRecords: vi.fn().mockResolvedValue([]),
  getStockReports: vi.fn().mockResolvedValue([]),
}));

vi.mock('./api', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('./api')>();
  return { ...original, ...api };
});

const owner = {
  id: 1,
  email: 'owner@example.com',
  name: 'Owner',
  role: 'admin',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  last_login_at: null,
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  api.getMe.mockReset();
  api.getMe.mockResolvedValue(owner);
});

it('sends an unauthenticated visitor to the owner login', async () => {
  render(<App />);

  await waitFor(() => expect(window.location.hash).toBe('#auth'));
  expect(screen.getByRole('heading', { name: '대표 전용 로그인', level: 1 })).toBeInTheDocument();
  expect(screen.queryByText(/결제|요금제|Pro 업그레이드/)).not.toBeInTheDocument();
});

it('shows only the two business modules after owner session restore', async () => {
  localStorage.setItem('jay-ai-platform-token', 'owner-token');
  render(<App />);
  const nav = within(screen.getByRole('navigation', { name: 'Primary' }));

  await waitFor(() => expect(nav.getByRole('link', { name: /주식 분석 Lab/ })).toBeInTheDocument());
  expect(nav.getByRole('link', { name: /Content Ops/ })).toBeInTheDocument();
  expect(nav.getByRole('link', { name: /대표 계정/ })).toBeInTheDocument();
  expect(nav.queryByRole('link', { name: /관리자|수익화|대시보드/ })).not.toBeInTheDocument();
});

it('restores the last stock tab and opens quick navigation with Ctrl+K', async () => {
  const user = userEvent.setup();
  localStorage.setItem('jay-ai-platform-token', 'owner-token');
  localStorage.setItem('jay-ai-stock-tab', JSON.stringify('analysis'));
  window.history.replaceState(null, '', '/#stocks');
  render(<App />);

  const analysisTab = await screen.findByRole('tab', { name: /AI 분석/ });
  expect(analysisTab).toHaveAttribute('aria-selected', 'true');

  await user.keyboard('{Control>}k{/Control}');
  expect(screen.getByRole('dialog', { name: '빠른 이동' })).toBeInTheDocument();
  expect(screen.getByLabelText('명령 검색')).toHaveFocus();
});

it('shows compact stock operations and keeps the add form collapsed', async () => {
  localStorage.setItem('jay-ai-platform-token', 'owner-token');
  window.history.replaceState(null, '', '/#stocks');
  render(<App />);

  expect(await screen.findByLabelText('주식 데이터 동기화 상태')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /전체 동기화/ })).toBeInTheDocument();
  expect(screen.getByText('분석 미완료')).toBeInTheDocument();

  const addHolding = screen.getByText('보유종목 추가').closest('details');
  expect(addHolding).not.toHaveAttribute('open');
});

it('builds numeric stock payloads from form drafts', () => {
  expect(
    buildHoldingPayload({
      ticker: '005930',
      name: '삼성전자',
      quantity: '10',
      average_price: '70000',
      current_price: '75000',
      investment_thesis: 'memory cycle',
      risk_memo: 'fx',
    }).quantity,
  ).toBe(10);
  expect(
    buildAnalysisPayload({
      ticker: '005930',
      name: '삼성전자',
      current_price: '75000',
      previous_close: '74000',
      volume: '2000000',
      previous_volume: '1000000',
      rsi: '55',
      macd: '10',
      macd_signal: '8',
      memo: '',
    }).volume,
  ).toBe(2_000_000);
});
