import {
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CrownOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  DollarOutlined,
  LineChartOutlined,
  LoginOutlined,
  LockOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { FormEvent, useEffect, useState } from 'react';
import {
  analyzeStock,
  createStockHolding,
  deleteStockHolding,
  getAdminUsers,
  getHealth,
  getManual,
  getMe,
  getModules,
  getMonetizationIdeas,
  getOverview,
  getRoadmap,
  getStockHoldings,
  getStockMarketSnapshot,
  login,
  signup,
  updateAdminUser,
  updateStockHolding,
} from './api';
import type {
  AuthResponse,
  HealthStatus,
  ManualSection,
  MonetizationIdea,
  PlatformModule,
  PlatformOverview,
  RoadmapPhase,
  StockAnalysisPayload,
  StockAnalysisResult,
  StockHolding,
  StockHoldingPayload,
  StockMarketSnapshot,
  UserAccount,
} from './types';

const TOKEN_STORAGE_KEY = 'jay-ai-platform-token';

type HoldingForm = {
  ticker: string;
  name: string;
  quantity: string;
  average_price: string;
  current_price: string;
  investment_thesis: string;
  risk_memo: string;
};

type AnalysisForm = {
  ticker: string;
  name: string;
  current_price: string;
  previous_close: string;
  volume: string;
  previous_volume: string;
  rsi: string;
  macd: string;
  macd_signal: string;
  memo: string;
};

const emptyHoldingForm: HoldingForm = {
  ticker: '',
  name: '',
  quantity: '',
  average_price: '',
  current_price: '',
  investment_thesis: '',
  risk_memo: '',
};

const defaultAnalysisForm: AnalysisForm = {
  ticker: '005930',
  name: '삼성전자',
  current_price: '',
  previous_close: '',
  volume: '',
  previous_volume: '',
  rsi: '55',
  macd: '0',
  macd_signal: '0',
  memo: '',
};

const stockWorkflows = [
  {
    title: '조건 기반 추천 후보',
    body: '거래량 200% 이상, RSI, MACD, 가격 변화율을 점수화해 관심 후보를 분리합니다.',
  },
  {
    title: '내 보유 종목 관리',
    body: '보유 수량, 평단가, 현재가, 투자 근거, 리스크 메모를 계정별로 저장합니다.',
  },
  {
    title: 'AI 요약 확장',
    body: '서버에 OpenAI 키가 있으면 같은 분석 데이터를 기반으로 한국어 요약을 추가합니다.',
  },
  {
    title: '규제 안전장치',
    body: '수익 보장이나 매수/매도 지시가 아니라 검토용 체크리스트와 리스크를 제공합니다.',
  },
];

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
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [holdingForm, setHoldingForm] = useState<HoldingForm>(emptyHoldingForm);
  const [holdingMessage, setHoldingMessage] = useState<string | null>(null);
  const [holdingLoading, setHoldingLoading] = useState(false);
  const [currentPriceDrafts, setCurrentPriceDrafts] = useState<Record<number, string>>({});
  const [savingCurrentPriceId, setSavingCurrentPriceId] = useState<number | null>(null);
  const [analysisForm, setAnalysisForm] = useState<AnalysisForm>(defaultAnalysisForm);
  const [analysisResult, setAnalysisResult] = useState<StockAnalysisResult | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketSnapshot, setMarketSnapshot] = useState<StockMarketSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portfolioTotals = holdings.reduce(
    (totals, holding) => ({
      cost: totals.cost + holding.cost_basis,
      value: totals.value + holding.market_value,
      profit: totals.profit + holding.profit_loss,
    }),
    { cost: 0, value: 0, profit: 0 },
  );
  const portfolioProfitPercent =
    portfolioTotals.cost > 0 ? (portfolioTotals.profit / portfolioTotals.cost) * 100 : 0;

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
      await loadStockHoldings(savedToken);
      if (user.role === 'admin') {
        await loadAdminUsers(savedToken);
      }
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken('');
      setCurrentUser(null);
      setAdminUsers([]);
      setHoldings([]);
      setCurrentPriceDrafts({});
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
    void loadStockHoldings(response.access_token);
    if (response.user.role === 'admin') {
      void loadAdminUsers(response.access_token);
    }
  }

  async function loadAdminUsers(activeToken = token) {
    if (!activeToken) return;
    const users = await getAdminUsers(activeToken);
    setAdminUsers(users);
  }

  async function handleAdminUserUpdate(
    userId: number,
    payload: { role?: 'admin' | 'member'; is_active?: boolean },
  ) {
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

  async function loadStockHoldings(activeToken = token) {
    if (!activeToken) return;
    const result = await getStockHoldings(activeToken);
    setHoldings(result);
    setCurrentPriceDrafts(
      Object.fromEntries(result.map((holding) => [holding.id, String(holding.current_price)])),
    );
  }

  async function handleCreateHolding(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setHoldingLoading(true);
    setHoldingMessage(null);

    try {
      const created = await createStockHolding(token, buildHoldingPayload(holdingForm));
      setHoldings((items) => [created, ...items]);
      setCurrentPriceDrafts((drafts) => ({ ...drafts, [created.id]: String(created.current_price) }));
      setHoldingForm(emptyHoldingForm);
      setHoldingMessage('보유 종목이 저장되었습니다.');
    } catch (requestError) {
      setHoldingMessage(requestError instanceof Error ? requestError.message : 'Holding save failed.');
    } finally {
      setHoldingLoading(false);
    }
  }

  async function handleCurrentPriceSave(holding: StockHolding) {
    if (!token) return;
    setSavingCurrentPriceId(holding.id);
    setHoldingMessage(null);

    try {
      const updated = await updateStockHolding(token, holding.id, {
        current_price: toNumber(currentPriceDrafts[holding.id]),
      });
      setHoldings((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setCurrentPriceDrafts((drafts) => ({ ...drafts, [updated.id]: String(updated.current_price) }));
      setHoldingMessage('현재가가 업데이트되었습니다.');
    } catch (requestError) {
      setHoldingMessage(requestError instanceof Error ? requestError.message : 'Price update failed.');
    } finally {
      setSavingCurrentPriceId(null);
    }
  }

  async function handleDeleteHolding(holdingId: number) {
    if (!token) return;
    setHoldingMessage(null);

    try {
      await deleteStockHolding(token, holdingId);
      setHoldings((items) => items.filter((item) => item.id !== holdingId));
      setCurrentPriceDrafts((drafts) => {
        const next = { ...drafts };
        delete next[holdingId];
        return next;
      });
      setHoldingMessage('보유 종목이 삭제되었습니다.');
    } catch (requestError) {
      setHoldingMessage(requestError instanceof Error ? requestError.message : 'Delete failed.');
    }
  }

  async function handleAnalyzeStock(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setAnalysisLoading(true);
    setAnalysisMessage(null);

    try {
      const result = await analyzeStock(token, buildAnalysisPayload(analysisForm));
      setAnalysisResult(result);
    } catch (requestError) {
      setAnalysisMessage(requestError instanceof Error ? requestError.message : 'Analysis failed.');
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleLoadMarketSnapshot() {
    if (!token || !analysisForm.ticker.trim()) return;
    setMarketLoading(true);
    setAnalysisMessage(null);

    try {
      const snapshot = await getStockMarketSnapshot(token, analysisForm.ticker);
      setMarketSnapshot(snapshot);
      setAnalysisForm((form) => ({
        ...form,
        ticker: snapshot.ticker,
        name: form.name.trim() || snapshot.ticker,
        current_price: String(snapshot.current_price),
        previous_close: String(snapshot.previous_close),
        volume: String(snapshot.volume),
        previous_volume: String(snapshot.previous_volume),
        rsi: String(snapshot.rsi),
        macd: String(snapshot.macd),
        macd_signal: String(snapshot.macd_signal),
      }));
      setAnalysisMessage(
        `${snapshot.provider_symbol} 기준 ${snapshot.latest_trading_day} 시세와 보조지표를 불러왔습니다.`,
      );
    } catch (requestError) {
      setAnalysisMessage(
        requestError instanceof Error ? requestError.message : 'Market data load failed.',
      );
    } finally {
      setMarketLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setCurrentUser(null);
    setAdminUsers([]);
    setHoldings([]);
    setAnalysisResult(null);
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
          <StatusTile label="운영 상태" value="VPS 배포중" />
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
              권한 설정
            </a>
          </div>
        </section>

        <section className="section-block" id="access">
          <SectionTitle
            eyebrow="Access First"
            icon={<SafetyCertificateOutlined />}
            title="회원가입, 로그인, 관리페이지"
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
                      <p>현재 등록된 회원을 확인하고 역할과 계정 상태를 관리합니다.</p>
                      <button className="secondary-button" onClick={() => void loadAdminUsers()} type="button">
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
          <SectionTitle
            eyebrow="Korea Stock Lab"
            icon={<BarChartOutlined />}
            title="국내 주식 분석과 내 주식 관리"
          />
          <div className="stock-grid">
            {stockWorkflows.map((item) => (
              <article className="stock-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>

          {currentUser ? (
            <div className="stock-workspace">
              <article className="tool-pane stock-pane">
                <div className="pane-title">
                  <LineChartOutlined />
                  <h3>내 주식 포트폴리오</h3>
                </div>
                <div className="pane-body">
                  <div className="portfolio-summary">
                    <StatusTile label="평가금액" value={formatWon(portfolioTotals.value)} tone="good" />
                    <StatusTile label="투입원금" value={formatWon(portfolioTotals.cost)} />
                    <StatusTile
                      label="손익"
                      value={`${formatWon(portfolioTotals.profit)} (${formatPercent(portfolioProfitPercent)})`}
                      tone={portfolioTotals.profit >= 0 ? 'good' : 'steady'}
                    />
                  </div>

                  <form className="stock-form" onSubmit={(event) => void handleCreateHolding(event)}>
                    <label>
                      <span>종목코드</span>
                      <input
                        onChange={(event) => setHoldingForm({ ...holdingForm, ticker: event.target.value })}
                        placeholder="005930"
                        required
                        value={holdingForm.ticker}
                      />
                    </label>
                    <label>
                      <span>종목명</span>
                      <input
                        onChange={(event) => setHoldingForm({ ...holdingForm, name: event.target.value })}
                        placeholder="삼성전자"
                        required
                        value={holdingForm.name}
                      />
                    </label>
                    <label>
                      <span>보유수량</span>
                      <input
                        min="0"
                        onChange={(event) => setHoldingForm({ ...holdingForm, quantity: event.target.value })}
                        required
                        step="0.0001"
                        type="number"
                        value={holdingForm.quantity}
                      />
                    </label>
                    <label>
                      <span>평단가</span>
                      <input
                        min="0"
                        onChange={(event) =>
                          setHoldingForm({ ...holdingForm, average_price: event.target.value })
                        }
                        required
                        type="number"
                        value={holdingForm.average_price}
                      />
                    </label>
                    <label>
                      <span>현재가</span>
                      <input
                        min="0"
                        onChange={(event) =>
                          setHoldingForm({ ...holdingForm, current_price: event.target.value })
                        }
                        required
                        type="number"
                        value={holdingForm.current_price}
                      />
                    </label>
                    <label className="wide-field">
                      <span>투자 근거</span>
                      <input
                        onChange={(event) =>
                          setHoldingForm({ ...holdingForm, investment_thesis: event.target.value })
                        }
                        placeholder="예: 반도체 업황 회복, 실적 개선 기대"
                        value={holdingForm.investment_thesis}
                      />
                    </label>
                    <label className="wide-field">
                      <span>리스크 메모</span>
                      <input
                        onChange={(event) => setHoldingForm({ ...holdingForm, risk_memo: event.target.value })}
                        placeholder="예: 환율, 업황 둔화, 과열 구간"
                        value={holdingForm.risk_memo}
                      />
                    </label>
                    <button className="primary-button" disabled={holdingLoading} type="submit">
                      <PlusOutlined />
                      보유 종목 저장
                    </button>
                  </form>

                  <div className="holding-list">
                    {holdings.map((holding) => (
                      <div className="holding-row" key={holding.id}>
                        <div className="holding-main">
                          <strong>
                            {holding.name} <span>{holding.ticker}</span>
                          </strong>
                          <small>
                            {holding.quantity}주 · 평단 {formatWon(holding.average_price)} · 평가{' '}
                            {formatWon(holding.market_value)}
                          </small>
                          {(holding.investment_thesis || holding.risk_memo) && (
                            <p>
                              {holding.investment_thesis}
                              {holding.risk_memo ? ` / 리스크: ${holding.risk_memo}` : ''}
                            </p>
                          )}
                        </div>
                        <div className={`profit-box ${holding.profit_loss >= 0 ? 'positive' : 'negative'}`}>
                          <span>{formatWon(holding.profit_loss)}</span>
                          <strong>{formatPercent(holding.profit_loss_percent)}</strong>
                        </div>
                        <div className="price-editor">
                          <input
                            min="0"
                            onChange={(event) =>
                              setCurrentPriceDrafts({
                                ...currentPriceDrafts,
                                [holding.id]: event.target.value,
                              })
                            }
                            type="number"
                            value={currentPriceDrafts[holding.id] ?? holding.current_price}
                          />
                          <button
                            className="secondary-button"
                            disabled={savingCurrentPriceId === holding.id}
                            onClick={() => void handleCurrentPriceSave(holding)}
                            title="현재가 저장"
                            type="button"
                          >
                            <SaveOutlined />
                          </button>
                        </div>
                        <button
                          className="icon-danger-button"
                          onClick={() => void handleDeleteHolding(holding.id)}
                          title="삭제"
                          type="button"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    ))}
                    {holdings.length === 0 && (
                      <div className="empty-state">아직 저장된 보유 종목이 없습니다.</div>
                    )}
                  </div>
                  {holdingMessage && <div className="inline-message">{holdingMessage}</div>}
                </div>
              </article>

              <article className="tool-pane stock-pane">
                <div className="pane-title">
                  <BarChartOutlined />
                  <h3>AI 분석 후보 만들기</h3>
                </div>
                <div className="pane-body">
                  <form className="analysis-form" onSubmit={(event) => void handleAnalyzeStock(event)}>
                    <label>
                      <span>종목코드</span>
                      <input
                        onChange={(event) => setAnalysisForm({ ...analysisForm, ticker: event.target.value })}
                        required
                        value={analysisForm.ticker}
                      />
                    </label>
                    <label>
                      <span>종목명</span>
                      <input
                        onChange={(event) => setAnalysisForm({ ...analysisForm, name: event.target.value })}
                        required
                        value={analysisForm.name}
                      />
                    </label>
                    <label>
                      <span>현재가</span>
                      <input
                        min="0"
                        onChange={(event) =>
                          setAnalysisForm({ ...analysisForm, current_price: event.target.value })
                        }
                        required
                        type="number"
                        value={analysisForm.current_price}
                      />
                    </label>
                    <label>
                      <span>전일 종가</span>
                      <input
                        min="0"
                        onChange={(event) =>
                          setAnalysisForm({ ...analysisForm, previous_close: event.target.value })
                        }
                        required
                        type="number"
                        value={analysisForm.previous_close}
                      />
                    </label>
                    <label>
                      <span>오늘 거래량</span>
                      <input
                        min="0"
                        onChange={(event) => setAnalysisForm({ ...analysisForm, volume: event.target.value })}
                        required
                        type="number"
                        value={analysisForm.volume}
                      />
                    </label>
                    <label>
                      <span>전일 거래량</span>
                      <input
                        min="1"
                        onChange={(event) =>
                          setAnalysisForm({ ...analysisForm, previous_volume: event.target.value })
                        }
                        required
                        type="number"
                        value={analysisForm.previous_volume}
                      />
                    </label>
                    <label>
                      <span>RSI</span>
                      <input
                        max="100"
                        min="0"
                        onChange={(event) => setAnalysisForm({ ...analysisForm, rsi: event.target.value })}
                        required
                        type="number"
                        value={analysisForm.rsi}
                      />
                    </label>
                    <label>
                      <span>MACD</span>
                      <input
                        onChange={(event) => setAnalysisForm({ ...analysisForm, macd: event.target.value })}
                        required
                        type="number"
                        value={analysisForm.macd}
                      />
                    </label>
                    <label>
                      <span>MACD Signal</span>
                      <input
                        onChange={(event) =>
                          setAnalysisForm({ ...analysisForm, macd_signal: event.target.value })
                        }
                        required
                        type="number"
                        value={analysisForm.macd_signal}
                      />
                    </label>
                    <label className="wide-field">
                      <span>분석 메모</span>
                      <input
                        onChange={(event) => setAnalysisForm({ ...analysisForm, memo: event.target.value })}
                        placeholder="예: 실적 발표 전, 거래량 급증, 기관 수급 확인 필요"
                        value={analysisForm.memo}
                      />
                    </label>
                    <button
                      className="secondary-button"
                      disabled={marketLoading || !analysisForm.ticker.trim()}
                      onClick={() => void handleLoadMarketSnapshot()}
                      type="button"
                    >
                      <ReloadOutlined />
                      시세/지표 불러오기
                    </button>
                    <button className="primary-button" disabled={analysisLoading} type="submit">
                      <LineChartOutlined />
                      분석 실행
                    </button>
                  </form>

                  {analysisMessage && <div className="inline-message">{analysisMessage}</div>}
                  {marketSnapshot && (
                    <div className="market-snapshot">
                      <span>{marketSnapshot.provider_symbol}</span>
                      <span>{marketSnapshot.latest_trading_day}</span>
                      <span>거래량 {marketSnapshot.volume_multiplier}배</span>
                      <span>RSI {marketSnapshot.rsi}</span>
                      <span>MACD {marketSnapshot.macd}</span>
                    </div>
                  )}
                  {analysisResult && (
                    <div className={`analysis-result ${analysisResult.rating}`}>
                      <div className="analysis-score">
                        <strong>{analysisResult.score}</strong>
                        <span>{analysisResult.rating_label}</span>
                      </div>
                      <div className="analysis-copy">
                        <h3>
                          {analysisResult.name} {analysisResult.ticker}
                        </h3>
                        <p>{analysisResult.summary}</p>
                        <p>{analysisResult.ai_summary}</p>
                        <small>{analysisResult.ai_powered ? 'OpenAI 요약 사용' : '기본 분석 요약 사용'}</small>
                      </div>
                      <div className="analysis-columns">
                        <SignalList title="긍정 신호" items={analysisResult.signals} />
                        <SignalList title="주의 신호" items={analysisResult.risk_notes} />
                        <SignalList title="체크리스트" items={analysisResult.action_checklist} />
                      </div>
                      <div className="disclaimer">{analysisResult.disclaimer}</div>
                    </div>
                  )}
                </div>
              </article>
            </div>
          ) : (
            <div className="empty-state stock-login-note">
              로그인 후 보유 종목 관리와 조건 기반 AI 분석 기능을 사용할 수 있습니다.
            </div>
          )}
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

function SignalList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="signal-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function buildHoldingPayload(form: HoldingForm): StockHoldingPayload {
  return {
    ticker: form.ticker,
    name: form.name,
    quantity: toNumber(form.quantity),
    average_price: toNumber(form.average_price),
    current_price: toNumber(form.current_price),
    investment_thesis: form.investment_thesis,
    risk_memo: form.risk_memo,
  };
}

function buildAnalysisPayload(form: AnalysisForm): StockAnalysisPayload {
  return {
    ticker: form.ticker,
    name: form.name,
    current_price: toNumber(form.current_price),
    previous_close: toNumber(form.previous_close),
    volume: Math.trunc(toNumber(form.volume)),
    previous_volume: Math.trunc(toNumber(form.previous_volume)),
    rsi: toNumber(form.rsi),
    macd: toNumber(form.macd),
    macd_signal: toNumber(form.macd_signal),
    memo: form.memo,
  };
}

function toNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  return Number((value ?? '').replaceAll(',', ''));
}

function formatWon(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
