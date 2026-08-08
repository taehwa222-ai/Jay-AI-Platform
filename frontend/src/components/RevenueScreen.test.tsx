import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RevenueScreen } from './RevenueScreen';
import type { MonetizationIdea } from '../types';

const ideas: MonetizationIdea[] = [
  {
    id: 'subscription',
    title: 'AI 투자 정보 구독',
    model: '월 구독 모델',
    risk: '규제 검토 필요',
    next_step: '리포트부터 설계',
  },
];

describe('RevenueScreen', () => {
  it('renders each idea title, model, risk, and next step', () => {
    render(<RevenueScreen active ideas={ideas} />);

    expect(screen.getByText('AI 투자 정보 구독')).toBeInTheDocument();
    expect(screen.getByText('월 구독 모델')).toBeInTheDocument();
    expect(screen.getByText('규제 검토 필요')).toBeInTheDocument();
    expect(screen.getByText('리포트부터 설계')).toBeInTheDocument();
  });

  it('hides the section when not active', () => {
    const { container } = render(<RevenueScreen active={false} ideas={ideas} />);
    expect(container.querySelector('section')).toHaveClass('screen-hidden');
  });
});
