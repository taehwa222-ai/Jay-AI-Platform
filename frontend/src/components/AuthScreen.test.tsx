import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { UserAccount } from '../types';
import { AuthScreen } from './AuthScreen';

const owner: UserAccount = {
  id: 1,
  email: 'owner@example.com',
  name: 'Owner',
  role: 'admin',
  is_active: true,
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
  };
}

it('shows the one-time owner bootstrap form without billing controls', () => {
  render(<AuthScreen {...props()} />);

  expect(screen.getByRole('heading', { name: '대표 전용 로그인' })).toBeInTheDocument();
  expect(screen.getByLabelText('대표 이름')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '대표 계정 생성' })).toBeInTheDocument();
  expect(screen.queryByText(/Pro|결제|요금제/)).not.toBeInTheDocument();
});

it('switches to login mode and shows the owner session', async () => {
  const user = userEvent.setup();
  const base = props();
  const { rerender } = render(<AuthScreen {...base} />);
  await user.click(screen.getByRole('tab', { name: /로그인$/ }));
  expect(base.onAuthModeChange).toHaveBeenCalledWith('login');

  rerender(<AuthScreen {...base} currentUser={owner} />);
  expect(screen.getByText('owner@example.com')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /로그아웃/ }));
  expect(base.onLogout).toHaveBeenCalled();
});
