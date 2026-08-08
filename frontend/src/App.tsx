import {
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  CrownOutlined,
  DeploymentUnitOutlined,
  DollarOutlined,
  LineChartOutlined,
  LockOutlined,
  ReloadOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { FormEvent, useEffect, useState } from 'react';
import {
  analyzeStock,
  createProRequest,
  createStockHolding,
  createStockReportFromAnalysis,
  createStockWatchlistItem,
  deleteStockAnalysisRecord,
  deleteStockHolding,
  deleteStockReport,
  deleteStockWatchlistItem,
  downloadStockReport,
  getAdminContentStats,
  getAdminProRequests,
  getAdminUserUsage,
  getAdminUsers,
  getMyProRequest,
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
  getStockReportMarket,
  getStockReports,
  getStockWatchlist,
  getYoutubeProjectDetail,
  getYoutubeProjects,
  login,
  refreshStockHoldingPrices,
  scanStocks,
  signup,
  updateAdminUser,
  updateAdminProRequest,
  updateStockHolding,
  updateStockReportPublish,
} from './api';
import { AdminScreen } from './components/AdminScreen';
import { AuthScreen } from './components/AuthScreen';
import type { AuthMode } from './components/AuthScreen';
import { ContentOpsScreen } from './components/ContentOpsScreen';
import type { ContentOpsTabId } from './components/ContentOpsScreen';
import { ManualScreen } from './components/ManualScreen';
import { RevenueScreen } from './components/RevenueScreen';
import { RoadmapSection } from './components/RoadmapSection';
import { SectionTitle, StatusTile } from './components/shared';
import { StockAnalysisPanel } from './components/StockAnalysisPanel';
import type { AnalysisForm } from './components/StockAnalysisPanel';
import { StockHoldingsPanel } from './components/StockHoldingsPanel';
import type { HoldingForm, PortfolioBreakdownItem } from './components/StockHoldingsPanel';
import { StockMarketPanel } from './components/StockMarketPanel';
import { StockReportsPanel } from './components/StockReportsPanel';
import { StockScanPanel } from './components/StockScanPanel';
import { StockWatchlistPanel } from './components/StockWatchlistPanel';
import type { WatchlistForm } from './components/StockWatchlistPanel';
import { parseTickerList, safeFileName, toNumber } from './utils';
import type {
  AdminContentStats,
  AdminUserUsage,
  AuthResponse,
  HealthStatus,
  ManualSection,
  MonetizationIdea,
  PlatformModule,
  PlatformOverview,
  ProUpgradeRequest,
  RoadmapPhase,
  StockAnalysisRecord,
  StockAnalysisPayload,
  StockAnalysisResult,
  StockHolding,
  StockHoldingPayload,
  StockMarketSnapshot,
  StockReport,
  StockReportMarketItem,
  StockScanResult,
  StockWatchlistItem,
  UserAccount,
  YoutubeProjectDetail,
  YoutubeProjectSummary,
} from './types';

const TOKEN_STORAGE_KEY = 'jay-ai-platform-token';

const VIEW_IDS = ['dashboard', 'auth', 'admin', 'manual', 'stocks', 'contentOps', 'revenue'] as const;

type ViewId = (typeof VIEW_IDS)[number];

const VIEW_META: Record<ViewId, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: 'Overview', title: 'AI 플랫폼 대시보드' },
  auth: { eyebrow: 'Access', title: '로그인·회원가입' },
  admin: { eyebrow: 'Admin', title: '관리자 페이지' },
  manual: { eyebrow: 'Manual', title: '사용 매뉴얼' },
  stocks: { eyebrow: 'Korea Stock Lab', title: '국내 주식 분석' },
  contentOps: { eyebrow: 'Content Ops', title: '콘텐츠 운영' },
  revenue: { eyebrow: 'Revenue Lab', title: '수익화 아이디어' },
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
  {
    id: 'reports',
    title: 'Reports',
    description: 'Saved analysis records become paid report drafts.',
  },
  {
    id: 'market',
    title: 'Market',
    description: 'Published stock reports for members.',
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
  const [adminContentStats, setAdminContentStats] = useState<AdminContentStats | null>(null);
  const [adminProRequests, setAdminProRequests] = useState<ProUpgradeRequest[]>([]);
  const [myProRequest, setMyProRequest] = useState<ProUpgradeRequest | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminUpdatingId, setAdminUpdatingId] = useState<number | null>(null);
  const [proRequestMessage, setProRequestMessage] = useState<string | null>(null);
  const [proRequestLoading, setProRequestLoading] = useState(false);
  const [adminProRequestUpdatingId, setAdminProRequestUpdatingId] = useState<number | null>(null);
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
  const [analysisRecordQuery, setAnalysisRecordQuery] = useState('');
  const [analysisRecordRatingFilter, setAnalysisRecordRatingFilter] = useState('all');
  const [stockReports, setStockReports] = useState<StockReport[]>([]);
  const [marketReports, setMarketReports] = useState<StockReportMarketItem[]>([]);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [deletingAnalysisRecordId, setDeletingAnalysisRecordId] = useState<number | null>(null);
  const [quickAnalysisLoadingKey, setQuickAnalysisLoadingKey] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [creatingReportRecordId, setCreatingReportRecordId] = useState<number | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<number | null>(null);
  const [updatingReportPublishId, setUpdatingReportPublishId] = useState<number | null>(null);
  const [marketMessage, setMarketMessage] = useState<string | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketSnapshot, setMarketSnapshot] = useState<StockMarketSnapshot | null>(null);
  const [prefillAnalysisLoadingKey, setPrefillAnalysisLoadingKey] = useState<string | null>(null);
  const [scanTickers, setScanTickers] = useState('005930,000660,035420,035720,051910');
  const [scanMemo, setScanMemo] = useState('');
  const [scanResult, setScanResult] = useState<StockScanResult | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeStockTab, setActiveStockTab] = useState<StockTabId>('holdings');
  const [activeContentOpsTab, setActiveContentOpsTab] = useState<ContentOpsTabId>('youtube');
  const [youtubeProjects, setYoutubeProjects] = useState<YoutubeProjectSummary[]>([]);
  const [youtubeProjectsMessage, setYoutubeProjectsMessage] = useState<string | null>(null);
  const [youtubeProjectsLoading, setYoutubeProjectsLoading] = useState(false);
  const [selectedYoutubeSlug, setSelectedYoutubeSlug] = useState<string | null>(null);
  const [youtubeProjectDetail, setYoutubeProjectDetail] = useState<YoutubeProjectDetail | null>(null);
  const [youtubeDetailLoading, setYoutubeDetailLoading] = useState(false);
  const [youtubeDetailMessage, setYoutubeDetailMessage] = useState<string | null>(null);
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
    reports: `${stockReports.length} drafts`,
    market: `${marketReports.length} items`,
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
  const watchlistTickerSet = new Set(watchlist.map((item) => item.ticker));
  const topAnalysisCandidates = [...analysisRecords]
    .sort(
      (first, second) =>
        second.score - first.score ||
        second.volume_multiplier - first.volume_multiplier ||
        second.price_change_percent - first.price_change_percent,
    )
    .slice(0, 3);
  const normalizedAnalysisRecordQuery = analysisRecordQuery.trim().toLowerCase();
  const filteredAnalysisRecords = analysisRecords.filter((record) => {
    const matchesQuery =
      normalizedAnalysisRecordQuery.length === 0 ||
      record.name.toLowerCase().includes(normalizedAnalysisRecordQuery) ||
      record.ticker.toLowerCase().includes(normalizedAnalysisRecordQuery);
    const matchesRating =
      analysisRecordRatingFilter === 'all' || record.rating === analysisRecordRatingFilter;
    return matchesQuery && matchesRating;
  });

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
      await loadStockReports(savedToken);
      await loadStockReportMarket(savedToken);
      await loadMyProRequest(savedToken);
      if (user.role === 'admin') {
        await loadAdminUsers(savedToken);
        await loadAdminUsage(savedToken);
        await loadAdminContentStats(savedToken);
        await loadAdminProRequests(savedToken);
        await loadYoutubeProjects(savedToken);
      }
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken('');
      setCurrentUser(null);
      setAdminUsers([]);
      setAdminUsage([]);
      setAdminContentStats(null);
      setAdminProRequests([]);
      setMyProRequest(null);
      setYoutubeProjects([]);
      setYoutubeProjectDetail(null);
      setSelectedYoutubeSlug(null);
      setHoldings([]);
      setWatchlist([]);
      setAnalysisRecords([]);
      setStockReports([]);
      setMarketReports([]);
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
    void loadStockReports(response.access_token);
    void loadStockReportMarket(response.access_token);
    void loadMyProRequest(response.access_token);
    if (response.user.role === 'admin') {
      void loadAdminUsers(response.access_token);
      void loadAdminUsage(response.access_token);
      void loadAdminContentStats(response.access_token);
      void loadAdminProRequests(response.access_token);
      void loadYoutubeProjects(response.access_token);
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

  async function loadAdminContentStats(activeToken = token) {
    if (!activeToken) return;
    const stats = await getAdminContentStats(activeToken);
    setAdminContentStats(stats);
  }

  async function loadAdminProRequests(activeToken = token) {
    if (!activeToken) return;
    const requests = await getAdminProRequests(activeToken);
    setAdminProRequests(requests);
  }

  async function loadYoutubeProjects(activeToken = token) {
    if (!activeToken) return;
    setYoutubeProjectsLoading(true);
    setYoutubeProjectsMessage(null);

    try {
      const projects = await getYoutubeProjects(activeToken);
      setYoutubeProjects(projects);
    } catch (requestError) {
      setYoutubeProjectsMessage(
        requestError instanceof Error ? requestError.message : '유튜브 프로젝트를 불러오지 못했습니다.',
      );
    } finally {
      setYoutubeProjectsLoading(false);
    }
  }

  async function handleSelectYoutubeProject(slug: string) {
    if (!token) return;
    setSelectedYoutubeSlug(slug);
    setYoutubeProjectDetail(null);
    setYoutubeDetailLoading(true);
    setYoutubeDetailMessage(null);

    try {
      const detail = await getYoutubeProjectDetail(token, slug);
      setYoutubeProjectDetail(detail);
    } catch (requestError) {
      setYoutubeDetailMessage(
        requestError instanceof Error ? requestError.message : '프로젝트 내용을 불러오지 못했습니다.',
      );
    } finally {
      setYoutubeDetailLoading(false);
    }
  }

  async function loadMyProRequest(activeToken = token) {
    if (!activeToken) return;
    const request = await getMyProRequest(activeToken);
    setMyProRequest(request);
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

  async function handleCreateProRequest() {
    if (!token) return;
    setProRequestLoading(true);
    setProRequestMessage(null);

    try {
      const request = await createProRequest(
        token,
        'Pro reports and higher analysis limits requested from the account screen.',
      );
      setMyProRequest(request);
      setProRequestMessage('Pro 업그레이드 신청이 접수되었습니다.');
    } catch (requestError) {
      setProRequestMessage(requestError instanceof Error ? requestError.message : 'Pro request failed.');
    } finally {
      setProRequestLoading(false);
    }
  }

  async function handleAdminProRequestUpdate(requestId: number, status: 'approved' | 'rejected') {
    if (!token) return;
    setAdminProRequestUpdatingId(requestId);
    setAdminMessage(null);

    try {
      const updated = await updateAdminProRequest(
        token,
        requestId,
        status,
        status === 'approved' ? 'Pro upgrade approved.' : 'Pro upgrade rejected.',
      );
      setAdminProRequests((requests) =>
        requests.map((request) => (request.id === updated.id ? updated : request)),
      );
      await loadAdminUsers(token);
      setAdminMessage(status === 'approved' ? 'Pro 신청을 승인했습니다.' : 'Pro 신청을 거절했습니다.');
    } catch (requestError) {
      setAdminMessage(requestError instanceof Error ? requestError.message : 'Request update failed.');
    } finally {
      setAdminProRequestUpdatingId(null);
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

  async function loadStockReports(activeToken = token) {
    if (!activeToken) return;
    const result = await getStockReports(activeToken);
    setStockReports(result);
  }

  async function loadStockReportMarket(activeToken = token) {
    if (!activeToken) return;
    try {
      const result = await getStockReportMarket(activeToken);
      setMarketReports(result);
    } catch (requestError) {
      setMarketMessage(requestError instanceof Error ? requestError.message : 'Market load failed.');
    }
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

  async function handleAnalyzeHolding(holding: StockHolding) {
    await prefillAnalysisFromTicker(
      `holding-${holding.id}`,
      holding.ticker,
      holding.name,
      `보유종목 분석: ${holding.investment_thesis || '포트폴리오 점검'}`,
      {
        current_price: holding.current_price,
        previous_close: holding.average_price,
      },
    );
  }

  async function handleQuickAnalyzeHolding(holding: StockHolding) {
    await quickAnalyzeFromTicker(
      `holding-${holding.id}`,
      holding.ticker,
      holding.name,
      `보유종목 즉시분석: ${holding.investment_thesis || '포트폴리오 점검'}`,
      {
        current_price: holding.current_price,
        previous_close: holding.average_price,
      },
    );
  }

  async function handleAnalyzeWatchlistItem(item: StockWatchlistItem) {
    await prefillAnalysisFromTicker(
      `watchlist-${item.id}`,
      item.ticker,
      item.name || item.ticker,
      item.note ? `관심종목 메모: ${item.note}` : '관심종목 조건 점검',
    );
  }

  async function handleQuickAnalyzeWatchlistItem(item: StockWatchlistItem) {
    await quickAnalyzeFromTicker(
      `watchlist-${item.id}`,
      item.ticker,
      item.name || item.ticker,
      item.note ? `관심종목 즉시분석: ${item.note}` : '관심종목 조건 즉시점검',
    );
  }

  async function prefillAnalysisFromTicker(
    loadingKey: string,
    ticker: string,
    name: string,
    memo: string,
    fallback?: { current_price: number; previous_close: number },
  ) {
    if (!token) return;
    setPrefillAnalysisLoadingKey(loadingKey);
    setAnalysisMessage(null);
    setHoldingMessage(null);
    setWatchlistMessage(null);

    try {
      const snapshot = await getStockMarketSnapshot(token, ticker);
      setMarketSnapshot(snapshot);
      setAnalysisForm({
        ticker: snapshot.ticker,
        name,
        current_price: String(snapshot.current_price),
        previous_close: String(snapshot.previous_close),
        volume: String(snapshot.volume),
        previous_volume: String(snapshot.previous_volume),
        rsi: String(snapshot.rsi),
        macd: String(snapshot.macd),
        macd_signal: String(snapshot.macd_signal),
        memo,
      });
      setAnalysisMessage(`${name} 분석 폼을 최신 시세와 지표로 채웠습니다. 확인 후 분석 실행을 누르세요.`);
    } catch (requestError) {
      if (!fallback) {
        setAnalysisMessage(requestError instanceof Error ? requestError.message : 'Market data load failed.');
        setActiveStockTab('analysis');
        return;
      }
      setMarketSnapshot(null);
      setAnalysisForm({
        ticker,
        name,
        current_price: String(fallback.current_price),
        previous_close: String(fallback.previous_close),
        volume: '1',
        previous_volume: '1',
        rsi: '50',
        macd: '0',
        macd_signal: '0',
        memo: `${memo} / 시세 조회 실패로 보유 입력값 기준`,
      });
      setAnalysisMessage('시세 조회에 실패해 보유종목 입력값으로 분석 폼을 채웠습니다.');
    } finally {
      setPrefillAnalysisLoadingKey(null);
      setActiveStockTab('analysis');
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

  async function quickAnalyzeFromTicker(
    loadingKey: string,
    ticker: string,
    name: string,
    memo: string,
    fallback?: { current_price: number; previous_close: number },
  ) {
    if (!token) return;
    setQuickAnalysisLoadingKey(loadingKey);
    setAnalysisLoading(true);
    setAnalysisMessage(null);
    setHoldingMessage(null);
    setWatchlistMessage(null);

    try {
      const payload = await buildAnalysisPayloadFromTicker(ticker, name, memo, fallback);
      setAnalysisForm({
        ticker: payload.ticker,
        name: payload.name,
        current_price: String(payload.current_price),
        previous_close: String(payload.previous_close),
        volume: String(payload.volume),
        previous_volume: String(payload.previous_volume),
        rsi: String(payload.rsi),
        macd: String(payload.macd),
        macd_signal: String(payload.macd_signal),
        memo: payload.memo ?? '',
      });
      const result = await analyzeStock(token, payload);
      setAnalysisResult(result);
      setAnalysisMessage(`${name} 즉시분석을 실행하고 기록에 저장했습니다.`);
      await loadStockAnalysisRecords(token);
      setActiveStockTab('analysis');
    } catch (requestError) {
      setAnalysisMessage(requestError instanceof Error ? requestError.message : 'Quick analysis failed.');
      setActiveStockTab('analysis');
    } finally {
      setQuickAnalysisLoadingKey(null);
      setAnalysisLoading(false);
    }
  }

  async function buildAnalysisPayloadFromTicker(
    ticker: string,
    name: string,
    memo: string,
    fallback?: { current_price: number; previous_close: number },
  ): Promise<StockAnalysisPayload> {
    try {
      const snapshot = await getStockMarketSnapshot(token, ticker);
      setMarketSnapshot(snapshot);
      return {
        ticker: snapshot.ticker,
        name,
        current_price: snapshot.current_price,
        previous_close: snapshot.previous_close,
        volume: snapshot.volume,
        previous_volume: snapshot.previous_volume,
        rsi: snapshot.rsi,
        macd: snapshot.macd,
        macd_signal: snapshot.macd_signal,
        memo,
      };
    } catch (requestError) {
      if (!fallback) {
        throw requestError;
      }
      setMarketSnapshot(null);
      return {
        ticker,
        name,
        current_price: fallback.current_price,
        previous_close: fallback.previous_close,
        volume: 1,
        previous_volume: 1,
        rsi: 50,
        macd: 0,
        macd_signal: 0,
        memo: `${memo} / 시세 조회 실패로 보유 입력값 기준`,
      };
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

  async function handleCreateWatchlistFromAnalysis(record: StockAnalysisRecord) {
    if (!token) return;
    setAnalysisMessage(null);

    try {
      const created = await createStockWatchlistItem(token, {
        ticker: record.ticker,
        name: record.name,
        note: `분석 점수 ${record.score} · ${record.rating_label}`,
      });
      setWatchlist((items) => [created, ...items]);
      setAnalysisMessage(`${record.name}을 관심종목에 저장했습니다.`);
    } catch (requestError) {
      setAnalysisMessage(requestError instanceof Error ? requestError.message : 'Watchlist save failed.');
    }
  }

  async function handleCreateReport(recordId: number) {
    if (!token) return;
    setCreatingReportRecordId(recordId);
    setReportMessage(null);

    try {
      const report = await createStockReportFromAnalysis(token, recordId);
      setStockReports((reports) => [report, ...reports]);
      setReportMessage('Report draft created.');
      setActiveStockTab('reports');
    } catch (requestError) {
      setReportMessage(requestError instanceof Error ? requestError.message : 'Report create failed.');
    } finally {
      setCreatingReportRecordId(null);
    }
  }

  async function handleDeleteReport(reportId: number) {
    if (!token) return;
    setDeletingReportId(reportId);
    setReportMessage(null);

    try {
      await deleteStockReport(token, reportId);
      setStockReports((reports) => reports.filter((report) => report.id !== reportId));
      setReportMessage('Report draft deleted.');
    } catch (requestError) {
      setReportMessage(requestError instanceof Error ? requestError.message : 'Report delete failed.');
    } finally {
      setDeletingReportId(null);
    }
  }

  async function handleDownloadReport(report: StockReport) {
    if (!token) return;
    setDownloadingReportId(report.id);
    setReportMessage(null);

    try {
      const blob = await downloadStockReport(token, report.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeFileName(report.ticker)}-report-${report.id}.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setReportMessage('Report markdown downloaded.');
    } catch (requestError) {
      setReportMessage(requestError instanceof Error ? requestError.message : 'Report download failed.');
    } finally {
      setDownloadingReportId(null);
    }
  }

  async function handleUpdateReportPublish(
    report: StockReport,
    accessLevel: StockReport['access_level'],
    isPublished: boolean,
  ) {
    if (!token) return;
    setUpdatingReportPublishId(report.id);
    setReportMessage(null);

    try {
      const updated = await updateStockReportPublish(token, report.id, {
        access_level: accessLevel,
        is_published: isPublished,
      });
      setStockReports((reports) => reports.map((item) => (item.id === updated.id ? updated : item)));
      await loadStockReportMarket(token);
      setReportMessage('Report publish settings saved.');
    } catch (requestError) {
      setReportMessage(requestError instanceof Error ? requestError.message : 'Publish update failed.');
    } finally {
      setUpdatingReportPublishId(null);
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
    setAdminContentStats(null);
    setAdminProRequests([]);
    setMyProRequest(null);
    setHoldings([]);
    setWatchlist([]);
    setAnalysisRecords([]);
    setStockReports([]);
    setMarketReports([]);
    setAnalysisResult(null);
    setScanResult(null);
    setYoutubeProjects([]);
    setYoutubeProjectDetail(null);
    setSelectedYoutubeSlug(null);
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
          <a className={activeView === 'contentOps' ? 'active' : ''} href="#contentOps">
            <VideoCameraOutlined />
            콘텐츠 운영
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

        <AuthScreen
          active={activeView === 'auth'}
          currentUser={currentUser}
          myProRequest={myProRequest}
          proRequestLoading={proRequestLoading}
          proRequestMessage={proRequestMessage}
          onCreateProRequest={() => void handleCreateProRequest()}
          onLogout={logout}
          authMode={authMode}
          onAuthModeChange={setAuthMode}
          name={name}
          onNameChange={setName}
          email={email}
          onEmailChange={setEmail}
          password={password}
          onPasswordChange={setPassword}
          authLoading={authLoading}
          authMessage={authMessage}
          onSubmit={(event) => void handleAuthSubmit(event)}
        />

        <AdminScreen
          active={activeView === 'admin'}
          isAdmin={currentUser?.role === 'admin'}
          currentUserId={currentUser?.id}
          metrics={{
            activeAdminCount,
            activeMemberCount,
            inactiveUserCount,
            proUserCount,
            freeUserCount,
            totalAnalysisCount,
            activeAnalysisUserCount,
            latestAnalysisAt,
          }}
          adminContentStats={adminContentStats}
          onRefreshContentStats={() => void loadAdminContentStats()}
          adminProRequests={adminProRequests}
          adminProRequestUpdatingId={adminProRequestUpdatingId}
          onRefreshProRequests={() => void loadAdminProRequests()}
          onUpdateProRequest={(requestId, status) =>
            void handleAdminProRequestUpdate(requestId, status)
          }
          adminUsers={adminUsers}
          adminUpdatingId={adminUpdatingId}
          adminMessage={adminMessage}
          onRefreshUsers={() => void loadAdminUsers()}
          onUpdateUser={(userId, payload) => void handleAdminUserUpdate(userId, payload)}
          adminUsage={adminUsage}
          onRefreshUsage={() => void loadAdminUsage()}
        />

        <ContentOpsScreen
          active={activeView === 'contentOps'}
          isAdmin={currentUser?.role === 'admin'}
          activeTab={activeContentOpsTab}
          onTabChange={setActiveContentOpsTab}
          youtubeProjects={youtubeProjects}
          youtubeProjectsLoading={youtubeProjectsLoading}
          youtubeProjectsMessage={youtubeProjectsMessage}
          onRefreshProjects={() => void loadYoutubeProjects()}
          selectedSlug={selectedYoutubeSlug}
          onSelectProject={(slug) => void handleSelectYoutubeProject(slug)}
          projectDetail={youtubeProjectDetail}
          detailLoading={youtubeDetailLoading}
          detailMessage={youtubeDetailMessage}
        />

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

        <ManualScreen active={activeView === 'manual'} manual={manual} />

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
                  <StockHoldingsPanel
                    currentPriceDrafts={currentPriceDrafts}
                    holdingForm={holdingForm}
                    holdingLoading={holdingLoading}
                    holdingMessage={holdingMessage}
                    holdingRefreshLoading={holdingRefreshLoading}
                    holdings={holdings}
                    maxHoldingProfitPercent={maxHoldingProfitPercent}
                    onAnalyze={(holding) => void handleAnalyzeHolding(holding)}
                    onCreate={(event) => void handleCreateHolding(event)}
                    onCurrentPriceDraftChange={(holdingId, value) =>
                      setCurrentPriceDrafts({ ...currentPriceDrafts, [holdingId]: value })
                    }
                    onDelete={(holdingId) => void handleDeleteHolding(holdingId)}
                    onFormChange={setHoldingForm}
                    onQuickAnalyze={(holding) => void handleQuickAnalyzeHolding(holding)}
                    onRefreshPrices={() => void handleRefreshHoldingPrices()}
                    onSaveCurrentPrice={(holding) => void handleCurrentPriceSave(holding)}
                    portfolioBreakdown={portfolioBreakdown}
                    portfolioProfitPercent={portfolioProfitPercent}
                    portfolioTotals={portfolioTotals}
                    prefillAnalysisLoadingKey={prefillAnalysisLoadingKey}
                    quickAnalysisLoadingKey={quickAnalysisLoadingKey}
                    savingCurrentPriceId={savingCurrentPriceId}
                  />
                )}

                {activeStockTab === 'watchlist' && (
                  <StockWatchlistPanel
                    deletingWatchlistId={deletingWatchlistId}
                    onAnalyze={(item) => void handleAnalyzeWatchlistItem(item)}
                    onCreate={(event) => void handleCreateWatchlistItem(event)}
                    onDelete={(itemId) => void handleDeleteWatchlistItem(itemId)}
                    onFormChange={setWatchlistForm}
                    onQuickAnalyze={(item) => void handleQuickAnalyzeWatchlistItem(item)}
                    onScanWatchlist={() => void handleScanWatchlist()}
                    prefillAnalysisLoadingKey={prefillAnalysisLoadingKey}
                    quickAnalysisLoadingKey={quickAnalysisLoadingKey}
                    scanLoading={scanLoading}
                    watchlist={watchlist}
                    watchlistForm={watchlistForm}
                    watchlistLoading={watchlistLoading}
                    watchlistMessage={watchlistMessage}
                  />
                )}

                {activeStockTab === 'analysis' && (
                  <StockAnalysisPanel
                    analysisForm={analysisForm}
                    analysisLoading={analysisLoading}
                    analysisMessage={analysisMessage}
                    analysisRecordQuery={analysisRecordQuery}
                    analysisRecordRatingFilter={analysisRecordRatingFilter}
                    analysisRecords={analysisRecords}
                    analysisResult={analysisResult}
                    creatingReportRecordId={creatingReportRecordId}
                    deletingAnalysisRecordId={deletingAnalysisRecordId}
                    filteredAnalysisRecords={filteredAnalysisRecords}
                    marketLoading={marketLoading}
                    marketSnapshot={marketSnapshot}
                    onCreateReport={(recordId) => void handleCreateReport(recordId)}
                    onCreateWatchlistFromAnalysis={(record) =>
                      void handleCreateWatchlistFromAnalysis(record)
                    }
                    onDeleteRecord={(recordId) => void handleDeleteAnalysisRecord(recordId)}
                    onFormChange={setAnalysisForm}
                    onLoadMarketSnapshot={() => void handleLoadMarketSnapshot()}
                    onQueryChange={setAnalysisRecordQuery}
                    onRatingFilterChange={setAnalysisRecordRatingFilter}
                    onRefreshRecords={() => void loadStockAnalysisRecords()}
                    onSubmit={(event) => void handleAnalyzeStock(event)}
                    topAnalysisCandidates={topAnalysisCandidates}
                    watchlistTickerSet={watchlistTickerSet}
                  />
                )}

                {activeStockTab === 'reports' && (
                  <StockReportsPanel
                    deletingReportId={deletingReportId}
                    downloadingReportId={downloadingReportId}
                    onDelete={(reportId) => void handleDeleteReport(reportId)}
                    onDownload={(report) => void handleDownloadReport(report)}
                    onRefresh={() => void loadStockReports()}
                    onUpdatePublish={(report, accessLevel, isPublished) =>
                      void handleUpdateReportPublish(report, accessLevel, isPublished)
                    }
                    reportMessage={reportMessage}
                    stockReports={stockReports}
                    updatingReportPublishId={updatingReportPublishId}
                  />
                )}

                {activeStockTab === 'market' && (
                  <StockMarketPanel
                    marketMessage={marketMessage}
                    marketReports={marketReports}
                    onRefresh={() => void loadStockReportMarket()}
                  />
                )}

                {activeStockTab === 'scan' && (
                  <StockScanPanel
                    onScan={(event) => void handleScanStocks(event)}
                    onScanMemoChange={setScanMemo}
                    onScanTickersChange={setScanTickers}
                    scanLoading={scanLoading}
                    scanMemo={scanMemo}
                    scanMessage={scanMessage}
                    scanResult={scanResult}
                    scanTickers={scanTickers}
                  />
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

        <RevenueScreen active={activeView === 'revenue'} ideas={ideas} />

        <RoadmapSection active={activeView === 'dashboard'} roadmap={roadmap} />
      </main>
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
    case 'reports':
      return <DollarOutlined />;
    case 'market':
      return <LockOutlined />;
  }
}

export function getInitialView(): ViewId {
  if (typeof window === 'undefined') {
    return 'dashboard';
  }

  const hashView = window.location.hash.replace('#', '');
  if (hashView === 'access') {
    return 'auth';
  }

  return VIEW_IDS.includes(hashView as ViewId) ? (hashView as ViewId) : 'dashboard';
}

export function buildHoldingPayload(form: HoldingForm): StockHoldingPayload {
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

export function buildAnalysisPayload(form: AnalysisForm): StockAnalysisPayload {
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

