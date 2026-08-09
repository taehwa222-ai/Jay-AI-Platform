import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const { member, confirmPayment } = vi.hoisted(() => ({
  member: {
    id: 1,
    email: 'member@example.com',
    name: 'Member',
    role: 'member' as const,
    plan: 'free' as const,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    last_login_at: null,
  },
  confirmPayment: vi.fn().mockResolvedValue({
    id: 1,
    order_id: 'order-1',
    amount: 9900,
    status: 'approved',
    created_at: '2026-01-01T00:00:00Z',
    approved_at: '2026-01-01T00:00:00Z',
  }),
}));

vi.mock('./api', () => ({
  getHealth: vi.fn().mockResolvedValue({ ok: true, app: 'Jay AI Platform', env: 'test', time: '' }),
  getOverview: vi.fn().mockResolvedValue({
    name: 'Jay AI Platform',
    status: 'ready',
    message: 'ready message',
    modules: [],
  }),
  getModules: vi.fn().mockResolvedValue([]),
  getManual: vi.fn().mockResolvedValue([]),
  getMonetizationIdeas: vi.fn().mockResolvedValue([]),
  getRoadmap: vi.fn().mockResolvedValue([]),
  getMe: vi.fn().mockResolvedValue(member),
  getStockHoldings: vi.fn().mockResolvedValue([]),
  getStockWatchlist: vi.fn().mockResolvedValue([]),
  getStockAnalysisRecords: vi.fn().mockResolvedValue([]),
  getStockReports: vi.fn().mockResolvedValue([]),
  getStockReportMarket: vi.fn().mockResolvedValue([]),
  getMyProRequest: vi.fn().mockResolvedValue(null),
  confirmPayment,
}));

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    confirmPayment.mockClear();
  });

  it('renders navigation links for every top-level view', async () => {
    render(<App />);
    const nav = within(screen.getByRole('navigation', { name: 'Primary' }));

    expect(nav.getByRole('link', { name: /대시보드/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /로그인/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /관리자/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /사용 매뉴얼/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /국내주식/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /콘텐츠 운영/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /수익화/ })).toBeInTheDocument();
  });

  it('shows the server status once the health check resolves', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText('server online')).toBeInTheDocument());
  });

  it('confirms a payment on return from Toss and shows the result', async () => {
    localStorage.setItem('jay-ai-platform-token', 'test-token');
    window.history.replaceState(
      null,
      '',
      '/?paymentKey=pk_test_1&orderId=order-1&amount=9900#auth',
    );

    render(<App />);

    await waitFor(() =>
      expect(confirmPayment).toHaveBeenCalledWith('test-token', {
        order_id: 'order-1',
        payment_key: 'pk_test_1',
        amount: 9900,
      }),
    );
    await waitFor(() =>
      expect(screen.getByText('결제가 완료되어 Pro로 업그레이드되었습니다.')).toBeInTheDocument(),
    );
    expect(window.location.search).toBe('');
  });
});
