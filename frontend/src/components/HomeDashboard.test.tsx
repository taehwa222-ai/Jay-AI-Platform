import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { OperationsOverview, UserAccount } from '../types';
import { HomeDashboard } from './HomeDashboard';

const api = vi.hoisted(() => ({
  getEmoticonProjects: vi.fn(),
  getOperations: vi.fn(),
  getYoutubeProjects: vi.fn(),
}));

vi.mock('../api', () => api);

const owner: UserAccount = {
  id: 1,
  email: 'owner@example.com',
  name: 'Jay',
  role: 'owner',
  is_active: true,
  approval_status: 'approved',
  can_access_stocks: true,
  can_access_content_ops: true,
  created_at: '2026-08-01T00:00:00Z',
  last_login_at: null,
};

const operations = {
  status: 'healthy',
  errors_last_24h: 0,
  ai_usage: { today_count: 12, daily_limit: 100 },
  database: { journal_mode: 'wal' },
} as OperationsOverview;

function props() {
  return {
    active: true,
    canAccessContentOps: true,
    canAccessStocks: true,
    canManageUsers: true,
    currentUser: owner,
    holdings: [{ market_value: 1_500_000 }],
    onOpenAccount: vi.fn(),
    onOpenContentOps: vi.fn(),
    onOpenOperations: vi.fn(),
    onOpenStocks: vi.fn(),
    pendingUserCount: 1,
    stockAnalysisRecords: [],
    token: 'owner-token',
    watchlist: [{ ticker: '005930', name: '삼성전자' }],
  } as unknown as ComponentProps<typeof HomeDashboard>;
}

beforeEach(() => {
  api.getYoutubeProjects.mockReset();
  api.getEmoticonProjects.mockReset();
  api.getOperations.mockReset();
  api.getYoutubeProjects.mockResolvedValue([{
    slug: '2026-08-15-trend',
    updated_at: '2026-08-15T10:00:00Z',
    has_production: false,
  }]);
  api.getEmoticonProjects.mockResolvedValue([]);
  api.getOperations.mockResolvedValue(operations);
});

it('collects stock, content, access and operations work into one home', async () => {
  const user = userEvent.setup();
  const input = props();
  render(<HomeDashboard {...input} />);

  expect(await screen.findByText('가입 승인 1건')).toBeInTheDocument();
  expect(screen.getByText('미분석 관심종목 1개')).toBeInTheDocument();
  expect(screen.getByText('진행 중 콘텐츠 1건')).toBeInTheDocument();
  expect(screen.getByText('1,500,000원')).toBeInTheDocument();
  expect(screen.getByText('2026-08-15-trend')).toBeInTheDocument();
  expect(api.getOperations).toHaveBeenCalledWith('owner-token');

  await user.click(screen.getByRole('button', { name: /가입 승인 1건/ }));
  await user.click(screen.getByRole('button', { name: /운영 현황/ }));
  expect(input.onOpenAccount).toHaveBeenCalledOnce();
  expect(input.onOpenOperations).toHaveBeenCalledOnce();
});

it('does not request administrator or content data without permission', async () => {
  const input = props();
  render(
    <HomeDashboard
      {...input}
      canAccessContentOps={false}
      canManageUsers={false}
      currentUser={{ ...owner, role: 'member', can_access_content_ops: false }}
    />,
  );

  expect(await screen.findByText('관리자 전용')).toBeInTheDocument();
  expect(screen.getByText('권한 없음')).toBeInTheDocument();
  expect(api.getOperations).not.toHaveBeenCalled();
  expect(api.getYoutubeProjects).not.toHaveBeenCalled();
  expect(api.getEmoticonProjects).not.toHaveBeenCalled();
});
