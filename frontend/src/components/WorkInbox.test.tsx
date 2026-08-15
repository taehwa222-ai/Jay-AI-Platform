import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkInbox } from './WorkInbox';

const api = vi.hoisted(() => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getTasks: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock('../api', () => api);

describe('WorkInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getTasks.mockResolvedValue([]);
    api.createTask.mockResolvedValue({
      id: 1,
      title: '배포 확인',
      description: '',
      status: 'todo',
      priority: 'normal',
      due_date: null,
      created_at: '2026-08-15T00:00:00Z',
      updated_at: '2026-08-15T00:00:00Z',
      completed_at: null,
    });
  });

  it('captures a task and displays it immediately', async () => {
    render(<WorkInbox active token="token" />);
    await waitFor(() => expect(api.getTasks).toHaveBeenCalledWith('token'));
    fireEvent.change(screen.getByLabelText('새 업무'), {
      target: { value: '배포 확인' },
    });
    fireEvent.click(screen.getByRole('button', { name: /추가/ }));
    await screen.findByText('배포 확인');
    expect(api.createTask).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ title: '배포 확인' }),
    );
  });
});
