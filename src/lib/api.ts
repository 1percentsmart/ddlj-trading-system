/**
 * DDLJ Trading System — API Service Layer
 * ==========================================
 * Type-safe API client for the FastAPI backend.
 * Frontend requests use the Next.js /api/v1 proxy, which rewrites to BACKEND_URL.
 */

const API_BASE = '/api/v1';
const WS_URL = '';

export { API_BASE, WS_URL };

// ── Types ──────────────────────────────────────────────────────
export interface EngineStatus {
  engine_running: boolean;
  initialized: boolean;
  error_count: number;
  start_time: string | null;
  stop_time: string | null;
  manually_started?: boolean;
  token: {
    stored: boolean;
    valid: boolean;
    user: string | null;
  };
  last_heartbeat: string | null;
  uptime_seconds?: number;
}

export interface EngineActionResult {
  status?: string;
  message?: string;
  ok?: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  reason?: string;
  action?: string;
  engine_running?: boolean;
  token_valid?: boolean;
  checks?: Record<string, unknown>;
  system?: Record<string, unknown>;
}

export interface TradesResponse {
  total: number;
  limit: number;
  offset: number;
  trades: Trade[];
}

export interface Trade {
  id?: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  entry_time: string;
  exit_time: string;
  sl: number;
  target: number;
  qty: number;
  gross: number;
  costs: number;
  net: number;
  exit_reason: string;
  rr: number;
  held: string;
  mode: string;
  option_strike?: number;
  option_type?: 'CE' | 'PE';
  option_entry_premium?: number;
  option_exit_premium?: number;
  option_delta?: number;
  option_iv_entry?: number;
  option_iv_exit?: number;
}

export interface PositionsResponse {
  count: number;
  positions: Position[];
}

export interface Position {
  id?: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  entry_time: string;
  qty: number;
  sl: number;
  target: number;
  rr: number;
  held: string;
  be_done: boolean;
  atr_at_entry: number;
  current_premium?: number;
  unrealized_pnl?: number;
  option_strike?: number;
  option_type?: 'CE' | 'PE';
}

export interface TokenStatus {
  stored: boolean;
  valid: boolean;
  user: string | null;
}

export interface TokenExchangeResult {
  status: string;
  user: string;
  message: string;
}

export interface TokenLoginUrl {
  login_url: string;
}

export interface BacktestRunResult {
  status: string;
  message: string;
  note?: string;
  hint?: string;
  params?: Record<string, unknown>;
  progress_endpoint?: string;
}

export interface BacktestProgress {
  phase: string;
  current_config: number;
  total_configs: number;
  current_label: string;
  data_fetched: boolean;
  candle_counts: Record<string, number>;
  pct: number;
  message: string;
}

export interface BacktestStatusResult {
  status: string;
  message?: string;
  // Normalized numeric progress for existing UI components.
  progress?: number;
  // Full backend progress object, when available.
  progress_detail?: BacktestProgress;
  elapsed_seconds?: number;
  started_at?: string;
  params?: Record<string, unknown> | null;
  last_results?: {
    version: string;
    configs_tested: number;
    method_a_top: Record<string, BacktestConfigResult>;
    method_b_top: Record<string, BacktestConfigResult>;
  } | null;
}

export interface BacktestTradeDetail {
  id: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  sl: number;
  target: number;
  qty: number;
  gross: number;
  costs: number;
  net: number;
  exit_reason: string;
  rr: number;
  risk: number;
  reward: number;
  held_bars: number;
  mode: string;
  option_strike?: number;
  option_type?: string;
  option_entry_premium?: number;
  option_exit_premium?: number;
  option_delta?: number;
  option_iv_entry?: number;
  option_iv_exit?: number;
  option_spread_cost?: number;
}

export interface BacktestConfigResult {
  label: string;
  net_pnl: number;
  net_pnl_pct: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  max_dd_pct: number;
  sharpe_approx: number;
  avg_trade: number;
  gross_profit?: number;
  gross_loss?: number;
  total_costs?: number;
  avg_win?: number;
  avg_loss?: number;
  avg_rr?: number;
  avg_held?: number;
  max_dd?: number;
  long_trades?: number;
  short_trades?: number;
  long_wr?: number;
  short_wr?: number;
  trading_days?: number;
  final_capital?: number;
  starting_capital?: number;
  exit_reasons?: Record<string, number>;
  monthly_pnl?: Record<string, number>;
  trades?: BacktestTradeDetail[];
}

export interface ReadinessCheck {
  status: 'ready' | 'not_ready';
  checks: Record<string, boolean>;
  blockers: string[];
  engine_running: boolean;
  next_actions: string[];
}

export interface LiveReadinessCheck {
  status: 'ready' | 'blocked';
  mode: string;
  checks: Record<string, boolean>;
  blockers: string[];
  kill_switch: {
    active: boolean;
    reason: string | null;
  };
  message: string;
}

// ── Helper ─────────────────────────────────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Engine ──────────────────────────────────────────────────────
export const engineApi = {
  getStatus: () => request<EngineStatus>('/status'),
  start: () => request<EngineActionResult>('/start', { method: 'POST' }),
  stop: () => request<EngineActionResult>('/stop', { method: 'POST' }),
  getReadiness: () => request<ReadinessCheck>('/readiness'),
};

// ── Config ──────────────────────────────────────────────────────
export const configApi = {
  getAll: () => request<Record<string, unknown>>('/config'),
  update: (updates: Record<string, unknown>) =>
    request<Record<string, unknown>>('/config', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    }),
};

// ── Trades & Positions ──────────────────────────────────────────
export const tradesApi = {
  getHistory: (limit = 100, offset = 0) =>
    request<TradesResponse>(`/trades?limit=${limit}&offset=${offset}`),
  getPositions: () => request<PositionsResponse>('/positions'),
};

// ── Health ──────────────────────────────────────────────────────
export const healthApi = {
  getHealth: () => request<HealthStatus>('/health'),
};

// ── Token ───────────────────────────────────────────────────────
export const tokenApi = {
  exchange: (requestToken: string) =>
    request<TokenExchangeResult>('/token', {
      method: 'POST',
      body: JSON.stringify({ request_token: requestToken }),
    }),
  getStatus: () => request<TokenStatus>('/token/status'),
  getLoginUrl: () => request<TokenLoginUrl>('/token/login'),
};

// ── Live safety ─────────────────────────────────────────────────
export const liveSafetyApi = {
  getReadiness: () => request<LiveReadinessCheck>('/live/readiness'),
  activateKillSwitch: (reason = 'manual') =>
    request<{ status: string; kill_switch: boolean; reason: string }>(
      `/live/kill-switch?reason=${encodeURIComponent(reason)}`,
      { method: 'POST' },
    ),
  resetKillSwitch: () =>
    request<{ status: string; kill_switch: boolean }>('/live/kill-switch/reset', { method: 'POST' }),
};

// ── Backtest ────────────────────────────────────────────────────
export type BacktestMethod = 'method_a' | 'method_b' | 'compounding' | 'monthly' | 'both';
export type BacktestTimeframe = '15m/60m' | '15m/15m' | '5m/60m' | '5m' | '15m' | '60m' | 'all';

export interface BacktestRunConfig {
  symbol?: 'BANKNIFTY' | 'NIFTY' | 'both';
  timeframe?: BacktestTimeframe;
  method?: BacktestMethod;
  from_date?: string;
  to_date?: string;
  capital?: number;
  sl_atr?: number;
  min_rr?: number;
  moneyness?: 'ATM' | 'ITM' | 'DEEP_ITM';
  daily_risk_pct?: number;
  max_open_positions?: number;
  max_daily_trades?: number;
  max_daily_trades_enabled?: boolean;
}

function normalizeBacktestConfig(config?: BacktestRunConfig): BacktestRunConfig | undefined {
  if (!config) return undefined;

  const methodMap: Record<string, 'method_a' | 'method_b' | 'both'> = {
    compounding: 'method_a',
    monthly: 'method_b',
    method_a: 'method_a',
    method_b: 'method_b',
    both: 'both',
  };

  const timeframeMap: Partial<Record<BacktestTimeframe, '15m/60m' | '15m/15m' | '5m/60m' | 'all'>> = {
    '5m': '5m/60m',
    '15m': '15m/60m',
    '60m': '15m/60m',
    '15m/60m': '15m/60m',
    '15m/15m': '15m/15m',
    '5m/60m': '5m/60m',
    all: 'all',
  };

  return {
    ...config,
    method: config.method ? methodMap[config.method] : undefined,
    timeframe: config.timeframe ? timeframeMap[config.timeframe] : undefined,
  };
}

function normalizeBacktestStatus(raw: BacktestStatusResult & { progress?: number | BacktestProgress }): BacktestStatusResult {
  const rawProgress = raw.progress;
  const progressDetail = typeof rawProgress === 'object' && rawProgress !== null ? rawProgress : undefined;
  const progressNumber = typeof rawProgress === 'number'
    ? rawProgress
    : progressDetail?.pct ?? (raw.status === 'completed' ? 100 : 0);

  return {
    ...raw,
    progress: progressNumber,
    progress_detail: progressDetail,
    message: progressDetail?.message ?? raw.message,
  };
}

export const backtestApi = {
  run: (config?: BacktestRunConfig) =>
    request<BacktestRunResult>('/backtest/run', {
      method: 'POST',
      body: config ? JSON.stringify(normalizeBacktestConfig(config)) : undefined,
    }),
  getStatus: async () => normalizeBacktestStatus(await request<BacktestStatusResult & { progress?: number | BacktestProgress }>('/backtest/status')),
};
