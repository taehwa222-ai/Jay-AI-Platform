import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionTitle, SignalList, StatusTile } from './shared';

describe('StatusTile', () => {
  it('renders the label and value', () => {
    render(<StatusTile label="API" value="Online" />);
    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('applies the given tone as a class', () => {
    const { container } = render(<StatusTile label="API" value="Online" tone="good" />);
    expect(container.querySelector('.status-tile')).toHaveClass('good');
  });
});

describe('SectionTitle', () => {
  it('renders the eyebrow and title', () => {
    render(<SectionTitle eyebrow="Access" icon={null} title="로그인" />);
    expect(screen.getByText('Access')).toBeInTheDocument();
    expect(screen.getByText('로그인')).toBeInTheDocument();
  });
});

describe('SignalList', () => {
  it('renders the title and every item', () => {
    render(<SignalList title="긍정 신호" items={['거래량 증가', 'RSI 반등']} />);
    expect(screen.getByText('긍정 신호')).toBeInTheDocument();
    expect(screen.getByText('거래량 증가')).toBeInTheDocument();
    expect(screen.getByText('RSI 반등')).toBeInTheDocument();
  });
});
