import {
  BarChartOutlined,
  ClockCircleOutlined,
  DeploymentUnitOutlined,
  FileSearchOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StarOutlined,
  SyncOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  analyzeStock,
  createStockHolding,
  createStockReportFromAnalysis,
  createStockWatchlistItem,
  deleteStockAnalysisRecord,
  deleteStockHolding,
  deleteStockReport,
  deleteStockWatchlistItem,
  downloadStockReport,
  getDisclosures,
  getAdminUsers,
  getStockAnalysisRecords,
  getHealth,
  getMe,
  getStockHoldings,
  getStockMarketSnapshot,
  getStockReports,
  getStockWatchlist,
  login,
  refreshStockHoldingPrices,
  scanStocks,
  signup,
  updateAdminUser,
  updateStockHolding,
} from './api';
import { AuthScreen } from './components/AuthScreen';
import type { AuthMode } from './components/AuthScreen';
import { CommandPalette } from './components/CommandPalette';
import type { CommandItem } from './components/CommandPalette';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ContentOpsScreen } from './components/ContentOpsScreen';
import { NotificationCenterPanel } from './components/NotificationCenterPanel';
import { StockAnalysisPanel } from './components/StockAnalysisPanel';
import type { AnalysisForm } from './components/StockAnalysisPanel';
import { StockHoldingsPanel } from './components/StockHoldingsPanel';
import type { HoldingForm, PortfolioBreakdownItem } from './components/StockHoldingsPanel';
import { StockReportsPanel } from './components/StockReportsPanel';
import { StockDisclosurePanel } from './components/StockDisclosurePanel';
import { StockScanPanel } from './components/StockScanPanel';
import { StockWatchlistPanel } from './components/StockWatchlistPanel';
import type { WatchlistForm } from './components/StockWatchlistPanel';
import { usePersistentState } from './hooks/usePersistentState';
import {
  getInitialView,
  getStockTabIcon,
  isStockTabId,
  rememberView,
  STOCK_TABS,
  VIEW_META,
} from './navigation';
import type { StockTabId, ViewId } from './navigation';
import { formatPercent, formatWon, parseTickerList, safeFileName, toNumber } from './utils';
import type {
  AuthResponse,
  AdminUserUpdatePayload,
  Disclosure,
  HealthStatus,
  StockAnalysisRecord,
  StockAnalysisPayload,
  StockAnalysisResult,
  StockHolding,
  StockHoldingPayload,
  StockMarketSnapshot,
  StockReport,
  StockScanResult,
  StockWatchlistItem,
  UserAccount,
} from './types';

const TOKEN_STORAGE_KEY = 'jay-ai-platform-token';

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

type DeleteTarget = {
  kind: 'holding' | 'watchlist' | 'analysis' | 'report';
  id: number;
  label: string;
};

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? '');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [sessionLoading, setSessionLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<UserAccount[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUpdatingId, setAdminUpdatingId] = useState<number | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
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
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [deletingAnalysisRecordId, setDeletingAnalysisRecordId] = useState<number | null>(null);
  const [quickAnalysisLoadingKey, setQuickAnalysisLoadingKey] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [creatingReportRecordId, setCreatingReportRecordId] = useState<number | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<number | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketSnapshot, setMarketSnapshot] = useState<StockMarketSnapshot | null>(null);
  const [prefillAnalysisLoadingKey, setPrefillAnalysisLoadingKey] = useState<string | null>(null);
  const [scanTickers, setScanTickers] = useState('005930,000660,035420,035720,051910');
  const [scanMemo, setScanMemo] = useState('');
  const [scanResult, setScanResult] = useState<StockScanResult | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [disclosureTicker, setDisclosureTicker] = useState('005930');
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [disclosureLoading, setDisclosureLoading] = useState(false);
  const [disclosureMessage, setDisclosureMessage] = useState<string | null>(null);
  const [activeStockTab, setActiveStockTab] = usePersistentState<StockTabId>(
    'jay-ai-stock-tab',
    'holdings',
    isStockTabId,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewId>(() => getInitialView());
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false);
  const [contentOpsDirty, setContentOpsDirty] = useState(false);
  const [contentDiscardSignal, setContentDiscardSignal] = useState(0);
  const [pendingView, setPendingView] = useState<ViewId | null>(null);
  const [stockSyncing, setStockSyncing] = useState(false);
  const [lastStockSyncAt, setLastStockSyncAt] = useState<Date | null>(null);
  const [stockSyncMessage, setStockSyncMessage] = useState<string | null>(null);
  const stockTabsRef = useRef<HTMLDivElement>(null);

  const isSignedIn = currentUser !== null;
  const canManageUsers = currentUser?.role === 'owner' || currentUser?.role === 'admin';
  const visibleStockTabs =
    currentUser?.role === 'member'
      ? STOCK_TABS.filter((tab) => tab.id !== 'notifications')
      : STOCK_TABS;
  const hasSessionNavigation = isSignedIn || sessionLoading;
  const activeViewMeta = VIEW_META[activeView];

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
  const stockTabCounts: Record<StockTabId, string> = {
    holdings: `${holdings.length}개`,
    watchlist: `${watchlist.length}개`,
    analysis: analysisRecords.length > 0 ? `${analysisRecords.length}개 기록` : '대기',
    scan: scanResult ? `${scanResult.candidates.length}개 후보` : '대기',
    reports: `${stockReports.length}개`,
    disclosures: disclosures.length > 0 ? `${disclosures.length}건` : '대기',
    notifications: '운영',
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
  const latestAnalysis = analysisRecords[0] ?? null;
  const largestHolding = portfolioBreakdown[0] ?? null;
  const analyzedTickerSet = new Set(analysisRecords.map((record) => record.ticker));
  const unreviewedWatchlistCount = watchlist.filter(
    (item) => !analyzedTickerSet.has(item.ticker),
  ).length;
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
  const quickCommands: CommandItem[] = [
    {
      id: 'view-stocks',
      label: '주식 분석 Lab 열기',
      description: '포트폴리오와 종목 분석 워크스페이스로 이동',
      group: '화면 이동',
      icon: <BarChartOutlined />,
      shortcut: 'G S',
      keywords: 'stock portfolio 주식',
      onSelect: () => requestNavigate('stocks'),
    },
    {
      id: 'view-content-ops',
      label: 'Content Ops 열기',
      description: 'YouTube와 이모티콘 문서 편집기로 이동',
      group: '화면 이동',
      icon: <VideoCameraOutlined />,
      shortcut: 'G C',
      keywords: 'content markdown 콘텐츠',
      onSelect: () => requestNavigate('contentOps'),
    },
    {
      id: 'view-account',
      label: '사내 계정 열기',
      description: '현재 세션과 사용자 승인 상태 확인',
      group: '화면 이동',
      icon: <TeamOutlined />,
      shortcut: 'G A',
      onSelect: () => requestNavigate('auth'),
    },
    ...visibleStockTabs.map<CommandItem>((tab) => ({
      id: `stock-${tab.id}`,
      label: `${tab.title} 열기`,
      description: tab.description,
      group: '주식 Lab',
      icon: getStockTabIcon(tab.id),
      keywords: `stock ${tab.id}`,
      onSelect: () => {
        setActiveStockTab(tab.id);
        requestNavigate('stocks');
      },
    })),
    {
      id: 'refresh-stock-workspace',
      label: '주식 데이터 전체 동기화',
      description: '보유종목, 관심종목, 분석 기록과 리포트를 백그라운드에서 갱신',
      group: '주식 Lab',
      icon: <SyncOutlined />,
      shortcut: 'R S',
      keywords: 'refresh sync 동기화 갱신',
      onSelect: () => void refreshStockWorkspace(),
    },
    {
      id: 'refresh-health',
      label: '서버 상태 새로고침',
      description: '백엔드 연결 상태를 다시 확인',
      group: '시스템',
      icon: <ReloadOutlined />,
      shortcut: 'R',
      onSelect: () => void refreshState(),
    },
  ];

  useEffect(() => {
    void refreshState();
  }, []);

  useEffect(() => {
    const syncViewFromHash = () => {
      const nextView = getInitialView();
      setActiveView(nextView);
      rememberView(nextView);
    };
    syncViewFromHash();
    window.addEventListener('hashchange', syncViewFromHash);
    return () => window.removeEventListener('hashchange', syncViewFromHash);
  }, []);

  useEffect(() => {
    const activeTabButton = stockTabsRef.current?.querySelector<HTMLElement>(
      `[data-stock-tab="${activeStockTab}"]`,
    );
    activeTabButton?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeStockTab]);

  useEffect(() => {
    const handleCommandShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleCommandShortcut);
    return () => window.removeEventListener('keydown', handleCommandShortcut);
  }, []);

  useEffect(() => {
    if (token && !currentUser) {
      void restoreSession(token);
    } else if (!token) {
      setSessionLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && !currentUser) return;
    if (activeView !== 'auth' && !isSignedIn) {
      navigateToView('auth');
    }
  }, [activeView, currentUser, isSignedIn, token]);

  useEffect(() => {
    if (token && canManageUsers) {
      void loadAdminUsers(token);
    } else {
      setAdminUsers([]);
    }
  }, [token, canManageUsers]);

  useEffect(() => {
    if (currentUser?.role === 'member' && activeStockTab === 'notifications') {
      setActiveStockTab('holdings');
    }
  }, [activeStockTab, currentUser?.role, setActiveStockTab]);

  async function refreshState() {
    setLoading(true);
    setError(null);

    try {
      setHealth(await getHealth());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  async function restoreSession(savedToken: string) {
    setSessionLoading(true);
    try {
      const user = await getMe(savedToken);
      setCurrentUser(user);
      await refreshStockWorkspace(savedToken, true);
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken('');
      setCurrentUser(null);
      setHoldings([]);
      setWatchlist([]);
      setAnalysisRecords([]);
      setStockReports([]);
      setCurrentPriceDrafts({});
    } finally {
      setSessionLoading(false);
    }
  }

  async function handleAuthSubmit(event: FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    try {
      if (authMode === 'signup') {
        const response = await signup({ email, password, name });
        setPassword('');
        if (response.access_token) {
          applyAuth({
            access_token: response.access_token,
            token_type: response.token_type,
            user: response.user,
          });
          setAuthMessage('대표 계정이 생성되었습니다.');
        } else {
          setAuthMode('login');
          setAuthMessage('가입 신청이 접수되었습니다. 관리자 승인 후 로그인하세요.');
        }
      } else {
        const response = await login({ email, password });
        applyAuth(response);
        setPassword('');
        setAuthMessage('로그인되었습니다.');
      }
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
    void refreshStockWorkspace(response.access_token);
    navigateToView('stocks');
  }

  async function loadAdminUsers(activeToken = token) {
    if (!activeToken) return;
    setAdminUsersLoading(true);
    setAdminMessage(null);
    try {
      setAdminUsers(await getAdminUsers(activeToken));
    } catch (requestError) {
      setAdminMessage(
        requestError instanceof Error ? requestError.message : '사용자 목록을 불러오지 못했습니다.',
      );
    } finally {
      setAdminUsersLoading(false);
    }
  }

  async function handleUpdateAdminUser(userId: number, payload: AdminUserUpdatePayload) {
    if (!token) return;
    setAdminUpdatingId(userId);
    setAdminMessage(null);
    try {
      const updated = await updateAdminUser(token, userId, payload);
      setAdminUsers((users) => users.map((user) => (user.id === updated.id ? updated : user)));
      setAdminMessage(
        updated.approval_status === 'approved' && updated.is_active
          ? `${updated.name} 계정 접근을 승인했습니다.`
          : `${updated.name} 계정 상태를 변경했습니다.`,
      );
    } catch (requestError) {
      setAdminMessage(
        requestError instanceof Error ? requestError.message : '계정 상태를 변경하지 못했습니다.',
      );
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

  async function loadStockReports(activeToken = token) {
    if (!activeToken) return;
    const result = await getStockReports(activeToken);
    setStockReports(result);
  }

  async function refreshStockWorkspace(activeToken = token, fatal = false) {
    if (!activeToken || stockSyncing) return;
    setStockSyncing(true);
    setStockSyncMessage(null);
    try {
      await Promise.all([
        loadStockHoldings(activeToken),
        loadStockWatchlist(activeToken),
        loadStockAnalysisRecords(activeToken),
        loadStockReports(activeToken),
      ]);
      setLastStockSyncAt(new Date());
    } catch (requestError) {
      setStockSyncMessage(
        requestError instanceof Error ? requestError.message : '주식 데이터를 동기화하지 못했습니다.',
      );
      if (fatal) throw requestError;
    } finally {
      setStockSyncing(false);
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

  async function handleSearchDisclosures(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setDisclosureLoading(true);
    setDisclosureMessage(null);

    try {
      const result = await getDisclosures(token, disclosureTicker);
      setDisclosures(result);
      setDisclosureMessage(
        result.length === 0 ? '최근 1년 내 공시가 없습니다.' : `공시 ${result.length}건을 찾았습니다.`,
      );
    } catch (requestError) {
      setDisclosures([]);
      setDisclosureMessage(
        requestError instanceof Error ? requestError.message : 'Disclosure lookup failed.',
      );
    } finally {
      setDisclosureLoading(false);
    }
  }

  function requestNavigate(view: ViewId) {
    if (view === activeView) return;
    if (activeView === 'contentOps' && contentOpsDirty) {
      setPendingView(view);
      return;
    }
    navigateToView(view);
  }

  function confirmPendingNavigation() {
    if (!pendingView) return;
    const nextView = pendingView;
    setPendingView(null);
    setContentDiscardSignal((signal) => signal + 1);
    setContentOpsDirty(false);
    navigateToView(nextView);
  }

  function requestDelete(kind: DeleteTarget['kind'], id: number, label: string) {
    setDeleteTarget({ kind, id, label });
  }

  async function confirmDeleteTarget() {
    if (!deleteTarget) return;
    setDeleteConfirmLoading(true);
    try {
      switch (deleteTarget.kind) {
        case 'holding':
          await handleDeleteHolding(deleteTarget.id);
          break;
        case 'watchlist':
          await handleDeleteWatchlistItem(deleteTarget.id);
          break;
        case 'analysis':
          await handleDeleteAnalysisRecord(deleteTarget.id);
          break;
        case 'report':
          await handleDeleteReport(deleteTarget.id);
          break;
      }
      setDeleteTarget(null);
    } finally {
      setDeleteConfirmLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setCurrentUser(null);
    setSessionLoading(false);
    setHoldings([]);
    setWatchlist([]);
    setAnalysisRecords([]);
    setStockReports([]);
    setAnalysisResult(null);
    setScanResult(null);
    setAdminUsers([]);
    setAdminMessage(null);
    setAuthMessage('로그아웃되었습니다.');
    navigateToView('auth');
  }

  function navigateToView(view: ViewId) {
    rememberView(view);
    window.location.hash = view;
    setActiveView(view);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><DeploymentUnitOutlined /></span>
          <span className="brand-copy">
            <strong>Jay AI</strong>
            <small>Internal Business OS</small>
          </span>
        </div>
        <span className="nav-section-label">WORKSPACES</span>
        <nav className="nav-list" aria-label="Primary">
          {hasSessionNavigation && (
            <>
              <a className={activeView === 'stocks' ? 'active' : ''} href="#stocks" onClick={(event) => { event.preventDefault(); requestNavigate('stocks'); }}>
                <span className="nav-icon"><BarChartOutlined /></span>
                <span className="nav-copy"><strong>주식 분석 Lab</strong><small>투자 리서치</small></span>
              </a>
              <a className={activeView === 'contentOps' ? 'active' : ''} href="#contentOps" onClick={(event) => { event.preventDefault(); requestNavigate('contentOps'); }}>
                <span className="nav-icon"><VideoCameraOutlined /></span>
                <span className="nav-copy"><strong>Content Ops</strong><small>콘텐츠 생산</small></span>
              </a>
            </>
          )}
          <a className={activeView === 'auth' ? 'active' : ''} href="#auth" onClick={(event) => { event.preventDefault(); requestNavigate('auth'); }}>
            <span className="nav-icon"><TeamOutlined /></span>
            <span className="nav-copy">
              <strong>{isSignedIn ? '사내 계정' : sessionLoading ? '계정 확인 중' : '사내 로그인'}</strong>
              <small>{isSignedIn ? '세션·사용자 관리' : sessionLoading ? 'Restoring session' : 'Team access'}</small>
            </span>
          </a>
        </nav>
        <div className="sidebar-footer">
          {currentUser && (
            <a className="owner-mini-card" href="#auth" onClick={(event) => { event.preventDefault(); requestNavigate('auth'); }}>
              <span className="owner-avatar"><UserOutlined /></span>
              <span><strong>{currentUser.name}</strong><small>{currentUser.email}</small></span>
            </a>
          )}
          <div className="sidebar-status">
            <span className={`status-dot ${health?.ok ? 'online' : ''}`} />
            <span>{health?.ok ? 'All systems operational' : 'Checking system status'}</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="eyebrow">{activeViewMeta.eyebrow}</span>
            <h1>{activeViewMeta.title}</h1>
            <p>{activeViewMeta.description}</p>
          </div>
          <div className="topbar-actions">
            {isSignedIn && (
              <button
                aria-label="빠른 이동"
                className="command-trigger"
                onClick={() => setCommandPaletteOpen(true)}
                type="button"
              >
                <SearchOutlined />
                <span>빠른 이동</span>
                <kbd>Ctrl K</kbd>
              </button>
            )}
            <span className={`system-pill ${health?.ok ? 'online' : ''}`}>
              <span className="status-dot" />
              {health?.ok ? 'Online' : 'Connecting'}
            </span>
            <button
              aria-label="서버 상태 새로고침"
              className="icon-button"
              disabled={loading}
              onClick={() => void refreshState()}
              title="서버 상태 새로고침"
              type="button"
            >
              <ReloadOutlined className={loading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {error && <div className="error-box">{error}</div>}

        <AuthScreen
          active={activeView === 'auth'}
          currentUser={currentUser}
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
          adminUsers={adminUsers}
          adminUsersLoading={adminUsersLoading}
          adminUpdatingId={adminUpdatingId}
          adminMessage={adminMessage}
          onRefreshAdminUsers={() => void loadAdminUsers()}
          onUpdateAdminUser={(userId, payload) => void handleUpdateAdminUser(userId, payload)}
        />

        {isSignedIn && (
          <ContentOpsScreen
            active={activeView === 'contentOps'}
            discardSignal={contentDiscardSignal}
            onDirtyChange={setContentOpsDirty}
            token={token}
          />
        )}

        <section className={activeView === 'stocks' ? 'section-block' : 'screen-hidden'} id="stocks">
          <div className="workspace-intro stock-intro">
            <div>
              <span className="workspace-kicker"><ThunderboltOutlined /> DECISION DESK</span>
              <h2>오늘의 투자 판단을 한 화면에서</h2>
              <p>보유 현황을 확인하고, 후보를 분석한 뒤 공시와 리포트까지 이어서 검토하세요.</p>
            </div>
            <div className="guardrail-badge">
              <SafetyCertificateOutlined />
              <span><strong>AI Guardrail</strong><small>일일 한도 · 로컬 분석 폴백</small></span>
            </div>
          </div>

          {sessionLoading && !currentUser ? (
            <div className="workspace-loading-card" role="status">
              <span className="loading-spinner" />
              <span><strong>사내 워크스페이스를 불러오는 중</strong><small>포트폴리오와 분석 기록을 안전하게 복원하고 있습니다.</small></span>
            </div>
          ) : currentUser ? (
            <div className="stock-tab-shell">
              <div className="stock-operations-bar" aria-label="주식 데이터 동기화 상태">
                <div className="stock-sync-state">
                  <span className={stockSyncing ? 'sync-dot active' : 'sync-dot'}>
                    <SyncOutlined spin={stockSyncing} />
                  </span>
                  <span>
                    <strong>{stockSyncing ? '주식 데이터 동기화 중' : '워크스페이스 최신 상태'}</strong>
                    <small>
                      {stockSyncMessage ??
                        (lastStockSyncAt
                          ? `마지막 동기화 ${lastStockSyncAt.toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : '로그인 후 자동으로 데이터를 동기화합니다.')}
                    </small>
                  </span>
                </div>
                <div className="stock-quick-actions">
                  <button
                    disabled={stockSyncing}
                    onClick={() => void refreshStockWorkspace()}
                    type="button"
                  >
                    <SyncOutlined spin={stockSyncing} /> 전체 동기화
                  </button>
                  <button onClick={() => setActiveStockTab('scan')} type="button">
                    <BarChartOutlined /> 후보 스캔
                  </button>
                  <button onClick={() => setActiveStockTab('disclosures')} type="button">
                    <FileSearchOutlined /> 공시 확인
                  </button>
                </div>
              </div>
              <div className="stock-command-center" aria-label="주식 분석 요약">
                <button onClick={() => setActiveStockTab('holdings')} type="button">
                  <span className="summary-icon"><LineChartOutlined /></span>
                  <span className="summary-copy"><small>보유 평가액</small><strong>{formatWon(portfolioTotals.value)}</strong></span>
                  <small className={`summary-change ${portfolioTotals.profit >= 0 ? 'positive' : 'negative'}`}>
                    {portfolioTotals.profit > 0 ? '+' : ''}{formatWon(portfolioTotals.profit)} · {formatPercent(portfolioProfitPercent)}
                  </small>
                </button>
                <button onClick={() => setActiveStockTab('watchlist')} type="button">
                  <span className="summary-icon amber"><StarOutlined /></span>
                  <span className="summary-copy"><small>관심종목</small><strong>{watchlist.length}개</strong></span>
                  <small className="summary-change">관심종목 관리</small>
                </button>
                <button onClick={() => setActiveStockTab('analysis')} type="button">
                  <span className="summary-icon violet"><ThunderboltOutlined /></span>
                  <span className="summary-copy"><small>최근 AI 분석</small><strong>{latestAnalysis ? `${latestAnalysis.name} · ${latestAnalysis.score}점` : '대기'}</strong></span>
                  <small className="summary-change">{latestAnalysis?.rating_label ?? '분석 기록 없음'}</small>
                </button>
                <button onClick={() => setActiveStockTab('watchlist')} type="button">
                  <span className="summary-icon rose"><ClockCircleOutlined /></span>
                  <span className="summary-copy"><small>분석 미완료</small><strong>{unreviewedWatchlistCount}개</strong></span>
                  <small className="summary-change">
                    {largestHolding
                      ? `최대 비중 ${largestHolding.name} · ${formatPercent(largestHolding.allocationPercent)}`
                      : '관심종목에서 다음 검토 대상을 선택하세요.'}
                  </small>
                </button>
              </div>
              <div
                className="stock-tabs"
                ref={stockTabsRef}
                role="tablist"
                aria-label="국내 주식 작업 메뉴"
              >
                {visibleStockTabs.map((tab) => (
                  <button
                    aria-selected={activeStockTab === tab.id}
                    className={activeStockTab === tab.id ? 'active' : ''}
                    data-stock-tab={tab.id}
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
                    onDelete={(holdingId) => {
                      const holding = holdings.find((item) => item.id === holdingId);
                      requestDelete(
                        'holding',
                        holdingId,
                        holding ? `${holding.name} (${holding.ticker})` : '이 보유종목',
                      );
                    }}
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
                    onDelete={(itemId) => {
                      const item = watchlist.find((candidate) => candidate.id === itemId);
                      requestDelete(
                        'watchlist',
                        itemId,
                        item ? `${item.name || item.ticker} (${item.ticker})` : '이 관심종목',
                      );
                    }}
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
                    onDeleteRecord={(recordId) => {
                      const record = analysisRecords.find((item) => item.id === recordId);
                      requestDelete(
                        'analysis',
                        recordId,
                        record ? `${record.name} (${record.ticker})` : '이 분석 기록',
                      );
                    }}
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
                    onDelete={(reportId) => {
                      const report = stockReports.find((item) => item.id === reportId);
                      requestDelete('report', reportId, report?.title ?? '이 내부 리포트');
                    }}
                    onDownload={(report) => void handleDownloadReport(report)}
                    onRefresh={() => void loadStockReports()}
                    reportMessage={reportMessage}
                    stockReports={stockReports}
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

                {activeStockTab === 'disclosures' && (
                  <StockDisclosurePanel
                    disclosures={disclosures}
                    loading={disclosureLoading}
                    message={disclosureMessage}
                    onSearch={(event) => void handleSearchDisclosures(event)}
                    onTickerChange={setDisclosureTicker}
                    ticker={disclosureTicker}
                  />
                )}

                {activeStockTab === 'notifications' && (
                  <NotificationCenterPanel token={token} />
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

      </main>

      <CommandPalette
        commands={quickCommands}
        onClose={() => setCommandPaletteOpen(false)}
        open={commandPaletteOpen}
      />
      <ConfirmDialog
        busy={deleteConfirmLoading}
        confirmLabel="삭제"
        danger
        description={`${deleteTarget?.label ?? '선택한 항목'}을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteTarget()}
        open={deleteTarget !== null}
        title={`${
          deleteTarget
            ? {
                holding: '보유종목',
                watchlist: '관심종목',
                analysis: '분석 기록',
                report: '내부 리포트',
              }[deleteTarget.kind]
            : '항목'
        } 삭제`}
      />
      <ConfirmDialog
        confirmLabel="변경사항 버리고 이동"
        description="이동하면 현재 Markdown 수정 내용이 사라집니다. 계속 이동할까요?"
        onCancel={() => setPendingView(null)}
        onConfirm={confirmPendingNavigation}
        open={pendingView !== null}
        title="저장하지 않은 변경사항이 있습니다"
      />
    </div>
  );
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

