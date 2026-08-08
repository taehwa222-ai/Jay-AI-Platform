import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ManualScreen } from './ManualScreen';
import type { ManualSection } from '../types';

const manual: ManualSection[] = [
  {
    id: 'local-setup',
    title: '1. 로컬 개발 환경 준비',
    summary: '처음 한 번만 의존성을 설치합니다.',
    commands: ['npm install'],
    checks: ['dependencies installed'],
  },
];

describe('ManualScreen', () => {
  it('renders each manual section with its commands and checks', () => {
    render(<ManualScreen active manual={manual} />);

    expect(screen.getByText('1. 로컬 개발 환경 준비')).toBeInTheDocument();
    expect(screen.getByText('npm install')).toBeInTheDocument();
    expect(screen.getByText('dependencies installed')).toBeInTheDocument();
  });

  it('hides the section when not active', () => {
    const { container } = render(<ManualScreen active={false} manual={manual} />);
    expect(container.querySelector('section')).toHaveClass('screen-hidden');
  });
});
