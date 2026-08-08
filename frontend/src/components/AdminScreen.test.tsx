import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminScreen } from './AdminScreen';
import type { AdminUserUsage, ProUpgradeRequest, UserAccount } from '../types';

const metrics = {
  activeAdminCount: 1,
  activeMemberCount: 2,
  inactiveUserCount: 0,
  proUserCount: 3,
  freeUserCount: 4,
  totalAnalysisCount: 10,
  activeAnalysisUserCount: 5,
  latestAnalysisAt: null,
};

const member: UserAccount = {
  id: 2,
  email: 'member@example.com',
  name: '회원',
  role: 'member',
  plan: 'free',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  last_login_at: null,
};

const proRequest: ProUpgradeRequest = {
  id: 1,
  user_id: 2,
  email: 'member@example.com',
  name: '회원',
  current_plan: 'free',
  status: 'pending',
  message: 'Pro로 올려주세요',
  admin_note: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const usage: AdminUserUsage = { ...member, analysis_count: 5, latest_analysis_at: null };

function baseProps() {
  return {
    active: true,
    isAdmin: true,
    currentUserId: 1,
    metrics,
    adminContentStats: null,
    onRefreshContentStats: vi.fn(),
    adminProRequests: [proRequest],
    adminProRequestUpdatingId: null,
    onRefreshProRequests: vi.fn(),
    onUpdateProRequest: vi.fn(),
    adminUsers: [member],
    adminUpdatingId: null,
    adminMessage: null,
    onRefreshUsers: vi.fn(),
    onUpdateUser: vi.fn(),
    adminUsage: [usage],
    onRefreshUsage: vi.fn(),
  };
}

describe('AdminScreen (non-admin)', () => {
  it('shows a locked message in every pane instead of admin data', () => {
    render(<AdminScreen {...baseProps()} isAdmin={false} />);

    expect(screen.getByText('관리자 계정으로 로그인하면 콘텐츠 통계를 볼 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByText('관리자 계정으로 로그인하면 업그레이드 신청을 볼 수 있습니다.')).toBeInTheDocument();
    expect(
      screen.getByText('관리자 계정으로 로그인하면 회원 목록과 권한 설정을 볼 수 있습니다.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('관리자 계정으로 로그인하면 회원별 분석 사용량을 볼 수 있습니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('회원')).not.toBeInTheDocument();
  });
});

describe('AdminScreen (admin)', () => {
  it('renders the member metrics band', () => {
    render(<AdminScreen {...baseProps()} />);
    expect(screen.getByText('1명')).toBeInTheDocument();
    expect(screen.getByText('10회')).toBeInTheDocument();
  });

  it('calls onUpdateProRequest with approved when clicking 승인', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AdminScreen {...props} />);

    await user.click(screen.getByRole('button', { name: '승인' }));

    expect(props.onUpdateProRequest).toHaveBeenCalledWith(1, 'approved');
  });

  it('calls onUpdateProRequest with rejected when clicking 거절', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AdminScreen {...props} />);

    await user.click(screen.getByRole('button', { name: '거절' }));

    expect(props.onUpdateProRequest).toHaveBeenCalledWith(1, 'rejected');
  });

  it('calls onUpdateUser with the new role when the role select changes', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AdminScreen {...props} />);

    await user.selectOptions(screen.getByDisplayValue('member'), 'admin');

    expect(props.onUpdateUser).toHaveBeenCalledWith(2, { role: 'admin' });
  });

  it('calls onUpdateUser to toggle active state', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AdminScreen {...props} />);

    await user.click(screen.getByRole('button', { name: '비활성화' }));

    expect(props.onUpdateUser).toHaveBeenCalledWith(2, { is_active: false });
  });

  it('disables role/deactivate controls for the current admin account', () => {
    render(<AdminScreen {...baseProps()} currentUserId={2} />);

    expect(screen.getByDisplayValue('member')).toBeDisabled();
    expect(screen.getByRole('button', { name: '비활성화' })).toBeDisabled();
  });

  it('calls the refresh handlers', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AdminScreen {...props} />);

    const refreshButtons = screen.getAllByRole('button', { name: /새로고침/ });
    await user.click(refreshButtons[0]);

    expect(props.onRefreshContentStats).toHaveBeenCalledTimes(1);
  });
});
