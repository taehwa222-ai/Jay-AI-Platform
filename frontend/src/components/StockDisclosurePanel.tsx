import { FileSearchOutlined, LinkOutlined } from '@ant-design/icons';
import type { FormEvent } from 'react';
import type { Disclosure } from '../types';

export function StockDisclosurePanel({
  ticker,
  onTickerChange,
  onSearch,
  loading,
  message,
  disclosures,
}: {
  ticker: string;
  onTickerChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  loading: boolean;
  message: string | null;
  disclosures: Disclosure[];
}) {
  return (
    <article className="tool-pane stock-pane">
      <div className="pane-title">
        <FileSearchOutlined />
        <h3>OpenDART 공시 조회</h3>
      </div>
      <div className="pane-body">
        <form className="scan-form" onSubmit={onSearch}>
          <label>
            <span>종목코드</span>
            <input
              onChange={(event) => onTickerChange(event.target.value)}
              placeholder="005930"
              required
              value={ticker}
            />
          </label>
          <button className="primary-button" disabled={loading} type="submit">
            <FileSearchOutlined />
            {loading ? '조회 중' : '공시 조회'}
          </button>
        </form>

        {message && <div className="inline-message">{message}</div>}

        <div className="report-list">
          {disclosures.map((disclosure) => (
            <article className="report-card" key={disclosure.receipt_no}>
              <div className="report-head">
                <div>
                  <strong>{disclosure.title}</strong>
                  <small>{disclosure.date}</small>
                </div>
              </div>
              <a href={disclosure.url} rel="noreferrer" target="_blank">
                <LinkOutlined />
                DART 원문 보기
              </a>
            </article>
          ))}
          {disclosures.length === 0 && !loading && (
            <div className="empty-state">종목코드를 입력하고 조회하면 최근 1년 공시가 표시됩니다.</div>
          )}
        </div>
      </div>
    </article>
  );
}
