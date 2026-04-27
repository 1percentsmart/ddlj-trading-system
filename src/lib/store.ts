/**
 * DDLJ Trading System — Global State Store (Zustand)
 * ====================================================
 * 
 * Central state management for the entire trading dashboard.
 * Handles navigation, engine status, trades, positions, config,
 * and real-time updates.
 */

import { create } from 'zustand';
import type {
  EngineStatus,
  Trade,
  Position,
  ConfigParam,
  BacktestResult,
  HealthCheck,
  SignalLog,
  OptionsChainData,
  RiskMetrics,
  RiskAlert,
  AlertConfig,
  AlertHistoryEntry,
  TelegramConfig,
  JournalEntry,
  ThemePreferences,
  AccentColor,
  ConfigPreset,
} from './mock-data';
import {
  mockEngineStatus,
  mockTrades,
  mockPositions,
  mockConfig,
  mockBacktestResults,
  mockHealthChecks,
  mockSignalLog,
  mockOptionsChain,
  mockRiskMetrics,
  mockRiskAlerts,
  mockAlertConfigs,
  mockAlertHistory,
  mockTelegramConfig,
  mockJournalEntries,
  defaultThemePreferences,
  mockConfigPresets,
} from './mock-data';

// ── Navigation ───────────────────────────────────────────────────
export type PageId = 
  | 'dashboard'
  | 'engine'
  | 'trades'
  | 'config'
  | 'backtest'
  | 'token'
  | 'health'
  | 'options'
  | 'risk'
  | 'alerts'
  | 'journal';

// ── Store State ──────────────────────────────────────────────────
interface DDLJStore {
  // Navigation
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Engine
  engineStatus: EngineStatus;
  updateEngineStatus: (status: Partial<EngineStatus>) => void;
  isEngineLoading: boolean;
  setEngineLoading: (loading: boolean) => void;

  // Trades & Positions
  trades: Trade[];
  positions: Position[];
  addTrade: (trade: Trade) => void;
  addPosition: (position: Position) => void;
  removePosition: (id: string) => void;

  // Config
  config: ConfigParam[];
  updateConfigParam: (key: string, value: string | number | boolean) => void;
  resetConfigParam: (key: string) => void;
  resetAllConfig: () => void;
  configPresets: ConfigPreset[];
  applyConfigPreset: (preset: ConfigPreset) => void;

  // Backtest
  backtestResults: BacktestResult[];
  isBacktestRunning: boolean;
  setBacktestRunning: (running: boolean) => void;

  // Health
  healthChecks: HealthCheck[];

  // Signal Log
  signalLog: SignalLog[];
  addSignal: (signal: SignalLog) => void;

  // Connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Options Chain
  optionsChain: OptionsChainData;
  selectedOptionsIndex: 'BANKNIFTY' | 'NIFTY';
  setSelectedOptionsIndex: (index: 'BANKNIFTY' | 'NIFTY') => void;

  // Risk
  riskMetrics: RiskMetrics;
  riskAlerts: RiskAlert[];

  // Alerts
  alertConfigs: AlertConfig[];
  alertHistory: AlertHistoryEntry[];
  telegramConfig: TelegramConfig;
  updateTelegramConfig: (config: Partial<TelegramConfig>) => void;

  // Journal
  journalEntries: JournalEntry[];
  addJournalEntry: (entry: JournalEntry) => void;

  // Theme
  theme: ThemePreferences;
  updateTheme: (theme: Partial<ThemePreferences>) => void;
  setThemeMode: (mode: 'dark' | 'light' | 'system') => void;
  setAccentColor: (accent: AccentColor) => void;
  setSidebarPosition: (position: 'left' | 'right') => void;
  setCompactMode: (compact: boolean) => void;
  setNumberFormat: (format: 'indian' | 'international') => void;
}

export const useDDLJStore = create<DDLJStore>((set) => ({
  // ── Navigation ──
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // ── Engine ──
  engineStatus: mockEngineStatus,
  updateEngineStatus: (partial) =>
    set((s) => ({ engineStatus: { ...s.engineStatus, ...partial } })),
  isEngineLoading: false,
  setEngineLoading: (loading) => set({ isEngineLoading: loading }),

  // ── Trades & Positions ──
  trades: mockTrades,
  positions: mockPositions,
  addTrade: (trade) => set((s) => ({ trades: [trade, ...s.trades] })),
  addPosition: (position) =>
    set((s) => ({ positions: [...s.positions, position] })),
  removePosition: (id) =>
    set((s) => ({ positions: s.positions.filter((p) => p.id !== id) })),

  // ── Config ──
  config: mockConfig,
  updateConfigParam: (key, value) =>
    set((s) => ({
      config: s.config.map((p) =>
        p.key === key ? { ...p, value } : p
      ),
    })),
  resetConfigParam: (key) =>
    set((s) => ({
      config: s.config.map((p) =>
        p.key === key ? { ...p, value: p.default } : p
      ),
    })),
  resetAllConfig: () =>
    set((s) => ({
      config: s.config.map((p) => ({ ...p, value: p.default })),
    })),
  configPresets: mockConfigPresets,
  applyConfigPreset: (preset) =>
    set((s) => {
      const newConfig = s.config.map((p) => {
        if (p.key in preset.changes) {
          return { ...p, value: preset.changes[p.key] };
        }
        return p;
      });
      return { config: newConfig };
    }),

  // ── Backtest ──
  backtestResults: mockBacktestResults,
  isBacktestRunning: false,
  setBacktestRunning: (running) => set({ isBacktestRunning: running }),

  // ── Health ──
  healthChecks: mockHealthChecks,

  // ── Signal Log ──
  signalLog: mockSignalLog,
  addSignal: (signal) =>
    set((s) => ({ signalLog: [signal, ...s.signalLog].slice(0, 100) })),

  // ── Connection ──
  isConnected: true,
  setConnected: (connected) => set({ isConnected: connected }),

  // ── Options ──
  optionsChain: mockOptionsChain,
  selectedOptionsIndex: 'BANKNIFTY',
  setSelectedOptionsIndex: (index) => set({ selectedOptionsIndex: index }),

  // ── Risk ──
  riskMetrics: mockRiskMetrics,
  riskAlerts: mockRiskAlerts,

  // ── Alerts ──
  alertConfigs: mockAlertConfigs,
  alertHistory: mockAlertHistory,
  telegramConfig: mockTelegramConfig,
  updateTelegramConfig: (partial) =>
    set((s) => ({ telegramConfig: { ...s.telegramConfig, ...partial } })),

  // ── Journal ──
  journalEntries: mockJournalEntries,
  addJournalEntry: (entry) =>
    set((s) => ({ journalEntries: [entry, ...s.journalEntries] })),

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
}));
