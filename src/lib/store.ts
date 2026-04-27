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
} from './mock-data';
import {
  mockEngineStatus,
  mockTrades,
  mockPositions,
  mockConfig,
  mockBacktestResults,
  mockHealthChecks,
  mockSignalLog,
} from './mock-data';

// ── Navigation ───────────────────────────────────────────────────
export type PageId = 
  | 'dashboard'
  | 'engine'
  | 'trades'
  | 'config'
  | 'backtest'
  | 'token'
  | 'health';

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
}));
