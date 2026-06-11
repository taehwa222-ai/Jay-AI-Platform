import type {
  AdminUserUpdatePayload,
  AdminUserUsage,
  AuthResponse,
  HealthStatus,
  LoginPayload,
  ManualSection,
  MonetizationIdea,
  PlatformModule,
  PlatformOverview,
  RoadmapPhase,
  SignupPayload,
  StockAnalysisRecord,
  StockAnalysisPayload,
  StockAnalysisResult,
  StockHolding,
  StockHoldingPayload,
  StockHoldingPriceRefreshResult,
  StockMarketSnapshot,
  StockReport,
  StockReportMarketItem,
  StockReportPublishPayload,
  StockScanPayload,
  StockScanResult,
  StockWatchlistItem,
  StockWatchlistPayload,
  UserAccount,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function getHealth(): Promise<HealthStatus> {
  return request<HealthStatus>('/api/v1/health');
}

export function getOverview(): Promise<PlatformOverview> {
  return request<PlatformOverview>('/api/v1/platform/overview');
}

export async function getModules(): Promise<PlatformModule[]> {
  const response = await request<{ modules: PlatformModule[] }>('/api/v1/platform/modules');
  return response.modules;
}

export async function getManual(): Promise<ManualSection[]> {
  const response = await request<{ sections: ManualSection[] }>('/api/v1/platform/manual');
  return response.sections;
}

export async function getMonetizationIdeas(): Promise<MonetizationIdea[]> {
  const response = await request<{ ideas: MonetizationIdea[] }>('/api/v1/platform/monetization');
  return response.ideas;
}

export async function getRoadmap(): Promise<RoadmapPhase[]> {
  const response = await request<{ phases: RoadmapPhase[] }>('/api/v1/platform/roadmap');
  return response.phases;
}

export function signup(payload: SignupPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMe(token: string): Promise<UserAccount> {
  return request<UserAccount>('/api/v1/auth/me', undefined, token);
}

export function getAdminUsers(token: string): Promise<UserAccount[]> {
  return request<UserAccount[]>('/api/v1/admin/users', undefined, token);
}

export function getAdminUserUsage(token: string): Promise<AdminUserUsage[]> {
  return request<AdminUserUsage[]>('/api/v1/admin/user-usage', undefined, token);
}

export function updateAdminUser(
  token: string,
  userId: number,
  payload: AdminUserUpdatePayload,
): Promise<UserAccount> {
  return request<UserAccount>(
    `/api/v1/admin/users/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function getStockHoldings(token: string): Promise<StockHolding[]> {
  return request<StockHolding[]>('/api/v1/stocks/holdings', undefined, token);
}

export function getStockWatchlist(token: string): Promise<StockWatchlistItem[]> {
  return request<StockWatchlistItem[]>('/api/v1/stocks/watchlist', undefined, token);
}

export function createStockWatchlistItem(
  token: string,
  payload: StockWatchlistPayload,
): Promise<StockWatchlistItem> {
  return request<StockWatchlistItem>(
    '/api/v1/stocks/watchlist',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function deleteStockWatchlistItem(token: string, itemId: number): Promise<void> {
  await request<void>(
    `/api/v1/stocks/watchlist/${itemId}`,
    {
      method: 'DELETE',
    },
    token,
  );
}

export function createStockHolding(
  token: string,
  payload: StockHoldingPayload,
): Promise<StockHolding> {
  return request<StockHolding>(
    '/api/v1/stocks/holdings',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function updateStockHolding(
  token: string,
  holdingId: number,
  payload: Partial<StockHoldingPayload>,
): Promise<StockHolding> {
  return request<StockHolding>(
    `/api/v1/stocks/holdings/${holdingId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function deleteStockHolding(token: string, holdingId: number): Promise<void> {
  await request<void>(
    `/api/v1/stocks/holdings/${holdingId}`,
    {
      method: 'DELETE',
    },
    token,
  );
}

export function refreshStockHoldingPrices(token: string): Promise<StockHoldingPriceRefreshResult> {
  return request<StockHoldingPriceRefreshResult>(
    '/api/v1/stocks/holdings/refresh-prices',
    {
      method: 'POST',
    },
    token,
  );
}

export function analyzeStock(
  token: string,
  payload: StockAnalysisPayload,
): Promise<StockAnalysisResult> {
  return request<StockAnalysisResult>(
    '/api/v1/stocks/analyze',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function getStockMarketSnapshot(
  token: string,
  ticker: string,
): Promise<StockMarketSnapshot> {
  return request<StockMarketSnapshot>(
    `/api/v1/stocks/market/${encodeURIComponent(ticker)}`,
    undefined,
    token,
  );
}

export function getStockAnalysisRecords(token: string): Promise<StockAnalysisRecord[]> {
  return request<StockAnalysisRecord[]>('/api/v1/stocks/analysis-records', undefined, token);
}

export async function deleteStockAnalysisRecord(token: string, recordId: number): Promise<void> {
  await request<void>(
    `/api/v1/stocks/analysis-records/${recordId}`,
    {
      method: 'DELETE',
    },
    token,
  );
}

export function getStockReports(token: string): Promise<StockReport[]> {
  return request<StockReport[]>('/api/v1/stocks/reports', undefined, token);
}

export function getStockReportMarket(token: string): Promise<StockReportMarketItem[]> {
  return request<StockReportMarketItem[]>('/api/v1/stocks/reports/market', undefined, token);
}

export function createStockReportFromAnalysis(
  token: string,
  recordId: number,
): Promise<StockReport> {
  return request<StockReport>(
    `/api/v1/stocks/reports/from-analysis/${recordId}`,
    {
      method: 'POST',
    },
    token,
  );
}

export async function deleteStockReport(token: string, reportId: number): Promise<void> {
  await request<void>(
    `/api/v1/stocks/reports/${reportId}`,
    {
      method: 'DELETE',
    },
    token,
  );
}

export async function downloadStockReport(token: string, reportId: number): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/v1/stocks/reports/${reportId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.blob();
}

export function updateStockReportPublish(
  token: string,
  reportId: number,
  payload: StockReportPublishPayload,
): Promise<StockReport> {
  return request<StockReport>(
    `/api/v1/stocks/reports/${reportId}/publish`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function scanStocks(token: string, payload: StockScanPayload): Promise<StockScanResult> {
  return request<StockScanResult>(
    '/api/v1/stocks/scan',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}
