'use client';

/**
 * DDLJ Trading System — Backtest Page
 * ========================================
 * Professional backtest results viewer with expandable trade details,
 * summary metric cards, and real-time progress streaming.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type BacktestConfigResult,
  type BacktestTradeDetail,
  type BacktestStatusResult,
  backtestApi,
} from '@/lib/api';
import { cn, formatCurrency, pnlColor, formatPercent, formatDuration } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
                  ₹{t.entry_price.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono">
                  ₹{t.exit_price.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono text-red-400/80">
                  ₹{t.sl.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono text-emerald-400/80">
                  ₹{t.target.toLocaleString('en-IN')}
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

// ── Main Backtest Page Component ───────────────────────────────
export default function BacktestPage() {
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<FlattenedResult[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [maxDailyTradesEnabled, setMaxDailyTradesEnabled] = useState(true);
  const [maxDailyTrades, setMaxDailyTrades] = useState(4);
  const [activeMethod, setActiveMethod] = useState<'all' | 'a' | 'b'>('all');
  const [hasResults, setHasResults] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

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

  // Check initial status on mount
  useEffect(() => {
    const checkInitial = async () => {
      try {
        const status = await backtestApi.getStatus();
        if (status.status === 'completed' && status.last_results) {
          setResults(flattenResults(status));
          setHasResults(true);
          setProgress(100);
          setProgressMsg('Results loaded from previous run');
        } else if (status.status === 'running') {
          setIsRunning(true);
          setProgress(status.progress || 0);
          setProgressMsg(status.message || 'Running...');
          startTimeRef.current = Date.now() - (status.elapsed_seconds || 0) * 1000;
          startPolling();
        }
      } catch {
        // Silently ignore — backend may be unreachable
      } finally {
        setInitialLoad(false);
      }
    };
    checkInitial();
  }, [flattenResults]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  // Start polling for status
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);

    startTimeRef.current = Date.now();

    elapsedRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const status = await backtestApi.getStatus();
        setProgress(status.progress || 0);
        setProgressMsg(status.message || '');

        if (status.status === 'completed' && status.last_results) {
          setResults(flattenResults(status));
          setHasResults(true);
          setIsRunning(false);
          if (pollRef.current) clearInterval(pollRef.current);
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          setProgress(100);
          toast.success('Backtest completed', {
            description: `${(status.last_results?.configs_tested || 0)} configurations tested`,
          });
        } else if (status.status === 'running') {
          // Still running, keep polling
        } else if (status.status === 'no_results') {
          // Not running and no results — stop
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 1500);
  }, [flattenResults]);

  // Run backtest
  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress(0);
    setProgressMsg('Starting backtest...');
    setElapsed(0);
    setExpandedRows(new Set());

    try {
      await backtestApi.run({
        max_daily_trades_enabled: maxDailyTradesEnabled,
      });
      startPolling();
      toast.info('Backtest started', {
        description: 'Polling for progress...',
      });
    } catch (err) {
      setIsRunning(false);
      toast.error('Failed to start backtest', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [isRunning, maxDailyTradesEnabled, startPolling]);

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
            Run strategy backtests across multiple configurations and analyze individual trade details
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

      {/* Configuration Panel */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuration</CardTitle>
          <CardDescription>Backtest parameters — changes apply on next run</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-6">
            {/* Max Daily Trades Switch */}
            <div className="flex items-center gap-3">
              <Switch
                checked={maxDailyTradesEnabled}
                onCheckedChange={setMaxDailyTradesEnabled}
                id="max-daily-trades-switch"
              />
              <label
                htmlFor="max-daily-trades-switch"
                className="text-sm font-medium cursor-pointer select-none"
              >
                Max Daily Trades
              </label>
              {maxDailyTradesEnabled ? (
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={maxDailyTrades}
                  onChange={(e) => setMaxDailyTrades(parseInt(e.target.value) || 1)}
                  className="w-20 h-8 text-center text-sm"
                />
              ) : (
                <span className="text-sm text-muted-foreground italic">Unlimited</span>
              )}
            </div>

            {/* Method filter */}
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Method:</span>
              <div className="flex rounded-lg border border-border/50 overflow-hidden">
                {(['all', 'a', 'b'] as const).map((method) => (
                  <Button
                    key={method}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 px-3 text-xs rounded-none',
                      activeMethod === method
                        ? 'bg-primary/15 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setActiveMethod(method)}
                  >
                    {method === 'all' ? 'All' : method === 'a' ? 'Compounding' : 'Monthly'}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
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
              Run a backtest to analyze strategy performance across multiple configurations
              and drill into individual trade details.
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
