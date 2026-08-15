import {
  CheckCircleOutlined,
  CrownOutlined,
  ReloadOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { AdminUserUpdatePayload, UserAccount } from '../types';

type Props = {
  currentUser: UserAccount;
  users: UserAccount[];
  loading: boolean;
  updatingId: number | null;
  message: string | null;
  onRefresh: () => void;
  onUpdate: (userId: number, payload: AdminUserUpdatePayload) => void;
};

function roleLabel(role: UserAccount['role']) {
  if (role === 'owner') return '대표';
  if (role === 'admin') return '관리자';
  return '구성원';
}

function statusLabel(user: UserAccount) {
  if (user.approval_status === 'pending') return '승인 대기';
  if (!user.is_active || user.approval_status === 'disabled') return '비활성';
  return '활성';
}

export function TeamAccessPanel({
  currentUser,
  users,
  loading,
  updatingId,
  message,
  onRefresh,
  onUpdate,
}: Props) {
  const isOwner = currentUser.role === 'owner';
  const pendingCount = users.filter((user) => user.approval_status === 'pending').length;

  return (
    <article className="team-access-panel">
      <div className="team-access-head">
        <div>
          <span className="eyebrow"><TeamOutlined /> TEAM ACCESS</span>
          <h3>사내 사용자 관리</h3>
          <p>가입 신청을 승인하고 구성원의 역할과 접근 상태를 관리합니다.</p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={onRefresh} type="button">
          <ReloadOutlined spin={loading} /> 새로고침
        </button>
      </div>

      <div className="team-access-summary">
        <span><strong>{users.length}</strong> 전체 계정</span>
        <span className={pendingCount > 0 ? 'pending' : ''}><strong>{pendingCount}</strong> 승인 대기</span>
      </div>

      <div className="team-user-list">
        {users.map((user) => {
          const isSelf = user.id === currentUser.id;
          const isProtected = user.role === 'owner' || isSelf;
          const adminCanManage = currentUser.role === 'admin' && user.role === 'member';
          const canManage = !isProtected && (isOwner || adminCanManage);
          const updating = updatingId === user.id;
          const status = statusLabel(user);

          return (
            <div className={`team-user-row ${user.is_active ? '' : 'inactive'}`} key={user.id}>
              <div className="team-user-identity">
                <span className="team-user-avatar">
                  {user.role === 'owner' ? <CrownOutlined /> : user.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{user.name}{isSelf ? ' · 나' : ''}</strong>
                  <small>{user.email}</small>
                </span>
              </div>
              <div className="team-user-state">
                <span className={`role-chip ${user.role}`}>{roleLabel(user.role)}</span>
                <span className={`approval-chip ${user.approval_status}`}>{status}</span>
              </div>
              <div className="team-user-actions">
                <select
                  aria-label={`${user.name} 역할`}
                  disabled={!canManage || !isOwner || updating}
                  onChange={(event) =>
                    onUpdate(user.id, { role: event.target.value as 'admin' | 'member' })
                  }
                  value={user.role === 'owner' ? 'owner' : user.role}
                >
                  {user.role === 'owner' && <option value="owner">대표</option>}
                  <option value="admin">관리자</option>
                  <option value="member">구성원</option>
                </select>
                {user.approval_status === 'pending' ? (
                  <button
                    className="primary-button compact-button"
                    disabled={!canManage || updating}
                    onClick={() => onUpdate(user.id, { is_active: true })}
                    type="button"
                  >
                    <CheckCircleOutlined /> 승인
                  </button>
                ) : (
                  <button
                    className={user.is_active ? 'danger-button compact-button' : 'secondary-button compact-button'}
                    disabled={!canManage || updating}
                    onClick={() => onUpdate(user.id, { is_active: !user.is_active })}
                    type="button"
                  >
                    {user.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                    {user.is_active ? ' 비활성화' : ' 활성화'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!loading && users.length === 0 && <div className="empty-state">등록된 사용자가 없습니다.</div>}
      </div>
      {message && <div className="inline-message" role="status">{message}</div>}
    </article>
  );
}
