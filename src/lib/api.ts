/**
 * DDLJ Trading System — API Service Layer
 * ==========================================
 * Type-safe API client for the FastAPI backend.
 * All endpoints match the real backend at https://ddlj.up.railway.app/api/v1
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

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  reason?: string;
  action?: string;
  engine_running?: boolean;
  token_valid?: boolean;
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
}

export interface BacktestStatusResult {
  status: string;
  message?: string;
  progress?: number | BacktestProgress; // Can be number (legacy) or object (current)
  elapsed_seconds?: number;
  started_at?: string;
  params?: BacktestRunConfig;
  last_results?: {
    version: string;
    params_used?: BacktestRunConfig;
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
  // Additional fields from the backend analysis
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
  // Individual trade details — critical for the trade log view
  trades?: BacktestTradeDetail[];
}

export interface ReadinessCheck {
  status: 'ready' | 'not_ready';
  checks: Record<string, boolean>;
  blockers: string[];
  engine_running: boolean;
  next_actions: string[];
}

// ── Helper ─────────────────────────────────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Use Next.js API proxy route — requests go to /api/v1/* which proxies to the backend
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
  start: () => request<{ ok: boolean }>('/start', { method: 'POST' }),
  stop: () => request<{ ok: boolean }>('/stop', { method: 'POST' }),
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

// ── Backtest ──────────────────────────────────────────────────────
export interface BacktestRunConfig {
  symbol?: 'BANKNIFTY' | 'NIFTY' | 'both';
  timeframe?: '15m/60m' | '15m/15m' | '5m/60m' | 'all';
  method?: 'method_a' | 'method_b' | 'both';
  from_date?: string; // YYYY-MM-DD
  to_date?: string;   // YYYY-MM-DD
  capital?: number;
  sl_atr?: number;
  min_rr?: number;
  moneyness?: 'ATM' | 'ITM' | 'DEEP_ITM';
  daily_risk_pct?: number;
  max_open_positions?: number;
  max_daily_trades?: number;
  max_daily_trades_enabled?: boolean;
}

export interface BacktestProgress {
  phase?: string;
  current_config?: number;
  total_configs?: number;
  current_label?: string;
  data_fetched?: boolean;
  candle_counts?: Record<string, number>;
  pct?: number;
  message?: string;
}

export const backtestApi = {
  run: (config?: BacktestRunConfig) =>
    request<BacktestRunResult>('/backtest/run', {
      method: 'POST',
      body: config ? JSON.stringify(config) : undefined,
    }),
  getStatus: () => request<BacktestStatusResult>('/backtest/status'),
};
