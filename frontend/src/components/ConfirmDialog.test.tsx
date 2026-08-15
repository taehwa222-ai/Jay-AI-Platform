import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

it('requires an explicit confirmation for a destructive action', async () => {
  const user = userEvent.setup();
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      confirmLabel="삭제"
      danger
      description="삼성전자 항목을 삭제합니다."
      onCancel={onCancel}
      onConfirm={onConfirm}
      open
      title="보유종목 삭제"
    />,
  );

  expect(screen.getByRole('dialog', { name: '보유종목 삭제' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '삭제' }));
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onCancel).not.toHaveBeenCalled();
});
