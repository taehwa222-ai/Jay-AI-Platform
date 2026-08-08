import { DollarOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons';
import { formatDateTime } from '../utils';
import type { StockReportMarketItem } from '../types';

export function StockMarketPanel({
  marketMessage,
  marketReports,
  onRefresh,
}: {
  marketMessage: string | null;
  marketReports: StockReportMarketItem[];
  onRefresh: () => void;
}) {
  return (
    <article className="tool-pane stock-pane report-pane">
      <div className="pane-title">
        <DollarOutlined />
        <h3>Report market</h3>
        <button className="secondary-button" onClick={onRefresh} type="button">
          <ReloadOutlined />
          Refresh
        </button>
      </div>
      <div className="pane-body">
        {marketMessage && <div className="inline-message">{marketMessage}</div>}
        <div className="report-list">
          {marketReports.map((report) => (
            <article className={`report-card ${report.rating}`} key={report.id}>
              <div className="report-head">
                <div>
                  <strong>{report.title}</strong>
                  <small>
                    {formatDateTime(report.created_at)} · Score {report.score} · {report.rating_label}
                  </small>
                  <span className={`publish-chip ${report.can_view ? 'published' : 'private'}`}>
                    {report.access_level.toUpperCase()}
                  </span>
                </div>
              </div>
              {report.can_view ? (
                <pre className="report-body">{report.body}</pre>
              ) : (
                <div className="locked-report">
                  <LockOutlined />
                  <strong>Pro members only</strong>
                  <p>{report.locked_reason}</p>
                </div>
              )}
            </article>
          ))}
          {marketReports.length === 0 && (
            <div className="empty-state">
              Published stock reports will appear here after you publish drafts.
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
