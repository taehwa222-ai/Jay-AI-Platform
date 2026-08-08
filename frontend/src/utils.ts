export function parseTickerList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export function toNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  return Number((value ?? '').replaceAll(',', ''));
}

export function formatWon(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatPlainPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'stock';
}
