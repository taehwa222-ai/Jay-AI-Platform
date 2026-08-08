import { describe, expect, it } from 'vitest';
import {
  formatDateTime,
  formatPercent,
  formatPlainPercent,
  formatWon,
  parseTickerList,
  safeFileName,
  toNumber,
} from './utils';

describe('toNumber', () => {
  it('parses plain numeric strings', () => {
    expect(toNumber('42')).toBe(42);
  });

  it('strips thousands separators', () => {
    expect(toNumber('1,234,567')).toBe(1234567);
  });

  it('passes numbers through unchanged', () => {
    expect(toNumber(3.5)).toBe(3.5);
  });

  it('treats empty/undefined input as 0', () => {
    expect(toNumber('')).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
});

describe('formatWon', () => {
  it('rounds and appends the won suffix with Korean thousands separators', () => {
    expect(formatWon(1234567.6)).toBe('1,234,568원');
  });

  it('handles zero', () => {
    expect(formatWon(0)).toBe('0원');
  });
});

describe('formatPercent', () => {
  it('prefixes a plus sign for positive values', () => {
    expect(formatPercent(12.345)).toBe('+12.35%');
  });

  it('does not add a sign for negative values (native minus is kept)', () => {
    expect(formatPercent(-5)).toBe('-5.00%');
  });

  it('does not add a plus sign for zero', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });
});

describe('formatPlainPercent', () => {
  it('never adds a sign', () => {
    expect(formatPlainPercent(12.345)).toBe('12.35%');
    expect(formatPlainPercent(-5)).toBe('-5.00%');
  });
});

describe('parseTickerList', () => {
  it('splits on commas and whitespace, uppercases, and dedupes', () => {
    expect(parseTickerList('005930, 000660  005930\n035420')).toEqual([
      '005930',
      '000660',
      '035420',
    ]);
  });

  it('returns an empty array for blank input', () => {
    expect(parseTickerList('   ')).toEqual([]);
  });
});

describe('safeFileName', () => {
  it('replaces unsafe characters with dashes and trims edge dashes', () => {
    expect(safeFileName('삼성전자 report (2026).pdf')).toBe('report-2026-pdf');
  });

  it('falls back to "stock" when nothing safe remains', () => {
    expect(safeFileName('삼성전자')).toBe('stock');
  });
});

describe('formatDateTime', () => {
  it('returns the original string when it cannot be parsed as a date', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });

  it('formats a valid ISO string without throwing', () => {
    expect(formatDateTime('2026-01-02T03:04:00Z')).not.toBe('2026-01-02T03:04:00Z');
  });
});
