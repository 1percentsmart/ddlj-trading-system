/**
 * DDLJ Trading System — API Service Layer
 * ==========================================
 * Type-safe API client for the FastAPI backend.
 * All endpoints match the real backend at https://ddlj.up.railway.app/api/v1
 */

// ── Config ──────────────────────────────────────────────────────
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
}

export interface HealthStatus {
  status: 'healthy' | 'degraded';
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
  id: string;
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
  id: string;
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
export const engineApi = {
  getStatus: () => request<EngineStatus>('/status'),
  start: () => request<{ ok: boolean }>('/start', { method: 'POST' }),
  stop: () => request<{ ok: boolean }>('/stop', { method: 'POST' }),
};

// ── Config ──────────────────────────────────────────────────────
export const configApi = {
  getAll: () => request<Record<string, unknown>>('/config'),
  update: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('/config', { method: 'PUT', body: JSON.stringify(data) }),
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
