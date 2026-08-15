import type {
  AuthResponse,
  AdminUserUpdatePayload,
  AuditLog,
  ContentDocument,
  ContentKind,
  Disclosure,
  HealthStatus,
  LoginPayload,
  ManualSection,
  PlatformModule,
  PlatformOverview,
  RoadmapPhase,
  SignupPayload,
  SignupResponse,
  StockAnalysisRecord,
  StockAnalysisPayload,
  StockAnalysisResult,
  StockHolding,
  StockHoldingPayload,
  StockHoldingPriceRefreshResult,
  StockMarketSnapshot,
  StockReport,
  StockScanPayload,
  StockScanResult,
  StockWatchlistItem,
  StockWatchlistPayload,
  UserAccount,
  EmoticonProjectDetail,
  EmoticonProjectSummary,
  YoutubeProjectDetail,
  YoutubeProjectSummary,
  NotificationCenterStatus,
  OperationsOverview,
  TelegramNotificationResult,
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
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      detail = parsed.detail ?? text;
    } catch {
      // Keep the original response when the server did not return JSON.
    }
    throw new Error(detail || `Request failed: ${response.status}`);
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

export async function getRoadmap(): Promise<RoadmapPhase[]> {
  const response = await request<{ phases: RoadmapPhase[] }>('/api/v1/platform/roadmap');
  return response.phases;
}

export function signup(payload: SignupPayload): Promise<SignupResponse> {
  return request<SignupResponse>('/api/v1/auth/signup', {
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

export function getYoutubeProjects(token: string): Promise<YoutubeProjectSummary[]> {
  return request<YoutubeProjectSummary[]>('/api/v1/content-ops/youtube', undefined, token);
}

export function getYoutubeProjectDetail(
  token: string,
  slug: string,
): Promise<YoutubeProjectDetail> {
  return request<YoutubeProjectDetail>(
    `/api/v1/content-ops/youtube/${encodeURIComponent(slug)}`,
    undefined,
    token,
  );
}

export function getEmoticonProjects(token: string): Promise<EmoticonProjectSummary[]> {
  return request<EmoticonProjectSummary[]>('/api/v1/content-ops/emoticon', undefined, token);
}

export function getEmoticonProjectDetail(
  token: string,
  slug: string,
): Promise<EmoticonProjectDetail> {
  return request<EmoticonProjectDetail>(
    `/api/v1/content-ops/emoticon/${encodeURIComponent(slug)}`,
    undefined,
    token,
  );
}

export function getAdminUsers(token: string): Promise<UserAccount[]> {
  return request<UserAccount[]>('/api/v1/admin/users', undefined, token);
}

export function updateAdminUser(
  token: string,
  userId: number,
  payload: AdminUserUpdatePayload,
): Promise<UserAccount> {
  return request<UserAccount>(
    `/api/v1/admin/users/${userId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    token,
  );
}

export function getAuditLogs(token: string): Promise<AuditLog[]> {
  return request<AuditLog[]>('/api/v1/admin/audit-logs?limit=50', undefined, token);
}

export function getOperations(token: string): Promise<OperationsOverview> {
  return request<OperationsOverview>('/api/v1/admin/operations', undefined, token);
}

export function revokeUserSessions(token: string, userId: number): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/v1/admin/users/${userId}/sessions/revoke`,
    { method: 'POST' },
    token,
  );
}

export function resetUserPassword(
  token: string,
  userId: number,
  newPassword: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/v1/admin/users/${userId}/password/reset`,
    { method: 'POST', body: JSON.stringify({ new_password: newPassword }) },
    token,
  );
}

export function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    '/api/v1/auth/password',
    {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    },
    token,
  );
}

export function revokeOwnSessions(token: string): Promise<{ message: string }> {
  return request<{ message: string }>('/api/v1/auth/sessions/revoke', { method: 'POST' }, token);
}

export function getContentDocuments(
  token: string,
  kind: ContentKind,
  slug: string,
): Promise<ContentDocument[]> {
  return request<ContentDocument[]>(
    `/api/v1/content-ops/documents/${kind}/${encodeURIComponent(slug)}`,
    undefined,
    token,
  );
}

export function saveContentDocument(
  token: string,
  kind: ContentKind,
  slug: string,
  filename: string,
  content: string,
): Promise<ContentDocument> {
  return request<ContentDocument>(
    `/api/v1/content-ops/documents/${kind}/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}`,
    { method: 'PUT', body: JSON.stringify({ content }) },
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

export function getDisclosures(token: string, ticker: string): Promise<Disclosure[]> {
  return request<Disclosure[]>(
    `/api/v1/disclosures/${encodeURIComponent(ticker)}`,
    undefined,
    token,
  );
}

export function getNotificationStatus(token: string): Promise<NotificationCenterStatus> {
  return request<NotificationCenterStatus>('/api/v1/notifications/status', undefined, token);
}

export function sendTelegramTest(token: string): Promise<TelegramNotificationResult> {
  return request<TelegramNotificationResult>(
    '/api/v1/notifications/telegram/test',
    { method: 'POST' },
    token,
  );
}

export function sendDisclosureNotification(
  token: string,
  ticker: string,
): Promise<TelegramNotificationResult> {
  return request<TelegramNotificationResult>(
    `/api/v1/notifications/telegram/disclosures/${encodeURIComponent(ticker)}`,
    { method: 'POST' },
    token,
  );
}

export function retryNotification(
  token: string,
  eventId: number,
): Promise<TelegramNotificationResult> {
  return request<TelegramNotificationResult>(
    `/api/v1/notifications/events/${eventId}/retry`,
    { method: 'POST' },
    token,
  );
}
