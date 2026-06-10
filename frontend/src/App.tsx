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
  createStockWatchlistItem,
  deleteStockAnalysisRecord,
  deleteStockHolding,
  deleteStockWatchlistItem,
  getAdminUserUsage,
  getAdminUsers,
  getStockAnalysisRecords,
  getHealth,
  getManual,
  getMe,
  getModules,
  getMonetizationIdeas,
  getOverview,
  getRoadmap,
  getStockHoldings,
  getStockMarketSnapshot,
  getStockWatchlist,
  login,
  refreshStockHoldingPrices,
  scanStocks,
  signup,
  updateAdminUser,
  updateStockHolding,
} from './api';
import type {
  AdminUserUsage,
  AuthResponse,
  HealthStatus,
  ManualSection,
  MonetizationIdea,
  PlatformModule,
  PlatformOverview,
  RoadmapPhase,
  StockAnalysisRecord,
  StockAnalysisPayload,
  StockAnalysisResult,
  StockHolding,
  StockHoldingPayload,
  StockMarketSnapshot,
  StockScanResult,
  StockWatchlistItem,
  UserAccount,
} from './types';

const TOKEN_STORAGE_KEY = 'jay-ai-platform-token';

const VIEW_IDS = ['dashboard', 'auth', 'admin', 'manual', 'stocks', 'revenue'] as const;

type ViewId = (typeof VIEW_IDS)[number];

const VIEW_META: Record<ViewId, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: 'Overview', title: 'AI 플랫폼 대시보드' },
  auth: { eyebrow: 'Access', title: '로그인·회원가입' },
  admin: { eyebrow: 'Admin', title: '관리자 페이지' },
  manual: { eyebrow: 'Manual', title: '사용 매뉴얼' },
  stocks: { eyebrow: 'Korea Stock Lab', title: '국내 주식 분석' },
  revenue: { eyebrow: 'Revenue Lab', title: '수익화 아이디어' },
};

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

type WatchlistForm = {
  ticker: string;
  name: string;
  note: string;
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

const emptyWatchlistForm: WatchlistForm = {
  ticker: '',
  name: '',
  note: '',
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

const STOCK_TABS = [
  {
    id: 'holdings',
    title: '보유종목',
    description: '내가 실제로 보유한 주식과 손익을 관리합니다.',
  },
  {
    id: 'watchlist',
    title: '관심종목',
    description: '아직 매수 전인 종목을 따로 저장하고 추적합니다.',
  },
  {
    id: 'analysis',
    title: 'AI 분석',
    description: '한 종목의 시세, 거래량, RSI, MACD를 분석합니다.',
  },
  {
    id: 'scan',
    title: '후보 스캔',
    description: '여러 종목을 한 번에 비교해 후보를 정렬합니다.',
  },
] as const;

type StockTabId = (typeof STOCK_TABS)[number]['id'];

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
  const [adminUsage, setAdminUsage] = useState<AdminUserUsage[]>([]);
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
  const [holdingRefreshLoading, setHoldingRefreshLoading] = useState(false);
  const [currentPriceDrafts, setCurrentPriceDrafts] = useState<Record<number, string>>({});
  const [savingCurrentPriceId, setSavingCurrentPriceId] = useState<number | null>(null);
  const [watchlist, setWatchlist] = useState<StockWatchlistItem[]>([]);
  const [watchlistForm, setWatchlistForm] = useState<WatchlistForm>(emptyWatchlistForm);
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [deletingWatchlistId, setDeletingWatchlistId] = useState<number | null>(null);
  const [analysisForm, setAnalysisForm] = useState<AnalysisForm>(defaultAnalysisForm);
  const [analysisResult, setAnalysisResult] = useState<StockAnalysisResult | null>(null);
  const [analysisRecords, setAnalysisRecords] = useState<StockAnalysisRecord[]>([]);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [deletingAnalysisRecordId, setDeletingAnalysisRecordId] = useState<number | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketSnapshot, setMarketSnapshot] = useState<StockMarketSnapshot | null>(null);
  const [scanTickers, setScanTickers] = useState('005930,000660,035420,035720,051910');
  const [scanMemo, setScanMemo] = useState('');
  const [scanResult, setScanResult] = useState<StockScanResult | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeStockTab, setActiveStockTab] = useState<StockTabId>('holdings');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewId>(() => getInitialView());

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
  const activeMemberCount = adminUsers.filter((user) => user.role === 'member' && user.is_active).length;
  const activeAdminCount = adminUsers.filter((user) => user.role === 'admin' && user.is_active).length;
  const inactiveUserCount = adminUsers.filter((user) => !user.is_active).length;
  const proUserCount = adminUsers.filter((user) => user.plan === 'pro').length;
  const freeUserCount = adminUsers.filter((user) => user.plan === 'free').length;
  const totalAnalysisCount = adminUsage.reduce((total, user) => total + user.analysis_count, 0);
  const activeAnalysisUserCount = adminUsage.filter((user) => user.analysis_count > 0).length;
  const latestAnalysisAt =
    adminUsage
      .map((user) => user.latest_analysis_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const stockTabCounts: Record<StockTabId, string> = {
    holdings: `${holdings.length}개`,
    watchlist: `${watchlist.length}개`,
    analysis: analysisRecords.length > 0 ? `${analysisRecords.length}개 기록` : '대기',
    scan: scanResult ? `${scanResult.candidates.length}개 후보` : '대기',
  };
  const portfolioBreakdown = holdings
    .map((holding) => ({
      ...holding,
      allocationPercent:
        portfolioTotals.value > 0 ? (holding.market_value / portfolioTotals.value) * 100 : 0,
    }))
    .sort((first, second) => second.market_value - first.market_value);
  const maxHoldingProfitPercent = Math.max(
    1,
    ...portfolioBreakdown.map((holding) => Math.abs(holding.profit_loss_percent)),
  );

  useEffect(() => {
    void refreshState();
  }, []);

  useEffect(() => {
    const syncViewFromHash = () => setActiveView(getInitialView());
    syncViewFromHash();
    window.addEventListener('hashchange', syncViewFromHash);
    return () => window.removeEventListener('hashchange', syncViewFromHash);
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
      await loadStockWatchlist(savedToken);
      await loadStockAnalysisRecords(savedToken);
      if (user.role === 'admin') {
        await loadAdminUsers(savedToken);
        await loadAdminUsage(savedToken);
      }
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken('');
      setCurrentUser(null);
      setAdminUsers([]);
      setAdminUsage([]);
      setHoldings([]);
      setWatchlist([]);
      setAnalysisRecords([]);
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
    void loadStockWatchlist(response.access_token);
    void loadStockAnalysisRecords(response.access_token);
    if (response.user.role === 'admin') {
      void loadAdminUsers(response.access_token);
      void loadAdminUsage(response.access_token);
    }
    navigateToView(response.user.role === 'admin' ? 'admin' : 'stocks');
  }

  async function loadAdminUsers(activeToken = token) {
    if (!activeToken) return;
    const users = await getAdminUsers(activeToken);
    setAdminUsers(users);
  }

  async function loadAdminUsage(activeToken = token) {
    if (!activeToken) return;
    const usage = await getAdminUserUsage(activeToken);
    setAdminUsage(usage);
  }

  async function handleAdminUserUpdate(
    userId: number,
    payload: { role?: 'admin' | 'member'; plan?: 'free' | 'pro'; is_active?: boolean },
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

  async function loadStockWatchlist(activeToken = token) {
    if (!activeToken) return;
    const result = await getStockWatchlist(activeToken);
    setWatchlist(result);
  }

  async function loadStockAnalysisRecords(activeToken = token) {
    if (!activeToken) return;
    const result = await getStockAnalysisRecords(activeToken);
    setAnalysisRecords(result);
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

  async function handleRefreshHoldingPrices() {
    if (!token || holdings.length === 0) return;
    setHoldingRefreshLoading(true);
    setHoldingMessage(null);

    try {
      const result = await refreshStockHoldingPrices(token);
      if (result.updated.length > 0) {
        const updatedById = new Map(result.updated.map((holding) => [holding.id, holding]));
        const nextHoldings = holdings.map((holding) => updatedById.get(holding.id) ?? holding);
        setHoldings(nextHoldings);
        setCurrentPriceDrafts(
          Object.fromEntries(nextHoldings.map((holding) => [holding.id, String(holding.current_price)])),
        );
      }
      const successMessage = `${result.updated.length}개 보유종목 현재가를 갱신했습니다.`;
      const failureMessage =
        result.failed.length > 0 ? ` ${result.failed.length}개 종목은 시세 조회에 실패했습니다.` : '';
      setHoldingMessage(`${successMessage}${failureMessage}`);
    } catch (requestError) {
      setHoldingMessage(
        requestError instanceof Error ? requestError.message : 'Price refresh failed.',
      );
    } finally {
      setHoldingRefreshLoading(false);
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

  async function handleCreateWatchlistItem(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setWatchlistLoading(true);
    setWatchlistMessage(null);

    try {
      const created = await createStockWatchlistItem(token, watchlistForm);
      setWatchlist((items) => [created, ...items]);
      setWatchlistForm(emptyWatchlistForm);
      setWatchlistMessage('관심종목이 저장되었습니다.');
    } catch (requestError) {
      setWatchlistMessage(requestError instanceof Error ? requestError.message : 'Watchlist save failed.');
    } finally {
      setWatchlistLoading(false);
    }
  }

  async function handleDeleteWatchlistItem(itemId: number) {
    if (!token) return;
    setDeletingWatchlistId(itemId);
    setWatchlistMessage(null);

    try {
      await deleteStockWatchlistItem(token, itemId);
      setWatchlist((items) => items.filter((item) => item.id !== itemId));
      setWatchlistMessage('관심종목이 삭제되었습니다.');
    } catch (requestError) {
      setWatchlistMessage(requestError instanceof Error ? requestError.message : 'Watchlist delete failed.');
    } finally {
      setDeletingWatchlistId(null);
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
      setAnalysisMessage('분석 결과를 저장했습니다.');
      await loadStockAnalysisRecords(token);
    } catch (requestError) {
      setAnalysisMessage(requestError instanceof Error ? requestError.message : 'Analysis failed.');
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleDeleteAnalysisRecord(recordId: number) {
    if (!token) return;
    setDeletingAnalysisRecordId(recordId);
    setAnalysisMessage(null);

    try {
      await deleteStockAnalysisRecord(token, recordId);
      setAnalysisRecords((records) => records.filter((record) => record.id !== recordId));
      setAnalysisMessage('분석 기록을 삭제했습니다.');
    } catch (requestError) {
      setAnalysisMessage(requestError instanceof Error ? requestError.message : 'Delete failed.');
    } finally {
      setDeletingAnalysisRecordId(null);
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

  async function handleScanStocks(event: FormEvent) {
    event.preventDefault();
    await runStockScan(parseTickerList(scanTickers), {}, scanMemo);
  }

  async function handleScanWatchlist() {
    const tickers = watchlist.map((item) => item.ticker);
    const nameMap = Object.fromEntries(
      watchlist.map((item) => [item.ticker, item.name || item.ticker]),
    );
    setScanTickers(tickers.join(','));
    setActiveStockTab('scan');
    await runStockScan(tickers, nameMap, scanMemo || '관심종목 전체 스캔');
  }

  async function runStockScan(tickers: string[], nameMap: Record<string, string>, memo: string) {
    if (!token || tickers.length === 0) {
      setScanMessage('스캔할 종목을 먼저 입력하거나 관심종목을 추가하세요.');
      return;
    }
    setScanLoading(true);
    setScanMessage(null);

    try {
      const result = await scanStocks(token, { tickers, name_map: nameMap, memo });
      setScanResult(result);
      setScanMessage(`${result.candidates.length}개 후보를 점수순으로 정리했습니다.`);
    } catch (requestError) {
      setScanMessage(requestError instanceof Error ? requestError.message : 'Stock scan failed.');
    } finally {
      setScanLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setCurrentUser(null);
    setAdminUsers([]);
    setAdminUsage([]);
    setHoldings([]);
    setWatchlist([]);
    setAnalysisRecords([]);
    setAnalysisResult(null);
    setScanResult(null);
    setAuthMessage('로그아웃되었습니다.');
    navigateToView('auth');
  }

  function navigateToView(view: ViewId) {
    window.location.hash = view;
    setActiveView(view);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <DeploymentUnitOutlined />
          <span>Jay AI Platform</span>
        </div>
        <nav className="nav-list" aria-label="Primary">
          <a className={activeView === 'dashboard' ? 'active' : ''} href="#dashboard">
            <AppstoreOutlined />
            대시보드
          </a>
          <a className={activeView === 'auth' ? 'active' : ''} href="#auth">
            <TeamOutlined />
            로그인
          </a>
          <a className={activeView === 'admin' ? 'active' : ''} href="#admin">
            <CrownOutlined />
            관리자
          </a>
          <a className={activeView === 'manual' ? 'active' : ''} href="#manual">
            <BookOutlined />
            사용 매뉴얼
          </a>
          <a className={activeView === 'stocks' ? 'active' : ''} href="#stocks">
            <BarChartOutlined />
            국내주식
          </a>
          <a className={activeView === 'revenue' ? 'active' : ''} href="#revenue">
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
            <span className="eyebrow">{VIEW_META[activeView].eyebrow}</span>
            <h1>{VIEW_META[activeView].title}</h1>
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

        <section className={activeView === 'dashboard' ? 'metric-band' : 'screen-hidden'} id="dashboard">
          <StatusTile label="API" value={health?.ok ? 'Online' : 'Checking'} tone={health?.ok ? 'good' : 'muted'} />
          <StatusTile label="우선순위" value="로그인/관리자" tone="steady" />
          <StatusTile label="운영 상태" value="VPS 배포중" />
        </section>

        <section className={activeView === 'dashboard' ? 'hero-panel' : 'screen-hidden'}>
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
            <a href="#auth">
              <LockOutlined />
              로그인
            </a>
          </div>
        </section>

        <section className={activeView === 'auth' ? 'section-block' : 'screen-hidden'} id="auth">
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

        <section className={activeView === 'admin' ? 'section-block' : 'screen-hidden'} id="admin">
          <SectionTitle eyebrow="Admin Console" icon={<CrownOutlined />} title="회원과 권한 관리" />
          <div className="admin-grid">
            <StatusTile label="활성 관리자" value={`${activeAdminCount}명`} tone="good" />
            <StatusTile label="활성 회원" value={`${activeMemberCount}명`} />
            <StatusTile label="비활성 계정" value={`${inactiveUserCount}명`} tone="steady" />
            <StatusTile label="PRO 회원" value={`${proUserCount}명`} tone="good" />
            <StatusTile label="무료 회원" value={`${freeUserCount}명`} />
            <StatusTile label="총 분석 횟수" value={`${totalAnalysisCount}회`} tone="good" />
            <StatusTile label="분석 사용 회원" value={`${activeAnalysisUserCount}명`} />
            <StatusTile
              label="최근 분석"
              value={latestAnalysisAt ? formatDateTime(latestAnalysisAt) : '없음'}
              tone="steady"
            />
          </div>
          <article className="tool-pane">
            <div className="pane-title">
              <TeamOutlined />
              <h3>회원 목록</h3>
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
                            <select
                              disabled={adminUpdatingId === user.id}
                              onChange={(event) =>
                                void handleAdminUserUpdate(user.id, {
                                  plan: event.target.value as 'free' | 'pro',
                                })
                              }
                              value={user.plan}
                            >
                              <option value="free">free</option>
                              <option value="pro">pro</option>
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
                  관리자 계정으로 로그인하면 회원 목록과 권한 설정을 볼 수 있습니다.
                </div>
              )}
            </div>
          </article>
          <article className="tool-pane admin-usage-pane">
            <div className="pane-title">
              <BarChartOutlined />
              <h3>회원별 분석 사용량</h3>
              {currentUser?.role === 'admin' && (
                <button
                  className="secondary-button"
                  onClick={() => void loadAdminUsage()}
                  type="button"
                >
                  <ReloadOutlined />
                  새로고침
                </button>
              )}
            </div>
            <div className="pane-body">
              {currentUser?.role === 'admin' ? (
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
                                totalAnalysisCount > 0
                                  ? (usage.analysis_count / totalAnalysisCount) * 100
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
                <div className="empty-state">
                  관리자 계정으로 로그인하면 회원별 분석 사용량을 볼 수 있습니다.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className={activeView === 'dashboard' ? 'section-block' : 'screen-hidden'}>
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

        <section className={activeView === 'manual' ? 'section-block' : 'screen-hidden'} id="manual">
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

        <section className={activeView === 'stocks' ? 'section-block' : 'screen-hidden'} id="stocks">
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
            <div className="stock-tab-shell">
              <div className="stock-tabs" role="tablist" aria-label="국내 주식 작업 메뉴">
                {STOCK_TABS.map((tab) => (
                  <button
                    aria-selected={activeStockTab === tab.id}
                    className={activeStockTab === tab.id ? 'active' : ''}
                    key={tab.id}
                    onClick={() => setActiveStockTab(tab.id)}
                    role="tab"
                    type="button"
                  >
                    <span className="stock-tab-title">
                      {getStockTabIcon(tab.id)}
                      <span>{tab.title}</span>
                    </span>
                    <small>{tab.description}</small>
                    <strong>{stockTabCounts[tab.id]}</strong>
                  </button>
                ))}
              </div>

              <div className="stock-workspace stock-workspace-tabs">
                {activeStockTab === 'holdings' && (
                  <article className="tool-pane stock-pane">
                <div className="pane-title">
                  <LineChartOutlined />
                  <h3>내 주식 포트폴리오</h3>
                  <button
                    className="secondary-button"
                    disabled={holdingRefreshLoading || holdings.length === 0}
                    onClick={() => void handleRefreshHoldingPrices()}
                    type="button"
                  >
                    <ReloadOutlined />
                    현재가 전체 갱신
                  </button>
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

                  {portfolioBreakdown.length > 0 && (
                    <div className="portfolio-visuals">
                      <div className="portfolio-chart-panel">
                        <div className="chart-head">
                          <strong>보유 비중</strong>
                          <span>평가금액 기준</span>
                        </div>
                        <div className="allocation-list">
                          {portfolioBreakdown.map((holding) => (
                            <div className="allocation-row" key={holding.id}>
                              <div className="allocation-label">
                                <strong>{holding.name}</strong>
                                <span>{formatPlainPercent(holding.allocationPercent)}</span>
                              </div>
                              <div className="allocation-track">
                                <div
                                  className="allocation-fill"
                                  style={{ width: `${Math.max(2, holding.allocationPercent)}%` }}
                                />
                              </div>
                              <small>{formatWon(holding.market_value)}</small>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="portfolio-chart-panel">
                        <div className="chart-head">
                          <strong>수익률 비교</strong>
                          <span>종목별 손익률</span>
                        </div>
                        <div className="performance-list">
                          {portfolioBreakdown.map((holding) => {
                            const barWidth = Math.max(
                              4,
                              (Math.abs(holding.profit_loss_percent) / maxHoldingProfitPercent) * 100,
                            );
                            return (
                              <div className="performance-row" key={holding.id}>
                                <div className="performance-label">
                                  <strong>{holding.name}</strong>
                                  <span
                                    className={
                                      holding.profit_loss >= 0 ? 'profit-positive' : 'profit-negative'
                                    }
                                  >
                                    {formatPercent(holding.profit_loss_percent)}
                                  </span>
                                </div>
                                <div className="performance-track">
                                  <div
                                    className={`performance-fill ${
                                      holding.profit_loss >= 0 ? 'positive' : 'negative'
                                    }`}
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                                <small>{formatWon(holding.profit_loss)}</small>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

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
                )}

                {activeStockTab === 'watchlist' && (
                  <article className="tool-pane stock-pane">
                <div className="pane-title">
                  <BookOutlined />
                  <h3>관심종목</h3>
                </div>
                <div className="pane-body">
                  <form className="watchlist-form" onSubmit={(event) => void handleCreateWatchlistItem(event)}>
                    <label>
                      <span>종목코드</span>
                      <input
                        onChange={(event) =>
                          setWatchlistForm({ ...watchlistForm, ticker: event.target.value })
                        }
                        placeholder="005930"
                        required
                        value={watchlistForm.ticker}
                      />
                    </label>
                    <label>
                      <span>종목명</span>
                      <input
                        onChange={(event) =>
                          setWatchlistForm({ ...watchlistForm, name: event.target.value })
                        }
                        placeholder="삼성전자"
                        value={watchlistForm.name}
                      />
                    </label>
                    <label className="wide-field">
                      <span>메모</span>
                      <input
                        onChange={(event) =>
                          setWatchlistForm({ ...watchlistForm, note: event.target.value })
                        }
                        placeholder="예: 거래량 급증 시 확인"
                        value={watchlistForm.note}
                      />
                    </label>
                    <button className="primary-button" disabled={watchlistLoading} type="submit">
                      <PlusOutlined />
                      관심종목 저장
                    </button>
                    <button
                      className="secondary-button"
                      disabled={scanLoading || watchlist.length === 0}
                      onClick={() => void handleScanWatchlist()}
                      type="button"
                    >
                      <BarChartOutlined />
                      관심종목 전체 스캔
                    </button>
                  </form>

                  <div className="watchlist-list">
                    {watchlist.map((item) => (
                      <div className="watchlist-row" key={item.id}>
                        <div>
                          <strong>
                            {item.name || item.ticker} <span>{item.ticker}</span>
                          </strong>
                          {item.note && <p>{item.note}</p>}
                        </div>
                        <button
                          className="icon-danger-button"
                          disabled={deletingWatchlistId === item.id}
                          onClick={() => void handleDeleteWatchlistItem(item.id)}
                          title="삭제"
                          type="button"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    ))}
                    {watchlist.length === 0 && (
                      <div className="empty-state">아직 저장된 관심종목이 없습니다.</div>
                    )}
                  </div>
                  {watchlistMessage && <div className="inline-message">{watchlistMessage}</div>}
                </div>
                  </article>
                )}

                {activeStockTab === 'analysis' && (
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

                  <div className="analysis-history">
                    <div className="chart-head">
                      <strong>저장된 분석 기록</strong>
                      <button className="secondary-button" onClick={() => void loadStockAnalysisRecords()} type="button">
                        <ReloadOutlined />
                        새로고침
                      </button>
                    </div>
                    <div className="analysis-record-list">
                      {analysisRecords.map((record) => (
                        <article className={`analysis-record ${record.rating}`} key={record.id}>
                          <div className="analysis-record-main">
                            <div>
                              <strong>
                                {record.name} <span>{record.ticker}</span>
                              </strong>
                              <small>
                                {formatDateTime(record.created_at)} · 점수 {record.score} ·{' '}
                                {record.rating_label}
                              </small>
                            </div>
                            <p>{record.summary}</p>
                            {record.memo && <p>메모: {record.memo}</p>}
                          </div>
                          <div className="analysis-record-side">
                            <span
                              className={
                                record.price_change_percent >= 0 ? 'profit-positive' : 'profit-negative'
                              }
                            >
                              {formatPercent(record.price_change_percent)}
                            </span>
                            <small>거래량 {record.volume_multiplier}배</small>
                            <button
                              className="icon-danger-button"
                              disabled={deletingAnalysisRecordId === record.id}
                              onClick={() => void handleDeleteAnalysisRecord(record.id)}
                              title="분석 기록 삭제"
                              type="button"
                            >
                              <DeleteOutlined />
                            </button>
                          </div>
                        </article>
                      ))}
                      {analysisRecords.length === 0 && (
                        <div className="empty-state">아직 저장된 분석 기록이 없습니다.</div>
                      )}
                    </div>
                  </div>
                </div>
                  </article>
                )}

                {activeStockTab === 'scan' && (
                  <article className="tool-pane stock-pane scan-pane">
                <div className="pane-title">
                  <LineChartOutlined />
                  <h3>추천 후보 스캔</h3>
                </div>
                <div className="pane-body">
                  <form className="scan-form" onSubmit={(event) => void handleScanStocks(event)}>
                    <label className="wide-field">
                      <span>스캔할 종목코드</span>
                      <input
                        onChange={(event) => setScanTickers(event.target.value)}
                        placeholder="005930,000660,035720"
                        required
                        value={scanTickers}
                      />
                    </label>
                    <label className="wide-field">
                      <span>스캔 메모</span>
                      <input
                        onChange={(event) => setScanMemo(event.target.value)}
                        placeholder="예: 거래량 급증 후보, 반도체/AI 관련주 우선 확인"
                        value={scanMemo}
                      />
                    </label>
                    <button className="primary-button" disabled={scanLoading} type="submit">
                      <BarChartOutlined />
                      후보 스캔 실행
                    </button>
                  </form>

                  {scanMessage && <div className="inline-message">{scanMessage}</div>}
                  {scanResult && (
                    <div className="scan-result">
                      {scanResult.candidates.map((candidate, index) => (
                        <div className={`scan-card ${candidate.rating}`} key={candidate.ticker}>
                          <div className="scan-rank">#{index + 1}</div>
                          <div className="scan-main">
                            <strong>
                              {candidate.name} <span>{candidate.ticker}</span>
                            </strong>
                            <p>{candidate.summary}</p>
                            <small>
                              {candidate.latest_trading_day} · {candidate.provider_symbol} · 거래량{' '}
                              {candidate.volume_multiplier}배 · RSI {candidate.rsi}
                            </small>
                          </div>
                          <div className="scan-score">
                            <strong>{candidate.score}</strong>
                            <span>{candidate.rating_label}</span>
                          </div>
                        </div>
                      ))}
                      {scanResult.failed.length > 0 && (
                        <div className="scan-failed">
                          <strong>조회 실패</strong>
                          {scanResult.failed.map((item) => (
                            <span key={item.ticker}>
                              {item.ticker}: {item.reason}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="disclaimer">{scanResult.disclaimer}</div>
                    </div>
                  )}
                </div>
                  </article>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state stock-login-note">
              로그인 후 보유 종목 관리와 조건 기반 AI 분석 기능을 사용할 수 있습니다.
              <a href="#auth">로그인 화면으로 이동</a>
            </div>
          )}
        </section>

        <section className={activeView === 'revenue' ? 'section-block' : 'screen-hidden'} id="revenue">
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

        <section className={activeView === 'dashboard' ? 'phase-list' : 'screen-hidden'} id="roadmap">
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

function getStockTabIcon(tabId: StockTabId): ReactNode {
  switch (tabId) {
    case 'holdings':
      return <LineChartOutlined />;
    case 'watchlist':
      return <BookOutlined />;
    case 'analysis':
      return <BarChartOutlined />;
    case 'scan':
      return <AppstoreOutlined />;
  }
}

function getInitialView(): ViewId {
  if (typeof window === 'undefined') {
    return 'dashboard';
  }

  const hashView = window.location.hash.replace('#', '');
  if (hashView === 'access') {
    return 'auth';
  }

  return VIEW_IDS.includes(hashView as ViewId) ? (hashView as ViewId) : 'dashboard';
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

function parseTickerList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
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

function formatPlainPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
