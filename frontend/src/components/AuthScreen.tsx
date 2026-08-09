import {
  BarChartOutlined,
  BookOutlined,
  CrownOutlined,
  LockOutlined,
  LoginOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { FormEvent } from 'react';
import { SectionTitle } from './shared';
import type { ProUpgradeRequest, UserAccount } from '../types';

export type AuthMode = 'signup' | 'login';

export function AuthScreen({
  active,
  currentUser,
  myProRequest,
  proRequestLoading,
  proRequestMessage,
  onCreateProRequest,
  onStartPayment,
  paymentLoading,
  paymentMessage,
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
}: {
  active: boolean;
  currentUser: UserAccount | null;
  myProRequest: ProUpgradeRequest | null;
  proRequestLoading: boolean;
  proRequestMessage: string | null;
  onCreateProRequest: () => void;
  onStartPayment: () => void;
  paymentLoading: boolean;
  paymentMessage: string | null;
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
}) {
  return (
    <section className={active ? 'section-block' : 'screen-hidden'} id="auth">
      <SectionTitle
        eyebrow="Access First"
        icon={<SafetyCertificateOutlined />}
        title="회원가입과 로그인"
      />
      <div className="access-grid">
        <article className="tool-pane">
          <div className="pane-title">
            {currentUser ? <TeamOutlined /> : <UserAddOutlined />}
            <h3>{currentUser ? '내 계정' : '회원 인증'}</h3>
          </div>
          <div className="pane-body">
            {currentUser ? (
              <div className="account-panel">
                <div>
                  <span className="eyebrow">Signed In</span>
                  <h3>{currentUser.name}</h3>
                  <p>{currentUser.email}</p>
                </div>
                <span className="role-chip">{currentUser.role}</span>
                <div className="pro-request-box">
                  <strong>Plan: {currentUser.plan.toUpperCase()}</strong>
                  {currentUser.plan === 'pro' ? (
                    <p>Pro 기능을 사용할 수 있습니다.</p>
                  ) : myProRequest?.status === 'pending' ? (
                    <p>Pro 업그레이드 신청이 관리자 확인을 기다리고 있습니다.</p>
                  ) : (
                    <div className="pro-request-actions">
                      <button
                        className="primary-button"
                        disabled={paymentLoading}
                        onClick={onStartPayment}
                        type="button"
                      >
                        <CrownOutlined />
                        {paymentLoading ? '결제 준비 중' : '카드 결제로 즉시 업그레이드'}
                      </button>
                      <button
                        className="secondary-button"
                        disabled={proRequestLoading}
                        onClick={onCreateProRequest}
                        type="button"
                      >
                        Pro 업그레이드 신청 (관리자 승인)
                      </button>
                    </div>
                  )}
                  {myProRequest && myProRequest.status !== 'pending' && (
                    <small>
                      최근 신청: {myProRequest.status}
                      {myProRequest.admin_note ? ` · ${myProRequest.admin_note}` : ''}
                    </small>
                  )}
                  {proRequestMessage && <div className="inline-message">{proRequestMessage}</div>}
                  {paymentMessage && <div className="inline-message">{paymentMessage}</div>}
                </div>
                <button className="secondary-button" onClick={onLogout} type="button">
                  <LogoutOutlined />
                  로그아웃
                </button>
              </div>
            ) : (
              <form className="auth-form" onSubmit={onSubmit}>
                <div className="segmented-control">
                  <button
                    className={authMode === 'signup' ? 'active' : ''}
                    onClick={() => onAuthModeChange('signup')}
                    type="button"
                  >
                    회원가입
                  </button>
                  <button
                    className={authMode === 'login' ? 'active' : ''}
                    onClick={() => onAuthModeChange('login')}
                    type="button"
                  >
                    로그인
                  </button>
                </div>
                {authMode === 'signup' && (
                  <label>
                    <span>이름</span>
                    <input
                      autoComplete="name"
                      onChange={(event) => onNameChange(event.target.value)}
                      required
                      value={name}
                    />
                  </label>
                )}
                <label>
                  <span>이메일</span>
                  <input
                    autoComplete="email"
                    onChange={(event) => onEmailChange(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </label>
                <label>
                  <span>비밀번호</span>
                  <input
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={8}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </label>
                <button className="primary-button" disabled={authLoading} type="submit">
                  {authMode === 'signup' ? <UserAddOutlined /> : <LoginOutlined />}
                  {authLoading ? '처리 중' : authMode === 'signup' ? '계정 만들기' : '로그인'}
                </button>
                {authMessage && <div className="inline-message">{authMessage}</div>}
              </form>
            )}
          </div>
        </article>

        <article className="tool-pane">
          <div className="pane-title">
            <LockOutlined />
            <h3>로그인 후 이동</h3>
          </div>
          <div className="pane-body">
            <div className="login-route-list">
              <a href="#stocks">
                <BarChartOutlined />
                국내 주식 분석 화면으로 이동
              </a>
              <a href="#manual">
                <BookOutlined />
                사용 매뉴얼 화면으로 이동
              </a>
              <a href="#admin">
                <CrownOutlined />
                관리자 화면으로 이동
              </a>
            </div>
            <p>
              첫 번째 가입자는 자동으로 관리자 권한을 받습니다. 이후 가입자는 일반 회원으로 등록되고,
              관리자가 역할과 활성 상태를 조정합니다.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
