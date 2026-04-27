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
    expires_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    user_name: 'Sameer Gani Shaikh',
  },
  market_status: 'open',
  last_signal: 'BUY Signal — BankNifty 15m EMA Crossover',
  last_signal_time: new Date(Date.now() - 12 * 60000).toISOString(),
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
    entry_time: new Date(Date.now() - 45 * 60000).toISOString(),
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
    entry_time: new Date(Date.now() - 25 * 60000).toISOString(),
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
  { name: 'Engine Heartbeat', status: 'healthy', message: 'Engine is running', last_checked: new Date().toISOString() },
  { name: 'Kite Token', status: 'healthy', message: 'Token is valid — expires in 8h', last_checked: new Date().toISOString() },
  { name: 'Database', status: 'healthy', message: 'Database is accessible', last_checked: new Date().toISOString() },
  { name: 'Market Hours Guard', status: 'healthy', message: 'Active — market is open', last_checked: new Date().toISOString() },
  { name: 'Telegram Notifier', status: 'degraded', message: 'Last message delivered with 2s delay', last_checked: new Date().toISOString() },
  { name: 'Session Recovery', status: 'healthy', message: 'No recoverable sessions', last_checked: new Date().toISOString() },
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
  { time: new Date(Date.now() - 120000).toISOString(), type: 'ENTRY', message: 'BUY Signal — BankNifty 15m EMA Crossover, Bias: BULLISH', severity: 'success' },
  { time: new Date(Date.now() - 300000).toISOString(), type: 'BIAS_CHANGE', message: 'Bias changed from NEUTRAL to BULLISH (strength: 0.78)', severity: 'info' },
  { time: new Date(Date.now() - 600000).toISOString(), type: 'EXIT', message: 'Target hit — NIFTY PE 24300 exited at 210.5 (+3552)', severity: 'success' },
  { time: new Date(Date.now() - 900000).toISOString(), type: 'SYSTEM', message: 'VIX refreshed from API: 16.42', severity: 'info' },
  { time: new Date(Date.now() - 1200000).toISOString(), type: 'ENTRY', message: 'SELL Signal — Nifty 15m EMA Crossover, Bias: BEARISH', severity: 'success' },
  { time: new Date(Date.now() - 1800000).toISOString(), type: 'EXIT', message: 'Target hit — BankNifty CE 54300 exited at 445.2 (+6438)', severity: 'success' },
  { time: new Date(Date.now() - 2400000).toISOString(), type: 'SYSTEM', message: 'Session recovered from previous run — 0 open positions restored', severity: 'warning' },
  { time: new Date(Date.now() - 3600000).toISOString(), type: 'SYSTEM', message: 'Market opened — engine auto-started', severity: 'info' },
];
