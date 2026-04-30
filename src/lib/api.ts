/**
 * DDLJ Trading System — API Service Layer
 * ==========================================
 * Type-safe API client for the FastAPI backend.
 * All endpoints match the real backend at https://ddlj.up.railway.app/api/v1
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://ddlj.up.railway.app/api/v1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://ddlj.up.railway.app/ws';

export { API_BASE, WS_URL };

// ── Types ──────────────────────────────────────────────────────
export interface EngineStatus {
  engine_running: boolean;
  initialized: boolean;
  error_count: number;
  start_time: string | null;
  stop_time: string | null;
  token: {
    stored: boolean;
    valid: boolean;
    user: string | null;
  };
  last_heartbeat: string | null;
  last_error: string | null;
  // Fields from PaperTrader.get_status()
  running?: boolean;
  connected?: boolean;
  capital?: number;
  peak_capital?: number;
  daily_pnl?: number;
  daily_trade_count?: number;
  open_positions?: number;
  total_closed_trades?: number;
  last_bias?: string;
  index?: string;
  entry_tf?: string;
  bias_tf?: string;
  live_vix?: number | null;
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
  // In-memory endpoint uses entry/exit, DB endpoint uses entry_price/exit_price
  entry: number;
  exit: number;
  entry_price?: number;  // DB endpoint alias
  exit_price?: number;   // DB endpoint alias
  entry_time: string;
  exit_time: string;
  sl: number;
  target: number;
  qty: number;
  // In-memory: gross/costs/net, DB: gross_pnl/costs/net_pnl
  gross: number;
  costs: number;
  net: number;
  gross_pnl?: number;  // DB endpoint alias
  net_pnl?: number;    // DB endpoint alias
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
  entry_price?: number;  // DB endpoint alias
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
  status: 'started' | 'already_running' | 'error';
  message: string;
  note?: string;
  hint?: string;
  params?: Record<string, unknown>;
  started_at?: string | null;
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
}

export interface BacktestProgressEvent {
  status: 'idle' | 'running' | 'completed' | 'error';
  phase: 'idle' | 'starting' | 'fetching' | 'running' | 'analyzing' | 'saving' | 'done' | 'error';
  current_config: number;
  total_configs: number;
  current_label: string;
  data_fetched: boolean;
  candle_counts: Record<string, number>;
  pct: number;
  message: string;
  error_message: string | null;
}

export interface BacktestStatusResult {
  status: 'idle' | 'running' | 'completed' | 'error' | 'no_results';
  message?: string;
  started_at?: string | null;
  params?: Record<string, unknown> | null;
  progress?: BacktestProgressEvent;
  last_results?: {
    version: string;
    params_used?: Record<string, unknown>;
    configs_tested: number;
    method_a_top: Record<string, BacktestConfigResult>;
    method_b_top: Record<string, BacktestConfigResult>;
  };
}

export interface ReadinessCheck {
  status: 'ready' | 'not_ready';
  checks: Record<string, boolean>;
  blockers: string[];
  engine_running: boolean;
  next_actions: string[];
}

// ── Normalizers ────────────────────────────────────────────────
/** Normalize trade data from either endpoint format (in-memory or DB). */
export function normalizeTrade(raw: Record<string, unknown>): Trade {
  return {
    id: (raw.id ?? raw.session_id)?.toString(),
    symbol: raw.symbol as string,
    direction: raw.direction as 'LONG' | 'SHORT',
    entry: (raw.entry ?? raw.entry_price) as number,
    exit: (raw.exit ?? raw.exit_price) as number,
    entry_price: raw.entry_price as number | undefined,
    exit_price: raw.exit_price as number | undefined,
    entry_time: raw.entry_time as string,
    exit_time: raw.exit_time as string,
    sl: raw.sl as number,
    target: raw.target as number,
    qty: raw.qty as number,
    gross: (raw.gross ?? raw.gross_pnl) as number,
    costs: raw.costs as number,
    net: (raw.net ?? raw.net_pnl) as number,
    gross_pnl: raw.gross_pnl as number | undefined,
    net_pnl: raw.net_pnl as number | undefined,
    exit_reason: raw.exit_reason as string,
    rr: raw.rr as number,
    held: (raw.held ?? '') as string,
    mode: (raw.mode ?? 'futures') as string,
    option_strike: raw.option_strike as number | undefined,
    option_type: raw.option_type as 'CE' | 'PE' | undefined,
    option_entry_premium: raw.option_entry_premium as number | undefined,
    option_exit_premium: raw.option_exit_premium as number | undefined,
    option_delta: raw.option_delta as number | undefined,
    option_iv_entry: raw.option_iv_entry as number | undefined,
    option_iv_exit: raw.option_iv_exit as number | undefined,
  };
}

/** Normalize position data from either endpoint format (in-memory or DB). */
export function normalizePosition(raw: Record<string, unknown>): Position {
  return {
    id: raw.id?.toString(),
    symbol: raw.symbol as string,
    direction: raw.direction as 'LONG' | 'SHORT',
    entry: (raw.entry ?? raw.entry_price) as number,
    entry_price: raw.entry_price as number | undefined,
    entry_time: raw.entry_time as string,
    qty: raw.qty as number,
    sl: raw.sl as number,
    target: raw.target as number,
    rr: raw.rr as number,
    held: (raw.held ?? '') as string,
    be_done: (raw.be_done ?? false) as boolean,
    atr_at_entry: (raw.atr_at_entry ?? 0) as number,
    current_premium: raw.current_premium as number | undefined,
    unrealized_pnl: raw.unrealized_pnl as number | undefined,
    option_strike: raw.option_strike as number | undefined,
    option_type: raw.option_type as 'CE' | 'PE' | undefined,
  };
}

// ── Helper ─────────────────────────────────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
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
export interface EngineActionResponse {
  status: string;
  message: string;
}

export const engineApi = {
  getStatus: () => request<EngineStatus>('/status'),
  start: () => request<EngineActionResponse>('/start', { method: 'POST' }),
  stop: () => request<EngineActionResponse>('/stop', { method: 'POST' }),
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
export interface BacktestRunParams {
  symbol?: string;
  timeframe?: string;
  method?: string;
  from_date?: string;
  to_date?: string;
  capital?: number;
  sl_atr?: number;
  min_rr?: number;
  moneyness?: string;
  daily_risk_pct?: number;
  max_open_positions?: number;
  max_daily_trades?: number;
  max_daily_trades_enabled?: boolean;
  // NOTE: use_sample_data removed — always enabled as internal fallback
}

export const backtestApi = {
  run: (params?: BacktestRunParams) =>
    request<BacktestRunResult>('/backtest/run', {
      method: 'POST',
      ...(params ? { body: JSON.stringify(params) } : {}),
    }),
  getStatus: () => request<BacktestStatusResult>('/backtest/status'),
  /**
   * Open an SSE connection for real-time backtest progress updates.
   * Returns an EventSource that the caller owns (must close it).
   */
  progressStream: (): EventSource => {
    return new EventSource(`${API_BASE}/backtest/progress`);
  },
};

// ── Live Safety ──────────────────────────────────────────────────
export interface LiveReadinessCheck {
  status: 'ready' | 'not_ready';
  checks: Record<string, boolean>;
  blockers: string[];
  message?: string;
}

export interface KillSwitchResult {
  status: string;
  message: string;
  timestamp: string;
}

export const liveSafetyApi = {
  getReadiness: () => request<LiveReadinessCheck>('/live/readiness'),
  activateKillSwitch: () =>
    request<KillSwitchResult>('/live/kill-switch', { method: 'POST' }),
  resetKillSwitch: () =>
    request<KillSwitchResult>('/live/kill-switch/reset', { method: 'POST' }),
};
