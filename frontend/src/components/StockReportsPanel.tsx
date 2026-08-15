import { DeleteOutlined, FileTextOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import type { StockReport } from '../types';
import { formatDateTime } from '../utils';

export function StockReportsPanel({
  reportMessage,
  stockReports,
  onRefresh,
  downloadingReportId,
  onDownload,
  deletingReportId,
  onDelete,
}: {
  reportMessage: string | null;
  stockReports: StockReport[];
  onRefresh: () => void;
  downloadingReportId: number | null;
  onDownload: (report: StockReport) => void;
  deletingReportId: number | null;
  onDelete: (reportId: number) => void;
}) {
  return (
    <article className="tool-pane stock-pane report-pane">
      <div className="pane-title">
        <FileTextOutlined />
        <h3>내부 분석 리포트</h3>
        <button className="secondary-button" onClick={onRefresh} type="button">
          <ReloadOutlined /> 새로고침
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
                    {formatDateTime(report.created_at)} · {report.score}점 · {report.rating_label}
                  </small>
                  <span className="publish-chip private">OWNER ONLY</span>
                </div>
                <div className="report-actions">
                  <button
                    className="secondary-button compact-button"
                    disabled={downloadingReportId === report.id}
                    onClick={() => onDownload(report)}
                    type="button"
                  >
                    <SaveOutlined /> Markdown 저장
                  </button>
                  <button
                    className="icon-danger-button"
                    disabled={deletingReportId === report.id}
                    onClick={() => onDelete(report.id)}
                    title="리포트 삭제"
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
              저장된 분석 기록에서 내부 검토용 리포트를 만들 수 있습니다.
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
