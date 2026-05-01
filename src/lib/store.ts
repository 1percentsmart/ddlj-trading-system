/**
 * DDLJ Trading System — Global State Store (Zustand)
 * Central state management with hash-based SPA routing.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  engineApi, tradesApi, configApi, healthApi, tokenApi, backtestApi,
  type EngineStatus, type Trade, type Position, type HealthStatus,
  type TokenStatus, type TokenExchangeResult, type BacktestStatusResult,
  type ReadinessCheck,
} from './api';

// ── Theme Types ─────────────────────────────────────────────────
export type AccentColor = 'emerald' | 'blue' | 'purple' | 'amber' | 'red';

export interface ThemePreferences {
  mode: 'dark' | 'light' | 'system';
  accent: AccentColor;
  sidebarPosition: 'left' | 'right';
  compactMode: boolean;
  numberFormat: 'indian' | 'international';
}

const defaultTheme: ThemePreferences = {
  mode: 'dark',
  accent: 'emerald',
  sidebarPosition: 'left',
  compactMode: false,
  numberFormat: 'indian',
};

// ── Navigation with URL hash routing ─────────────────────────────
export type PageId =
  | 'dashboard'
  | 'engine'
  | 'trades'
  | 'config'
  | 'token'
  | 'health'
  | 'backtest'
  | 'options'
  | 'risk'
  | 'alerts'
  | 'journal';

export const PAGE_LABELS: Record<PageId, string> = {
  dashboard: 'Dashboard',
  engine: 'Engine',
  trades: 'Trades',
  config: 'Configuration',
  token: 'Token',
  health: 'Health',
  backtest: 'Backtest',
  options: 'Options Chain',
  risk: 'Risk',
  alerts: 'Alerts',
  journal: 'Journal',
};

const defaultEngineStatus: EngineStatus = {
  engine_running: false,
  initialized: false,
  error_count: 0,
  start_time: null,
  stop_time: null,
  manually_started: false,
  token: { stored: false, valid: false, user: null },
  last_heartbeat: null,
  uptime_seconds: 0,
};

// ── Store ────────────────────────────────────────────────────────
interface DDLJStore {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  engineStatus: EngineStatus;
  isEngineLoading: boolean;
  trades: Trade[];
  tradesTotal: number;
  positions: Position[];
  positionsCount: number;
  config: Record<string, unknown>;
  healthStatus: HealthStatus | null;
  tokenStatus: TokenStatus | null;
  loginUrl: string | null;
  readiness: ReadinessCheck | null;

  // Track whether initial data fetch completed (even if empty)
  dataFetched: boolean;
  setFetched: () => void;

  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Backtest
  backtestStatus: BacktestStatusResult | null;

  // Async
  fetchStatus: () => Promise<void>;
  fetchTrades: (limit?: number, offset?: number) => Promise<void>;
  fetchPositions: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchTokenStatus: () => Promise<void>;
  fetchLoginUrl: () => Promise<void>;
  fetchReadiness: () => Promise<void>;
  fetchBacktestStatus: () => Promise<void>;
  startEngine: () => Promise<void>;
  stopEngine: () => Promise<void>;
  exchangeToken: (requestToken: string) => Promise<TokenExchangeResult>;
  updateConfig: (updates: Record<string, unknown>) => Promise<void>;
  refreshAll: () => Promise<void>;

  // Theme
  theme: ThemePreferences;
  updateTheme: (theme: Partial<ThemePreferences>) => void;
  setThemeMode: (mode: 'dark' | 'light' | 'system') => void;
  setAccentColor: (accent: AccentColor) => void;
  setSidebarPosition: (position: 'left' | 'right') => void;
  setCompactMode: (compact: boolean) => void;
  setNumberFormat: (format: 'indian' | 'international') => void;
}

export const useDDLJStore = create<DDLJStore>()(
  persist(
    (set, get) => ({
      activePage: 'dashboard',
      setActivePage: (page) => {
        set({ activePage: page });
        if (typeof window !== 'undefined') {
          window.location.hash = page;
        }
      },
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileMenuOpen: false,
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

      engineStatus: defaultEngineStatus,
      isEngineLoading: false,
      trades: [],
      tradesTotal: 0,
      positions: [],
      positionsCount: 0,
      config: {},
      healthStatus: null,
      tokenStatus: null,
      loginUrl: null,
      readiness: null,
      dataFetched: false,
      setFetched: () => set({ dataFetched: true }),
      backtestStatus: null,
      isConnected: false,
      setConnected: (connected) => set({ isConnected: connected }),

      fetchStatus: async () => {
        try {
          const status = await engineApi.getStatus();
          set({ engineStatus: status, isConnected: true });
        } catch {
          set({ isConnected: false });
        }
      },
      fetchTrades: async (limit = 100, offset = 0) => {
        try {
          const data = await tradesApi.getHistory(limit, offset);
          set({ trades: data.trades, tradesTotal: data.total, isConnected: true });
        } catch {
          set({ isConnected: false });
        }
      },
      fetchPositions: async () => {
        try {
          const data = await tradesApi.getPositions();
          set({ positions: data.positions, positionsCount: data.count, isConnected: true });
        } catch {
          set({ isConnected: false });
        }
      },
      fetchConfig: async () => {
        try {
          const data = await configApi.getAll();
          set({ config: data, isConnected: true });
        } catch {
          set({ isConnected: false });
        }
      },
      fetchHealth: async () => {
        try {
          const data = await healthApi.getHealth();
          set({ healthStatus: data, isConnected: true });
        } catch {
          set({ isConnected: false });
        }
      },
      fetchTokenStatus: async () => {
        try {
          const data = await tokenApi.getStatus();
          set({ tokenStatus: data, isConnected: true });
        } catch {
          set({ isConnected: false });
        }
      },
      fetchLoginUrl: async () => {
        try {
          const data = await tokenApi.getLoginUrl();
          set({ loginUrl: data.login_url, isConnected: true });
        } catch {
          set({ isConnected: false });
        }
      },
      fetchReadiness: async () => {
        try {
          const data = await engineApi.getReadiness();
          set({ readiness: data, isConnected: true });
        } catch {
          set({ isConnected: false });
        }
      },
      fetchBacktestStatus: async () => {
        try {
          const data = await backtestApi.getStatus();
          set({ backtestStatus: data, isConnected: true });
        } catch {
          // silently ignore
        }
      },
      startEngine: async () => {
        set({ isEngineLoading: true });
        try { await engineApi.start(); await get().fetchStatus(); }
        catch { /* handled by fetchStatus */ }
        finally { set({ isEngineLoading: false }); }
      },
      stopEngine: async () => {
        set({ isEngineLoading: true });
        try { await engineApi.stop(); await get().fetchStatus(); }
        catch { /* handled by fetchStatus */ }
        finally { set({ isEngineLoading: false }); }
      },
      exchangeToken: async (requestToken: string) => {
        const result = await tokenApi.exchange(requestToken);
        await get().fetchStatus();
        await get().fetchTokenStatus();
        return result;
      },
      updateConfig: async (updates: Record<string, unknown>) => {
        await configApi.update(updates);
        await get().fetchConfig();
      },
      refreshAll: async () => {
        await Promise.allSettled([
          get().fetchStatus(),
          get().fetchTrades(),
          get().fetchPositions(),
          get().fetchConfig(),
          get().fetchHealth(),
          get().fetchTokenStatus(),
          get().fetchReadiness(),
          get().fetchBacktestStatus(),
          // Note: fetchLoginUrl removed from auto-refresh — no longer needed since auth redirect link was removed
        ]);
        set({ dataFetched: true });
      },

      theme: defaultTheme,
      updateTheme: (partial) => set((s) => ({ theme: { ...s.theme, ...partial } })),
      setThemeMode: (mode) => set((s) => ({ theme: { ...s.theme, mode } })),
      setAccentColor: (accent) => set((s) => ({ theme: { ...s.theme, accent } })),
      setSidebarPosition: (sidebarPosition) => set((s) => ({ theme: { ...s.theme, sidebarPosition } })),
      setCompactMode: (compactMode) => set((s) => ({ theme: { ...s.theme, compactMode } })),
      setNumberFormat: (numberFormat) => set((s) => ({ theme: { ...s.theme, numberFormat } })),
    }),
    {
      name: 'ddljj-theme',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
