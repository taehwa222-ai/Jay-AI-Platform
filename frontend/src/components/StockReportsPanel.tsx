import { DeleteOutlined, DollarOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { formatDateTime } from '../utils';
import type { StockReport } from '../types';

export function StockReportsPanel({
  reportMessage,
  stockReports,
  onRefresh,
  updatingReportPublishId,
  onUpdatePublish,
  downloadingReportId,
  onDownload,
  deletingReportId,
  onDelete,
}: {
  reportMessage: string | null;
  stockReports: StockReport[];
  onRefresh: () => void;
  updatingReportPublishId: number | null;
  onUpdatePublish: (
    report: StockReport,
    accessLevel: StockReport['access_level'],
    isPublished: boolean,
  ) => void;
  downloadingReportId: number | null;
  onDownload: (report: StockReport) => void;
  deletingReportId: number | null;
  onDelete: (reportId: number) => void;
}) {
  return (
    <article className="tool-pane stock-pane report-pane">
      <div className="pane-title">
        <DollarOutlined />
        <h3>Report drafts</h3>
        <button className="secondary-button" onClick={onRefresh} type="button">
          <ReloadOutlined />
          Refresh
        </button>
      </div>
      <div className="pane-body">
        {reportMessage && <div className="inline-message">{reportMessage}</div>}
        <div className="report-list">
          {stockReports.map((report) => (
            <article className={`report-card ${report.rating}`} key={report.id}>
              <div className="report-head">
                <div>
                  <strong>{report.title}</strong>
                  <small>
                    {formatDateTime(report.created_at)} · Score {report.score} · {report.rating_label}
                  </small>
                  <span className={`publish-chip ${report.is_published ? 'published' : 'private'}`}>
                    {report.is_published ? `${report.access_level.toUpperCase()} published` : 'PRIVATE'}
                  </span>
                </div>
                <div className="report-actions">
                  <select
                    aria-label="Report access level"
                    disabled={updatingReportPublishId === report.id}
                    onChange={(event) =>
                      onUpdatePublish(
                        report,
                        event.target.value as StockReport['access_level'],
                        event.target.value !== 'private',
                      )
                    }
                    value={report.access_level}
                  >
                    <option value="private">Private</option>
                    <option value="free">Free members</option>
                    <option value="pro">Pro members</option>
                  </select>
                  {report.is_published ? (
                    <button
                      className="secondary-button compact-button"
                      disabled={updatingReportPublishId === report.id}
                      onClick={() => onUpdatePublish(report, 'private', false)}
                      type="button"
                    >
                      Hide
                    </button>
                  ) : (
                    <button
                      className="secondary-button compact-button"
                      disabled={updatingReportPublishId === report.id}
                      onClick={() => onUpdatePublish(report, 'pro', true)}
                      type="button"
                    >
                      Publish Pro
                    </button>
                  )}
                  <button
                    className="secondary-button compact-button"
                    disabled={downloadingReportId === report.id}
                    onClick={() => onDownload(report)}
                    type="button"
                  >
                    <SaveOutlined />
                    Download .md
                  </button>
                  <button
                    className="icon-danger-button"
                    disabled={deletingReportId === report.id}
                    onClick={() => onDelete(report.id)}
                    title="Delete report"
                    type="button"
                  >
                    <DeleteOutlined />
                  </button>
                </div>
              </div>
              <pre className="report-body">{report.body}</pre>
            </article>
          ))}
          {stockReports.length === 0 && (
            <div className="empty-state">
              Create a report from a saved analysis record to build paid content drafts.
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
