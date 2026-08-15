import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  HddOutlined,
  ReloadOutlined,
  RobotOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getOperations } from '../api';
import type {
  OperationsCacheStatus,
  OperationsIntegrationStatus,
  OperationsOverview,
} from '../types';
import { DataControlPanel } from './DataControlPanel';

type OperationsDashboardProps = {
  active: boolean;
  token: string;
};

export function OperationsDashboard({ active, token }: OperationsDashboardProps) {
  const [overview, setOverview] = useState<OperationsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadOverview = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    setMessage(null);
    try {
      setOverview(await getOperations(token));
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : '운영 지표를 불러오지 못했습니다.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!active || !token) return;
    void loadOverview();
    const intervalId = window.setInterval(() => void loadOverview(true), 30_000);
    return () => window.clearInterval(intervalId);
  }, [active, loadOverview, token]);

  const historyMaximum = Math.max(
    1,
    ...(overview?.ai_usage.history.map((day) => day.request_count) ?? []),
  );

  return (
    <section
      aria-label="운영 현황 대시보드"
      className={active ? 'section-block operations-dashboard' : 'screen-hidden'}
      id="operations"
    >
      <div className="workspace-intro operations-intro">
        <div>
          <span className="workspace-kicker"><CloudServerOutlined /> OPERATIONS CONTROL</span>
          <h2>서비스 상태를 한눈에 확인하세요</h2>
          <p>서버, 데이터, AI 비용과 외부 연동 상태를 실시간에 가깝게 추적합니다.</p>
        </div>
        <div className="operations-intro-actions">
          {overview && (
            <span className={`operations-health-pill ${overview.status}`}>
              {overview.status === 'healthy' ? <CheckCircleOutlined /> : <WarningOutlined />}
              {overview.status === 'healthy' ? '정상 운영' : '확인 필요'}
            </span>
          )}
          <button
            className="secondary-button"
            disabled={loading}
            onClick={() => void loadOverview()}
            type="button"
          >
            <ReloadOutlined spin={loading} /> 새로고침
          </button>
        </div>
      </div>

      {message && <div className="error-box" role="alert">{message}</div>}

      {!overview && loading ? (
        <div className="workspace-loading-card" role="status">
          <span className="loading-spinner" />
          <span><strong>운영 지표를 수집하는 중</strong><small>DB와 외부 연동 상태를 확인하고 있습니다.</small></span>
        </div>
      ) : overview ? (
        <div className="operations-body">
          <div className="operations-summary-grid">
            <SummaryCard
              detail={`${overview.runtime.total_requests.toLocaleString()}건 요청 · 평균 ${overview.runtime.average_duration_ms.toFixed(0)}ms`}
              icon={<ClockCircleOutlined />}
              label="서버 가동 시간"
              tone="violet"
              value={formatDuration(overview.runtime.uptime_seconds)}
            />
            <SummaryCard
              detail={`잔여 ${overview.ai_usage.remaining.toLocaleString()}회 · ${overview.ai_usage.usage_percent.toFixed(1)}% 사용`}
              icon={<RobotOutlined />}
              label="오늘 AI 연산"
              tone={overview.ai_usage.usage_percent >= 80 ? 'warning' : 'teal'}
              value={`${overview.ai_usage.today_count.toLocaleString()} / ${overview.ai_usage.daily_limit.toLocaleString()}`}
            />
            <SummaryCard
              detail={`${overview.database.journal_mode.toUpperCase()} · 여유 ${overview.database.disk_free_percent.toFixed(1)}%`}
              icon={<DatabaseOutlined />}
              label="SQLite 데이터"
              tone={overview.database.healthy ? 'teal' : 'warning'}
              value={overview.database.healthy ? '정상' : '점검 필요'}
            />
            <SummaryCard
              detail={`누적 5xx ${overview.runtime.server_error_count.toLocaleString()}건`}
              icon={<WarningOutlined />}
              label="최근 24시간 오류"
              tone={overview.errors_last_24h > 0 ? 'warning' : 'teal'}
              value={`${overview.errors_last_24h.toLocaleString()}건`}
            />
          </div>

          <div className="operations-main-grid">
            <article className="operations-panel data-panel">
              <PanelHeading icon={<HddOutlined />} title="데이터 보존" subtitle="SQLite · WAL · 일일 백업" />
              <div className="operations-detail-list">
                <DetailRow label="데이터베이스" value={`${overview.database.file_name} · ${formatBytes(overview.database.size_bytes)}`} />
                <DetailRow label="무결성 검사" value={overview.database.integrity_check} good={overview.database.healthy} />
                <DetailRow label="디스크 여유" value={`${formatBytes(overview.database.disk_free_bytes)} (${overview.database.disk_free_percent.toFixed(1)}%)`} />
                <DetailRow
                  label="최신 백업"
                  value={overview.backup.available
                    ? `${overview.backup.latest_file} · ${overview.backup.age_hours?.toFixed(1)}시간 전`
                    : '백업 없음'}
                  good={overview.backup.available}
                />
                <DetailRow label="보관 백업" value={`${overview.backup.backup_count.toLocaleString()}개`} />
              </div>
            </article>

            <article className="operations-panel ai-panel">
              <PanelHeading icon={<RobotOutlined />} title="AI 비용 가드레일" subtitle="최근 7일 요청 추이" />
              <div className="ai-usage-track" aria-label={`AI 일일 사용률 ${overview.ai_usage.usage_percent.toFixed(1)}%`}>
                <span style={{ width: `${Math.min(overview.ai_usage.usage_percent, 100)}%` }} />
              </div>
              <div className="ai-history-chart" aria-label="최근 7일 AI 사용량">
                {overview.ai_usage.history.map((day) => (
                  <div className="ai-history-day" key={day.usage_date}>
                    <strong>{day.request_count}</strong>
                    <span><i style={{ height: `${Math.max(6, day.request_count / historyMaximum * 100)}%` }} /></span>
                    <small>{formatShortDate(day.usage_date)}</small>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <article className="operations-panel cache-panel">
            <PanelHeading icon={<ApiOutlined />} title="외부 API 캐시" subtitle="반복 호출 절감과 응답 속도" />
            <div className="cache-card-grid">
              {overview.caches.map((cache) => <CacheCard cache={cache} key={cache.name} />)}
            </div>
          </article>

          <div className="operations-main-grid lower-grid">
            <article className="operations-panel integration-panel">
              <PanelHeading icon={<ApiOutlined />} title="외부 연동" subtitle="키 값은 화면에 표시하지 않습니다" />
              <div className="integration-list">
                {overview.integrations.map((integration) => (
                  <IntegrationRow integration={integration} key={integration.name} />
                ))}
              </div>
            </article>

            <article className="operations-panel error-panel">
              <PanelHeading icon={<WarningOutlined />} title="최근 서버 오류" subtitle="민감한 요청 본문은 기록하지 않습니다" />
              {overview.recent_errors.length > 0 ? (
                <div className="operations-error-list">
                  {overview.recent_errors.map((event) => (
                    <div className="operations-error-row" key={event.id}>
                      <span className="error-status-code">{event.status_code}</span>
                      <span className="error-event-copy">
                        <strong>{event.method} {event.path}</strong>
                        <small>{event.error_type} · {event.duration_ms.toFixed(0)}ms · {formatDateTime(event.occurred_at)}</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="operations-empty-state">
                  <CheckCircleOutlined />
                  <span><strong>기록된 서버 오류가 없습니다</strong><small>최근 5xx 응답이 발생하면 여기에 표시됩니다.</small></span>
                </div>
              )}
            </article>
          </div>

          <DataControlPanel token={token} />

          <p className="operations-updated-at">
            30초마다 자동 갱신 · 마지막 수집 {formatDateTime(overview.generated_at)}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone: 'teal' | 'violet' | 'warning';
  value: string;
}) {
  return (
    <article className={`operations-summary-card ${tone}`}>
      <span className="operations-summary-icon">{icon}</span>
      <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
    </article>
  );
}

function PanelHeading({ icon, subtitle, title }: { icon: ReactNode; subtitle: string; title: string }) {
  return (
    <div className="operations-panel-heading">
      <span>{icon}</span>
      <div><h3>{title}</h3><p>{subtitle}</p></div>
    </div>
  );
}

function DetailRow({ good, label, value }: { good?: boolean; label: string; value: string }) {
  return (
    <div className="operations-detail-row">
      <span>{label}</span>
      <strong className={good === false ? 'is-warning' : good ? 'is-good' : ''}>{value}</strong>
    </div>
  );
}

function CacheCard({ cache }: { cache: OperationsCacheStatus }) {
  const hitPercent = cache.hit_rate * 100;
  return (
    <div className="cache-status-card">
      <div><strong>{cacheLabel(cache.name)}</strong><small>TTL {formatDuration(cache.ttl_seconds)}</small></div>
      <span className="cache-hit-value">{hitPercent.toFixed(1)}%</span>
      <div className="cache-hit-track"><span style={{ width: `${Math.min(hitPercent, 100)}%` }} /></div>
      <dl>
        <div><dt>요청</dt><dd>{cache.requests}</dd></div>
        <div><dt>적중</dt><dd>{cache.hits}</dd></div>
        <div><dt>외부 호출</dt><dd>{cache.loads}</dd></div>
        <div><dt>오류</dt><dd>{cache.load_errors}</dd></div>
      </dl>
    </div>
  );
}

function IntegrationRow({ integration }: { integration: OperationsIntegrationStatus }) {
  return (
    <div className="integration-row">
      <span className={`integration-dot ${integration.configured ? 'configured' : ''}`} />
      <span><strong>{integration.name}</strong><small>{integration.detail}</small></span>
      <em>{integration.configured ? '연결됨' : '미설정'}</em>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}초`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}분`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}시간`;
  return `${Math.floor(seconds / 86_400)}일 ${Math.round((seconds % 86_400) / 3600)}시간`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function cacheLabel(name: string) {
  if (name === 'yahoo_market') return 'Yahoo 시세';
  if (name === 'opendart_disclosures') return 'OpenDART 공시';
  return name;
}
