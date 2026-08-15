import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { NotificationCenterPanel } from './NotificationCenterPanel';

const api = vi.hoisted(() => ({
  getNotificationStatus: vi.fn(),
  retryNotification: vi.fn(),
  sendDisclosureNotification: vi.fn(),
  sendTelegramTest: vi.fn(),
}));

vi.mock('../api', () => api);

const center = {
  configured: true,
  chat_target: '••••5678',
  ai_daily_count: 12,
  ai_daily_limit: 100,
  events: [
    {
      id: 2,
      event_type: 'analysis_complete',
      title: '삼성전자 AI 분석 완료',
      status: 'sent',
      item_count: 1,
      error_message: null,
      attempt_count: 1,
      created_at: '2026-08-15T01:00:00Z',
      last_attempt_at: '2026-08-15T01:00:00Z',
    },
    {
      id: 1,
      event_type: 'connection_test',
      title: '텔레그램 연결 테스트',
      status: 'failed',
      item_count: 0,
      error_message: 'timeout',
      attempt_count: 1,
      created_at: '2026-08-15T00:00:00Z',
      last_attempt_at: '2026-08-15T00:00:00Z',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getNotificationStatus.mockResolvedValue(center);
  api.retryNotification.mockResolvedValue({ configured: true, sent: true, item_count: 0 });
  api.sendDisclosureNotification.mockResolvedValue({ configured: true, sent: true, item_count: 1 });
  api.sendTelegramTest.mockResolvedValue({ configured: true, sent: true, item_count: 0 });
});

it('shows Telegram configuration, AI usage, and delivery history', async () => {
  render(<NotificationCenterPanel token="owner-token" />);

  expect(await screen.findByText('연결됨')).toBeInTheDocument();
  expect(screen.getByText('12 / 100')).toBeInTheDocument();
  expect(screen.getByText('삼성전자 AI 분석 완료')).toBeInTheDocument();
  expect(screen.getByText('timeout')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /재시도/ })).toBeInTheDocument();
});

it('runs test, disclosure, and retry actions then refreshes the center', async () => {
  const user = userEvent.setup();
  render(<NotificationCenterPanel token="owner-token" />);
  await screen.findByText('연결됨');

  await user.click(screen.getByRole('button', { name: /연결 테스트/ }));
  await user.clear(screen.getByLabelText('공시 알림 종목코드'));
  await user.type(screen.getByLabelText('공시 알림 종목코드'), '000660');
  await user.click(screen.getByRole('button', { name: /주요 공시 확인/ }));
  await user.click(screen.getByRole('button', { name: /재시도/ }));

  await waitFor(() => {
    expect(api.sendTelegramTest).toHaveBeenCalledWith('owner-token');
    expect(api.sendDisclosureNotification).toHaveBeenCalledWith('owner-token', '000660');
    expect(api.retryNotification).toHaveBeenCalledWith('owner-token', 1);
  });
  expect(api.getNotificationStatus).toHaveBeenCalledTimes(4);
});
