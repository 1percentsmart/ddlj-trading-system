/**
 * DDLJ Trading System — Global State Store (Zustand)
 * ====================================================
 * 
 * Central state management for the trading dashboard.
 * All data comes from real API calls — no mock data.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  engineApi,
  tradesApi,
  configApi,
  healthApi,
  tokenApi,
  type EngineStatus,
  type Trade,
  type Position,
  type HealthStatus,
  type TokenStatus,
  type TokenExchangeResult,
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

const defaultThemePreferences: ThemePreferences = {
  mode: 'dark',
  accent: 'emerald',
  sidebarPosition: 'left',
  compactMode: false,
  numberFormat: 'indian',
};

// ── Navigation ───────────────────────────────────────────────────
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

// ── Default engine status ───────────────────────────────────────
const defaultEngineStatus: EngineStatus = {
  engine_running: false,
  initialized: false,
  error_count: 0,
  start_time: null,
  stop_time: null,
  token: { stored: false, valid: false, user: null },
  last_heartbeat: null,
};

// ── Store State ──────────────────────────────────────────────────
interface DDLJStore {
  // Navigation
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  // Engine
  engineStatus: EngineStatus;
  isEngineLoading: boolean;

  // Trades & Positions
  trades: Trade[];
  tradesTotal: number;
  positions: Position[];
  positionsCount: number;

  // Config (flat key-value)
  config: Record<string, unknown>;

  // Health
  healthStatus: HealthStatus | null;

  // Token
  tokenStatus: TokenStatus | null;
  loginUrl: string | null;

  // Connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Async actions
  fetchStatus: () => Promise<void>;
  fetchTrades: (limit?: number, offset?: number) => Promise<void>;
  fetchPositions: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchTokenStatus: () => Promise<void>;
  fetchLoginUrl: () => Promise<void>;
  startEngine: () => Promise<void>;
  stopEngine: () => Promise<void>;
  exchangeToken: (requestToken: string) => Promise<TokenExchangeResult>;
  updateConfig: (data: Record<string, unknown>) => Promise<void>;

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
  // ── Navigation ──
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  // ── Engine ──
  engineStatus: defaultEngineStatus,
  isEngineLoading: false,

  // ── Trades & Positions ──
  trades: [],
  tradesTotal: 0,
  positions: [],
  positionsCount: 0,

  // ── Config ──
  config: {},

  // ── Health ──
  healthStatus: null,

  // ── Token ──
  tokenStatus: null,
  loginUrl: null,

  // ── Connection ──
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),

  // ── Async Actions ──
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

  startEngine: async () => {
    set({ isEngineLoading: true });
    try {
      await engineApi.start();
      await get().fetchStatus();
    } catch {
      // Error handled by fetchStatus
    } finally {
      set({ isEngineLoading: false });
    }
  },

  stopEngine: async () => {
    set({ isEngineLoading: true });
    try {
      await engineApi.stop();
      await get().fetchStatus();
    } catch {
      // Error handled by fetchStatus
    } finally {
      set({ isEngineLoading: false });
    }
  },

  exchangeToken: async (requestToken: string) => {
    const result = await tokenApi.exchange(requestToken);
    // Refresh status after token exchange
    await get().fetchStatus();
    await get().fetchTokenStatus();
    return result;
  },

  updateConfig: async (data: Record<string, unknown>) => {
    await configApi.update(data);
    await get().fetchConfig();
  },

  // ── Theme ──
  theme: defaultThemePreferences,
  updateTheme: (partial) =>
    set((s) => ({ theme: { ...s.theme, ...partial } })),
  setThemeMode: (mode) =>
    set((s) => ({ theme: { ...s.theme, mode } })),
  setAccentColor: (accent) =>
    set((s) => ({ theme: { ...s.theme, accent } })),
  setSidebarPosition: (sidebarPosition) =>
    set((s) => ({ theme: { ...s.theme, sidebarPosition } })),
  setCompactMode: (compactMode) =>
    set((s) => ({ theme: { ...s.theme, compactMode } })),
  setNumberFormat: (numberFormat) =>
    set((s) => ({ theme: { ...s.theme, numberFormat } })),
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
