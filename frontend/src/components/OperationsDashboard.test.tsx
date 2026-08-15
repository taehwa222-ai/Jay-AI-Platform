import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { OperationsOverview } from '../types';
import { OperationsDashboard } from './OperationsDashboard';

const api = vi.hoisted(() => ({ getOperations: vi.fn() }));

vi.mock('../api', () => api);

const overview: OperationsOverview = {
  generated_at: '2026-08-15T10:20:00Z',
  status: 'healthy',
  runtime: {
    started_at: '2026-08-15T09:20:00Z',
    uptime_seconds: 3_600,
    total_requests: 120,
    completed_requests: 119,
    in_flight_requests: 1,
    server_error_count: 0,
    telemetry_write_failures: 0,
    average_duration_ms: 28.4,
    status_counts: { '2xx': 119 },
  },
  database: {
    healthy: true,
    file_name: 'jay_ai_platform.db',
    journal_mode: 'wal',
    integrity_check: 'ok',
    size_bytes: 1_048_576,
    disk_free_bytes: 10_737_418_240,
    disk_free_percent: 72.5,
  },
  backup: {
    available: true,
    latest_file: 'jay_ai_platform-20260815.db',
    latest_created_at: '2026-08-15T00:00:00Z',
    age_hours: 10.3,
    backup_count: 8,
  },
  ai_usage: {
    today_count: 12,
    daily_limit: 100,
    remaining: 88,
    usage_percent: 12,
    history: [
      { usage_date: '2026-08-09', request_count: 4 },
      { usage_date: '2026-08-10', request_count: 8 },
      { usage_date: '2026-08-11', request_count: 2 },
      { usage_date: '2026-08-12', request_count: 0 },
      { usage_date: '2026-08-13', request_count: 7 },
      { usage_date: '2026-08-14', request_count: 10 },
      { usage_date: '2026-08-15', request_count: 12 },
    ],
  },
  caches: [
    {
      name: 'yahoo_market',
      ttl_seconds: 300,
      entries: 2,
      requests: 10,
      hits: 8,
      misses: 2,
      loads: 2,
      load_errors: 0,
      coalesced_waits: 0,
      hit_rate: 0.8,
      last_hit_at: '2026-08-15T10:19:00Z',
      last_miss_at: '2026-08-15T10:18:00Z',
      last_load_at: '2026-08-15T10:18:00Z',
    },
    {
      name: 'opendart_disclosures',
      ttl_seconds: 1_800,
      entries: 1,
      requests: 3,
      hits: 2,
      misses: 1,
      loads: 1,
      load_errors: 0,
      coalesced_waits: 0,
      hit_rate: 0.6667,
      last_hit_at: null,
      last_miss_at: null,
      last_load_at: null,
    },
  ],
  integrations: [
    { name: 'Yahoo Finance', configured: true, detail: 'Public market data endpoint' },
    { name: 'OpenDART', configured: false, detail: 'Disclosure API key' },
  ],
  errors_last_24h: 0,
  recent_errors: [],
};

beforeEach(() => {
  api.getOperations.mockReset();
  api.getOperations.mockResolvedValue(overview);
});

it('loads and renders the administrator operations overview', async () => {
  render(<OperationsDashboard active token="owner-token" />);

  expect(screen.getByRole('status')).toHaveTextContent('운영 지표를 수집하는 중');
  expect(await screen.findByText('정상 운영')).toBeInTheDocument();
  expect(screen.getByText('12 / 100')).toBeInTheDocument();
  expect(screen.getByText('jay_ai_platform.db · 1.00 MB')).toBeInTheDocument();
  expect(screen.getByText('Yahoo 시세')).toBeInTheDocument();
  expect(screen.getByText('80.0%')).toBeInTheDocument();
  expect(screen.getByText('기록된 서버 오류가 없습니다')).toBeInTheDocument();
  expect(api.getOperations).toHaveBeenCalledWith('owner-token');
});

it('refreshes the overview on demand', async () => {
  const user = userEvent.setup();
  render(<OperationsDashboard active token="owner-token" />);
  await screen.findByText('정상 운영');

  await user.click(screen.getByRole('button', { name: /새로고침/ }));
  await waitFor(() => expect(api.getOperations).toHaveBeenCalledTimes(2));
});

it('does not request administrator metrics while hidden', () => {
  render(<OperationsDashboard active={false} token="owner-token" />);
  expect(api.getOperations).not.toHaveBeenCalled();
});
