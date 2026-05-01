import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_BASE, engineApi, tradesApi, configApi, healthApi, tokenApi, backtestApi } from '../lib/api';

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
});

// ============================================================================
// TEST: API Configuration
// ============================================================================

describe('API Configuration', () => {
  it('should have API_BASE pointing to relative /api/v1', () => {
    expect(API_BASE).toBe('/api/v1');
  });
});

// ============================================================================
// TEST: Engine API
// ============================================================================

describe('engineApi', () => {
  it('getStatus - should call GET /status', async () => {
    const mockStatus = {
      engine_running: false,
      initialized: true,
      error_count: 0,
      token: { stored: false, valid: false, user: null },
    };
    mockFetch.mockReturnValue(mockResponse(mockStatus));

    const result = await engineApi.getStatus();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/status'),
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(result.engine_running).toBe(false);
    expect(result.initialized).toBe(true);
  });

  it('start - should call POST /start', async () => {
    mockFetch.mockReturnValue(mockResponse({ status: 'started', message: 'Trading engine is running' }));

    const result = await engineApi.start();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/start'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.status).toBe('started');
  });

  it('stop - should call POST /stop', async () => {
    mockFetch.mockReturnValue(mockResponse({ status: 'stopped', message: 'Trading engine stopped gracefully' }));

    const result = await engineApi.stop();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/stop'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.status).toBe('stopped');
  });

  it('getReadiness - should call GET /readiness', async () => {
    const mockReadiness = {
      status: 'not_ready',
      checks: {},
      blockers: ['kite_token_stored'],
      engine_running: false,
      next_actions: [],
    };
    mockFetch.mockReturnValue(mockResponse(mockReadiness));

    const result = await engineApi.getReadiness();
    expect(result.status).toBe('not_ready');
    expect(result.blockers).toContain('kite_token_stored');
  });
});

// ============================================================================
// TEST: Trades API
// ============================================================================

describe('tradesApi', () => {
  it('getHistory - should call GET /trades with pagination', async () => {
    const mockTrades = {
      total: 5,
      limit: 100,
      offset: 0,
      trades: [{ id: '0', symbol: 'BANKNIFTY', direction: 'LONG', net: 1500 }],
    };
    mockFetch.mockReturnValue(mockResponse(mockTrades));

    const result = await tradesApi.getHistory(100, 0);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/trades?limit=100&offset=0'),
      expect.any(Object)
    );
    expect(result.total).toBe(5);
    expect(result.trades).toHaveLength(1);
  });

  it('getPositions - should call GET /positions', async () => {
    const mockPositions = {
      count: 1,
      positions: [{ id: '0', symbol: 'BANKNIFTY', direction: 'LONG', entry: 53000 }],
    };
    mockFetch.mockReturnValue(mockResponse(mockPositions));

    const result = await tradesApi.getPositions();
    expect(result.count).toBe(1);
  });
});

// ============================================================================
// TEST: Config API
// ============================================================================

describe('configApi', () => {
  it('getAll - should call GET /config', async () => {
    const mockConfig = { STARTING_CAPITAL: 50000, DAILY_RISK_PCT: 6.0 };
    mockFetch.mockReturnValue(mockResponse(mockConfig));

    const result = await configApi.getAll();
    expect(result.STARTING_CAPITAL).toBe(50000);
  });

  it('update - should call PUT /config with updates', async () => {
    mockFetch.mockReturnValue(mockResponse({ updated: ['DAILY_RISK_PCT'] }));

    await configApi.update({ DAILY_RISK_PCT: 3.0 });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/config'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ updates: { DAILY_RISK_PCT: 3.0 } }),
      })
    );
  });
});

// ============================================================================
// TEST: Token API
// ============================================================================

describe('tokenApi', () => {
  it('exchange - should call POST /token', async () => {
    mockFetch.mockReturnValue(mockResponse({
      status: 'success', user: 'test_user', message: 'ok',
    }));

    const result = await tokenApi.exchange('req_token_123');
    expect(result.status).toBe('success');
  });

  it('getStatus - should call GET /token/status', async () => {
    mockFetch.mockReturnValue(mockResponse({ stored: true, valid: false }));

    const result = await tokenApi.getStatus();
    expect(result.stored).toBe(true);
  });

  it('getLoginUrl - should call GET /token/login', async () => {
    mockFetch.mockReturnValue(mockResponse({
      login_url: 'https://kite.trade/connect/login?api_key=test',
    }));

    const result = await tokenApi.getLoginUrl();
    expect(result.login_url).toContain('kite.trade');
  });
});

// ============================================================================
// TEST: Backtest API
// ============================================================================

describe('backtestApi', () => {
  it('run - should call POST /backtest/run with config', async () => {
    mockFetch.mockReturnValue(mockResponse({
      status: 'started', message: 'Backtest started',
    }));

    const result = await backtestApi.run({
      symbol: 'BANKNIFTY',
      method: 'method_a',
      timeframe: '15m/60m',
      capital: 50000,
    });
    expect(result.status).toBe('started');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/backtest/run'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      })
    );
  });

  it('getStatus - should call GET /backtest/status', async () => {
    mockFetch.mockReturnValue(mockResponse({
      status: 'completed',
      last_results: {
        version: 'v10',
        configs_tested: 3,
        method_a_top: {},
        method_b_top: {},
      },
    }));

    const result = await backtestApi.getStatus();
    expect(result.status).toBe('completed');
  });
});

// ============================================================================
// TEST: Error handling
// ============================================================================

describe('API error handling', () => {
  it('should throw on non-2xx responses', async () => {
    mockFetch.mockReturnValue(mockResponse({ detail: 'Not found' }, 404));

    await expect(engineApi.getStatus()).rejects.toThrow('API 404');
  });

  it('should throw on 500 responses', async () => {
    mockFetch.mockReturnValue(mockResponse({ detail: 'Internal error' }, 500));

    await expect(engineApi.start()).rejects.toThrow('API 500');
  });
});
