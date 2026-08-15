import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

it('filters commands and runs the selected command with the keyboard', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const openContent = vi.fn();
  render(
    <CommandPalette
      commands={[
        {
          id: 'stocks',
          label: '주식 분석 Lab 열기',
          description: '포트폴리오 화면',
          group: '화면 이동',
          icon: <span>S</span>,
          onSelect: vi.fn(),
        },
        {
          id: 'content',
          label: 'Content Ops 열기',
          description: 'Markdown 편집기',
          group: '화면 이동',
          icon: <span>C</span>,
          onSelect: openContent,
        },
      ]}
      onClose={onClose}
      open
    />,
  );

  const search = screen.getByLabelText('명령 검색');
  await user.type(search, 'markdown');
  expect(screen.queryByText('주식 분석 Lab 열기')).not.toBeInTheDocument();
  await user.keyboard('{Enter}');

  expect(openContent).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});
