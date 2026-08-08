import { BarChartOutlined, LineChartOutlined } from '@ant-design/icons';
import type { FormEvent } from 'react';
import type { StockScanResult } from '../types';

export function StockScanPanel({
  scanTickers,
  onScanTickersChange,
  scanMemo,
  onScanMemoChange,
  onScan,
  scanLoading,
  scanMessage,
  scanResult,
}: {
  scanTickers: string;
  onScanTickersChange: (value: string) => void;
  scanMemo: string;
  onScanMemoChange: (value: string) => void;
  onScan: (event: FormEvent) => void;
  scanLoading: boolean;
  scanMessage: string | null;
  scanResult: StockScanResult | null;
}) {
  return (
    <article className="tool-pane stock-pane scan-pane">
      <div className="pane-title">
        <LineChartOutlined />
        <h3>추천 후보 스캔</h3>
      </div>
      <div className="pane-body">
        <form className="scan-form" onSubmit={onScan}>
          <label className="wide-field">
            <span>스캔할 종목코드</span>
            <input
              onChange={(event) => onScanTickersChange(event.target.value)}
              placeholder="005930,000660,035720"
              required
              value={scanTickers}
            />
          </label>
          <label className="wide-field">
            <span>스캔 메모</span>
            <input
              onChange={(event) => onScanMemoChange(event.target.value)}
              placeholder="예: 거래량 급증 후보, 반도체/AI 관련주 우선 확인"
              value={scanMemo}
            />
          </label>
          <button className="primary-button" disabled={scanLoading} type="submit">
            <BarChartOutlined />
            후보 스캔 실행
          </button>
        </form>

        {scanMessage && <div className="inline-message">{scanMessage}</div>}
        {scanResult && (
          <div className="scan-result">
            {scanResult.candidates.map((candidate, index) => (
              <div className={`scan-card ${candidate.rating}`} key={candidate.ticker}>
                <div className="scan-rank">#{index + 1}</div>
                <div className="scan-main">
                  <strong>
                    {candidate.name} <span>{candidate.ticker}</span>
                  </strong>
                  <p>{candidate.summary}</p>
                  <small>
                    {candidate.latest_trading_day} · {candidate.provider_symbol} · 거래량{' '}
                    {candidate.volume_multiplier}배 · RSI {candidate.rsi}
                  </small>
                </div>
                <div className="scan-score">
                  <strong>{candidate.score}</strong>
                  <span>{candidate.rating_label}</span>
                </div>
              </div>
            ))}
            {scanResult.failed.length > 0 && (
              <div className="scan-failed">
                <strong>조회 실패</strong>
                {scanResult.failed.map((item) => (
                  <span key={item.ticker}>
                    {item.ticker}: {item.reason}
                  </span>
                ))}
              </div>
            )}
            <div className="disclaimer">{scanResult.disclaimer}</div>
          </div>
        )}
      </div>
    </article>
  );
}
