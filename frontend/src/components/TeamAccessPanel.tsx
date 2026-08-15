import {
  BarChartOutlined,
  CheckCircleOutlined,
  CrownOutlined,
  FileProtectOutlined,
  KeyOutlined,
  LogoutOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useMemo, useState } from 'react';
import type { AdminUserUpdatePayload, AuditLog, UserAccount } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

type Props = {
  currentUser: UserAccount;
  users: UserAccount[];
  auditLogs: AuditLog[];
  loading: boolean;
  updatingId: number | null;
  message: string | null;
  onRefresh: () => void;
  onUpdate: (userId: number, payload: AdminUserUpdatePayload) => void;
  onRevokeSessions: (userId: number) => void;
  onResetPassword: (userId: number, newPassword: string) => void;
};

type PendingAction = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => void;
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

function formatAccountDate(value: string | null) {
  if (!value) return '기록 없음';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function auditLabel(eventType: string) {
  return {
    account_created: '계정 생성',
    login_succeeded: '로그인',
    user_updated: '사용자 변경',
    password_changed: '비밀번호 변경',
    password_reset: '비밀번호 초기화',
    sessions_revoked: '세션 만료',
  }[eventType] ?? eventType;
}

export function TeamAccessPanel({
  currentUser,
  users,
  auditLogs,
  loading,
  updatingId,
  message,
  onRefresh,
  onUpdate,
  onRevokeSessions,
  onResetPassword,
}: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const isOwner = currentUser.role === 'owner';
  const pendingCount = users.filter((user) => user.approval_status === 'pending').length;
  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !normalized ||
        user.name.toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' && user.approval_status === 'pending') ||
        (statusFilter === 'active' && user.is_active) ||
        (statusFilter === 'disabled' && !user.is_active);
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, users]);

  function confirmUpdate(user: UserAccount, payload: AdminUserUpdatePayload) {
    const approving = user.approval_status === 'pending' && payload.is_active === true;
    const disabling = user.is_active && payload.is_active === false;
    setPendingAction({
      title: approving ? `${user.name} 가입 승인` : `${user.name} 계정 비활성화`,
      description: approving
        ? '선택한 모듈 권한으로 사내 시스템 로그인을 허용합니다.'
        : '기존 세션이 즉시 만료되고 다시 로그인할 수 없습니다.',
      confirmLabel: approving ? '승인' : '비활성화',
      danger: disabling,
      run: () => onUpdate(user.id, payload),
    });
  }

  return (
    <article className="team-access-panel">
      <div className="team-access-head">
        <div>
          <span className="eyebrow"><TeamOutlined /> TEAM ACCESS</span>
          <h3>사내 사용자 관리</h3>
          <p>가입 승인, 모듈 권한, 세션과 보안 이력을 한곳에서 관리합니다.</p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={onRefresh} type="button">
          <ReloadOutlined spin={loading} /> 새로고침
        </button>
      </div>

      <div className="team-access-summary">
        <span><strong>{users.length}</strong> 전체 계정</span>
        <span className={pendingCount > 0 ? 'pending' : ''}><strong>{pendingCount}</strong> 승인 대기</span>
      </div>

      <div className="team-access-filters">
        <label>
          <SearchOutlined />
          <input
            aria-label="사용자 검색"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름 또는 이메일 검색"
            value={query}
          />
        </label>
        <select aria-label="계정 상태 필터" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="all">전체 상태</option>
          <option value="pending">승인 대기</option>
          <option value="active">활성</option>
          <option value="disabled">비활성</option>
        </select>
      </div>

      <div className="team-user-list">
        {filteredUsers.map((user) => {
          const isSelf = user.id === currentUser.id;
          const isProtected = user.role === 'owner' || isSelf;
          const adminCanManage = currentUser.role === 'admin' && user.role === 'member';
          const canManage = !isProtected && (isOwner || adminCanManage);
          const updating = updatingId === user.id;
          return (
            <div className={`team-user-row ${user.is_active ? '' : 'inactive'}`} key={user.id}>
              <div className="team-user-identity">
                <span className="team-user-avatar">
                  {user.role === 'owner' ? <CrownOutlined /> : user.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{user.name}{isSelf ? ' · 나' : ''}</strong>
                  <small>{user.email}</small>
                  <small>가입 {formatAccountDate(user.created_at)} · 최근 로그인 {formatAccountDate(user.last_login_at)}</small>
                </span>
              </div>
              <div className="team-user-state">
                <span className={`role-chip ${user.role}`}>{roleLabel(user.role)}</span>
                <span className={`approval-chip ${user.approval_status}`}>{statusLabel(user)}</span>
              </div>
              <div className="team-module-access" aria-label={`${user.name} 모듈 권한`}>
                <button
                  aria-pressed={user.can_access_stocks}
                  className={user.can_access_stocks ? 'active' : ''}
                  disabled={!canManage || updating}
                  onClick={() => onUpdate(user.id, { can_access_stocks: !user.can_access_stocks })}
                  type="button"
                >
                  <BarChartOutlined /> 주식 Lab
                </button>
                <button
                  aria-pressed={user.can_access_content_ops}
                  className={user.can_access_content_ops ? 'active' : ''}
                  disabled={!canManage || updating}
                  onClick={() => onUpdate(user.id, { can_access_content_ops: !user.can_access_content_ops })}
                  type="button"
                >
                  <VideoCameraOutlined /> Content Ops
                </button>
              </div>
              <div className="team-user-actions">
                <select
                  aria-label={`${user.name} 역할`}
                  disabled={!canManage || !isOwner || updating}
                  onChange={(event) => onUpdate(user.id, { role: event.target.value as 'admin' | 'member' })}
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
                    onClick={() => confirmUpdate(user, { is_active: true })}
                    type="button"
                  ><CheckCircleOutlined /> 승인</button>
                ) : (
                  <button
                    className={user.is_active ? 'danger-button compact-button' : 'secondary-button compact-button'}
                    disabled={!canManage || updating}
                    onClick={() => user.is_active
                      ? confirmUpdate(user, { is_active: false })
                      : onUpdate(user.id, { is_active: true })}
                    type="button"
                  >
                    {user.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                    {user.is_active ? ' 비활성화' : ' 활성화'}
                  </button>
                )}
                <button
                  className="secondary-button compact-button"
                  disabled={!canManage || !user.is_active || updating}
                  onClick={() => setPendingAction({
                    title: `${user.name} 세션 강제 종료`,
                    description: '현재 로그인된 모든 기기에서 즉시 로그아웃됩니다.',
                    confirmLabel: '세션 종료',
                    danger: true,
                    run: () => onRevokeSessions(user.id),
                  })}
                  type="button"
                ><LogoutOutlined /> 세션 종료</button>
                {isOwner && canManage && (
                  <button
                    className="secondary-button compact-button"
                    onClick={() => setResetUserId(resetUserId === user.id ? null : user.id)}
                    type="button"
                  ><KeyOutlined /> 비밀번호 초기화</button>
                )}
              </div>
              {resetUserId === user.id && (
                <form
                  className="team-password-reset"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onResetPassword(user.id, temporaryPassword);
                    setTemporaryPassword('');
                    setResetUserId(null);
                  }}
                >
                  <input
                    aria-label={`${user.name} 임시 비밀번호`}
                    minLength={8}
                    onChange={(event) => setTemporaryPassword(event.target.value)}
                    placeholder="8자 이상 임시 비밀번호"
                    required
                    type="password"
                    value={temporaryPassword}
                  />
                  <button className="primary-button compact-button" type="submit">초기화</button>
                </form>
              )}
            </div>
          );
        })}
        {!loading && filteredUsers.length === 0 && <div className="empty-state">조건에 맞는 사용자가 없습니다.</div>}
      </div>
      {message && <div className="inline-message" role="status">{message}</div>}

      <details className="team-audit-log">
        <summary><FileProtectOutlined /> 보안 감사 로그 <span>{auditLogs.length}건</span></summary>
        <div>
          {auditLogs.map((log) => (
            <p key={log.id}>
              <strong>{auditLabel(log.event_type)}</strong>
              <span>{log.actor_name ?? '시스템'} → {log.target_name ?? '알 수 없음'}</span>
              <small>{formatAccountDate(log.created_at)}</small>
            </p>
          ))}
          {auditLogs.length === 0 && <span className="empty-state">기록이 없습니다.</span>}
        </div>
      </details>

      <ConfirmDialog
        busy={updatingId !== null}
        confirmLabel={pendingAction?.confirmLabel}
        danger={pendingAction?.danger}
        description={pendingAction?.description ?? ''}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          pendingAction?.run();
          setPendingAction(null);
        }}
        open={pendingAction !== null}
        title={pendingAction?.title ?? ''}
      />
    </article>
  );
}
