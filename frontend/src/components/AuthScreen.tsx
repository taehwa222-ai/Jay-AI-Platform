import {
  CheckCircleOutlined,
  LockOutlined,
  LoginOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { FormEvent } from 'react';
import type { AdminUserUpdatePayload, UserAccount } from '../types';
import { TeamAccessPanel } from './TeamAccessPanel';

export type AuthMode = 'signup' | 'login';

type Props = {
  active: boolean;
  currentUser: UserAccount | null;
  onLogout: () => void;
  authMode: AuthMode;
  onAuthModeChange: (mode: AuthMode) => void;
  name: string;
  onNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  authLoading: boolean;
  authMessage: string | null;
  onSubmit: (event: FormEvent) => void;
  adminUsers: UserAccount[];
  adminUsersLoading: boolean;
  adminUpdatingId: number | null;
  adminMessage: string | null;
  onRefreshAdminUsers: () => void;
  onUpdateAdminUser: (userId: number, payload: AdminUserUpdatePayload) => void;
};

export function AuthScreen({
  active,
  currentUser,
  onLogout,
  authMode,
  onAuthModeChange,
  name,
  onNameChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  authLoading,
  authMessage,
  onSubmit,
  adminUsers,
  adminUsersLoading,
  adminUpdatingId,
  adminMessage,
  onRefreshAdminUsers,
  onUpdateAdminUser,
}: Props) {
  if (!active) return null;

  return (
    <section className="auth-layout" id="auth">
      <div className="auth-showcase">
        <span className="auth-lockup"><LockOutlined /> INTERNAL WORKSPACE</span>
        <h2>사내 구성원 로그인</h2>
        <p>대표와 승인된 구성원이 투자 리서치와 콘텐츠 운영을 하나의 워크스페이스에서 관리합니다.</p>
        <div className="auth-benefits">
          <span><CheckCircleOutlined /> 관리자 승인 기반 접근</span>
          <span><CheckCircleOutlined /> 로컬 데이터 우선 보존</span>
          <span><CheckCircleOutlined /> AI 비용 가드레일 적용</span>
        </div>
        <div className="auth-security-note">
          <SafetyCertificateOutlined />
          <span><strong>Internal team access</strong><small>결제·고객 계정 없이 사내 구성원만 사용하는 운영 시스템입니다.</small></span>
        </div>
      </div>

      {currentUser ? (
        <div className="auth-card owner-session-card">
          <span className="state-chip">ACTIVE TEAM SESSION · {currentUser.role.toUpperCase()}</span>
          <div className="owner-session-avatar">{currentUser.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <h3>{currentUser.name}</h3>
            <p>{currentUser.email}</p>
          </div>
          <p className="auth-helper">승인된 사내 계정으로 주식 분석 Lab과 Content Ops를 사용 중입니다.</p>
          <button className="secondary-button" onClick={onLogout} type="button">
            <LogoutOutlined /> 로그아웃
          </button>
        </div>
      ) : (
        <div className="auth-card">
          <div className="auth-card-head">
            <span className="eyebrow">SECURE ACCESS</span>
            <h3>{authMode === 'login' ? '다시 오신 것을 환영합니다' : '사내 계정 가입 신청'}</h3>
            <p>{authMode === 'login' ? '승인된 사내 계정으로 로그인하세요.' : '가입 후 대표 또는 관리자의 승인을 기다립니다.'}</p>
          </div>
          <div className="auth-mode-tabs" role="tablist" aria-label="사내 계정 접속 방식">
            <button
              aria-selected={authMode === 'login'}
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => onAuthModeChange('login')}
              role="tab"
              type="button"
            >
              <LoginOutlined /> 로그인
            </button>
            <button
              aria-selected={authMode === 'signup'}
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => onAuthModeChange('signup')}
              role="tab"
              type="button"
            >
              <UserAddOutlined /> 가입 신청
            </button>
          </div>
          <form className="auth-form" onSubmit={onSubmit}>
            {authMode === 'signup' && (
              <label>
                <span>이름</span>
                <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="이름을 입력하세요" required />
              </label>
            )}
            <label>
              <span>이메일</span>
              <input
                autoComplete="email"
                placeholder="name@company.com"
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                required
              />
            </label>
            <label>
              <span>비밀번호</span>
              <input
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                minLength={authMode === 'signup' ? 8 : 1}
                placeholder="비밀번호를 입력하세요"
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                required
              />
            </label>
            <button className="primary-button auth-submit" disabled={authLoading} type="submit">
              {authLoading ? '처리 중…' : authMode === 'login' ? '로그인' : '가입 신청'}
            </button>
          </form>
          {authMessage && <div className="inline-message" role="status">{authMessage}</div>}
          <p className="auth-helper">첫 계정은 대표 권한으로 생성되며 이후 가입자는 승인 후 로그인할 수 있습니다.</p>
        </div>
      )}

      {currentUser && ['owner', 'admin'].includes(currentUser.role) && (
        <TeamAccessPanel
          currentUser={currentUser}
          loading={adminUsersLoading}
          message={adminMessage}
          onRefresh={onRefreshAdminUsers}
          onUpdate={onUpdateAdminUser}
          updatingId={adminUpdatingId}
          users={adminUsers}
        />
      )}
    </section>
  );
}
