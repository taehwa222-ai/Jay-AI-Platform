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
  role: 'admin' | string;
  is_active: boolean;
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
