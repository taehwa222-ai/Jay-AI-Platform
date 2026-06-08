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

export type MonetizationIdea = {
  id: string;
  title: string;
  model: string;
  risk: string;
  next_step: string;
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
  role: 'admin' | 'member' | string;
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

export type AdminUserUpdatePayload = {
  role?: 'admin' | 'member';
  is_active?: boolean;
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
