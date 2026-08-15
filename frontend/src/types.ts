export type HealthStatus = {
  ok: boolean;
  app: string;
  env: string;
  time: string;
};

export type PlatformOverview = {
  name: string;
  status: string;
  message: string;
  modules: string[];
};

export type PlatformModule = {
  id: string;
  title: string;
  status: string;
  description: string;
  items: string[];
};

export type ManualSection = {
  id: string;
  title: string;
  summary: string;
  commands: string[];
  checks: string[];
};

export type RoadmapPhase = {
  id: string;
  title: string;
  status: string;
  items: string[];
};

export type UserAccount = {
  id: number;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  is_active: boolean;
  approval_status: 'approved' | 'pending' | 'disabled';
  can_access_stocks: boolean;
  can_access_content_ops: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type SignupPayload = {
  email: string;
  password: string;
  name: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: UserAccount;
};

export type Disclosure = {
  title: string;
  date: string;
  receipt_no: string;
  url: string;
};

export type StockHolding = {
  id: number;
  ticker: string;
  name: string;
  quantity: number;
  average_price: number;
  current_price: number;
  cost_basis: number;
  market_value: number;
  profit_loss: number;
  profit_loss_percent: number;
  investment_thesis: string;
  risk_memo: string;
  created_at: string;
  updated_at: string;
};

export type StockHoldingPayload = {
  ticker: string;
  name: string;
  quantity: number;
  average_price: number;
  current_price: number;
  investment_thesis?: string;
  risk_memo?: string;
};

export type StockHoldingPriceRefreshFailure = {
  id: number;
  ticker: string;
  name: string;
  reason: string;
};

export type StockHoldingPriceRefreshResult = {
  updated: StockHolding[];
  failed: StockHoldingPriceRefreshFailure[];
};

export type StockWatchlistItem = {
  id: number;
  ticker: string;
  name: string;
  note: string;
  created_at: string;
  updated_at: string;
};

export type StockWatchlistPayload = {
  ticker: string;
  name?: string;
  note?: string;
};

export type StockAnalysisPayload = {
  ticker: string;
  name: string;
  current_price: number;
  previous_close: number;
  volume: number;
  previous_volume: number;
  rsi: number;
  macd: number;
  macd_signal: number;
  memo?: string;
};

export type StockAnalysisResult = {
  ticker: string;
  name: string;
  score: number;
  rating: 'candidate' | 'watch' | 'caution';
  rating_label: string;
  summary: string;
  ai_summary: string;
  ai_powered: boolean;
  price_change_percent: number;
  volume_multiplier: number;
  signals: string[];
  risk_notes: string[];
  action_checklist: string[];
  disclaimer: string;
};

export type StockAnalysisRecord = StockAnalysisResult & {
  id: number;
  memo: string;
  created_at: string;
};

export type StockReport = {
  id: number;
  analysis_record_id: number;
  ticker: string;
  name: string;
  title: string;
  body: string;
  score: number;
  rating: 'candidate' | 'watch' | 'caution';
  rating_label: string;
  report_type: string;
  created_at: string;
};

export type SignupResponse = {
  user: UserAccount;
  approval_status: 'approved' | 'pending';
  message: string;
  access_token: string | null;
  token_type: string;
};

export type AdminUserUpdatePayload = {
  role?: 'admin' | 'member';
  is_active?: boolean;
  can_access_stocks?: boolean;
  can_access_content_ops?: boolean;
};

export type AuditLog = {
  id: number;
  event_type: string;
  actor_user_id: number | null;
  actor_name: string | null;
  target_user_id: number | null;
  target_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type OperationsRuntimeStatus = {
  started_at: string;
  uptime_seconds: number;
  total_requests: number;
  completed_requests: number;
  in_flight_requests: number;
  server_error_count: number;
  telemetry_write_failures: number;
  average_duration_ms: number;
  status_counts: Record<string, number>;
};

export type OperationsDatabaseStatus = {
  healthy: boolean;
  file_name: string;
  journal_mode: string;
  integrity_check: string;
  size_bytes: number;
  disk_free_bytes: number;
  disk_free_percent: number;
};

export type OperationsBackupStatus = {
  available: boolean;
  latest_file: string | null;
  latest_created_at: string | null;
  age_hours: number | null;
  backup_count: number;
};

export type OperationsAIUsageDay = {
  usage_date: string;
  request_count: number;
};

export type OperationsAIUsageStatus = {
  today_count: number;
  daily_limit: number;
  remaining: number;
  usage_percent: number;
  history: OperationsAIUsageDay[];
};

export type OperationsCacheStatus = {
  name: string;
  ttl_seconds: number;
  entries: number;
  requests: number;
  hits: number;
  misses: number;
  loads: number;
  load_errors: number;
  coalesced_waits: number;
  hit_rate: number;
  last_hit_at: string | null;
  last_miss_at: string | null;
  last_load_at: string | null;
};

export type OperationsIntegrationStatus = {
  name: string;
  configured: boolean;
  detail: string;
};

export type OperationsError = {
  id: number;
  occurred_at: string;
  method: string;
  path: string;
  status_code: number;
  error_type: string;
  duration_ms: number;
};

export type OperationsOverview = {
  generated_at: string;
  status: 'healthy' | 'attention';
  runtime: OperationsRuntimeStatus;
  database: OperationsDatabaseStatus;
  backup: OperationsBackupStatus;
  ai_usage: OperationsAIUsageStatus;
  caches: OperationsCacheStatus[];
  integrations: OperationsIntegrationStatus[];
  errors_last_24h: number;
  recent_errors: OperationsError[];
};

export type StockMarketSnapshot = {
  ticker: string;
  provider_symbol: string;
  source: string;
  latest_trading_day: string;
  current_price: number;
  previous_close: number;
  volume: number;
  previous_volume: number;
  rsi: number;
  macd: number;
  macd_signal: number;
  price_change_percent: number;
  volume_multiplier: number;
  fetched_at: string;
};

export type StockScanPayload = {
  tickers: string[];
  name_map?: Record<string, string>;
  memo?: string;
};

export type StockScanCandidate = {
  ticker: string;
  name: string;
  provider_symbol: string;
  latest_trading_day: string;
  current_price: number;
  previous_close: number;
  price_change_percent: number;
  volume_multiplier: number;
  rsi: number;
  macd: number;
  macd_signal: number;
  score: number;
  rating: 'candidate' | 'watch' | 'caution';
  rating_label: string;
  summary: string;
  signals: string[];
  risk_notes: string[];
};

export type StockScanFailure = {
  ticker: string;
  reason: string;
};

export type StockScanResult = {
  candidates: StockScanCandidate[];
  failed: StockScanFailure[];
  disclaimer: string;
};

export type ReviewMetrics = {
  view_count: string | null;
  ctr: string | null;
  avg_watch_time: string | null;
  subscriber_delta: string | null;
  engagement: string | null;
  top_traffic_source: string | null;
};

export type YoutubeProjectSummary = {
  slug: string;
  date: string;
  has_research: boolean;
  has_ideas: boolean;
  has_qa: boolean;
  has_script: boolean;
  has_production: boolean;
  has_review: boolean;
  updated_at: string;
  view_count: string | null;
};

export type YoutubeProjectDetail = {
  slug: string;
  date: string;
  research: string | null;
  ideas: string | null;
  qa: string | null;
  script: string | null;
  production: string | null;
  review: string | null;
  review_metrics: ReviewMetrics | null;
};

export type EmoticonSetSummary = {
  set_key: string;
  has_set_doc: boolean;
  has_submission_checklist: boolean;
  has_submission_copy: boolean;
};

export type EmoticonProjectSummary = {
  slug: string;
  has_character: boolean;
  has_research: boolean;
  has_qa: boolean;
  has_friends: boolean;
  has_review: boolean;
  sets: EmoticonSetSummary[];
  updated_at: string;
};

export type EmoticonSetDetail = {
  set_key: string;
  set_doc: string | null;
  submission_checklist: string | null;
  submission_copy: string | null;
};

export type EmoticonProjectDetail = {
  slug: string;
  character: string | null;
  research: string | null;
  qa: string | null;
  friends: string | null;
  review: string | null;
  sets: EmoticonSetDetail[];
};

export type ContentKind = 'youtube' | 'emoticon';

export type ContentDocument = {
  filename: string;
  content: string;
  updated_at: string;
};

export type NotificationEvent = {
  id: number;
  event_type: string;
  title: string;
  status: 'sent' | 'failed' | 'skipped';
  item_count: number;
  error_message: string | null;
  attempt_count: number;
  created_at: string;
  last_attempt_at: string;
};

export type NotificationCenterStatus = {
  configured: boolean;
  chat_target: string;
  ai_daily_count: number;
  ai_daily_limit: number;
  events: NotificationEvent[];
};

export type TelegramNotificationResult = {
  configured: boolean;
  sent: boolean;
  item_count: number;
};
