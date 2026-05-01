'use client';

/**
 * DDLJ Trading System — Backtest Page
 * ========================================
 * Full-featured backtest configuration + results viewer with:
 *  - Complete parameter configuration (symbol, dates, capital, SL ATR, RR, moneyness, etc.)
 *  - Real-time progress streaming
 *  - Expandable trade details with date/time, quantity, trigger columns
 *  - Summary metric cards
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type BacktestConfigResult,
  type BacktestTradeDetail,
  type BacktestStatusResult,
  type BacktestRunConfig,
  type BacktestProgress,
  backtestApi,
} from '@/lib/api';
import { cn, formatCurrency, pnlColor, formatPercent, formatDuration } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Activity,
  ShieldAlert,
  Zap,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  Calendar,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Flattened Result Interface ─────────────────────────────────
interface FlattenedResult extends BacktestConfigResult {
  _method: 'a' | 'b';
  _key: string;
}

// ── Date Formatter ─────────────────────────────────────────────
function formatTradeDateTime(isoString: string): string {
  const d = new Date(isoString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${mins}`;
}

// ── Exit Reason Badge Color ────────────────────────────────────
function exitReasonVariant(reason: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (reason.toUpperCase()) {
    case 'TARGET':
    case 'NEAR_TGT':
      return 'default';
    case 'SL':
      return 'destructive';
    case 'EOD':
    case 'BIAS_FLIP':
      return 'secondary';
    default:
      return 'outline';
  }
}

// ── Summary Stat Card ──────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className={cn('text-xl font-bold tracking-tight truncate', color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('p-2 rounded-lg shrink-0', color.replace('text-', 'bg-').replace(/-\d+$/, '-500/10'))}>
            <Icon className={cn('h-4 w-4', color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Trade Detail Row ───────────────────────────────────────────
function TradeDetailTable({ trades }: { trades: BacktestTradeDetail[] }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        No trade details available for this configuration.
      </div>
    );
  }

  const totalNet = trades.reduce((sum, t) => sum + t.net, 0);
  const wins = trades.filter(t => t.net > 0).length;

  return (
    <div className="px-4 py-3">
      {/* Trade summary bar */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <span className="text-muted-foreground">
          {trades.length} trades &middot; {wins}W / {trades.length - wins}L
        </span>
        <span className={cn('font-semibold', pnlColor(totalNet))}>
          Net: {formatCurrency(totalNet)}
        </span>
        {trades.length > 0 && (
          <span className="text-muted-foreground">
            Avg: {formatCurrency(totalNet / trades.length)}
          </span>
        )}
      </div>

      {/* Scrollable trade table */}
      <div className="max-h-96 overflow-y-auto rounded-md border border-border/50" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'hsl(var(--border)) transparent',
      }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-xs h-8">#</TableHead>
              <TableHead className="text-xs h-8">Date/Time</TableHead>
              <TableHead className="text-xs h-8">Symbol</TableHead>
              <TableHead className="text-xs h-8">Dir</TableHead>
              <TableHead className="text-xs h-8 text-right">Entry</TableHead>
              <TableHead className="text-xs h-8 text-right">Exit</TableHead>
              <TableHead className="text-xs h-8 text-right">SL</TableHead>
              <TableHead className="text-xs h-8 text-right">Target</TableHead>
              <TableHead className="text-xs h-8 text-right">Qty</TableHead>
              <TableHead className="text-xs h-8">Trigger</TableHead>
              <TableHead className="text-xs h-8 text-right">Net P&L</TableHead>
              <TableHead className="text-xs h-8 text-right">R:R</TableHead>
              <TableHead className="text-xs h-8 text-right">Bars</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((t, i) => (
              <TableRow key={t.id ?? i} className="text-xs hover:bg-muted/30">
                <TableCell className="py-1.5 text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="py-1.5 whitespace-nowrap">
                  {formatTradeDateTime(t.entry_time)}
                </TableCell>
                <TableCell className="py-1.5 font-medium">{t.symbol}</TableCell>
                <TableCell className="py-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0 font-semibold border-0',
                      t.direction === 'LONG'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    )}
                  >
                    {t.direction}
                  </Badge>
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono">
                  {t.entry_price.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono">
                  {t.exit_price.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono text-red-400/80">
                  {t.sl.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono text-emerald-400/80">
                  {t.target.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="py-1.5 text-right">{t.qty}</TableCell>
                <TableCell className="py-1.5">
                  <Badge
                    variant={exitReasonVariant(t.exit_reason)}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {t.exit_reason}
                  </Badge>
                </TableCell>
                <TableCell className={cn('py-1.5 text-right font-semibold font-mono', pnlColor(t.net))}>
                  {t.net > 0 ? '+' : ''}{formatCurrency(t.net)}
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono">
                  {t.rr > 0 ? `${t.rr.toFixed(2)}` : '—'}
                </TableCell>
                <TableCell className="py-1.5 text-right text-muted-foreground">
                  {t.held_bars}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Default backtest config ────────────────────────────────────
const DEFAULT_CONFIG: BacktestRunConfig = {
  symbol: 'both',
  timeframe: 'all',
  method: 'both',
  from_date: '2025-11-01',
  to_date: '2026-04-25',
  capital: 50000,
  sl_atr: 2.0,
  min_rr: 1.5,
  moneyness: 'ITM',
  daily_risk_pct: 6.0,
  max_open_positions: 2,
  max_daily_trades: 4,
  max_daily_trades_enabled: true,
  use_sample_data: false,
};

// ── Main Backtest Page Component ───────────────────────────────
export default function BacktestPage() {
  // Configuration state
  const [symbol, setSymbol] = useState<'BANKNIFTY' | 'NIFTY' | 'both'>(DEFAULT_CONFIG.symbol!);
  const [method, setMethod] = useState<'method_a' | 'method_b' | 'both'>(DEFAULT_CONFIG.method!);
  const [timeframe, setTimeframe] = useState<'15m/60m' | '15m/15m' | '5m/60m' | 'all'>(DEFAULT_CONFIG.timeframe!);
  const [fromDate, setFromDate] = useState(DEFAULT_CONFIG.from_date!);
  const [toDate, setToDate] = useState(DEFAULT_CONFIG.to_date!);
  const [capital, setCapital] = useState(DEFAULT_CONFIG.capital!);
  const [slAtr, setSlAtr] = useState(DEFAULT_CONFIG.sl_atr!);
  const [minRR, setMinRR] = useState(DEFAULT_CONFIG.min_rr!);
  const [moneyness, setMoneyness] = useState<'ATM' | 'ITM' | 'DEEP_ITM'>(DEFAULT_CONFIG.moneyness!);
  const [dailyRiskPct, setDailyRiskPct] = useState(DEFAULT_CONFIG.daily_risk_pct!);
  const [maxOpenPositions, setMaxOpenPositions] = useState(DEFAULT_CONFIG.max_open_positions!);
  const [maxDailyTradesEnabled, setMaxDailyTradesEnabled] = useState(DEFAULT_CONFIG.max_daily_trades_enabled!);
  const [maxDailyTrades, setMaxDailyTrades] = useState(DEFAULT_CONFIG.max_daily_trades!);
  const [allowSampleData, setAllowSampleData] = useState(DEFAULT_CONFIG.use_sample_data!);

  // Results state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<FlattenedResult[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeMethod, setActiveMethod] = useState<'all' | 'a' | 'b'>('all');
  const [hasResults, setHasResults] = useState(false);
  const [hasSyntheticData, setHasSyntheticData] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showConfig, setShowConfig] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Flatten results from the API response
  const flattenResults = useCallback((data: BacktestStatusResult): FlattenedResult[] => {
    if (!data.last_results) return [];
    const flat: FlattenedResult[] = [];

    const methodA = data.last_results.method_a_top || {};
    const methodB = data.last_results.method_b_top || {};

    for (const [key, val] of Object.entries(methodA)) {
      flat.push({ ...val, _method: 'a' as const, _key: key });
    }
    for (const [key, val] of Object.entries(methodB)) {
      flat.push({ ...val, _method: 'b' as const, _key: key });
    }

    // Sort by net P&L descending
    flat.sort((a, b) => b.net_pnl - a.net_pnl);
    return flat;
  }, []);

  // Start polling for status
  const startPolling = useCallback((resetStartTime = true) => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);

    if (resetStartTime) {
      startTimeRef.current = Date.now();
    }

    elapsedRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const status = await backtestApi.getStatus();
        // Progress is an object with .pct and .message
        const progObj = status.progress;
        const pct = progObj?.pct ?? 0;
        const msg = progObj?.message ?? status.message ?? '';
        setProgress(pct);
        setProgressMsg(msg);

        if (status.status === 'completed' && status.last_results) {
          setResults(flattenResults(status));
          setHasResults(true);
          setHasSyntheticData(status.last_results?.has_synthetic_data ?? false);
          setIsRunning(false);
          if (pollRef.current) clearInterval(pollRef.current);
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          setProgress(100);
          toast.success('Backtest completed', {
            description: `${(status.last_results?.configs_tested || 0)} configurations tested`,
          });
        } else if (status.status === 'error') {
          setIsRunning(false);
          if (pollRef.current) clearInterval(pollRef.current);
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          toast.error('Backtest failed', {
            description: status.message || 'Unknown error',
          });
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 1500);
  }, [flattenResults]);

  // Check initial status on mount
  useEffect(() => {
    const checkInitial = async () => {
      try {
        const status = await backtestApi.getStatus();
        if (status.status === 'completed' && status.last_results) {
          setResults(flattenResults(status));
          setHasResults(true);
          setHasSyntheticData(status.last_results?.has_synthetic_data ?? false);
          setProgress(100);
          setProgressMsg('Results loaded from previous run');
        } else if (status.status === 'running') {
          setIsRunning(true);
          const progObj = status.progress;
          const pct = progObj?.pct ?? 0;
          const msg = progObj?.message ?? status.message ?? 'Running...';
          setProgress(pct);
          setProgressMsg(msg);
          startTimeRef.current = Date.now() - (status.elapsed_seconds || 0) * 1000;
          startPolling(false);
        } else if (status.status === 'error') {
          toast.error('Previous backtest failed', {
            description: status.message || 'Unknown error',
          });
        }
      } catch {
        // Silently ignore — backend may be unreachable
      } finally {
        setInitialLoad(false);
      }
    };
    checkInitial();
  }, [flattenResults, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  // Run backtest — sends ALL configuration to the backend
  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress(0);
    setProgressMsg('Starting backtest...');
    setElapsed(0);
    setExpandedRows(new Set());

    const config: BacktestRunConfig = {
      symbol,
      timeframe,
      method,
      from_date: fromDate,
      to_date: toDate,
      capital,
      sl_atr: slAtr,
      min_rr: minRR,
      moneyness,
      daily_risk_pct: dailyRiskPct,
      max_open_positions: maxOpenPositions,
      max_daily_trades: maxDailyTradesEnabled ? maxDailyTrades : undefined,
      max_daily_trades_enabled: maxDailyTradesEnabled,
      use_sample_data: allowSampleData,
    };

    try {
      await backtestApi.run(config);
      startPolling();
      toast.info('Backtest started', {
        description: `${symbol} | ${fromDate} to ${toDate} | Capital: ${capital}`,
      });
    } catch (err) {
      setIsRunning(false);
      toast.error('Failed to start backtest', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [isRunning, symbol, method, fromDate, toDate, capital, slAtr, minRR, moneyness, dailyRiskPct, maxOpenPositions, maxDailyTradesEnabled, maxDailyTrades, allowSampleData, startPolling]);

  // Toggle expanded row
  const toggleExpand = useCallback((key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Filter results by method
  const filteredResults = results.filter(r => {
    if (activeMethod === 'all') return true;
    if (activeMethod === 'a') return r._method === 'a';
    if (activeMethod === 'b') return r._method === 'b';
    return true;
  });

  // Expand / collapse all
  const expandAll = useCallback(() => {
    setExpandedRows(new Set(filteredResults.map(r => r._key)));
  }, [filteredResults]);

  const collapseAll = useCallback(() => {
    setExpandedRows(new Set());
  }, []);

  // Compute summary stats from top config or overall
  const bestResult = results.length > 0 ? results[0] : null;
  const totalPnl = results.reduce((s, r) => s + r.net_pnl, 0);
  const avgWinRate = results.length > 0
    ? results.reduce((s, r) => s + r.win_rate, 0) / results.length
    : 0;
  const avgProfitFactor = results.length > 0
    ? results.reduce((s, r) => s + r.profit_factor, 0) / results.length
    : 0;
  const totalTrades = results.reduce((s, r) => s + r.total_trades, 0);
  const maxDrawdown = results.length > 0
    ? Math.max(...results.map(r => r.max_dd_pct))
    : 0;
  const avgSharpe = results.length > 0
    ? results.reduce((s, r) => s + r.sharpe_approx, 0) / results.length
    : 0;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backtest Engine</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure and run strategy backtests across multiple configurations, then drill into individual trade details
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
              <Clock className="h-4 w-4 animate-pulse" />
              <span>{formatDuration(elapsed)}</span>
            </div>
          )}
          <Button
            onClick={handleRun}
            disabled={isRunning}
            size="lg"
            className={cn(
              'gap-2 font-semibold',
              isRunning
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            )}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Backtest
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Configuration Panel ────────────────────────────────── */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Configuration
              </CardTitle>
              <CardDescription>All parameters apply on next run — defaults from engine config</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowConfig(!showConfig)}
            >
              {showConfig ? (
                <><ChevronDown className="h-3 w-3" />Hide</>
              ) : (
                <><ChevronRight className="h-3 w-3" />Show</>
              )}
            </Button>
          </div>
        </CardHeader>
        {showConfig && (
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              {/* Symbol */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Symbol</Label>
                <Select value={symbol} onValueChange={(v) => setSymbol(v as 'BANKNIFTY' | 'NIFTY' | 'both')}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both (BANKNIFTY + NIFTY)</SelectItem>
                    <SelectItem value="BANKNIFTY">BANKNIFTY</SelectItem>
                    <SelectItem value="NIFTY">NIFTY</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as 'method_a' | 'method_b' | 'both')}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both Methods</SelectItem>
                    <SelectItem value="method_a">Compounding</SelectItem>
                    <SelectItem value="method_b">Monthly Batch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Timeframe */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Timeframe</Label>
                <Select value={timeframe} onValueChange={(v) => setTimeframe(v as '15m/60m' | '15m/15m' | '5m/60m' | 'all')}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Combinations</SelectItem>
                    <SelectItem value="15m/60m">15m Entry / 60m Bias</SelectItem>
                    <SelectItem value="15m/15m">15m Entry / 15m Bias</SelectItem>
                    <SelectItem value="5m/60m">5m Entry / 60m Bias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* From Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> From Date
                </Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* To Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> To Date
                </Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Capital */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Starting Capital</Label>
                <Input
                  type="number"
                  min={10000}
                  max={10000000}
                  step={10000}
                  value={capital}
                  onChange={(e) => setCapital(Number(e.target.value) || 50000)}
                  className="h-9"
                />
              </div>

              {/* SL ATR Multiplier */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">SL ATR Multiplier</Label>
                <Input
                  type="number"
                  min={0.5}
                  max={5.0}
                  step={0.1}
                  value={slAtr}
                  onChange={(e) => setSlAtr(Number(e.target.value) || 2.0)}
                  className="h-9"
                />
              </div>

              {/* Min Risk-Reward */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Min Risk-Reward</Label>
                <Input
                  type="number"
                  min={0.5}
                  max={5.0}
                  step={0.1}
                  value={minRR}
                  onChange={(e) => setMinRR(Number(e.target.value) || 1.5)}
                  className="h-9"
                />
              </div>

              {/* Moneyness */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Option Moneyness</Label>
                <Select value={moneyness} onValueChange={(v) => setMoneyness(v as 'ATM' | 'ITM' | 'DEEP_ITM')}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ITM">ITM (In-The-Money)</SelectItem>
                    <SelectItem value="ATM">ATM (At-The-Money)</SelectItem>
                    <SelectItem value="DEEP_ITM">Deep ITM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Daily Risk % */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Daily Risk %</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  step={0.5}
                  value={dailyRiskPct}
                  onChange={(e) => setDailyRiskPct(Number(e.target.value) || 6.0)}
                  className="h-9"
                />
              </div>

              {/* Max Open Positions */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Max Open Positions</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={maxOpenPositions}
                  onChange={(e) => setMaxOpenPositions(Number(e.target.value) || 2)}
                  className="h-9"
                />
              </div>

              {/* Max Daily Trades Toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Max Daily Trades</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    checked={maxDailyTradesEnabled}
                    onCheckedChange={setMaxDailyTradesEnabled}
                    id="max-daily-trades-switch"
                  />
                  {maxDailyTradesEnabled ? (
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={maxDailyTrades}
                      onChange={(e) => setMaxDailyTrades(parseInt(e.target.value) || 1)}
                      className="w-16 h-8 text-center text-sm"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Unlimited</span>
                  )}
                </div>
              </div>

              {/* Data Source Fallback */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Sample Data Fallback</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    checked={allowSampleData}
                    onCheckedChange={setAllowSampleData}
                    id="sample-data-switch"
                  />
                  <span className="text-xs text-muted-foreground">
                    {allowSampleData ? 'Allowed' : 'Real data only'}
                  </span>
                </div>
              </div>
            </div>

            {/* Config summary */}
            <div className="mt-4 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Active config:</span>{' '}
                {symbol} | TF: {timeframe} | {fromDate} to {toDate} | {formatCurrency(capital)} capital | SL {slAtr}x ATR | RR {minRR}+ | {moneyness} | {dailyRiskPct}% daily risk
                {maxDailyTradesEnabled && ` | max ${maxDailyTrades} trades/day`}
                {` | ${allowSampleData ? 'sample fallback allowed' : 'real data only'}`}
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Progress Section */}
      {isRunning && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-200">
                  {progressMsg || 'Processing...'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {progress}% complete &middot; {formatDuration(elapsed)} elapsed
                </p>
              </div>
              <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                {progress}%
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Synthetic Data Warning Banner */}
      {hasResults && hasSyntheticData && (
        <div className="bg-red-950/50 border border-red-500/40 rounded-lg p-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm">Results based on synthetic (sample) data</p>
            <p className="text-red-400/80 text-xs mt-0.5">
              The Kite API was unavailable during this run, so the backtest used generated sample data instead of real market data.
              These results may not reflect actual market conditions and should not be used for trading decisions.
              Connect a valid Kite access token and re-run for reliable results.
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats Cards */}
      {hasResults && filteredResults.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Total P&L"
            value={formatCurrency(totalPnl)}
            icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
            color={pnlColor(totalPnl)}
            sub={formatPercent(totalPnl > 0 ? (totalPnl / (bestResult?.starting_capital || 50000)) * 100 : 0)}
          />
          <StatCard
            label="Avg Win Rate"
            value={`${avgWinRate.toFixed(1)}%`}
            icon={Target}
            color={avgWinRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}
          />
          <StatCard
            label="Profit Factor"
            value={avgProfitFactor.toFixed(2)}
            icon={BarChart3}
            color={avgProfitFactor >= 1.5 ? 'text-emerald-400' : avgProfitFactor >= 1.0 ? 'text-amber-400' : 'text-red-400'}
          />
          <StatCard
            label="Total Trades"
            value={totalTrades.toString()}
            icon={Activity}
            color="text-zinc-300"
            sub={`${results.length} configs`}
          />
          <StatCard
            label="Max Drawdown"
            value={`${maxDrawdown.toFixed(1)}%`}
            icon={ShieldAlert}
            color={maxDrawdown <= 25 ? 'text-emerald-400' : maxDrawdown <= 40 ? 'text-amber-400' : 'text-red-400'}
          />
          <StatCard
            label="Sharpe Ratio"
            value={avgSharpe.toFixed(2)}
            icon={Zap}
            color={avgSharpe >= 2 ? 'text-emerald-400' : avgSharpe >= 1 ? 'text-amber-400' : 'text-red-400'}
          />
        </div>
      )}

      {/* Results Table */}
      {hasResults && (
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Configuration Results</CardTitle>
                <CardDescription>
                  Click any row to expand and view individual trade details
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* Method filter pills */}
                <div className="flex rounded-lg border border-border/50 overflow-hidden">
                  {(['all', 'a', 'b'] as const).map((m) => (
                    <Button
                      key={m}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 px-3 text-xs rounded-none',
                        activeMethod === m
                          ? 'bg-primary/15 text-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setActiveMethod(m)}
                    >
                      {m === 'all' ? 'All' : m === 'a' ? 'Compounding' : 'Monthly'}
                    </Button>
                  ))}
                </div>
                <Separator orientation="vertical" className="h-6 hidden sm:block" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={expandAll}
                >
                  <Eye className="h-3 w-3" />
                  Expand All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={collapseAll}
                >
                  <EyeOff className="h-3 w-3" />
                  Collapse All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10" />
                    <TableHead className="text-xs">Config</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs text-right">Net P&L</TableHead>
                    <TableHead className="text-xs text-right">P&L %</TableHead>
                    <TableHead className="text-xs text-right">Win Rate</TableHead>
                    <TableHead className="text-xs text-right">PF</TableHead>
                    <TableHead className="text-xs text-right">Trades</TableHead>
                    <TableHead className="text-xs text-right">Max DD%</TableHead>
                    <TableHead className="text-xs text-right">Sharpe</TableHead>
                    <TableHead className="text-xs text-right">Avg R:R</TableHead>
                    <TableHead className="text-xs text-right">Trading Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((r) => {
                    const isExpanded = expandedRows.has(r._key);
                    const tradeCount = r.trades?.length || 0;
                    return (
                      <ExpandableConfigRow
                        key={r._key}
                        result={r}
                        isExpanded={isExpanded}
                        tradeCount={tradeCount}
                        onToggle={() => toggleExpand(r._key)}
                      />
                    );
                  })}
                  {filteredResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        No results match the selected filter
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!hasResults && !isRunning && !initialLoad && (
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Backtest Results</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Configure parameters above and run a backtest to analyze strategy performance
              across multiple configurations and drill into individual trade details.
            </p>
            <Button
              onClick={handleRun}
              size="lg"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <Play className="h-4 w-4" />
              Run First Backtest
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Initial Loading State */}
      {initialLoad && (
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="py-16 flex flex-col items-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Checking backtest status...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Expandable Config Row Component ────────────────────────────
function ExpandableConfigRow({
  result,
  isExpanded,
  tradeCount,
  onToggle,
}: {
  result: FlattenedResult;
  isExpanded: boolean;
  tradeCount: number;
  onToggle: () => void;
}) {
  const methodLabel = result._method === 'a' ? 'Compounding' : 'Monthly';
  const methodColor = result._method === 'a'
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

  return (
    <>
      {/* Main row */}
      <TableRow
        className={cn(
          'cursor-pointer transition-colors',
          isExpanded ? 'bg-muted/20' : 'hover:bg-muted/40',
        )}
        onClick={onToggle}
      >
        <TableCell className="py-3 w-10">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="py-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{result.label}</span>
            {tradeCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {tradeCount} trades
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="py-3">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', methodColor)}>
            {methodLabel}
          </Badge>
        </TableCell>
        <TableCell className={cn('py-3 text-right font-semibold font-mono', pnlColor(result.net_pnl))}>
          {result.net_pnl > 0 ? '+' : ''}{formatCurrency(result.net_pnl)}
        </TableCell>
        <TableCell className={cn('py-3 text-right font-mono text-sm', pnlColor(result.net_pnl_pct))}>
          {formatPercent(result.net_pnl_pct)}
        </TableCell>
        <TableCell className="py-3 text-right">
          <span className={cn(
            'font-medium',
            result.win_rate >= 50 ? 'text-emerald-400' : result.win_rate >= 40 ? 'text-amber-400' : 'text-red-400'
          )}>
            {result.win_rate.toFixed(1)}%
          </span>
        </TableCell>
        <TableCell className="py-3 text-right font-mono text-sm">
          <span className={cn(
            result.profit_factor >= 1.5 ? 'text-emerald-400' :
            result.profit_factor >= 1.0 ? 'text-amber-400' : 'text-red-400'
          )}>
            {result.profit_factor.toFixed(2)}
          </span>
        </TableCell>
        <TableCell className="py-3 text-right text-sm">{result.total_trades}</TableCell>
        <TableCell className="py-3 text-right">
          <span className={cn(
            'text-sm font-mono',
            result.max_dd_pct <= 25 ? 'text-emerald-400' :
            result.max_dd_pct <= 40 ? 'text-amber-400' : 'text-red-400'
          )}>
            {result.max_dd_pct.toFixed(1)}%
          </span>
        </TableCell>
        <TableCell className="py-3 text-right">
          <span className={cn(
            'font-mono text-sm',
            result.sharpe_approx >= 2 ? 'text-emerald-400' :
            result.sharpe_approx >= 1 ? 'text-amber-400' : 'text-red-400'
          )}>
            {result.sharpe_approx.toFixed(2)}
          </span>
        </TableCell>
        <TableCell className="py-3 text-right font-mono text-sm">
          {result.avg_rr?.toFixed(2) ?? '—'}
        </TableCell>
        <TableCell className="py-3 text-right text-sm">
          {result.trading_days ?? '—'}
        </TableCell>
      </TableRow>

      {/* Expanded trade details */}
      {isExpanded && (
        <TableRow
          className="bg-muted/10 hover:bg-muted/10"
          onClick={(e) => e.stopPropagation()}
        >
          <TableCell colSpan={12} className="p-0 border-0">
            <div className="border-l-2 border-emerald-500/30 ml-5 my-1">
              {/* Config detail summary */}
              <div className="px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 text-xs border-b border-border/30">
                <span>
                  <span className="text-muted-foreground">Gross Profit: </span>
                  <span className="text-emerald-400 font-mono">
                    {formatCurrency(result.gross_profit ?? 0)}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Gross Loss: </span>
                  <span className="text-red-400 font-mono">
                    {formatCurrency(result.gross_loss ?? 0)}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Costs: </span>
                  <span className="font-mono">{formatCurrency(result.total_costs ?? 0)}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Avg Win: </span>
                  <span className="text-emerald-400 font-mono">
                    {formatCurrency(result.avg_win ?? 0)}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Avg Loss: </span>
                  <span className="text-red-400 font-mono">
                    {formatCurrency(result.avg_loss ?? 0)}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Long: </span>
                  {result.long_trades ?? 0} ({(result.long_wr ?? 0).toFixed(1)}%)
                </span>
                <span>
                  <span className="text-muted-foreground">Short: </span>
                  {result.short_trades ?? 0} ({(result.short_wr ?? 0).toFixed(1)}%)
                </span>
                <span>
                  <span className="text-muted-foreground">Capital: </span>
                  {formatCurrency(result.starting_capital ?? 50000)} → {formatCurrency(result.final_capital ?? 0)}
                </span>
                {result.exit_reasons && Object.keys(result.exit_reasons).length > 0 && (
                  <span>
                    <span className="text-muted-foreground">Exits: </span>
                    {Object.entries(result.exit_reasons).map(([reason, count]) => (
                      <Badge
                        key={reason}
                        variant={exitReasonVariant(reason)}
                        className="text-[9px] px-1 py-0 mx-0.5"
                      >
                        {reason}: {count}
                      </Badge>
                    ))}
                  </span>
                )}
              </div>

              {/* Individual trades table */}
              {result.trades && result.trades.length > 0 ? (
                <TradeDetailTable trades={result.trades} />
              ) : (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  No individual trade details available. Trade details are returned when the backend includes the trades array.
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
