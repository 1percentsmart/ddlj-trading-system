'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FlaskConical,
  Play,
  Circle,
  Loader2,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Settings2,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { backtestApi, type BacktestConfigResult, type BacktestRunParams } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────

type BtStatus = 'idle' | 'running' | 'completed' | 'error';
type SymbolOption = 'BANKNIFTY' | 'NIFTY' | 'both';
type TimeframeOption = '15m/60m' | '15m/15m' | '5m/60m' | 'all';
type MethodOption = 'method_a' | 'method_b' | 'both';
type MoneynessOption = 'ITM' | 'ATM' | 'DEEP_ITM';

interface FlattenedResult {
  key: string;
  method: string;
  config: BacktestConfigResult;
}

// ── Default backtest params (matching engine/config.py) ───────────

const DEFAULT_PARAMS = {
  capital: 50000,
  sl_atr: 2.0,
  min_rr: 1.5,
  daily_risk_pct: 6.0,
  max_open_positions: 2,
  max_daily_trades: 4,
};

const DEFAULT_FROM_DATE = '2025-11-01';
const DEFAULT_TO_DATE = '2026-04-25';

// ── Helpers ──────────────────────────────────────────────────────

function flattenResults(
  methodATop: Record<string, BacktestConfigResult>,
  methodBTop: Record<string, BacktestConfigResult>
): FlattenedResult[] {
  const a = Object.entries(methodATop).map(([key, config]) => ({
    key,
    method: 'Compounding (A)',
    config,
  }));
  const b = Object.entries(methodBTop).map(([key, config]) => ({
    key,
    method: 'Monthly Batch (B)',
    config,
  }));
  return [...a, ...b].sort((a, b) => b.config.net_pnl - a.config.net_pnl);
}

function sharpeColor(val: number): string {
  if (val >= 2) return 'text-emerald-400';
  if (val >= 1) return 'text-emerald-300';
  if (val >= 0.5) return 'text-amber-400';
  return 'text-red-400';
}

function ddColor(val: number): string {
  if (val <= 5) return 'text-emerald-400';
  if (val <= 15) return 'text-amber-400';
  return 'text-red-400';
}

// ── No Results State ─────────────────────────────────────────────

function NoResultsState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted/50 p-4">
        <BarChart3 className="size-10 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold text-muted-foreground">
        No Backtest Results Yet
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground/70">
        Configure the backtest parameters above and click &ldquo;Run Backtest&rdquo;
        to evaluate strategy performance against historical data.
      </p>
    </div>
  );
}

// ── Running State ────────────────────────────────────────────────

function RunningState() {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="relative mb-4">
          <Loader2 className="size-10 animate-spin text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-amber-400">
          Backtest is running...
        </h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The engine is processing historical data with your parameters.
          Results will appear automatically once complete.
        </p>
        <Progress className="mt-4 h-1.5 w-64" value={undefined} />
        <p className="mt-2 text-xs text-muted-foreground/60">
          Polling for status every 15 seconds
        </p>
      </CardContent>
    </Card>
  );
}

// ── Results Table ────────────────────────────────────────────────

function ResultsTable({ results }: { results: FlattenedResult[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="size-4 text-emerald-400" />
          Backtest Results
          <Badge variant="secondary" className="ml-1 text-[10px]">
            {results.length} config{results.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Sorted by Net P&L (descending) across all methods
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Config</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Net P&L</TableHead>
                <TableHead className="text-right">P&L %</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Profit Factor</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Max DD %</TableHead>
                <TableHead className="text-right pr-4">Sharpe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => {
                const c = r.config;
                return (
                  <TableRow key={r.key}>
                    <TableCell className="pl-4 font-medium text-sm">
                      {c.label || r.key}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] border-0',
                          r.method.includes('A')
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-purple-500/10 text-purple-400'
                        )}
                      >
                        {r.method}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        pnlColor(c.net_pnl)
                      )}
                    >
                      {c.net_pnl >= 0 ? '+' : ''}
                      {formatCurrency(c.net_pnl)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        pnlColor(c.net_pnl_pct)
                      )}
                    >
                      {c.net_pnl_pct >= 0 ? '+' : ''}
                      {c.net_pnl_pct.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.win_rate.toFixed(1)}%
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        c.profit_factor >= 1.5
                          ? 'text-emerald-400'
                          : c.profit_factor >= 1
                            ? 'text-amber-400'
                            : 'text-red-400'
                      )}
                    >
                      {c.profit_factor.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.total_trades}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        ddColor(c.max_dd_pct)
                      )}
                    >
                      {c.max_dd_pct.toFixed(2)}%
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums pr-4',
                        sharpeColor(c.sharpe_approx)
                      )}
                    >
                      {c.sharpe_approx.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Backtest Page ───────────────────────────────────────────

export default function BacktestPage() {
  const {
    engineStatus,
    isConnected,
    backtestStatus,
    fetchBacktestStatus,
  } = useDDLJStore();

  // ── Local State ──────────────────────────────────────────────
  const [symbol, setSymbol] = useState<SymbolOption>('BANKNIFTY');
  const [timeframe, setTimeframe] = useState<TimeframeOption>('15m/60m');
  const [method, setMethod] = useState<MethodOption>('both');
  const [fromDate, setFromDate] = useState(DEFAULT_FROM_DATE);
  const [toDate, setToDate] = useState(DEFAULT_TO_DATE);
  const [capital, setCapital] = useState(DEFAULT_PARAMS.capital.toString());
  const [slAtr, setSlAtr] = useState(DEFAULT_PARAMS.sl_atr.toString());
  const [minRr, setMinRr] = useState(DEFAULT_PARAMS.min_rr.toString());
  const [dailyRiskPct, setDailyRiskPct] = useState(DEFAULT_PARAMS.daily_risk_pct.toString());
  const [maxOpenPositions, setMaxOpenPositions] = useState(DEFAULT_PARAMS.max_open_positions.toString());
  const [maxDailyTrades, setMaxDailyTrades] = useState(DEFAULT_PARAMS.max_daily_trades.toString());
  const [moneyness, setMoneyness] = useState<MoneynessOption>('ITM');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [errorFlag, setErrorFlag] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Token validity ───────────────────────────────────────────
  const tokenValid = engineStatus.token.valid;

  // ── Computed results ─────────────────────────────────────────
  const flattenedResults = useMemo(() => {
    if (!backtestStatus?.last_results) return [];
    return flattenResults(
      backtestStatus.last_results.method_a_top,
      backtestStatus.last_results.method_b_top
    );
  }, [backtestStatus]);

  const hasResults = flattenedResults.length > 0;

  // ── Derive btStatus ──
  const btStatus: BtStatus = useMemo(() => {
    if (errorFlag) return 'error';
    if (isRunning) return 'running';
    if (backtestStatus?.last_results) return 'completed';
    return 'idle';
  }, [isRunning, errorFlag, backtestStatus]);

  // ── Fetch on mount ───────────────────────────────────────────
  useEffect(() => {
    fetchBacktestStatus();
  }, [fetchBacktestStatus]);

  // ── Polling logic ────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        await fetchBacktestStatus();
        const latest = await backtestApi.getStatus();
        if (latest.status === 'completed' || latest.status === 'error' || latest.status === 'no_results') {
          setIsRunning(false);
          setErrorFlag(latest.status === 'error');
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          if (latest.last_results) {
            toast.success('Backtest completed! Results are ready.');
          } else if (latest.status === 'error') {
            toast.error('Backtest failed. Check backend logs.');
          } else {
            toast.info('Backtest finished with no results.');
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 15_000);
  }, [fetchBacktestStatus]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── Cleanup polling on unmount ───────────────────────────────
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Reset params to defaults ────────────────────────────────
  const handleResetParams = useCallback(() => {
    setFromDate(DEFAULT_FROM_DATE);
    setToDate(DEFAULT_TO_DATE);
    setCapital(DEFAULT_PARAMS.capital.toString());
    setSlAtr(DEFAULT_PARAMS.sl_atr.toString());
    setMinRr(DEFAULT_PARAMS.min_rr.toString());
    setDailyRiskPct(DEFAULT_PARAMS.daily_risk_pct.toString());
    setMaxOpenPositions(DEFAULT_PARAMS.max_open_positions.toString());
    setMaxDailyTrades(DEFAULT_PARAMS.max_daily_trades.toString());
    setMoneyness('ITM');
    setSymbol('BANKNIFTY');
    setTimeframe('15m/60m');
    setMethod('both');
    toast.info('Parameters reset to defaults');
  }, []);

  // ── Handle run backtest ──────────────────────────────────────
  const handleRunBacktest = useCallback(async () => {
    try {
      setIsRunning(true);
      setErrorFlag(false);

      const params: BacktestRunParams = {
        symbol,
        timeframe,
        method,
        from_date: fromDate,
        to_date: toDate,
        capital: parseFloat(capital) || DEFAULT_PARAMS.capital,
        sl_atr: parseFloat(slAtr) || DEFAULT_PARAMS.sl_atr,
        min_rr: parseFloat(minRr) || DEFAULT_PARAMS.min_rr,
        moneyness,
        daily_risk_pct: parseFloat(dailyRiskPct) || DEFAULT_PARAMS.daily_risk_pct,
        max_open_positions: parseInt(maxOpenPositions) || DEFAULT_PARAMS.max_open_positions,
        max_daily_trades: parseInt(maxDailyTrades) || DEFAULT_PARAMS.max_daily_trades,
      };

      toast.info('Backtest started. This may take a few minutes...');
      await backtestApi.run(params);
      startPolling();
    } catch (err) {
      setIsRunning(false);
      setErrorFlag(true);
      toast.error(
        `Backtest failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      stopPolling();
    }
  }, [startPolling, stopPolling, symbol, timeframe, method, fromDate, toDate,
      capital, slAtr, minRr, moneyness, dailyRiskPct, maxOpenPositions, maxDailyTrades]);

  // ── Run button disabled logic ────────────────────────────────
  const runDisabled = !tokenValid || !isConnected || isRunning;

  // ── Params used in last backtest (from backend response) ────
  const paramsUsed = backtestStatus?.last_results?.params_used;

  return (
    <div className="page-enter space-y-6">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <FlaskConical className="size-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Backtest</h1>
            <p className="text-xs text-muted-foreground">
              Evaluate strategy performance against historical data
            </p>
          </div>
        </div>

        {/* Status badge */}
        <Badge
          variant="outline"
          className={cn(
            'gap-1.5 border-0 text-xs',
            btStatus === 'running'
              ? 'bg-amber-500/10 text-amber-400'
              : btStatus === 'completed'
                ? 'bg-emerald-500/10 text-emerald-400'
                : btStatus === 'error'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-zinc-500/10 text-zinc-400'
          )}
        >
          {btStatus === 'running' && <Loader2 className="size-3 animate-spin" />}
          {btStatus === 'completed' && <CheckCircle2 className="size-3" />}
          {btStatus === 'error' && <AlertTriangle className="size-3" />}
          {btStatus === 'idle' && <Clock className="size-3" />}
          {btStatus === 'idle'
            ? 'Ready'
            : btStatus === 'running'
              ? 'Running'
              : btStatus === 'completed'
                ? 'Completed'
                : 'Error'}
        </Badge>
      </div>

      {/* ── Backtest Configuration Card ──────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="size-4" />
            Configuration
          </CardTitle>
          <CardDescription>
            Set up the parameters for the backtest run. Date range, strategy
            parameters, and risk settings are all configurable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* ── Row 1: Symbol, Timeframe, Method ─────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Symbol */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Symbol
              </label>
              <Select
                value={symbol}
                onValueChange={(v) => setSymbol(v as SymbolOption)}
                disabled={isRunning}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select symbol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANKNIFTY">BankNifty</SelectItem>
                  <SelectItem value="NIFTY">Nifty</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Timeframe */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Timeframe
              </label>
              <Select
                value={timeframe}
                onValueChange={(v) => setTimeframe(v as TimeframeOption)}
                disabled={isRunning}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15m/60m">15m / 60m (Recommended)</SelectItem>
                  <SelectItem value="15m/15m">15m / 15m</SelectItem>
                  <SelectItem value="5m/60m">5m / 60m</SelectItem>
                  <SelectItem value="all">All Combinations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Method */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Method
              </label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as MethodOption)}
                disabled={isRunning}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="method_a">Compounding (Method A)</SelectItem>
                  <SelectItem value="method_b">Monthly Batch (Method B)</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* ── Row 2: Date Range ──────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date Range
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="from-date" className="text-xs text-muted-foreground">From Date</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={isRunning}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to-date" className="text-xs text-muted-foreground">To Date</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={isRunning}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Row 3: Strategy Parameters ─────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Strategy Parameters
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="capital" className="text-xs text-muted-foreground">Starting Capital (₹)</Label>
                <Input
                  id="capital"
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  disabled={isRunning}
                  className="font-mono text-sm"
                  min="10000"
                  step="10000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-atr" className="text-xs text-muted-foreground">SL ATR Multiplier</Label>
                <Input
                  id="sl-atr"
                  type="number"
                  value={slAtr}
                  onChange={(e) => setSlAtr(e.target.value)}
                  disabled={isRunning}
                  className="font-mono text-sm"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min-rr" className="text-xs text-muted-foreground">Min Risk:Reward</Label>
                <Input
                  id="min-rr"
                  type="number"
                  value={minRr}
                  onChange={(e) => setMinRr(e.target.value)}
                  disabled={isRunning}
                  className="font-mono text-sm"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="moneyness" className="text-xs text-muted-foreground">Option Moneyness</Label>
                <Select
                  value={moneyness}
                  onValueChange={(v) => setMoneyness(v as MoneynessOption)}
                  disabled={isRunning}
                >
                  <SelectTrigger id="moneyness">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ITM">ITM (In-The-Money)</SelectItem>
                    <SelectItem value="ATM">ATM (At-The-Money)</SelectItem>
                    <SelectItem value="DEEP_ITM">Deep ITM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── Advanced Risk Parameters (collapsible) ────────────── */}
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings2 className="size-3.5" />
              {showAdvanced ? 'Hide' : 'Show'} Risk Parameters
            </Button>

            {showAdvanced && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="daily-risk" className="text-xs text-muted-foreground">Daily Risk %</Label>
                  <Input
                    id="daily-risk"
                    type="number"
                    value={dailyRiskPct}
                    onChange={(e) => setDailyRiskPct(e.target.value)}
                    disabled={isRunning}
                    className="font-mono text-sm"
                    min="1"
                    max="15"
                    step="0.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max-positions" className="text-xs text-muted-foreground">Max Open Positions</Label>
                  <Input
                    id="max-positions"
                    type="number"
                    value={maxOpenPositions}
                    onChange={(e) => setMaxOpenPositions(e.target.value)}
                    disabled={isRunning}
                    className="font-mono text-sm"
                    min="1"
                    max="5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max-trades" className="text-xs text-muted-foreground">Max Daily Trades</Label>
                  <Input
                    id="max-trades"
                    type="number"
                    value={maxDailyTrades}
                    onChange={(e) => setMaxDailyTrades(e.target.value)}
                    disabled={isRunning}
                    className="font-mono text-sm"
                    min="1"
                    max="10"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Action row ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {/* Token validity badge */}
              <Badge
                variant="outline"
                className={cn(
                  'gap-1.5 border-0 text-xs',
                  tokenValid
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                )}
              >
                <Circle
                  className={cn(
                    'size-2',
                    tokenValid ? 'fill-emerald-400' : 'fill-red-400'
                  )}
                />
                {tokenValid ? 'Token Valid' : 'Token Invalid'}
              </Badge>

              {/* Date range summary */}
              <span className="text-xs text-muted-foreground font-mono">
                {fromDate} → {toDate}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Reset button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleResetParams}
                disabled={isRunning}
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>

              {/* Run Backtest button */}
              <Button
                className={cn(
                  'gap-2 min-w-[160px]',
                  !runDisabled && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                )}
                onClick={handleRunBacktest}
                disabled={runDisabled}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-current" />
                    Run Backtest
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ── Disabled reasons ─────────────────────────────────── */}
          {runDisabled && !isRunning && (
            <div className="flex flex-wrap gap-2">
              {!isConnected && (
                <Badge variant="destructive" className="text-[10px] gap-1">
                  <AlertTriangle className="size-3" /> Not connected to backend
                </Badge>
              )}
              {!tokenValid && (
                <Badge variant="destructive" className="text-[10px] gap-1">
                  <AlertTriangle className="size-3" /> Token is invalid or missing
                </Badge>
              )}
            </div>
          )}

          {/* ── Info note ────────────────────────────────────────── */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              The backtest replays historical candle data for the selected symbol and timeframe,
              applying the DDLJ strategy with both Compounding (Method A) and Monthly Batch
              (Method B) approaches. All parameters above are passed directly to the engine.
              Ensure your Kite token is valid before running.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Results Section ──────────────────────────────────────── */}
      {btStatus === 'running' && !hasResults && <RunningState />}

      {btStatus !== 'running' && hasResults && (
        <ResultsTable results={flattenedResults} />
      )}

      {/* Summary card when we have results */}
      {hasResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Summary</CardTitle>
              {paramsUsed && (
                <Badge variant="outline" className="text-[10px] border-0 bg-muted/50">
                  {Object.entries(paramsUsed).length} params configured
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Best P&L */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Best Net P&L</p>
                <div className="flex items-center gap-1.5">
                  {flattenedResults[0].config.net_pnl >= 0 ? (
                    <TrendingUp className={cn('size-4', pnlColor(flattenedResults[0].config.net_pnl))} />
                  ) : (
                    <TrendingDown className={cn('size-4', pnlColor(flattenedResults[0].config.net_pnl))} />
                  )}
                  <span className={cn('text-lg font-bold', pnlColor(flattenedResults[0].config.net_pnl))}>
                    {formatCurrency(flattenedResults[0].config.net_pnl)}
                  </span>
                </div>
              </div>

              {/* Configs tested */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Configs Tested</p>
                <span className="text-lg font-bold">
                  {backtestStatus?.last_results?.configs_tested ?? '—'}
                </span>
              </div>

              {/* Best Win Rate */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Best Win Rate</p>
                <span className="text-lg font-bold text-emerald-400">
                  {flattenedResults.length > 0
                    ? Math.max(...flattenedResults.map((r) => r.config.win_rate)).toFixed(1)
                    : '—'}%
                </span>
              </div>

              {/* Best Sharpe */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Best Sharpe</p>
                <span className={cn('text-lg font-bold', sharpeColor(
                  flattenedResults.length > 0
                    ? Math.max(...flattenedResults.map((r) => r.config.sharpe_approx))
                    : 0
                ))}>
                  {flattenedResults.length > 0
                    ? Math.max(...flattenedResults.map((r) => r.config.sharpe_approx)).toFixed(2)
                    : '—'}
                </span>
              </div>
            </div>

            {/* Params used badge */}
            {paramsUsed && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {Object.entries(paramsUsed).map(([key, val]) => (
                  <Badge key={key} variant="outline" className="text-[10px] border-0 bg-muted/40 font-mono">
                    {key}: {String(val)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {btStatus !== 'running' && !hasResults && <NoResultsState />}

      {/* ── Error state ──────────────────────────────────────────── */}
      {btStatus === 'error' && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="size-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">Backtest Failed</p>
              <p className="text-xs text-muted-foreground">
                The backtest encountered an error. Check the backend logs for details
                and ensure your token is valid.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
