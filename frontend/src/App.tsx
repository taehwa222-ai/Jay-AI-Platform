import {
  ApiOutlined,
  BarChartOutlined,
  BellOutlined,
  FundProjectionScreenOutlined,
  ReloadOutlined,
  RocketOutlined,
  StockOutlined,
} from '@ant-design/icons';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getDefaults, getHealth, getRoadmap, runRecommendations } from './api';
import type {
  HealthStatus,
  RecommendationDefaults,
  RecommendationResponse,
  RoadmapPhase,
  StockCandidate,
} from './types';

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [defaults, setDefaults] = useState<RecommendationDefaults | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapPhase[]>([]);
  const [tickers, setTickers] = useState('AAPL,MSFT,NVDA,TSLA,AMD');
  const [volumeMultiplier, setVolumeMultiplier] = useState(2);
  const [period, setPeriod] = useState('6mo');
  const [sendTelegram, setSendTelegram] = useState(false);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshState();
  }, []);

  const scannedLabel = useMemo(() => {
    if (!result) return 'ready';
    return `${result.scanned.length} scanned`;
  }, [result]);

  async function refreshState() {
    const [healthResult, defaultResult, roadmapResult] = await Promise.all([
      getHealth(),
      getDefaults(),
      getRoadmap(),
    ]);
    setHealth(healthResult);
    setDefaults(defaultResult);
    setRoadmap(roadmapResult);
    setTickers(defaultResult.tickers.join(','));
    setVolumeMultiplier(defaultResult.volume_multiplier);
    setPeriod(defaultResult.period);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await runRecommendations({
        tickers: parseTickers(tickers),
        period,
        interval: '1d',
        volume_multiplier: volumeMultiplier,
        send_telegram: sendTelegram,
      });
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <StockOutlined />
          <span>Jay Stock AI</span>
        </div>
        <nav className="nav-list" aria-label="Primary">
          <a href="#scan">
            <RocketOutlined />
            Scan
          </a>
          <a href="#signals">
            <BarChartOutlined />
            Signals
          </a>
          <a href="#server">
            <ApiOutlined />
            Server
          </a>
        </nav>
        <div className="sidebar-status">
          <span className={`status-dot ${health?.ok ? 'online' : ''}`} />
          <span>{health?.model_provider ?? 'checking'}</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Stock Recommendation Server</span>
            <h1>Custom Signal Scanner</h1>
          </div>
          <button className="icon-button" onClick={() => void refreshState()} type="button" title="Refresh">
            <ReloadOutlined />
          </button>
        </header>

        <section className="grid scanner-grid" id="scan">
          <form className="tool-pane scan-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="pane-title">
              <FundProjectionScreenOutlined />
              <h2>Scan Setup</h2>
            </div>
            <label>
              <span>Tickers</span>
              <textarea value={tickers} onChange={(event) => setTickers(event.target.value)} rows={5} />
            </label>
            <div className="field-row">
              <label>
                <span>Volume Spike</span>
                <input
                  min="1"
                  max="20"
                  step="0.1"
                  type="number"
                  value={volumeMultiplier}
                  onChange={(event) => setVolumeMultiplier(Number(event.target.value))}
                />
              </label>
              <label>
                <span>Period</span>
                <select value={period} onChange={(event) => setPeriod(event.target.value)}>
                  <option value="1mo">1mo</option>
                  <option value="3mo">3mo</option>
                  <option value="6mo">6mo</option>
                  <option value="1y">1y</option>
                </select>
              </label>
            </div>
            <label className="toggle-row">
              <input
                checked={sendTelegram}
                onChange={(event) => setSendTelegram(event.target.checked)}
                type="checkbox"
              />
              <span>Telegram</span>
            </label>
            <button className="primary-button" disabled={loading} type="submit">
              <RocketOutlined />
              {loading ? 'Scanning' : 'Run Scan'}
            </button>
          </form>

          <div className="metric-band">
            <div>
              <span>State</span>
              <strong>{scannedLabel}</strong>
            </div>
            <div>
              <span>Provider</span>
              <strong>{defaults?.model_provider ?? 'checking'}</strong>
            </div>
            <div>
              <span>Telegram</span>
              <strong>{defaults?.telegram_configured ? 'ready' : 'off'}</strong>
            </div>
          </div>
        </section>

        <section className="results-layout" id="signals">
          <div className="tool-pane results-pane">
            <div className="pane-title">
              <BarChartOutlined />
              <h2>Signals</h2>
            </div>
            {error && <div className="error-box">{error}</div>}
            {!result && !error && <div className="empty-state">No scan result yet.</div>}
            {result && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Close</th>
                      <th>Change</th>
                      <th>Volume</th>
                      <th>Ratio</th>
                      <th>RSI</th>
                      <th>MACD Hist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.candidates.map((candidate) => (
                      <SignalRow candidate={candidate} key={candidate.symbol} />
                    ))}
                  </tbody>
                </table>
                {result.candidates.length === 0 && <div className="empty-state">No candidates passed.</div>}
              </div>
            )}
          </div>

          <div className="tool-pane analysis-pane">
            <div className="pane-title">
              <BellOutlined />
              <h2>AI Analysis</h2>
            </div>
            <pre>{result?.analysis ?? 'Analysis will appear after a scan.'}</pre>
            {result && (
              <div className={`telegram-status ${result.telegram.status}`}>
                {result.telegram.status}: {result.telegram.message}
              </div>
            )}
            {result?.errors.length ? (
              <div className="error-list">
                {result.errors.map((item) => (
                  <div key={item.symbol}>
                    <strong>{item.symbol}</strong> {item.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="phase-list" id="server">
          {roadmap.map((phase) => (
            <article className="phase-card" key={phase.id}>
              <div className="phase-head">
                <h3>{phase.title}</h3>
                <span>{phase.status}</span>
              </div>
              <ul>
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function SignalRow({ candidate }: { candidate: StockCandidate }) {
  return (
    <tr>
      <td>{candidate.symbol}</td>
      <td>{formatNumber(candidate.close)}</td>
      <td className={candidate.change_percent >= 0 ? 'positive' : 'negative'}>
        {candidate.change_percent.toFixed(2)}%
      </td>
      <td>{candidate.volume.toLocaleString()}</td>
      <td>{candidate.volume_ratio.toFixed(2)}x</td>
      <td>{formatNullable(candidate.indicators.rsi)}</td>
      <td>{formatNullable(candidate.indicators.macd_histogram)}</td>
    </tr>
  );
}

function parseTickers(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean);
}

function formatNullable(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(2);
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
