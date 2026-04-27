/**
 * DDLJ Trading System — Mock Data Layer
 * =======================================
 *
 * Simulates all backend API responses for development and demo.
 * When deployed, these are replaced by real FastAPI calls.
 *
 * The data structure matches the actual backend routes.py responses
 * so switching to real API is seamless.
 */

// ── Engine Status ────────────────────────────────────────────────
export interface EngineStatus {
  initialized: boolean;
  engine_running: boolean;
  capital: number;
  starting_capital: number;
  daily_pnl: number;
  total_pnl: number;
  daily_trade_count: number;
  total_closed_trades: number;
  open_positions_count: number;
  current_bias: string;
  bias_strength: number;
  live_vix: number;
  uptime_seconds: number;
  error_count: number;
  token: {
    stored: boolean;
    valid: boolean;
    expires_at: string | null;
    user_name: string | null;
  };
  market_status: 'open' | 'closed' | 'pre_market' | 'post_market';
  last_signal: string | null;
  last_signal_time: string | null;
}

export const mockEngineStatus: EngineStatus = {
  initialized: true,
  engine_running: true,
  capital: 245800,
  starting_capital: 200000,
  daily_pnl: 3850,
  total_pnl: 45800,
  daily_trade_count: 3,
  total_closed_trades: 47,
  open_positions_count: 2,
  current_bias: 'BULLISH',
  bias_strength: 0.78,
  live_vix: 16.42,
  uptime_seconds: 14523,
  error_count: 0,
  token: {
    stored: true,
    valid: true,
    expires_at: '2026-04-28T17:15:00+05:30',
    user_name: 'Sameer Gani Shaikh',
  },
  market_status: 'open',
  last_signal: 'BUY Signal — BankNifty 15m EMA Crossover',
  last_signal_time: '2026-04-28T09:03:00+05:30',
};

// ── Trade History ────────────────────────────────────────────────
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

export const mockTrades: Trade[] = [
  {
    id: 'T001',
    symbol: 'BANKNIFTY',
    direction: 'LONG',
    entry: 54200,
    exit: 54650,
    entry_time: '2026-04-25T10:15:00+05:30',
    exit_time: '2026-04-25T11:45:00+05:30',
    sl: 53950,
    target: 54600,
    qty: 15,
    gross: 6750,
    costs: 312,
    net: 6438,
    exit_reason: 'TARGET_HIT',
    rr: 2.8,
    held: '1h 30m',
    mode: 'options',
    option_strike: 54300,
    option_type: 'CE',
    option_entry_premium: 185.5,
    option_exit_premium: 445.2,
    option_delta: 0.52,
    option_iv_entry: 17.8,
    option_iv_exit: 19.2,
  },
  {
    id: 'T002',
    symbol: 'NIFTY',
    direction: 'SHORT',
    entry: 24250,
    exit: 24100,
    entry_time: '2026-04-25T13:00:00+05:30',
    exit_time: '2026-04-25T14:30:00+05:30',
    sl: 24400,
    target: 24100,
    qty: 25,
    gross: 3750,
    costs: 198,
    net: 3552,
    exit_reason: 'TARGET_HIT',
    rr: 2.5,
    held: '1h 30m',
    mode: 'options',
    option_strike: 24200,
    option_type: 'PE',
    option_entry_premium: 95.0,
    option_exit_premium: 210.5,
    option_delta: -0.48,
    option_iv_entry: 14.5,
    option_iv_exit: 15.8,
  },
  {
    id: 'T003',
    symbol: 'BANKNIFTY',
    direction: 'LONG',
    entry: 54800,
    exit: 54650,
    entry_time: '2026-04-24T10:30:00+05:30',
    exit_time: '2026-04-24T12:15:00+05:30',
    sl: 54600,
    target: 55200,
    qty: 15,
    gross: -2250,
    costs: 285,
    net: -2535,
    exit_reason: 'STOP_LOSS',
    rr: -1.0,
    held: '1h 45m',
    mode: 'options',
    option_strike: 54900,
    option_type: 'CE',
    option_entry_premium: 210.0,
    option_exit_premium: 115.0,
    option_delta: 0.55,
    option_iv_entry: 18.2,
    option_iv_exit: 16.8,
  },
  {
    id: 'T004',
    symbol: 'BANKNIFTY',
    direction: 'SHORT',
    entry: 54100,
    exit: 53800,
    entry_time: '2026-04-23T14:00:00+05:30',
    exit_time: '2026-04-23T15:00:00+05:30',
    sl: 54350,
    target: 53800,
    qty: 15,
    gross: 4500,
    costs: 245,
    net: 4255,
    exit_reason: 'TARGET_HIT',
    rr: 1.8,
    held: '1h 0m',
    mode: 'options',
    option_strike: 54000,
    option_type: 'PE',
    option_entry_premium: 155.0,
    option_exit_premium: 320.5,
    option_delta: -0.50,
    option_iv_entry: 17.5,
    option_iv_exit: 20.1,
  },
  {
    id: 'T005',
    symbol: 'NIFTY',
    direction: 'LONG',
    entry: 24050,
    exit: 24200,
    entry_time: '2026-04-22T09:45:00+05:30',
    exit_time: '2026-04-22T11:30:00+05:30',
    sl: 23950,
    target: 24200,
    qty: 25,
    gross: 3750,
    costs: 178,
    net: 3572,
    exit_reason: 'TARGET_HIT',
    rr: 2.5,
    held: '1h 45m',
    mode: 'options',
    option_strike: 24100,
    option_type: 'CE',
    option_entry_premium: 88.0,
    option_exit_premium: 198.5,
    option_delta: 0.45,
    option_iv_entry: 13.8,
    option_iv_exit: 14.2,
  },
  {
    id: 'T006',
    symbol: 'BANKNIFTY',
    direction: 'LONG',
    entry: 53500,
    exit: 53750,
    entry_time: '2026-04-21T10:00:00+05:30',
    exit_time: '2026-04-21T12:00:00+05:30',
    sl: 53300,
    target: 53800,
    qty: 15,
    gross: 3750,
    costs: 268,
    net: 3482,
    exit_reason: 'NEAR_TARGET',
    rr: 1.9,
    held: '2h 0m',
    mode: 'options',
    option_strike: 53600,
    option_type: 'CE',
    option_entry_premium: 145.0,
    option_exit_premium: 290.0,
    option_delta: 0.50,
    option_iv_entry: 19.5,
    option_iv_exit: 18.8,
  },
  {
    id: 'T007',
    symbol: 'NIFTY',
    direction: 'SHORT',
    entry: 24400,
    exit: 24500,
    entry_time: '2026-04-18T13:15:00+05:30',
    exit_time: '2026-04-18T14:45:00+05:30',
    sl: 24500,
    target: 24200,
    qty: 25,
    gross: -2500,
    costs: 185,
    net: -2685,
    exit_reason: 'STOP_LOSS',
    rr: -1.0,
    held: '1h 30m',
    mode: 'options',
    option_strike: 24300,
    option_type: 'PE',
    option_entry_premium: 105.0,
    option_exit_premium: 55.0,
    option_delta: -0.48,
    option_iv_entry: 15.0,
    option_iv_exit: 13.2,
  },
  {
    id: 'T008',
    symbol: 'BANKNIFTY',
    direction: 'LONG',
    entry: 53000,
    exit: 53400,
    entry_time: '2026-04-17T09:30:00+05:30',
    exit_time: '2026-04-17T11:00:00+05:30',
    sl: 52800,
    target: 53400,
    qty: 15,
    gross: 6000,
    costs: 295,
    net: 5705,
    exit_reason: 'TARGET_HIT',
    rr: 3.0,
    held: '1h 30m',
    mode: 'options',
    option_strike: 53100,
    option_type: 'CE',
    option_entry_premium: 165.0,
    option_exit_premium: 410.0,
    option_delta: 0.52,
    option_iv_entry: 20.5,
    option_iv_exit: 22.0,
  },
];

// ── Open Positions ───────────────────────────────────────────────
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

export const mockPositions: Position[] = [
  {
    id: 'P001',
    symbol: 'BANKNIFTY',
    direction: 'LONG',
    entry: 56200,
    entry_time: '2026-04-28T08:30:00+05:30',
    qty: 15,
    sl: 55950,
    target: 56700,
    rr: 2.0,
    held: '0h 45m',
    be_done: false,
    atr_at_entry: 185.5,
    current_premium: 320.0,
    unrealized_pnl: 2150,
    option_strike: 56300,
    option_type: 'CE',
  },
  {
    id: 'P002',
    symbol: 'NIFTY',
    direction: 'SHORT',
    entry: 24350,
    entry_time: '2026-04-28T08:50:00+05:30',
    qty: 25,
    sl: 24550,
    target: 24150,
    rr: 1.5,
    held: '0h 25m',
    be_done: false,
    atr_at_entry: 95.2,
    current_premium: 135.0,
    unrealized_pnl: 850,
    option_strike: 24300,
    option_type: 'PE',
  },
];

// ── Configuration ────────────────────────────────────────────────
export interface ConfigParam {
  key: string;
  value: string | number | boolean;
  default: string | number | boolean;
  type: 'string' | 'number' | 'boolean' | 'select';
  description: string;
  category: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  live_update: boolean;
}

export const mockConfig: ConfigParam[] = [
  // ── Trading Index ──
  { key: 'TRADE_INDEX', value: 'BANKNIFTY', default: 'BANKNIFTY', type: 'select', description: 'Index to trade — BankNifty or Nifty', category: 'Trading Index', options: ['BANKNIFTY', 'NIFTY'], live_update: false },
  { key: 'STARTING_CAPITAL', value: 200000, default: 200000, type: 'number', description: 'Starting capital in rupees', category: 'Capital', min: 50000, max: 10000000, step: 10000, live_update: false },
  // ── Timeframes ──
  { key: 'ENTRY_TIMEFRAME', value: '15m', default: '15m', type: 'select', description: 'Timeframe for entry signals', category: 'Timeframes', options: ['5m', '15m', '60m'], live_update: false },
  { key: 'BIAS_TIMEFRAME', value: '60m', default: '60m', type: 'select', description: 'Timeframe for bias determination', category: 'Timeframes', options: ['15m', '60m', '1D'], live_update: false },
  // ── EMA Settings ──
  { key: 'EMA_FAST', value: 9, default: 9, type: 'number', description: 'Fast EMA period for crossover signals', category: 'EMA Settings', min: 3, max: 50, step: 1, live_update: true },
  { key: 'EMA_MID', value: 21, default: 21, type: 'number', description: 'Mid EMA period for trend confirmation', category: 'EMA Settings', min: 5, max: 100, step: 1, live_update: true },
  { key: 'EMA_SLOW', value: 55, default: 55, type: 'number', description: 'Slow EMA period for major trend direction', category: 'EMA Settings', min: 20, max: 200, step: 1, live_update: true },
  { key: 'EMA_BIAS_SLOW', value: 89, default: 89, type: 'number', description: 'Bias timeframe slow EMA', category: 'EMA Settings', min: 30, max: 300, step: 1, live_update: true },
  { key: 'EMA_BIAS_FAST', value: 21, default: 21, type: 'number', description: 'Bias timeframe fast EMA', category: 'EMA Settings', min: 5, max: 100, step: 1, live_update: true },
  // ── Risk Management ──
  { key: 'DAILY_RISK_PCT', value: 3.0, default: 3.0, type: 'number', description: 'Maximum daily risk as % of capital', category: 'Risk Management', min: 0.5, max: 10, step: 0.5, live_update: true },
  { key: 'RISK_PER_POSITION_PCT', value: 2.0, default: 2.0, type: 'number', description: 'Risk per position as % of capital', category: 'Risk Management', min: 0.5, max: 5, step: 0.25, live_update: true },
  { key: 'MAX_OPEN_POSITIONS', value: 2, default: 2, type: 'number', description: 'Maximum simultaneous open positions', category: 'Risk Management', min: 1, max: 5, step: 1, live_update: true },
  { key: 'DRAWDOWN_CIRCUIT_BREAKER', value: 0.80, default: 0.80, type: 'number', description: 'Stop trading if drawdown exceeds this % of capital', category: 'Risk Management', min: 0.5, max: 0.95, step: 0.05, live_update: true },
  { key: 'CAPITAL_FLOOR_PCT', value: 0.20, default: 0.20, type: 'number', description: 'Minimum capital % to continue trading', category: 'Risk Management', min: 0.05, max: 0.50, step: 0.05, live_update: true },
  // ── Options ──
  { key: 'OPTION_TYPE', value: 'ITM', default: 'ITM', type: 'select', description: 'Option type — ITM, ATM, or OTM', category: 'Options', options: ['ITM', 'ATM', 'OTM'], live_update: false },
  { key: 'STRIKE_OFFSET_ITM', value: 2, default: 2, type: 'number', description: 'Number of strikes ITM for entry', category: 'Options', min: 0, max: 5, step: 1, live_update: false },
  { key: 'STRIKE_OFFSET_OTM', value: 2, default: 2, type: 'number', description: 'Number of strikes OTM for entry', category: 'Options', min: 0, max: 5, step: 1, live_update: false },
  { key: 'LOT_SIZE', value: 15, default: 15, type: 'number', description: 'Lot size (15 for BN, 25 for Nifty)', category: 'Options', min: 1, max: 100, step: 1, live_update: false },
  { key: 'NUM_LOTS', value: 1, default: 1, type: 'number', description: 'Number of lots per trade', category: 'Options', min: 1, max: 10, step: 1, live_update: true },
  // ── Position Management ──
  { key: 'BE_TRIGGER_RISK_MULT', value: 2.0, default: 2.0, type: 'number', description: 'Move SL to breakeven when profit = this x risk', category: 'Position Management', min: 1.0, max: 5.0, step: 0.25, live_update: true },
  { key: 'TRAILING_STOP_ENABLED', value: true, default: true, type: 'boolean', description: 'Enable trailing stop loss', category: 'Position Management', live_update: true },
  { key: 'TRAIL_EVERY_N_CANDLES', value: 3, default: 3, type: 'number', description: 'Trail SL every N candles', category: 'Position Management', min: 1, max: 10, step: 1, live_update: true },
  { key: 'BIAS_FLIP_MIN_HELD', value: 2, default: 2, type: 'number', description: 'Minimum candles held before bias flip exit', category: 'Position Management', min: 1, max: 10, step: 1, live_update: true },
  { key: 'NEAR_TARGET_ATR_MULT', value: 0.3, default: 0.3, type: 'number', description: 'Consider "near target" when within this x ATR', category: 'Position Management', min: 0.1, max: 1.0, step: 0.05, live_update: true },
  { key: 'MAX_TRADE_HOURS', value: 6, default: 6, type: 'number', description: 'Maximum hours to hold a trade', category: 'Position Management', min: 1, max: 8, step: 1, live_update: true },
  // ── Signal Filters ──
  { key: 'RSI_OVERBOUGHT', value: 70, default: 70, type: 'number', description: 'RSI overbought threshold — skip longs above', category: 'Signal Filters', min: 60, max: 90, step: 5, live_update: true },
  { key: 'RSI_OVERSOLD', value: 30, default: 30, type: 'number', description: 'RSI oversold threshold — skip shorts below', category: 'Signal Filters', min: 10, max: 40, step: 5, live_update: true },
  { key: 'VIX_HIGH_THRESHOLD', value: 25, default: 25, type: 'number', description: 'VIX above this = high volatility regime', category: 'Signal Filters', min: 15, max: 40, step: 1, live_update: true },
  { key: 'VIX_LOW_THRESHOLD', value: 12, default: 12, type: 'number', description: 'VIX below this = low volatility regime', category: 'Signal Filters', min: 8, max: 20, step: 1, live_update: true },
  { key: 'ATR_SL_MULT', value: 1.5, default: 1.5, type: 'number', description: 'Stop loss = ATR x this multiplier', category: 'Signal Filters', min: 0.5, max: 3.0, step: 0.25, live_update: true },
  { key: 'ATR_TARGET_MULT', value: 2.5, default: 2.5, type: 'number', description: 'Target = ATR x this multiplier', category: 'Signal Filters', min: 1.0, max: 5.0, step: 0.25, live_update: true },
  // ── VIX ──
  { key: 'USE_REAL_VIX', value: true, default: true, type: 'boolean', description: 'Use real VIX from API instead of historical data', category: 'VIX', live_update: true },
  { key: 'VIX_REFRESH_SECONDS', value: 300, default: 300, type: 'number', description: 'How often to refresh VIX data (seconds)', category: 'VIX', min: 60, max: 1800, step: 60, live_update: true },
  // ── Session ──
  { key: 'WARMUP_DAYS', value: 30, default: 30, type: 'number', description: 'Days of historical data to preload at startup', category: 'Session', min: 7, max: 90, step: 1, live_update: false },
  { key: 'SAVE_TRADE_LOG', value: true, default: true, type: 'boolean', description: 'Save trade log CSV files', category: 'Session', live_update: true },
  { key: 'COST_BROKERAGE_PER_LOT', value: 10, default: 10, type: 'number', description: 'Brokerage per lot per order', category: 'Session', min: 0, max: 50, step: 5, live_update: true },
  { key: 'COST_STT_PCT', value: 0.0625, default: 0.0625, type: 'number', description: 'STT as % of premium', category: 'Session', min: 0, max: 1, step: 0.01, live_update: true },
  { key: 'COST_EXCHANGE_TXN_PCT', value: 0.05, default: 0.05, type: 'number', description: 'Exchange transaction charges %', category: 'Session', min: 0, max: 1, step: 0.01, live_update: true },
  { key: 'COST_GST_PCT', value: 18.0, default: 18.0, type: 'number', description: 'GST on brokerage + exchange charges %', category: 'Session', min: 0, max: 28, step: 1, live_update: true },
  { key: 'COST_SEBI_PCT', value: 0.001, default: 0.001, type: 'number', description: 'SEBI turnover fee %', category: 'Session', min: 0, max: 0.01, step: 0.0001, live_update: true },
  { key: 'COST_STAMP_DUTY_PCT', value: 0.003, default: 0.003, type: 'number', description: 'Stamp duty % on buy side', category: 'Session', min: 0, max: 0.01, step: 0.0005, live_update: true },
];

// ── Backtest Results ─────────────────────────────────────────────
export interface BacktestResult {
  config_name: string;
  index: string;
  timeframe: string;
  option_type: string;
  total_trades: number;
  win_rate: number;
  net_pnl: number;
  max_drawdown: number;
  profit_factor: number;
  sharpe_ratio: number;
  avg_trade: number;
  best_trade: number;
  worst_trade: number;
}

export const mockBacktestResults: BacktestResult[] = [
  { config_name: 'BN 15x60 ITM', index: 'BANKNIFTY', timeframe: '15m/60m', option_type: 'ITM', total_trades: 46, win_rate: 47.83, net_pnl: 75300, max_drawdown: 11.7, profit_factor: 1.96, sharpe_ratio: 5.02, avg_trade: 1637, best_trade: 8200, worst_trade: -4100 },
  { config_name: 'BN 15x60 ATM', index: 'BANKNIFTY', timeframe: '15m/60m', option_type: 'ATM', total_trades: 44, win_rate: 45.45, net_pnl: 52100, max_drawdown: 14.2, profit_factor: 1.72, sharpe_ratio: 3.85, avg_trade: 1184, best_trade: 6800, worst_trade: -5200 },
  { config_name: 'BN 5x60 ITM', index: 'BANKNIFTY', timeframe: '5m/60m', option_type: 'ITM', total_trades: 89, win_rate: 41.57, net_pnl: -15200, max_drawdown: 28.5, profit_factor: 0.82, sharpe_ratio: -1.2, avg_trade: -171, best_trade: 4100, worst_trade: -6800 },
  { config_name: 'NF 15x60 ATM', index: 'NIFTY', timeframe: '15m/60m', option_type: 'ATM', total_trades: 52, win_rate: 51.92, net_pnl: 195800, max_drawdown: 9.8, profit_factor: 2.35, sharpe_ratio: 6.12, avg_trade: 3765, best_trade: 12500, worst_trade: -5500 },
  { config_name: 'NF 15x60 ITM', index: 'NIFTY', timeframe: '15m/60m', option_type: 'ITM', total_trades: 48, win_rate: 47.92, net_pnl: 11700, max_drawdown: 18.3, profit_factor: 1.15, sharpe_ratio: 1.05, avg_trade: 244, best_trade: 5800, worst_trade: -4900 },
];

// ── Health Status ────────────────────────────────────────────────
export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  last_checked: string;
}

export const mockHealthChecks: HealthCheck[] = [
  { name: 'Engine Heartbeat', status: 'healthy', message: 'Engine is running', last_checked: '2026-04-28T09:15:00+05:30' },
  { name: 'Kite Token', status: 'healthy', message: 'Token is valid — expires in 8h', last_checked: '2026-04-28T09:15:00+05:30' },
  { name: 'Database', status: 'healthy', message: 'Database is accessible', last_checked: '2026-04-28T09:15:00+05:30' },
  { name: 'Market Hours Guard', status: 'healthy', message: 'Active — market is open', last_checked: '2026-04-28T09:15:00+05:30' },
  { name: 'Telegram Notifier', status: 'degraded', message: 'Last message delivered with 2s delay', last_checked: '2026-04-28T09:15:00+05:30' },
  { name: 'Session Recovery', status: 'healthy', message: 'No recoverable sessions', last_checked: '2026-04-28T09:15:00+05:30' },
];

// ── Equity Curve Data (for charts) ──────────────────────────────
export const mockEquityCurve = [
  { date: 'Apr 1', capital: 200000 },
  { date: 'Apr 2', capital: 201500 },
  { date: 'Apr 3', capital: 199800 },
  { date: 'Apr 4', capital: 204200 },
  { date: 'Apr 7', capital: 207500 },
  { date: 'Apr 8', capital: 205800 },
  { date: 'Apr 9', capital: 209100 },
  { date: 'Apr 10', capital: 212400 },
  { date: 'Apr 11', capital: 210500 },
  { date: 'Apr 14', capital: 215800 },
  { date: 'Apr 15', capital: 218200 },
  { date: 'Apr 16', capital: 216500 },
  { date: 'Apr 17', capital: 222100 },
  { date: 'Apr 18', capital: 219400 },
  { date: 'Apr 21', capital: 225800 },
  { date: 'Apr 22', capital: 229500 },
  { date: 'Apr 23', capital: 233800 },
  { date: 'Apr 24', capital: 231200 },
  { date: 'Apr 25', capital: 237600 },
  { date: 'Apr 26', capital: 242000 },
  { date: 'Apr 27', capital: 245800 },
];

// ── Daily P&L Data ──────────────────────────────────────────────
export const mockDailyPnl = [
  { date: 'Apr 21', pnl: 6300 },
  { date: 'Apr 22', pnl: 3700 },
  { date: 'Apr 23', pnl: 4300 },
  { date: 'Apr 24', pnl: -2600 },
  { date: 'Apr 25', pnl: 6400 },
  { date: 'Apr 26', pnl: 4400 },
  { date: 'Apr 27', pnl: 3800 },
];

// ── Signal Log ──────────────────────────────────────────────────
export interface SignalLog {
  time: string;
  type: 'ENTRY' | 'EXIT' | 'BIAS_CHANGE' | 'SYSTEM';
  message: string;
  severity: 'info' | 'warning' | 'success' | 'error';
}

export const mockSignalLog: SignalLog[] = [
  { time: '2026-04-28T09:13:00+05:30', type: 'ENTRY', message: 'BUY Signal — BankNifty 15m EMA Crossover, Bias: BULLISH', severity: 'success' },
  { time: '2026-04-28T09:10:00+05:30', type: 'BIAS_CHANGE', message: 'Bias changed from NEUTRAL to BULLISH (strength: 0.78)', severity: 'info' },
  { time: '2026-04-28T09:05:00+05:30', type: 'EXIT', message: 'Target hit — NIFTY PE 24300 exited at 210.5 (+3552)', severity: 'success' },
  { time: '2026-04-28T09:00:00+05:30', type: 'SYSTEM', message: 'VIX refreshed from API: 16.42', severity: 'info' },
  { time: '2026-04-28T08:55:00+05:30', type: 'ENTRY', message: 'SELL Signal — Nifty 15m EMA Crossover, Bias: BEARISH', severity: 'success' },
  { time: '2026-04-28T08:45:00+05:30', type: 'EXIT', message: 'Target hit — BankNifty CE 54300 exited at 445.2 (+6438)', severity: 'success' },
  { time: '2026-04-28T08:35:00+05:30', type: 'SYSTEM', message: 'Session recovered from previous run — 0 open positions restored', severity: 'warning' },
  { time: '2026-04-28T08:15:00+05:30', type: 'SYSTEM', message: 'Market opened — engine auto-started', severity: 'info' },
];

// ── Options Chain Data ───────────────────────────────────────────
export interface OptionStrike {
  strike: number;
  isATM: boolean;
  ce: {
    ltp: number;
    volume: number;
    oi: number;
    iv: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    itm: boolean;
  };
  pe: {
    ltp: number;
    volume: number;
    oi: number;
    iv: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    itm: boolean;
  };
}

export interface OptionsChainData {
  symbol: string;
  spot_price: number;
  atm_strike: number;
  expiry: string;
  strikes: OptionStrike[];
  greeks_summary: {
    total_delta: number;
    total_gamma: number;
    total_theta: number;
    total_vega: number;
  };
  iv_skew: { strike: number; ce_iv: number; pe_iv: number }[];
  payoff: { price: number; pnl: number }[];
}

const bnStrikes = [55400, 55600, 55800, 56000, 56200, 56400, 56600, 56800, 57000, 57200, 57400];
const atmIdx = 5; // 56400 is ATM

export const mockOptionsChain: OptionsChainData = {
  symbol: 'BANKNIFTY',
  spot_price: 56350,
  atm_strike: 56400,
  expiry: '2026-04-30',
  strikes: bnStrikes.map((strike, idx) => ({
    strike,
    isATM: idx === atmIdx,
    ce: {
      ltp: Math.max(10, Math.round((56350 - strike + 150 + idx * 9 + 30) * 100) / 100),
      volume: Math.round(12000 + idx * 4500 + 15000),
      oi: Math.round(50000 + idx * 18000 + 55000),
      iv: Math.round((14 + Math.abs(idx - atmIdx) * 0.8 + ((idx * 7) % 3) * 0.7) * 100) / 100,
      delta: Math.round((0.5 + (atmIdx - idx) * 0.08) * 100) / 100,
      gamma: Math.round((0.003 + (idx % 5) * 0.0004) * 10000) / 10000,
      theta: Math.round((-3.5 - (idx % 4) * 0.5 - 0.3) * 100) / 100,
      vega: Math.round((8 + (idx % 5) * 0.8 + 1.0) * 100) / 100,
      itm: strike < 56350,
    },
    pe: {
      ltp: Math.max(10, Math.round((strike - 56350 + 150 + idx * 8 + 25) * 100) / 100),
      volume: Math.round(10000 + idx * 4000 + 12000),
      oi: Math.round(45000 + idx * 16000 + 48000),
      iv: Math.round((15 + Math.abs(idx - atmIdx) * 0.7 + ((idx * 5) % 3) * 0.6) * 100) / 100,
      delta: Math.round((-0.5 + (atmIdx - idx) * 0.08) * 100) / 100,
      gamma: Math.round((0.003 + (idx % 5) * 0.0004) * 10000) / 10000,
      theta: Math.round((-3.2 - (idx % 4) * 0.4 - 0.2) * 100) / 100,
      vega: Math.round((7.5 + (idx % 5) * 0.7 + 0.8) * 100) / 100,
      itm: strike > 56350,
    },
  })),
  greeks_summary: {
    total_delta: 0.15,
    total_gamma: 0.045,
    total_theta: -12.8,
    total_vega: 35.2,
  },
  iv_skew: bnStrikes.map((strike, idx) => ({
    strike,
    ce_iv: Math.round((14 + Math.abs(idx - atmIdx) * 0.8 + (idx % 5) * 0.2) * 100) / 100,
    pe_iv: Math.round((15 + Math.abs(idx - atmIdx) * 0.7 + (idx % 4) * 0.2) * 100) / 100,
  })),
  payoff: Array.from({ length: 21 }, (_, i) => {
    const price = 55400 + i * 200;
    const pnl = (price - 56400) * 15 - 320 * 15;
    return { price, pnl: Math.round(pnl) };
  }),
};

const nfStrikes = [23800, 23900, 24000, 24100, 24200, 24300, 24400, 24500, 24600, 24700, 24800];
const nfAtmIdx = 5; // 24300 is ATM

export const mockNiftyOptionsChain: OptionsChainData = {
  symbol: 'NIFTY',
  spot_price: 24320,
  atm_strike: 24300,
  expiry: '2026-04-30',
  strikes: nfStrikes.map((strike, idx) => ({
    strike,
    isATM: idx === nfAtmIdx,
    ce: {
      ltp: Math.max(5, Math.round((24320 - strike + 80 + idx * 6 + 20) * 100) / 100),
      volume: Math.round(20000 + idx * 7000 + 25000),
      oi: Math.round(80000 + idx * 35000 + 120000),
      iv: Math.round((12 + Math.abs(idx - nfAtmIdx) * 0.6 + ((idx * 3) % 3) * 0.5) * 100) / 100,
      delta: Math.round((0.5 + (nfAtmIdx - idx) * 0.07) * 100) / 100,
      gamma: Math.round((0.002 + (idx % 5) * 0.0002) * 10000) / 10000,
      theta: Math.round((-2.8 - (idx % 4) * 0.35 - 0.2) * 100) / 100,
      vega: Math.round((6 + (idx % 5) * 0.6 + 0.5) * 100) / 100,
      itm: strike < 24320,
    },
    pe: {
      ltp: Math.max(5, Math.round((strike - 24320 + 80 + idx * 5 + 18) * 100) / 100),
      volume: Math.round(18000 + idx * 6000 + 22000),
      oi: Math.round(75000 + idx * 30000 + 100000),
      iv: Math.round((13 + Math.abs(idx - nfAtmIdx) * 0.5 + ((idx * 4) % 3) * 0.5) * 100) / 100,
      delta: Math.round((-0.5 + (nfAtmIdx - idx) * 0.07) * 100) / 100,
      gamma: Math.round((0.002 + (idx % 5) * 0.0002) * 10000) / 10000,
      theta: Math.round((-2.5 - (idx % 4) * 0.3 - 0.15) * 100) / 100,
      vega: Math.round((5.5 + (idx % 5) * 0.5 + 0.4) * 100) / 100,
      itm: strike > 24320,
    },
  })),
  greeks_summary: {
    total_delta: -0.22,
    total_gamma: 0.032,
    total_theta: -8.5,
    total_vega: 22.8,
  },
  iv_skew: nfStrikes.map((strike, idx) => ({
    strike,
    ce_iv: Math.round((12 + Math.abs(idx - nfAtmIdx) * 0.6 + (idx % 5) * 0.15) * 100) / 100,
    pe_iv: Math.round((13 + Math.abs(idx - nfAtmIdx) * 0.5 + (idx % 4) * 0.18) * 100) / 100,
  })),
  payoff: Array.from({ length: 21 }, (_, i) => {
    const price = 23800 + i * 100;
    const pnl = (24300 - price) * 25 - 135 * 25;
    return { price, pnl: Math.round(pnl) };
  }),
};

// ── Risk Metrics ──────────────────────────────────────────────────
export interface RiskMetrics {
  total_exposure: number;
  margin_used: number;
  buying_power: number;
  daily_risk_budget_pct: number;
  daily_risk_used_pct: number;
  max_drawdown_pct: number;
  current_drawdown_pct: number;
  circuit_breakers: {
    daily_loss_limit: { limit: number; used: number; triggered: boolean };
    max_drawdown: { limit: number; current: number; triggered: boolean };
    capital_floor: { limit: number; current: number; triggered: boolean };
  };
  greeks_exposure: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  vix_regime: {
    current: string;
    vix: number;
    history: { time: string; vix: number; regime: string }[];
  };
  drawdown_timeline: { date: string; drawdown_pct: number }[];
  correlation_matrix: { symbol1: string; symbol2: string; correlation: number }[];
}

export const mockRiskMetrics: RiskMetrics = {
  total_exposure: 845000,
  margin_used: 168000,
  buying_power: 77800,
  daily_risk_budget_pct: 3.0,
  daily_risk_used_pct: 1.6,
  max_drawdown_pct: 4.8,
  current_drawdown_pct: 1.2,
  circuit_breakers: {
    daily_loss_limit: { limit: 6000, used: 960, triggered: false },
    max_drawdown: { limit: 0.20, current: 0.048, triggered: false },
    capital_floor: { limit: 0.80, current: 1.229, triggered: false },
  },
  greeks_exposure: {
    delta: 0.15,
    gamma: 0.045,
    theta: -12.8,
    vega: 35.2,
  },
  vix_regime: {
    current: 'NORMAL',
    vix: 16.42,
    history: [
      { time: '09:15', vix: 17.1, regime: 'NORMAL' },
      { time: '09:45', vix: 16.8, regime: 'NORMAL' },
      { time: '10:15', vix: 16.5, regime: 'NORMAL' },
      { time: '10:45', vix: 16.2, regime: 'NORMAL' },
      { time: '11:15', vix: 16.9, regime: 'NORMAL' },
      { time: '11:45', vix: 17.3, regime: 'NORMAL' },
      { time: '12:15', vix: 16.7, regime: 'NORMAL' },
      { time: '13:15', vix: 16.1, regime: 'NORMAL' },
      { time: '13:45', vix: 16.4, regime: 'NORMAL' },
      { time: '14:15', vix: 16.0, regime: 'NORMAL' },
      { time: '14:45', vix: 16.42, regime: 'NORMAL' },
    ],
  },
  drawdown_timeline: [
    { date: 'Apr 1', drawdown_pct: 0 },
    { date: 'Apr 2', drawdown_pct: -0.5 },
    { date: 'Apr 3', drawdown_pct: -1.2 },
    { date: 'Apr 4', drawdown_pct: 0.8 },
    { date: 'Apr 7', drawdown_pct: 2.1 },
    { date: 'Apr 8', drawdown_pct: 1.5 },
    { date: 'Apr 9', drawdown_pct: 3.2 },
    { date: 'Apr 10', drawdown_pct: 4.8 },
    { date: 'Apr 11', drawdown_pct: 3.5 },
    { date: 'Apr 14', drawdown_pct: 2.1 },
    { date: 'Apr 15', drawdown_pct: 1.0 },
    { date: 'Apr 16', drawdown_pct: 1.8 },
    { date: 'Apr 17', drawdown_pct: 0.5 },
    { date: 'Apr 18', drawdown_pct: 2.2 },
    { date: 'Apr 21', drawdown_pct: 0.8 },
    { date: 'Apr 22', drawdown_pct: 0.3 },
    { date: 'Apr 23', drawdown_pct: 0.1 },
    { date: 'Apr 24', drawdown_pct: 1.5 },
    { date: 'Apr 25', drawdown_pct: 0.6 },
    { date: 'Apr 26', drawdown_pct: 1.2 },
    { date: 'Apr 27', drawdown_pct: 0.4 },
  ],
  correlation_matrix: [
    { symbol1: 'BANKNIFTY', symbol2: 'BANKNIFTY', correlation: 1.0 },
    { symbol1: 'BANKNIFTY', symbol2: 'NIFTY', correlation: 0.87 },
    { symbol1: 'NIFTY', symbol2: 'BANKNIFTY', correlation: 0.87 },
    { symbol1: 'NIFTY', symbol2: 'NIFTY', correlation: 1.0 },
  ],
};

// ── Risk Alerts ──────────────────────────────────────────────────
export interface RiskAlert {
  id: string;
  type: 'risk' | 'trade' | 'vix' | 'system';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  time: string;
  acknowledged: boolean;
}

export const mockRiskAlerts: RiskAlert[] = [
  { id: 'RA001', type: 'risk', severity: 'warning', message: 'Daily risk budget 53% used — 1.6% of 3.0%', time: '2026-04-28T09:10:00+05:30', acknowledged: false },
  { id: 'RA002', type: 'vix', severity: 'info', message: 'VIX regime: NORMAL (16.42)', time: '2026-04-28T09:00:00+05:30', acknowledged: true },
  { id: 'RA003', type: 'trade', severity: 'warning', message: 'BANKNIFTY position approaching stop loss — 45 points away', time: '2026-04-28T08:50:00+05:30', acknowledged: false },
  { id: 'RA004', type: 'system', severity: 'info', message: 'Session recovered — 2 open positions restored', time: '2026-04-28T08:30:00+05:30', acknowledged: true },
  { id: 'RA005', type: 'risk', severity: 'critical', message: 'Drawdown circuit breaker at 24% of limit', time: '2026-04-28T08:15:00+05:30', acknowledged: true },
];

// ── Alerts & Notifications ────────────────────────────────────────
export interface AlertConfig {
  id: string;
  name: string;
  type: 'price' | 'vix' | 'trade' | 'risk';
  condition: string;
  threshold: string;
  channels: ('telegram' | 'in_app')[];
  enabled: boolean;
}

export const mockAlertConfigs: AlertConfig[] = [
  { id: 'AC001', name: 'Daily Loss Alert', type: 'risk', condition: 'daily_loss > threshold', threshold: '₹5,000', channels: ['telegram', 'in_app'], enabled: true },
  { id: 'AC002', name: 'VIX Spike Alert', type: 'vix', condition: 'vix > threshold', threshold: '25', channels: ['in_app'], enabled: true },
  { id: 'AC003', name: 'Trade Entry Alert', type: 'trade', condition: 'on_trade_entry', threshold: 'Any', channels: ['telegram'], enabled: true },
  { id: 'AC004', name: 'Trade Exit Alert', type: 'trade', condition: 'on_trade_exit', threshold: 'Any', channels: ['telegram', 'in_app'], enabled: true },
  { id: 'AC005', name: 'Drawdown Alert', type: 'risk', condition: 'drawdown > threshold', threshold: '5%', channels: ['telegram', 'in_app'], enabled: true },
  { id: 'AC006', name: 'BankNifty Price Alert', type: 'price', condition: 'BANKNIFTY > threshold', threshold: '57000', channels: ['in_app'], enabled: false },
];

export interface AlertHistoryEntry {
  id: string;
  alert_name: string;
  type: 'price' | 'vix' | 'trade' | 'risk';
  message: string;
  time: string;
  channel: 'telegram' | 'in_app';
  acknowledged: boolean;
}

export const mockAlertHistory: AlertHistoryEntry[] = [
  { id: 'AH001', alert_name: 'Trade Entry Alert', type: 'trade', message: 'BUY BANKNIFTY CE 56300 @ ₹320', time: '2026-04-28T08:45:00+05:30', channel: 'telegram', acknowledged: true },
  { id: 'AH002', alert_name: 'Daily Loss Alert', type: 'risk', message: 'Daily P&L at -₹960 (1.6% of 3% budget)', time: '2026-04-28T09:10:00+05:30', channel: 'in_app', acknowledged: false },
  { id: 'AH003', alert_name: 'VIX Spike Alert', type: 'vix', message: 'VIX at 16.42 (below threshold 25)', time: '2026-04-28T09:00:00+05:30', channel: 'in_app', acknowledged: true },
  { id: 'AH004', alert_name: 'Trade Exit Alert', type: 'trade', message: 'EXIT NIFTY PE 24300 @ ₹210.5 (+₹3,552)', time: '2026-04-28T08:30:00+05:30', channel: 'telegram', acknowledged: true },
  { id: 'AH005', alert_name: 'Drawdown Alert', type: 'risk', message: 'Current drawdown at 4.8% (below 5% threshold)', time: '2026-04-28T08:50:00+05:30', channel: 'in_app', acknowledged: false },
];

export interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  enabled: boolean;
  last_test: string | null;
  last_test_success: boolean;
}

export const mockTelegramConfig: TelegramConfig = {
  bot_token: '7234*****:AAF5 ********************************',
  chat_id: '-1001*********',
  enabled: true,
  last_test: '2026-04-28T08:15:00+05:30',
  last_test_success: true,
};

// ── Journal Entries ───────────────────────────────────────────────
export type EmotionalState = 'confident' | 'anxious' | 'fomo' | 'patient' | 'disciplined' | 'revenge' | 'calm' | 'excited';

export interface JournalEntry {
  id: string;
  trade_id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry_time: string;
  exit_time: string | null;
  pre_trade_rationale: string;
  post_trade_review: string | null;
  emotional_state: EmotionalState;
  tags: string[];
  pnl: number | null;
  screenshot_url: string | null;
}

export const mockJournalEntries: JournalEntry[] = [
  {
    id: 'J001',
    trade_id: 'T001',
    symbol: 'BANKNIFTY',
    direction: 'LONG',
    entry_time: '2026-04-25T10:15:00+05:30',
    exit_time: '2026-04-25T11:45:00+05:30',
    pre_trade_rationale: 'Strong bullish bias on 60m chart. 15m EMA crossover confirmed. VIX in normal range. Entering ITM CE for directional play.',
    post_trade_review: 'Excellent execution. Followed the plan perfectly. Bias strength was 0.78 which gave confidence. Could have held for more but target hit.',
    emotional_state: 'confident',
    tags: ['ema-crossover', 'trend-following', 'plan-followed'],
    pnl: 6438,
    screenshot_url: null,
  },
  {
    id: 'J002',
    trade_id: 'T002',
    symbol: 'NIFTY',
    direction: 'SHORT',
    entry_time: '2026-04-25T13:00:00+05:30',
    exit_time: '2026-04-25T14:30:00+05:30',
    pre_trade_rationale: 'Bearish bias on hourly. RSI showing overbought conditions. Entering PE for counter-trend scalp.',
    post_trade_review: 'Good trade. Was patient waiting for the setup. Risk management was spot on.',
    emotional_state: 'patient',
    tags: ['counter-trend', 'rsi-filter', 'patience'],
    pnl: 3552,
    screenshot_url: null,
  },
  {
    id: 'J003',
    trade_id: 'T003',
    symbol: 'BANKNIFTY',
    direction: 'LONG',
    entry_time: '2026-04-24T10:30:00+05:30',
    exit_time: '2026-04-24T12:15:00+05:30',
    pre_trade_rationale: 'Trying to catch the bounce after yesterday\'s strong move. Bias still bullish.',
    post_trade_review: 'Should have waited for better confirmation. Entered on hope rather than signal. SL hit because I was too eager.',
    emotional_state: 'fomo',
    tags: ['fomo-entry', 'no-confirmation', 'lesson-learned'],
    pnl: -2535,
    screenshot_url: null,
  },
  {
    id: 'J004',
    trade_id: 'T004',
    symbol: 'BANKNIFTY',
    direction: 'SHORT',
    entry_time: '2026-04-23T14:00:00+05:30',
    exit_time: '2026-04-23T15:00:00+05:30',
    pre_trade_rationale: 'Late afternoon short setup. Bias turned bearish. Quick scalp opportunity.',
    post_trade_review: 'Disciplined execution. Did not overstay. Hit target and exited cleanly.',
    emotional_state: 'disciplined',
    tags: ['afternoon-trade', 'discipline', 'target-hit'],
    pnl: 4255,
    screenshot_url: null,
  },
  {
    id: 'J005',
    trade_id: 'T007',
    symbol: 'NIFTY',
    direction: 'SHORT',
    entry_time: '2026-04-18T13:15:00+05:30',
    exit_time: '2026-04-18T14:45:00+05:30',
    pre_trade_rationale: 'Entered short after previous loss. Market needs to go down. I\'ll make it back.',
    post_trade_review: 'Revenge trade. Did not follow system. Entered without proper signal. Big mistake.',
    emotional_state: 'revenge',
    tags: ['revenge-trade', 'no-signal', 'emotional'],
    pnl: -2685,
    screenshot_url: null,
  },
];

export const mockJournalAnalytics = {
  by_emotion: {
    confident: { count: 12, win_rate: 75, avg_pnl: 4200 },
    patient: { count: 8, win_rate: 62.5, avg_pnl: 2800 },
    disciplined: { count: 15, win_rate: 73.3, avg_pnl: 3600 },
    calm: { count: 6, win_rate: 66.7, avg_pnl: 2200 },
    anxious: { count: 4, win_rate: 25, avg_pnl: -1500 },
    fomo: { count: 5, win_rate: 20, avg_pnl: -2100 },
    revenge: { count: 3, win_rate: 0, avg_pnl: -3200 },
    excited: { count: 2, win_rate: 50, avg_pnl: 800 },
  } as Record<EmotionalState, { count: number; win_rate: number; avg_pnl: number }>,
  best_pattern: 'EMA crossover with bullish bias + VIX < 18',
  worst_pattern: 'Revenge trading after consecutive losses',
};

// ── Theme Preferences ─────────────────────────────────────────────
export type AccentColor = 'emerald' | 'blue' | 'purple' | 'amber' | 'red';

export interface ThemePreferences {
  mode: 'dark' | 'light' | 'system';
  accent: AccentColor;
  sidebarPosition: 'left' | 'right';
  compactMode: boolean;
  numberFormat: 'indian' | 'international';
}

export const defaultThemePreferences: ThemePreferences = {
  mode: 'dark',
  accent: 'emerald',
  sidebarPosition: 'left',
  compactMode: false,
  numberFormat: 'indian',
};

// ── Config Presets ────────────────────────────────────────────────
export interface ConfigPreset {
  name: string;
  description: string;
  changes: Record<string, string | number | boolean>;
}

export const mockConfigPresets: ConfigPreset[] = [
  {
    name: 'Conservative',
    description: 'Low risk, fewer trades, tight stops',
    changes: {
      DAILY_RISK_PCT: 1.5,
      RISK_PER_POSITION_PCT: 1.0,
      MAX_OPEN_POSITIONS: 1,
      DRAWDOWN_CIRCUIT_BREAKER: 0.60,
      CAPITAL_FLOOR_PCT: 0.30,
      NUM_LOTS: 1,
      ATR_SL_MULT: 2.0,
      ATR_TARGET_MULT: 3.0,
    },
  },
  {
    name: 'Moderate',
    description: 'Balanced risk-reward, default settings',
    changes: {
      DAILY_RISK_PCT: 3.0,
      RISK_PER_POSITION_PCT: 2.0,
      MAX_OPEN_POSITIONS: 2,
      DRAWDOWN_CIRCUIT_BREAKER: 0.80,
      CAPITAL_FLOOR_PCT: 0.20,
      NUM_LOTS: 1,
      ATR_SL_MULT: 1.5,
      ATR_TARGET_MULT: 2.5,
    },
  },
  {
    name: 'Aggressive',
    description: 'Higher risk tolerance, more positions',
    changes: {
      DAILY_RISK_PCT: 5.0,
      RISK_PER_POSITION_PCT: 3.0,
      MAX_OPEN_POSITIONS: 3,
      DRAWDOWN_CIRCUIT_BREAKER: 0.90,
      CAPITAL_FLOOR_PCT: 0.10,
      NUM_LOTS: 2,
      ATR_SL_MULT: 1.0,
      ATR_TARGET_MULT: 2.0,
    },
  },
];
