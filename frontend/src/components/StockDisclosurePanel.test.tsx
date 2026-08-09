import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StockDisclosurePanel } from './StockDisclosurePanel';
import type { Disclosure } from '../types';

const disclosure: Disclosure = {
  title: '사업보고서',
  date: '2026-02-01',
  receipt_no: '20260201000001',
  url: 'https://dart.fss.or.kr/dsaf001/main.do?rcptNo=20260201000001',
};

function baseProps() {
  return {
    ticker: '005930',
    onTickerChange: vi.fn(),
    onSearch: vi.fn((event: FormEvent) => event.preventDefault()),
    loading: false,
    message: null,
    disclosures: [],
  };
}

describe('StockDisclosurePanel', () => {
  it('shows an empty state before any search', () => {
    render(<StockDisclosurePanel {...baseProps()} />);
    expect(
      screen.getByText('종목코드를 입력하고 조회하면 최근 1년 공시가 표시됩니다.'),
    ).toBeInTheDocument();
  });

  it('lists disclosures with a link to the DART original', () => {
    render(<StockDisclosurePanel {...baseProps()} disclosures={[disclosure]} />);

    expect(screen.getByText('사업보고서')).toBeInTheDocument();
    expect(screen.getByText('2026-02-01')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /DART 원문 보기/ })).toHaveAttribute(
      'href',
      disclosure.url,
    );
  });

  it('calls onTickerChange as the user types', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockDisclosurePanel {...props} ticker="" />);

    await user.type(screen.getByPlaceholderText('005930'), '0');

    expect(props.onTickerChange).toHaveBeenCalledWith('0');
  });

  it('calls onSearch on submit', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<StockDisclosurePanel {...props} />);

    await user.click(screen.getByRole('button', { name: /공시 조회/ }));

    expect(props.onSearch).toHaveBeenCalledTimes(1);
  });

  it('shows the message when one is set', () => {
    render(<StockDisclosurePanel {...baseProps()} message="공시 1건을 찾았습니다." />);
    expect(screen.getByText('공시 1건을 찾았습니다.')).toBeInTheDocument();
  });
});
