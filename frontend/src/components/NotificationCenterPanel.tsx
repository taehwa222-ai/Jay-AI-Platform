import {
  BellOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getNotificationStatus,
  retryNotification,
  sendDisclosureNotification,
  sendTelegramTest,
} from '../api';
import type { NotificationCenterStatus, NotificationEvent } from '../types';
import { formatDateTime } from '../utils';

const EVENT_LABELS: Record<string, string> = {
  connection_test: '연결 테스트',
  analysis_complete: 'AI 분석',
  important_disclosures: '주요 공시',
};

export function NotificationCenterPanel({ token }: { token: string }) {
  const [center, setCenter] = useState<NotificationCenterStatus | null>(null);
  const [ticker, setTicker] = useState('005930');
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sentCount = useMemo(
    () => center?.events.filter((event) => event.status === 'sent').length ?? 0,
    [center],
  );
  const failedCount = useMemo(
    () => center?.events.filter((event) => event.status === 'failed').length ?? 0,
    [center],
  );
  const aiUsagePercent = center
    ? Math.min(100, (center.ai_daily_count / Math.max(1, center.ai_daily_limit)) * 100)
    : 0;

  useEffect(() => {
    void loadCenter();
  }, [token]);

  async function loadCenter() {
    setLoading(true);
    setMessage(null);
    try {
      setCenter(await getNotificationStatus(token));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '알림 센터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(key: string, action: () => Promise<unknown>, success: string) {
    setActionKey(key);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      setCenter(await getNotificationStatus(token));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '알림 작업을 완료하지 못했습니다.');
    } finally {
      setActionKey(null);
    }
  }

  async function handleDisclosureSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) return;
    await runAction(
      'disclosure',
      () => sendDisclosureNotification(token, normalizedTicker),
      `${normalizedTicker} 주요 공시 확인을 완료했습니다.`,
    );
  }

  return (
    <article className="tool-pane notification-pane">
      <div className="pane-title">
        <BellOutlined />
        <h3>알림 운영 센터</h3>
        <button
          aria-label="알림 센터 새로고침"
          className="icon-button light"
          disabled={loading}
          onClick={() => void loadCenter()}
          type="button"
        >
          <ReloadOutlined className={loading ? 'spin' : ''} />
        </button>
      </div>
      <div className="pane-body notification-center-body">
        {!center && loading ? (
          <div className="loading-state"><span className="loading-spinner" /> 알림 상태를 불러오는 중</div>
        ) : center ? (
          <>
            <div className="notification-status-grid">
              <StatusCard
                detail={`대상 ${center.chat_target}`}
                icon={center.configured ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                label="Telegram"
                tone={center.configured ? 'good' : 'danger'}
                value={center.configured ? '연결됨' : '설정 필요'}
              />
              <div className="notification-status-card usage-card">
                <span className="notification-card-icon"><SafetyCertificateOutlined /></span>
                <span><small>오늘 AI 사용량</small><strong>{center.ai_daily_count} / {center.ai_daily_limit}</strong></span>
                <div className="notification-usage-track"><span style={{ width: `${aiUsagePercent}%` }} /></div>
              </div>
              <StatusCard
                detail={`최근 ${center.events.length}건 중`}
                icon={<SendOutlined />}
                label="발송 성공"
                tone="good"
                value={`${sentCount}건`}
              />
              <StatusCard
                detail="재시도 가능"
                icon={<SyncOutlined />}
                label="발송 실패"
                tone={failedCount > 0 ? 'danger' : 'neutral'}
                value={`${failedCount}건`}
              />
            </div>

            <div className="notification-actions-card">
              <div>
                <span className="eyebrow">DELIVERY CHECK</span>
                <strong>연결 확인과 주요 공시 PUSH</strong>
                <small>실제 텔레그램 채팅으로 테스트 메시지 또는 중요 공시를 전송합니다.</small>
              </div>
              <button
                className="secondary-button"
                disabled={actionKey !== null}
                onClick={() =>
                  void runAction(
                    'test',
                    () => sendTelegramTest(token),
                    '텔레그램 테스트 발송을 완료했습니다.',
                  )
                }
                type="button"
              >
                <SendOutlined /> 연결 테스트
              </button>
              <form onSubmit={(event) => void handleDisclosureSubmit(event)}>
                <input
                  aria-label="공시 알림 종목코드"
                  onChange={(event) => setTicker(event.target.value)}
                  placeholder="005930"
                  value={ticker}
                />
                <button className="primary-button" disabled={actionKey !== null} type="submit">
                  <BellOutlined /> 주요 공시 확인
                </button>
              </form>
            </div>

            {message && <div className="inline-message" role="status">{message}</div>}

            <div className="notification-history">
              <div className="notification-history-head">
                <span><strong>최근 발송 이력</strong><small>성공·실패·건너뜀 상태와 재시도 횟수</small></span>
                <span>{center.events.length}건</span>
              </div>
              <div className="notification-event-list">
                {center.events.map((event) => (
                  <NotificationEventRow
                    busy={actionKey === `retry-${event.id}`}
                    event={event}
                    key={event.id}
                    onRetry={() =>
                      void runAction(
                        `retry-${event.id}`,
                        () => retryNotification(token, event.id),
                        '알림 재시도를 완료했습니다.',
                      )
                    }
                  />
                ))}
                {center.events.length === 0 && (
                  <div className="empty-state"><BellOutlined /> 아직 발송 이력이 없습니다.</div>
                )}
              </div>
            </div>
          </>
        ) : null}
        {message && !center && <div className="error-box">{message}</div>}
      </div>
    </article>
  );
}

function StatusCard({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone: 'good' | 'danger' | 'neutral';
  value: string;
}) {
  return (
    <div className={`notification-status-card ${tone}`}>
      <span className="notification-card-icon">{icon}</span>
      <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
    </div>
  );
}

function NotificationEventRow({
  busy,
  event,
  onRetry,
}: {
  busy: boolean;
  event: NotificationEvent;
  onRetry: () => void;
}) {
  const statusLabel = event.status === 'sent' ? '성공' : event.status === 'failed' ? '실패' : '건너뜀';
  return (
    <div className="notification-event-row">
      <span className={`notification-event-status ${event.status}`}>{statusLabel}</span>
      <span className="notification-event-copy">
        <small>{EVENT_LABELS[event.event_type] ?? event.event_type}</small>
        <strong>{event.title}</strong>
        <em>{formatDateTime(event.last_attempt_at)} · 시도 {event.attempt_count}회</em>
        {event.error_message && <p>{event.error_message}</p>}
      </span>
      <span className="notification-event-count">{event.item_count > 0 ? `${event.item_count}건` : '—'}</span>
      {event.status === 'failed' && (
        <button className="secondary-button" disabled={busy} onClick={onRetry} type="button">
          <SyncOutlined spin={busy} /> 재시도
        </button>
      )}
    </div>
  );
}
