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
  getAdminUsers: vi.fn().mockResolvedValue([]),
  getAuditLogs: vi.fn().mockResolvedValue([]),
  getOperations: vi.fn(),
  updateAdminUser: vi.fn(),
}));

vi.mock('./api', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('./api')>();
  return { ...original, ...api };
});

const owner = {
  id: 1,
  email: 'owner@example.com',
  name: 'Owner',
  role: 'owner',
  is_active: true,
  approval_status: 'approved',
  can_access_stocks: true,
  can_access_content_ops: true,
  created_at: '2026-01-01T00:00:00Z',
  last_login_at: null,
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  api.getMe.mockReset();
  api.getMe.mockResolvedValue(owner);
  api.getAdminUsers.mockClear();
});

it('sends an unauthenticated visitor to the internal team login', async () => {
  render(<App />);

  await waitFor(() => expect(window.location.hash).toBe('#auth'));
  expect(screen.getByRole('heading', { name: '사내 구성원 로그인', level: 1 })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /결제|요금제|Pro 업그레이드/ })).not.toBeInTheDocument();
});

it('shows only the two business modules after owner session restore', async () => {
  localStorage.setItem('jay-ai-platform-token', 'owner-token');
  render(<App />);
  const nav = within(screen.getByRole('navigation', { name: 'Primary' }));

  await waitFor(() => expect(nav.getByRole('link', { name: /주식 분석 Lab/ })).toBeInTheDocument());
  expect(nav.getByRole('link', { name: /Content Ops/ })).toBeInTheDocument();
  expect(nav.getByRole('link', { name: /운영 현황/ })).toBeInTheDocument();
  expect(nav.getByRole('link', { name: /사내 계정/ })).toBeInTheDocument();
  expect(nav.queryByRole('link', { name: /관리자|수익화|대시보드/ })).not.toBeInTheDocument();
});

it('logs out an active session without rendering the click event', async () => {
  const user = userEvent.setup();
  localStorage.setItem('jay-ai-platform-token', 'owner-token');
  window.history.replaceState(null, '', '/#auth');
  render(<App />);

  expect((await screen.findAllByText('owner@example.com')).length).toBeGreaterThan(0);
  await user.click(screen.getAllByRole('button', { name: /로그아웃/ }).at(-1)!);
  expect(await screen.findByRole('heading', { name: '사내 계정 가입 신청' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('로그아웃되었습니다.');
});

it('hides administrator notification controls from members', async () => {
  api.getMe.mockResolvedValue({ ...owner, id: 2, role: 'member' });
  localStorage.setItem('jay-ai-platform-token', 'member-token');
  window.history.replaceState(null, '', '/#stocks');
  render(<App />);

  expect(await screen.findByRole('tab', { name: /보유종목/ })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /알림 센터/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /운영 현황/ })).not.toBeInTheDocument();
  expect(api.getAdminUsers).not.toHaveBeenCalled();
});

it('shows members only the modules granted by the owner', async () => {
  api.getMe.mockResolvedValue({
    ...owner,
    id: 2,
    role: 'member',
    can_access_stocks: true,
    can_access_content_ops: false,
  });
  localStorage.setItem('jay-ai-platform-token', 'member-token');
  window.history.replaceState(null, '', '/#contentOps');
  render(<App />);

  await waitFor(() => expect(window.location.hash).toBe('#auth'));
  const nav = within(screen.getByRole('navigation', { name: 'Primary' }));
  expect(nav.getByRole('link', { name: /주식 분석 Lab/ })).toBeInTheDocument();
  expect(nav.queryByRole('link', { name: /Content Ops/ })).not.toBeInTheDocument();
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
