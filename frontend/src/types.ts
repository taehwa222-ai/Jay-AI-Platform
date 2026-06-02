export type HealthStatus = {
  ok: boolean;
  app: string;
  env: string;
  time: string;
  model_provider: string;
  default_tickers: string[];
  volume_multiplier: number;
};

export type RoadmapPhase = {
  id: string;
  title: string;
  status: string;
  items: string[];
};

export type RecommendationDefaults = {
  tickers: string[];
  volume_multiplier: number;
  period: string;
  interval: string;
  model_provider: string;
};

export type RecommendationRequest = {
  tickers: string[];
  period: string;
  interval: string;
  volume_multiplier: number;
};

export type TechnicalIndicators = {
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
};

export type StockCandidate = {
  symbol: string;
  close: number;
  previous_close: number;
  change_percent: number;
  volume: number;
  previous_volume: number;
  volume_ratio: number;
  indicators: TechnicalIndicators;
  reason: string;
};

export type TickerError = {
  symbol: string;
  message: string;
};

export type RecommendationResponse = {
  generated_at: string;
  scanned: string[];
  candidates: StockCandidate[];
  analysis: string;
  errors: TickerError[];
};
