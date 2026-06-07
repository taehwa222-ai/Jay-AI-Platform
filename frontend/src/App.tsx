import {
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CrownOutlined,
  DeploymentUnitOutlined,
  DollarOutlined,
  LoginOutlined,
  LockOutlined,
  LogoutOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { FormEvent, useEffect, useState } from 'react';
import {
  getAdminUsers,
  getHealth,
  getManual,
  getMe,
  getModules,
  getMonetizationIdeas,
  getOverview,
  getRoadmap,
  login,
  signup,
  updateAdminUser,
} from './api';
import type {
  AuthResponse,
  HealthStatus,
  ManualSection,
  MonetizationIdea,
  PlatformModule,
  PlatformOverview,
  RoadmapPhase,
  UserAccount,
} from './types';

const stockPlan = [
  {
    title: '국내 종목 분석',
    body: '가격, 거래량, 재무, 공시, 뉴스 요약을 모아 종목별 분석 리포트를 만듭니다.',
  },
  {
    title: '추천 후보 목록',
    body: '매수 지시가 아니라 조건 기반 관심 후보와 근거를 보여주는 방식으로 시작합니다.',
  },
  {
    title: '내 주식 관리',
    body: '보유 종목, 매수가, 비중, 손익, 리스크 메모, 리밸런싱 체크리스트를 관리합니다.',
  },
  {
    title: '규제 안전장치',
    body: '수익 보장 표현, 맞춤 매매 지시, 양방향 유료 리딩방 형태는 별도 검토 대상으로 둡니다.',
  },
];

const TOKEN_STORAGE_KEY = 'jay-ai-platform-token';

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [manual, setManual] = useState<ManualSection[]>([]);
  const [ideas, setIdeas] = useState<MonetizationIdea[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapPhase[]>([]);
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? '');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [adminUsers, setAdminUsers] = useState<UserAccount[]>([]);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminUpdatingId, setAdminUpdatingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshState();
  }, []);

  useEffect(() => {
    if (token) {
      void restoreSession(token);
    }
  }, [token]);

  async function refreshState() {
    setLoading(true);
    setError(null);

    try {
      const [healthResult, overviewResult, modulesResult, manualResult, ideasResult, roadmapResult] =
        await Promise.all([
          getHealth(),
          getOverview(),
          getModules(),
          getManual(),
          getMonetizationIdeas(),
          getRoadmap(),
        ]);
      setHealth(healthResult);
      setOverview(overviewResult);
      setModules(modulesResult);
      setManual(manualResult);
      setIdeas(ideasResult);
      setRoadmap(roadmapResult);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  async function restoreSession(savedToken: string) {
    try {
      const user = await getMe(savedToken);
      setCurrentUser(user);
      if (user.role === 'admin') {
        await loadAdminUsers(savedToken);
      }
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken('');
      setCurrentUser(null);
      setAdminUsers([]);
    }
  }

  async function handleAuthSubmit(event: FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    try {
      const response =
        authMode === 'signup'
          ? await signup({ email, password, name })
          : await login({ email, password });
      applyAuth(response);
      setPassword('');
      setAuthMessage(authMode === 'signup' ? '회원가입이 완료되었습니다.' : '로그인되었습니다.');
    } catch (requestError) {
      setAuthMessage(requestError instanceof Error ? requestError.message : 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  }

  function applyAuth(response: AuthResponse) {
    localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
    setToken(response.access_token);
    setCurrentUser(response.user);
    if (response.user.role === 'admin') {
      void loadAdminUsers(response.access_token);
    }
  }

  async function loadAdminUsers(activeToken = token) {
    if (!activeToken) return;
    const users = await getAdminUsers(activeToken);
    setAdminUsers(users);
  }

  async function handleAdminUserUpdate(userId: number, payload: { role?: 'admin' | 'member'; is_active?: boolean }) {
    if (!token) return;
    setAdminUpdatingId(userId);
    setAdminMessage(null);

    try {
      const updated = await updateAdminUser(token, userId, payload);
      setAdminUsers((users) => users.map((user) => (user.id === updated.id ? updated : user)));
      setAdminMessage('회원 정보가 업데이트되었습니다.');
    } catch (requestError) {
      setAdminMessage(requestError instanceof Error ? requestError.message : 'Update failed.');
    } finally {
      setAdminUpdatingId(null);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setCurrentUser(null);
    setAdminUsers([]);
    setAuthMessage('로그아웃되었습니다.');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <DeploymentUnitOutlined />
          <span>Jay AI Platform</span>
        </div>
        <nav className="nav-list" aria-label="Primary">
          <a href="#access">
            <TeamOutlined />
            회원/관리
          </a>
          <a href="#manual">
            <BookOutlined />
            사용 매뉴얼
          </a>
          <a href="#stocks">
            <BarChartOutlined />
            국내주식
          </a>
          <a href="#revenue">
            <DollarOutlined />
            수익화
          </a>
        </nav>
        <div className="sidebar-status">
          <span className={`status-dot ${health?.ok ? 'online' : ''}`} />
          <span>{health?.ok ? 'server online' : 'checking server'}</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">AI Revenue Platform</span>
            <h1>AI 수익화 운영 콘솔</h1>
          </div>
          <button
            className="icon-button"
            disabled={loading}
            onClick={() => void refreshState()}
            title="Refresh"
            type="button"
          >
            <ReloadOutlined />
          </button>
        </header>

        {error && <div className="error-box">{error}</div>}

        <section className="metric-band" id="foundation">
          <StatusTile label="API" value={health?.ok ? 'Online' : 'Checking'} tone={health?.ok ? 'good' : 'muted'} />
          <StatusTile label="우선순위" value="회원/관리" tone="steady" />
          <StatusTile label="운영 형태" value="VPS 배포형" />
        </section>

        <section className="hero-panel">
          <div>
            <span className="state-chip">{overview?.status ?? 'loading'}</span>
            <h2>{overview?.name ?? 'Jay AI Platform'}</h2>
            <p>{overview?.message ?? 'Loading platform overview.'}</p>
          </div>
          <div className="hero-actions">
            <a href="#manual">
              <BookOutlined />
              매뉴얼 보기
            </a>
            <a href="#access">
              <LockOutlined />
              권한 설계
            </a>
          </div>
        </section>

        <section className="section-block" id="access">
          <SectionTitle
            eyebrow="Access First"
            icon={<SafetyCertificateOutlined />}
            title="회원가입/로그인과 관리페이지"
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
                    <button className="secondary-button" onClick={logout} type="button">
                      <LogoutOutlined />
                      로그아웃
                    </button>
                  </div>
                ) : (
                  <form className="auth-form" onSubmit={(event) => void handleAuthSubmit(event)}>
                    <div className="segmented-control">
                      <button
                        className={authMode === 'signup' ? 'active' : ''}
                        onClick={() => setAuthMode('signup')}
                        type="button"
                      >
                        회원가입
                      </button>
                      <button
                        className={authMode === 'login' ? 'active' : ''}
                        onClick={() => setAuthMode('login')}
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
                          onChange={(event) => setName(event.target.value)}
                          required
                          value={name}
                        />
                      </label>
                    )}
                    <label>
                      <span>이메일</span>
                      <input
                        autoComplete="email"
                        onChange={(event) => setEmail(event.target.value)}
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
                        onChange={(event) => setPassword(event.target.value)}
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
                <CrownOutlined />
                <h3>관리페이지</h3>
              </div>
              <div className="pane-body">
                {currentUser?.role === 'admin' ? (
                  <div className="admin-panel">
                    <div className="admin-head">
                      <p>현재 등록된 회원을 확인합니다. 첫 가입자는 자동으로 관리자입니다.</p>
                      <button
                        className="secondary-button"
                        onClick={() => void loadAdminUsers()}
                        type="button"
                      >
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
                            {currentUser?.id === user.id && <small>내 계정</small>}
                          </div>
                          <div className="user-controls">
                            <select
                              disabled={currentUser?.id === user.id || adminUpdatingId === user.id}
                              onChange={(event) =>
                                void handleAdminUserUpdate(user.id, {
                                  role: event.target.value as 'admin' | 'member',
                                })
                              }
                              value={user.role}
                            >
                              <option value="admin">admin</option>
                              <option value="member">member</option>
                            </select>
                            <button
                              className={user.is_active ? 'danger-button' : 'secondary-button'}
                              disabled={currentUser?.id === user.id || adminUpdatingId === user.id}
                              onClick={() =>
                                void handleAdminUserUpdate(user.id, { is_active: !user.is_active })
                              }
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
                  <div className="empty-state">
                    관리자 계정으로 로그인하면 회원 목록과 운영 설정을 볼 수 있습니다.
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="section-block">
          <SectionTitle eyebrow="Service Map" icon={<AppstoreOutlined />} title="개발할 모듈 구조" />
          <div className="module-grid">
            {modules.map((module) => (
              <article className="module-card" key={module.id}>
                <div className="card-head">
                  <h3>{module.title}</h3>
                  <span>{module.status}</span>
                </div>
                <p>{module.description}</p>
                <ul>
                  {module.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" id="manual">
          <SectionTitle
            eyebrow="Manual Screen"
            icon={<BookOutlined />}
            title="로컬 개발부터 VPS 배포까지"
          />
          <div className="manual-list">
            {manual.map((section) => (
              <article className="manual-card" key={section.id}>
                <div>
                  <h3>{section.title}</h3>
                  <p>{section.summary}</p>
                </div>
                <div className="command-list">
                  {section.commands.map((command) => (
                    <code key={command}>{command}</code>
                  ))}
                </div>
                <ul className="check-list">
                  {section.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" id="stocks">
          <SectionTitle eyebrow="Korea Stock Lab" icon={<BarChartOutlined />} title="국내 주식 분석과 내 주식 관리" />
          <div className="stock-grid">
            {stockPlan.map((item) => (
              <article className="stock-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" id="revenue">
          <SectionTitle eyebrow="Revenue Lab" icon={<DollarOutlined />} title="수익 창출 아이디어" />
          <div className="idea-grid">
            {ideas.map((idea) => (
              <article className="idea-card" key={idea.id}>
                <h3>{idea.title}</h3>
                <dl>
                  <dt>모델</dt>
                  <dd>{idea.model}</dd>
                  <dt>주의</dt>
                  <dd>{idea.risk}</dd>
                  <dt>다음 작업</dt>
                  <dd>{idea.next_step}</dd>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="phase-list" id="roadmap">
          {roadmap.map((phase) => (
            <article className="phase-card" key={phase.id}>
              <div className="phase-head">
                <h3>{phase.title}</h3>
                <span>{phase.status}</span>
              </div>
              <ul>
                {phase.items.map((item) => (
                  <li key={item}>
                    <CheckCircleOutlined />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function StatusTile({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'muted' | 'steady';
}) {
  return (
    <div className={`status-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionTitle({ eyebrow, icon, title }: { eyebrow: string; icon: ReactNode; title: string }) {
  return (
    <div className="section-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <span className="section-icon">{icon}</span>
    </div>
  );
}
