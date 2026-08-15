import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { UserAccount } from '../types';
import { AuthScreen } from './AuthScreen';

const owner: UserAccount = {
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

function props() {
  return {
    active: true,
    currentUser: null,
    onLogout: vi.fn(),
    authMode: 'signup' as const,
    onAuthModeChange: vi.fn(),
    name: '',
    onNameChange: vi.fn(),
    email: '',
    onEmailChange: vi.fn(),
    password: '',
    onPasswordChange: vi.fn(),
    authLoading: false,
    authMessage: null,
    onSubmit: vi.fn(),
    adminUsers: [],
    adminUsersLoading: false,
    adminUpdatingId: null,
    adminMessage: null,
    onRefreshAdminUsers: vi.fn(),
    onUpdateAdminUser: vi.fn(),
    auditLogs: [],
    onRevokeUserSessions: vi.fn(),
    onResetUserPassword: vi.fn(),
    onChangePassword: vi.fn(),
    onRevokeOwnSessions: vi.fn(),
  };
}

it('shows the internal team signup form without billing controls', () => {
  render(<AuthScreen {...props()} />);

  expect(screen.getByRole('heading', { name: '사내 구성원 로그인' })).toBeInTheDocument();
  expect(screen.getByLabelText('이름')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '가입 신청' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Pro|결제|요금제/ })).not.toBeInTheDocument();
});

it('switches to login mode and shows the owner session with user management', async () => {
  const user = userEvent.setup();
  const base = props();
  const { rerender } = render(<AuthScreen {...base} />);
  await user.click(screen.getByRole('tab', { name: /로그인$/ }));
  expect(base.onAuthModeChange).toHaveBeenCalledWith('login');

  rerender(<AuthScreen {...base} currentUser={owner} />);
  expect(screen.getByText('owner@example.com')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '사내 사용자 관리' })).toBeInTheDocument();
  await user.click(screen.getAllByRole('button', { name: /로그아웃/ }).at(-1)!);
  expect(base.onLogout).toHaveBeenCalled();
});
