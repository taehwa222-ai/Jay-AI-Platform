import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

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
}));

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
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
});
