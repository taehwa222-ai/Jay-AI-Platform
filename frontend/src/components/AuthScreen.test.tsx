import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthScreen } from './AuthScreen';
import type { UserAccount } from '../types';

const admin: UserAccount = {
  id: 1,
  email: 'admin@example.com',
  name: '관리자',
  role: 'admin',
  plan: 'free',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  last_login_at: null,
};

function baseProps() {
  return {
    active: true,
    currentUser: null,
    myProRequest: null,
    proRequestLoading: false,
    proRequestMessage: null,
    onCreateProRequest: vi.fn(),
    onStartPayment: vi.fn(),
    paymentLoading: false,
    paymentMessage: null,
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
    onSubmit: vi.fn((event: FormEvent) => event.preventDefault()),
  };
}

describe('AuthScreen (signed out)', () => {
  it('shows the signup form fields when authMode is signup', () => {
    render(<AuthScreen {...baseProps()} />);

    expect(screen.getByText('이름')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /계정 만들기/ })).toBeInTheDocument();
  });

  it('hides the name field in login mode', () => {
    render(<AuthScreen {...baseProps()} authMode="login" />);

    expect(screen.queryByText('이름')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('calls onAuthModeChange when switching to login', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AuthScreen {...props} />);

    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(props.onAuthModeChange).toHaveBeenCalledWith('login');
  });

  it('calls the field change handlers as the user types', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AuthScreen {...props} />);

    await user.type(screen.getByLabelText('이메일'), 'a');

    expect(props.onEmailChange).toHaveBeenCalledWith('a');
  });

  it('submits the form via onSubmit', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    // Login mode only requires email + password, so the native required-field
    // validation doesn't block the submit (signup also requires a name). The
    // segmented-control toggle also renders a "로그인" button, so the submit
    // button (icon-prefixed) is targeted directly rather than by name.
    const { container } = render(
      <AuthScreen {...props} authMode="login" email="a@b.com" password="password123" />,
    );
    const submitButton = container.querySelector('form button[type="submit"]');
    expect(submitButton).not.toBeNull();

    await user.click(submitButton as HTMLButtonElement);

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('AuthScreen (signed in)', () => {
  it('shows the account panel with plan and a pro upgrade button for free members', () => {
    render(<AuthScreen {...baseProps()} currentUser={admin} />);

    expect(screen.getByText('관리자')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pro 업그레이드 신청/ })).toBeInTheDocument();
  });

  it('shows a pending message instead of the upgrade button when a request is pending', () => {
    render(
      <AuthScreen
        {...baseProps()}
        currentUser={admin}
        myProRequest={{
          id: 1,
          user_id: admin.id,
          email: admin.email,
          name: admin.name,
          current_plan: 'free',
          message: 'please',
          status: 'pending',
          admin_note: '',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        }}
      />,
    );

    expect(
      screen.getByText('Pro 업그레이드 신청이 관리자 확인을 기다리고 있습니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pro 업그레이드 신청/ })).not.toBeInTheDocument();
  });

  it('calls onLogout when the logout button is clicked', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AuthScreen {...props} currentUser={admin} />);

    await user.click(screen.getByRole('button', { name: /로그아웃/ }));

    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });

  it('calls onStartPayment when the card-payment button is clicked', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AuthScreen {...props} currentUser={admin} />);

    await user.click(screen.getByRole('button', { name: /카드 결제로 즉시 업그레이드/ }));

    expect(props.onStartPayment).toHaveBeenCalledTimes(1);
  });

  it('hides both upgrade buttons while a manual request is pending', () => {
    render(
      <AuthScreen
        {...baseProps()}
        currentUser={admin}
        myProRequest={{
          id: 1,
          user_id: admin.id,
          email: admin.email,
          name: admin.name,
          current_plan: 'free',
          message: 'please',
          status: 'pending',
          admin_note: '',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        }}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /카드 결제로 즉시 업그레이드/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the payment message when one is set', () => {
    render(
      <AuthScreen {...baseProps()} currentUser={admin} paymentMessage="결제가 완료되었습니다." />,
    );

    expect(screen.getByText('결제가 완료되었습니다.')).toBeInTheDocument();
  });
});
