import { BarChartOutlined, CrownOutlined, DollarOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons';
import { SectionTitle, StatusTile } from './shared';
import { formatDateTime } from '../utils';
import type { AdminContentStats, AdminUserUsage, ProUpgradeRequest, UserAccount } from '../types';

export type AdminMetrics = {
  activeAdminCount: number;
  activeMemberCount: number;
  inactiveUserCount: number;
  proUserCount: number;
  freeUserCount: number;
  totalAnalysisCount: number;
  activeAnalysisUserCount: number;
  latestAnalysisAt: string | null;
};

export function AdminScreen({
  active,
  isAdmin,
  currentUserId,
  metrics,
  adminContentStats,
  onRefreshContentStats,
  adminProRequests,
  adminProRequestUpdatingId,
  onRefreshProRequests,
  onUpdateProRequest,
  adminUsers,
  adminUpdatingId,
  adminMessage,
  onRefreshUsers,
  onUpdateUser,
  adminUsage,
  onRefreshUsage,
}: {
  active: boolean;
  isAdmin: boolean;
  currentUserId: number | undefined;
  metrics: AdminMetrics;
  adminContentStats: AdminContentStats | null;
  onRefreshContentStats: () => void;
  adminProRequests: ProUpgradeRequest[];
  adminProRequestUpdatingId: number | null;
  onRefreshProRequests: () => void;
  onUpdateProRequest: (requestId: number, status: 'approved' | 'rejected') => void;
  adminUsers: UserAccount[];
  adminUpdatingId: number | null;
  adminMessage: string | null;
  onRefreshUsers: () => void;
  onUpdateUser: (
    userId: number,
    payload: { role?: 'admin' | 'member'; plan?: 'free' | 'pro'; is_active?: boolean },
  ) => void;
  adminUsage: AdminUserUsage[];
  onRefreshUsage: () => void;
}) {
  return (
    <section className={active ? 'section-block' : 'screen-hidden'} id="admin">
      <SectionTitle eyebrow="Admin Console" icon={<CrownOutlined />} title="회원과 권한 관리" />
      <div className="admin-grid">
        <StatusTile label="활성 관리자" value={`${metrics.activeAdminCount}명`} tone="good" />
        <StatusTile label="활성 회원" value={`${metrics.activeMemberCount}명`} />
        <StatusTile label="비활성 계정" value={`${metrics.inactiveUserCount}명`} tone="steady" />
        <StatusTile label="PRO 회원" value={`${metrics.proUserCount}명`} tone="good" />
        <StatusTile label="무료 회원" value={`${metrics.freeUserCount}명`} />
        <StatusTile label="총 분석 횟수" value={`${metrics.totalAnalysisCount}회`} tone="good" />
        <StatusTile label="분석 사용 회원" value={`${metrics.activeAnalysisUserCount}명`} />
        <StatusTile
          label="최근 분석"
          value={metrics.latestAnalysisAt ? formatDateTime(metrics.latestAnalysisAt) : '없음'}
          tone="steady"
        />
      </div>
      <article className="tool-pane admin-content-pane">
        <div className="pane-title">
          <DollarOutlined />
          <h3>콘텐츠 수익화 현황</h3>
          {isAdmin && (
            <button className="secondary-button" onClick={onRefreshContentStats} type="button">
              <ReloadOutlined />
              새로고침
            </button>
          )}
        </div>
        <div className="pane-body">
          {isAdmin ? (
            <>
              <div className="content-stats-grid">
                <StatusTile
                  label="전체 리포트"
                  value={`${adminContentStats?.total_reports ?? 0}개`}
                  tone="good"
                />
                <StatusTile
                  label="공개 리포트"
                  value={`${adminContentStats?.published_reports ?? 0}개`}
                  tone="good"
                />
                <StatusTile label="비공개 초안" value={`${adminContentStats?.private_reports ?? 0}개`} />
                <StatusTile label="무료 공개" value={`${adminContentStats?.free_reports ?? 0}개`} />
                <StatusTile
                  label="PRO 전용"
                  value={`${adminContentStats?.pro_reports ?? 0}개`}
                  tone="steady"
                />
                <StatusTile
                  label="리포트 작성자"
                  value={`${adminContentStats?.report_creators ?? 0}명`}
                />
              </div>
              <div className="content-date-row">
                <span>
                  최근 리포트:{' '}
                  {adminContentStats?.latest_report_at
                    ? formatDateTime(adminContentStats.latest_report_at)
                    : '없음'}
                </span>
                <span>
                  최근 공개:{' '}
                  {adminContentStats?.latest_published_at
                    ? formatDateTime(adminContentStats.latest_published_at)
                    : '없음'}
                </span>
              </div>
            </>
          ) : (
            <div className="empty-state">관리자 계정으로 로그인하면 콘텐츠 통계를 볼 수 있습니다.</div>
          )}
        </div>
      </article>
      <article className="tool-pane admin-content-pane">
        <div className="pane-title">
          <CrownOutlined />
          <h3>PRO 업그레이드 신청</h3>
          {isAdmin && (
            <button className="secondary-button" onClick={onRefreshProRequests} type="button">
              <ReloadOutlined />
              새로고침
            </button>
          )}
        </div>
        <div className="pane-body">
          {isAdmin ? (
            <div className="pro-request-list">
              {adminProRequests.map((request) => (
                <div className={`pro-request-row ${request.status}`} key={request.id}>
                  <div>
                    <strong>{request.name}</strong>
                    <span>{request.email}</span>
                    <small>
                      {request.current_plan.toUpperCase()} · {request.status.toUpperCase()} ·{' '}
                      {formatDateTime(request.created_at)}
                    </small>
                    {request.message && <p>{request.message}</p>}
                    {request.admin_note && <p>관리자 메모: {request.admin_note}</p>}
                  </div>
                  {request.status === 'pending' ? (
                    <div className="pro-request-actions">
                      <button
                        className="primary-button"
                        disabled={adminProRequestUpdatingId === request.id}
                        onClick={() => onUpdateProRequest(request.id, 'approved')}
                        type="button"
                      >
                        승인
                      </button>
                      <button
                        className="danger-button"
                        disabled={adminProRequestUpdatingId === request.id}
                        onClick={() => onUpdateProRequest(request.id, 'rejected')}
                        type="button"
                      >
                        거절
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`publish-chip ${request.status === 'approved' ? 'published' : 'private'}`}
                    >
                      {request.status.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
              {adminProRequests.length === 0 && (
                <div className="empty-state">아직 PRO 업그레이드 신청이 없습니다.</div>
              )}
            </div>
          ) : (
            <div className="empty-state">관리자 계정으로 로그인하면 업그레이드 신청을 볼 수 있습니다.</div>
          )}
        </div>
      </article>
      <article className="tool-pane">
        <div className="pane-title">
          <TeamOutlined />
          <h3>회원 목록</h3>
        </div>
        <div className="pane-body">
          {isAdmin ? (
            <div className="admin-panel">
              <div className="admin-head">
                <p>현재 등록된 회원을 확인하고 역할과 계정 상태를 관리합니다.</p>
                <button className="secondary-button" onClick={onRefreshUsers} type="button">
                  <ReloadOutlined />
                  새로고침
                </button>
              </div>
              <div className="user-list">
                {adminUsers.map((user) => (
                  <div className={`user-row ${user.is_active ? '' : 'disabled'}`} key={user.id}>
                    <div className="user-identity">
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                      {currentUserId === user.id && <small>내 계정</small>}
                    </div>
                    <div className="user-controls">
                      <select
                        disabled={currentUserId === user.id || adminUpdatingId === user.id}
                        onChange={(event) =>
                          onUpdateUser(user.id, { role: event.target.value as 'admin' | 'member' })
                        }
                        value={user.role}
                      >
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                      <select
                        disabled={adminUpdatingId === user.id}
                        onChange={(event) =>
                          onUpdateUser(user.id, { plan: event.target.value as 'free' | 'pro' })
                        }
                        value={user.plan}
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                      </select>
                      <button
                        className={user.is_active ? 'danger-button' : 'secondary-button'}
                        disabled={currentUserId === user.id || adminUpdatingId === user.id}
                        onClick={() => onUpdateUser(user.id, { is_active: !user.is_active })}
                        type="button"
                      >
                        {user.is_active ? '비활성화' : '활성화'}
                      </button>
                    </div>
                  </div>
                ))}
                {adminUsers.length === 0 && <div className="empty-state">회원 목록이 비어 있습니다.</div>}
              </div>
              {adminMessage && <div className="inline-message">{adminMessage}</div>}
            </div>
          ) : (
            <div className="empty-state">관리자 계정으로 로그인하면 회원 목록과 권한 설정을 볼 수 있습니다.</div>
          )}
        </div>
      </article>
      <article className="tool-pane admin-usage-pane">
        <div className="pane-title">
          <BarChartOutlined />
          <h3>회원별 분석 사용량</h3>
          {isAdmin && (
            <button className="secondary-button" onClick={onRefreshUsage} type="button">
              <ReloadOutlined />
              새로고침
            </button>
          )}
        </div>
        <div className="pane-body">
          {isAdmin ? (
            <div className="usage-list">
              {adminUsage.map((usage) => (
                <div className="usage-row" key={usage.id}>
                  <div className="usage-identity">
                    <strong>{usage.name}</strong>
                    <span>{usage.email}</span>
                    <small className={`plan-chip ${usage.plan === 'pro' ? 'pro' : 'free'}`}>
                      {usage.plan.toUpperCase()}
                    </small>
                  </div>
                  <div className="usage-meter">
                    <span>{usage.analysis_count}회</span>
                    <div className="usage-track">
                      <div
                        className="usage-fill"
                        style={{
                          width: `${Math.max(
                            usage.analysis_count > 0 ? 6 : 0,
                            metrics.totalAnalysisCount > 0
                              ? (usage.analysis_count / metrics.totalAnalysisCount) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="usage-date">
                    {usage.latest_analysis_at ? formatDateTime(usage.latest_analysis_at) : '분석 없음'}
                  </div>
                </div>
              ))}
              {adminUsage.length === 0 && <div className="empty-state">사용량 데이터가 없습니다.</div>}
            </div>
          ) : (
            <div className="empty-state">관리자 계정으로 로그인하면 회원별 분석 사용량을 볼 수 있습니다.</div>
          )}
        </div>
      </article>
    </section>
  );
}
