// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDDLJStore, PAGE_LABELS, type PageId } from '../lib/store';

// ── Mock fetch globally ──
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
}

beforeEach(() => {
  mockFetch.mockReset();
  // Reset store to initial state
  useDDLJStore.setState({
    activePage: 'dashboard',
    engineStatus: {
      engine_running: false,
      initialized: false,
      error_count: 0,
      start_time: null,
      stop_time: null,
      token: { stored: false, valid: false, user: null },
      last_heartbeat: null,
      running: false,
      capital: 0,
      peak_capital: 0,
      daily_pnl: 0,
      daily_trade_count: 0,
      open_positions: 0,
      total_closed_trades: 0,
      last_bias: 'NEUTRAL',
      index: 'BANKNIFTY',
      entry_tf: '15m',
      bias_tf: '60m',
      live_vix: null,
      uptime_seconds: 0,
    },
    isConnected: false,
    trades: [],
    tradesTotal: 0,
    positions: [],
    positionsCount: 0,
    dataFetched: false,
    isEngineLoading: false,
  });
});

// ============================================================================
// TEST: Page Labels
// ============================================================================

describe('DDLJStore', () => {
  describe('Page Labels', () => {
    it('should have labels for all page IDs', () => {
      const pageIds: PageId[] = [
        'dashboard', 'engine', 'trades', 'config', 'token',
        'health', 'backtest', 'options', 'risk', 'alerts', 'journal',
      ];
      pageIds.forEach((id) => {
        expect(PAGE_LABELS[id]).toBeDefined();
        expect(typeof PAGE_LABELS[id]).toBe('string');
      });
    });
  });

  // ============================================================================
  // TEST: setActivePage
  // ============================================================================

  describe('setActivePage', () => {
    it('should update active page', () => {
      const { setActivePage } = useDDLJStore.getState();
      setActivePage('trades');
      expect(useDDLJStore.getState().activePage).toBe('trades');
    });

    it('should update window hash', () => {
      const { setActivePage } = useDDLJStore.getState();
      setActivePage('config');
      expect(window.location.hash).toBe('#config');
    });
  });

  // ============================================================================
  // TEST: toggleSidebar
  // ============================================================================

  describe('toggleSidebar', () => {
    it('should toggle sidebar collapsed state', () => {
      const initial = useDDLJStore.getState().sidebarCollapsed;
      useDDLJStore.getState().toggleSidebar();
      expect(useDDLJStore.getState().sidebarCollapsed).toBe(!initial);
    });

    it('should toggle back to original state', () => {
      const initial = useDDLJStore.getState().sidebarCollapsed;
      useDDLJStore.getState().toggleSidebar();
      useDDLJStore.getState().toggleSidebar();
      expect(useDDLJStore.getState().sidebarCollapsed).toBe(initial);
    });
  });

  // ============================================================================
  // TEST: fetchStatus
  // ============================================================================

  describe('fetchStatus', () => {
    it('should update engine status on successful fetch', async () => {
      const mockStatus = {
        engine_running: true,
        initialized: true,
        error_count: 0,
        start_time: '2026-04-30T09:15:00+05:30',
        stop_time: null,
        token: { stored: true, valid: true, user: 'test_user' },
        last_heartbeat: '2026-04-30T10:00:00+05:30',
        capital: 55000,
        daily_pnl: 5000,
      };
      mockFetch.mockReturnValue(mockResponse(mockStatus));

      await useDDLJStore.getState().fetchStatus();

      const state = useDDLJStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.engineStatus.engine_running).toBe(true);
      expect(state.engineStatus.capital).toBe(55000);
    });

    it('should set isConnected to false on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await useDDLJStore.getState().fetchStatus();

      expect(useDDLJStore.getState().isConnected).toBe(false);
    });
  });

  // ============================================================================
  // TEST: fetchTrades
  // ============================================================================

  describe('fetchTrades', () => {
    it('should update trades on successful fetch', async () => {
      const mockTrades = {
        total: 2,
        limit: 100,
        offset: 0,
        trades: [
          { id: '0', symbol: 'BANKNIFTY', direction: 'LONG', net: 1500 },
          { id: '1', symbol: 'NIFTY', direction: 'SHORT', net: -800 },
        ],
      };
      mockFetch.mockReturnValue(mockResponse(mockTrades));

      await useDDLJStore.getState().fetchTrades();

      const state = useDDLJStore.getState();
      expect(state.trades).toHaveLength(2);
      expect(state.tradesTotal).toBe(2);
    });

    it('should set isConnected to false on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Server error'));

      await useDDLJStore.getState().fetchTrades();

      expect(useDDLJStore.getState().isConnected).toBe(false);
    });
  });

  // ============================================================================
  // TEST: fetchPositions
  // ============================================================================

  describe('fetchPositions', () => {
    it('should update positions on successful fetch', async () => {
      const mockPositions = {
        count: 1,
        positions: [
          { id: '0', symbol: 'BANKNIFTY', direction: 'LONG', entry: 53000 },
        ],
      };
      mockFetch.mockReturnValue(mockResponse(mockPositions));

      await useDDLJStore.getState().fetchPositions();

      const state = useDDLJStore.getState();
      expect(state.positions).toHaveLength(1);
      expect(state.positionsCount).toBe(1);
    });

    it('should set isConnected to false on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Server error'));

      await useDDLJStore.getState().fetchPositions();

      expect(useDDLJStore.getState().isConnected).toBe(false);
    });
  });

  // ============================================================================
  // TEST: startEngine / stopEngine
  // ============================================================================

  describe('startEngine / stopEngine', () => {
    it('should set isEngineLoading during start', async () => {
      mockFetch
        .mockReturnValueOnce(mockResponse({ status: 'started', message: 'ok' }))
        .mockReturnValueOnce(mockResponse({
          engine_running: true, initialized: true, error_count: 0,
          token: { stored: true, valid: true, user: null }, last_heartbeat: null,
        }));

      const promise = useDDLJStore.getState().startEngine();
      // Check loading state is set synchronously
      expect(useDDLJStore.getState().isEngineLoading).toBe(true);

      await promise;
      expect(useDDLJStore.getState().isEngineLoading).toBe(false);
    });

    it('should set isEngineLoading during stop', async () => {
      mockFetch
        .mockReturnValueOnce(mockResponse({ status: 'stopped', message: 'ok' }))
        .mockReturnValueOnce(mockResponse({
          engine_running: false, initialized: true, error_count: 0,
          token: { stored: true, valid: true, user: null }, last_heartbeat: null,
        }));

      const promise = useDDLJStore.getState().stopEngine();
      expect(useDDLJStore.getState().isEngineLoading).toBe(true);

      await promise;
      expect(useDDLJStore.getState().isEngineLoading).toBe(false);
    });

    it('should reset isEngineLoading even when start fails', async () => {
      mockFetch.mockRejectedValue(new Error('Engine error'));

      await useDDLJStore.getState().startEngine();

      expect(useDDLJStore.getState().isEngineLoading).toBe(false);
    });
  });

  // ============================================================================
  // TEST: Theme preferences
  // ============================================================================

  describe('Theme preferences', () => {
    it('should update theme mode', () => {
      useDDLJStore.getState().setThemeMode('light');
      expect(useDDLJStore.getState().theme.mode).toBe('light');
    });

    it('should update accent color', () => {
      useDDLJStore.getState().setAccentColor('blue');
      expect(useDDLJStore.getState().theme.accent).toBe('blue');
    });

    it('should update compact mode', () => {
      useDDLJStore.getState().setCompactMode(true);
      expect(useDDLJStore.getState().theme.compactMode).toBe(true);
    });

    it('should update sidebar position', () => {
      useDDLJStore.getState().setSidebarPosition('right');
      expect(useDDLJStore.getState().theme.sidebarPosition).toBe('right');
    });

    it('should update number format', () => {
      useDDLJStore.getState().setNumberFormat('international');
      expect(useDDLJStore.getState().theme.numberFormat).toBe('international');
    });

    it('should update multiple theme fields via updateTheme', () => {
      useDDLJStore.getState().updateTheme({ mode: 'system', accent: 'purple', compactMode: true });
      const { theme } = useDDLJStore.getState();
      expect(theme.mode).toBe('system');
      expect(theme.accent).toBe('purple');
      expect(theme.compactMode).toBe(true);
    });
  });

  // ============================================================================
  // TEST: Connection state
  // ============================================================================

  describe('Connection state', () => {
    it('should set connected state', () => {
      useDDLJStore.getState().setConnected(true);
      expect(useDDLJStore.getState().isConnected).toBe(true);
      useDDLJStore.getState().setConnected(false);
      expect(useDDLJStore.getState().isConnected).toBe(false);
    });

    it('should set dataFetched state', () => {
      expect(useDDLJStore.getState().dataFetched).toBe(false);
      useDDLJStore.getState().setFetched();
      expect(useDDLJStore.getState().dataFetched).toBe(true);
    });
  });

  // ============================================================================
  // TEST: Mobile menu
  // ============================================================================

  describe('Mobile menu', () => {
    it('should set mobile menu open state', () => {
      useDDLJStore.getState().setMobileMenuOpen(true);
      expect(useDDLJStore.getState().mobileMenuOpen).toBe(true);
      useDDLJStore.getState().setMobileMenuOpen(false);
      expect(useDDLJStore.getState().mobileMenuOpen).toBe(false);
    });
  });
});
