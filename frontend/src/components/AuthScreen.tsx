import {
  CheckCircleOutlined,
  LockOutlined,
  LoginOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { FormEvent } from 'react';
import type { UserAccount } from '../types';

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
}: Props) {
  if (!active) return null;

  return (
    <section className="auth-layout" id="auth">
      <div className="auth-showcase">
        <span className="auth-lockup"><LockOutlined /> PRIVATE WORKSPACE</span>
        <h2>대표 전용 로그인</h2>
        <p>흩어진 투자 리서치와 콘텐츠 운영을 하나의 안전한 개인 워크스페이스에서 관리하세요.</p>
        <div className="auth-benefits">
          <span><CheckCircleOutlined /> 단일 대표 계정만 접근</span>
          <span><CheckCircleOutlined /> 로컬 데이터 우선 보존</span>
          <span><CheckCircleOutlined /> AI 비용 가드레일 적용</span>
        </div>
        <div className="auth-security-note">
          <SafetyCertificateOutlined />
          <span><strong>Owner-only access</strong><small>외부 고객과 공유되지 않는 내부 운영 시스템입니다.</small></span>
        </div>
      </div>

      {currentUser ? (
        <div className="auth-card owner-session-card">
          <span className="state-chip">ACTIVE OWNER SESSION</span>
          <div className="owner-session-avatar">{currentUser.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <h3>{currentUser.name}</h3>
            <p>{currentUser.email}</p>
          </div>
          <p className="auth-helper">주식 분석 Lab과 Content Ops의 모든 기능을 사용할 수 있습니다.</p>
          <button className="secondary-button" onClick={onLogout} type="button">
            <LogoutOutlined /> 로그아웃
          </button>
        </div>
      ) : (
        <div className="auth-card">
          <div className="auth-card-head">
            <span className="eyebrow">SECURE ACCESS</span>
            <h3>{authMode === 'login' ? '다시 오신 것을 환영합니다' : '대표 계정 시작하기'}</h3>
            <p>{authMode === 'login' ? '대표 계정으로 로그인하세요.' : '최초 한 번만 계정을 생성합니다.'}</p>
          </div>
          <div className="auth-mode-tabs" role="tablist" aria-label="대표 계정 접속 방식">
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
              <UserAddOutlined /> 최초 대표 계정 생성
            </button>
          </div>
          <form className="auth-form" onSubmit={onSubmit}>
            {authMode === 'signup' && (
              <label>
                <span>대표 이름</span>
                <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="이름을 입력하세요" required />
              </label>
            )}
            <label>
              <span>이메일</span>
              <input
                autoComplete="email"
                placeholder="owner@example.com"
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
              {authLoading ? '처리 중…' : authMode === 'login' ? '로그인' : '대표 계정 생성'}
            </button>
          </form>
          {authMessage && <div className="inline-message" role="status">{authMessage}</div>}
          <p className="auth-helper">대표 계정은 최초 한 번만 생성되며 이후에는 로그인만 사용합니다.</p>
        </div>
      )}
    </section>
  );
}
