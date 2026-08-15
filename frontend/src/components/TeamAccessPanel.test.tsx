import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { UserAccount } from '../types';
import { TeamAccessPanel } from './TeamAccessPanel';

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

const pending: UserAccount = {
  id: 2,
  email: 'member@example.com',
  name: 'Member',
  role: 'member',
  is_active: false,
  approval_status: 'pending',
  can_access_stocks: false,
  can_access_content_ops: false,
  created_at: '2026-01-02T00:00:00Z',
  last_login_at: null,
};

it('lets the owner approve a pending member while protecting the owner row', async () => {
  const user = userEvent.setup();
  const onUpdate = vi.fn();
  render(
    <TeamAccessPanel
      currentUser={owner}
      auditLogs={[]}
      loading={false}
      message={null}
      onRefresh={vi.fn()}
      onResetPassword={vi.fn()}
      onRevokeSessions={vi.fn()}
      onUpdate={onUpdate}
      updatingId={null}
      users={[pending, owner]}
    />,
  );

  expect(screen.getByText('1', { selector: '.team-access-summary .pending strong' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /승인/ }));
  const confirmButton = screen.getAllByRole('button', { name: /승인/ }).at(-1);
  expect(confirmButton).toBeDefined();
  await user.click(confirmButton!);
  expect(onUpdate).toHaveBeenCalledWith(2, { is_active: true });
  expect(screen.getByLabelText('Owner 역할')).toBeDisabled();
});

it('filters users and lets the owner grant module access', async () => {
  const user = userEvent.setup();
  const onUpdate = vi.fn();
  render(
    <TeamAccessPanel
      currentUser={owner}
      auditLogs={[]}
      loading={false}
      message={null}
      onRefresh={vi.fn()}
      onResetPassword={vi.fn()}
      onRevokeSessions={vi.fn()}
      onUpdate={onUpdate}
      updatingId={null}
      users={[pending, owner]}
    />,
  );

  await user.type(screen.getByLabelText('사용자 검색'), 'member@');
  expect(screen.getByText('member@example.com')).toBeInTheDocument();
  expect(screen.queryByText('owner@example.com')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /주식 Lab/ }));
  expect(onUpdate).toHaveBeenCalledWith(2, { can_access_stocks: true });
});
