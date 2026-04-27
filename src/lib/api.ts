/**
 * DDLJ Trading System — API Service Layer
 * ==========================================
 * Type-safe API client for the FastAPI backend.
 * Falls back to mock data when backend is unavailable.
 */

import type {
  EngineStatus,
  Trade,
  Position,
  ConfigParam,
  BacktestResult,
  HealthCheck,
  SignalLog,
} from './mock-data';

// ── Config ──────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

export { API_BASE, WS_URL };

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
  getStatus: () => request<EngineStatus>('/engine/status'),
  start: () => request<{ ok: boolean }>('/engine/start', { method: 'POST' }),
  stop: () => request<{ ok: boolean }>('/engine/stop', { method: 'POST' }),
  restart: () => request<{ ok: boolean }>('/engine/restart', { method: 'POST' }),
  forceCloseAll: () => request<{ ok: boolean }>('/engine/force-close', { method: 'POST' }),
};

// ── Config ──────────────────────────────────────────────────────
export const configApi = {
  getAll: () => request<ConfigParam[]>('/config'),
  update: (key: string, value: string | number | boolean) =>
    request<ConfigParam>(`/config/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  resetAll: () => request<{ ok: boolean }>('/config/reset', { method: 'POST' }),
  exportConfig: () => request<Record<string, unknown>>('/config/export'),
  importConfig: (data: Record<string, unknown>) =>
    request<{ ok: boolean }>('/config/import', { method: 'POST', body: JSON.stringify(data) }),
};

// ── Trades & Positions ──────────────────────────────────────────
export const tradesApi = {
  getHistory: (limit = 100, offset = 0) =>
    request<Trade[]>('/trades', undefined),
  getPositions: () => request<Position[]>('/positions'),
};

// ── Backtest ────────────────────────────────────────────────────
export const backtestApi = {
  run: (params: { index?: string; timeframe?: string; option_type?: string }) =>
    request<BacktestResult[]>('/backtest/run', { method: 'POST', body: JSON.stringify(params) }),
  getResults: () => request<BacktestResult[]>('/backtest/results'),
};

// ── Health ──────────────────────────────────────────────────────
export const healthApi = {
  getChecks: () => request<HealthCheck[]>('/health'),
};

// ── Token ───────────────────────────────────────────────────────
export const tokenApi = {
  exchange: (requestToken: string) =>
    request<{ ok: boolean; user_name?: string }>('/token/exchange', {
      method: 'POST',
      body: JSON.stringify({ request_token: requestToken }),
    }),
  getStatus: () => request<EngineStatus['token']>('/token/status'),
};

// ── Options ─────────────────────────────────────────────────────
export interface OptionsChainRow {
  strike: number;
  ce_ltp: number;
  ce_volume: number;
  ce_oi: number;
  ce_iv: number;
  ce_delta: number;
  ce_gamma: number;
  pe_ltp: number;
  pe_volume: number;
  pe_oi: number;
  pe_iv: number;
  pe_delta: number;
  pe_gamma: number;
  is_atm: boolean;
  is_itm_ce: boolean;
  is_itm_pe: boolean;
}

export const optionsApi = {
  getChain: (index: string, spot: number) =>
    request<OptionsChainRow[]>('/options/chain', undefined),
};

// ── Alerts ──────────────────────────────────────────────────────
export interface AlertRule {
  id: string;
  name: string;
  type: 'price' | 'vix' | 'trade' | 'risk' | 'system';
  condition: string;
  threshold: number;
  channel: 'telegram' | 'in_app' | 'both';
  enabled: boolean;
  created_at: string;
  last_triggered: string | null;
}

export const alertsApi = {
  getRules: () => request<AlertRule[]>('/alerts/rules'),
  createRule: (rule: Partial<AlertRule>) =>
    request<AlertRule>('/alerts/rules', { method: 'POST', body: JSON.stringify(rule) }),
  updateRule: (id: string, rule: Partial<AlertRule>) =>
    request<AlertRule>(`/alerts/rules/${id}`, { method: 'PUT', body: JSON.stringify(rule) }),
  deleteRule: (id: string) =>
    request<{ ok: boolean }>(`/alerts/rules/${id}`, { method: 'DELETE' }),
  getHistory: () => request<SignalLog[]>('/alerts/history'),
};

// ── Risk ────────────────────────────────────────────────────────
export interface RiskMetrics {
  total_exposure: number;
  margin_used: number;
  buying_power: number;
  daily_risk_used_pct: number;
  daily_risk_limit_pct: number;
  current_drawdown_pct: number;
  max_drawdown_pct: number;
  capital_floor_pct: number;
  total_delta: number;
  total_gamma: number;
  total_theta: number;
  total_vega: number;
  vix_regime: 'LOW' | 'NORMAL' | 'HIGH';
  circuit_breaker_active: boolean;
  circuit_breaker_reason: string | null;
}

export const riskApi = {
  getMetrics: () => request<RiskMetrics>('/risk/metrics'),
};

// ── Journal ─────────────────────────────────────────────────────
export interface JournalEntry {
  id: string;
  trade_id: string;
  pre_trade_rationale: string;
  post_trade_review: string;
  emotional_state: string;
  tags: string[];
  screenshot_url: string | null;
  created_at: string;
  updated_at: string;
}

export const journalApi = {
  getEntries: () => request<JournalEntry[]>('/journal'),
  createEntry: (entry: Partial<JournalEntry>) =>
    request<JournalEntry>('/journal', { method: 'POST', body: JSON.stringify(entry) }),
  updateEntry: (id: string, entry: Partial<JournalEntry>) =>
    request<JournalEntry>(`/journal/${id}`, { method: 'PUT', body: JSON.stringify(entry) }),
};

// ── Settings (Telegram, etc.) ───────────────────────────────────
export interface AppSettings {
  telegram_bot_token: string;
  telegram_chat_id: string;
  notifications_enabled: boolean;
  daily_summary_enabled: boolean;
  trade_alerts_enabled: boolean;
  risk_alerts_enabled: boolean;
}

export const settingsApi = {
  get: () => request<AppSettings>('/settings'),
  update: (settings: Partial<AppSettings>) =>
    request<AppSettings>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};
