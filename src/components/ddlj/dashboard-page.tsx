'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Circle,
  Play,
  Square,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronRight,
  RefreshCw,
  Loader2,
  Rocket,
  Zap,
  Settings,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatDateTime } from '@/lib/utils';
import type { Trade, Position } from '@/lib/api';

// ── Helpers ──────────────────────────────────────────────────────

function getISTTime(): string {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function isToday(isoString: string): boolean {
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

// ── KPI Computation ──────────────────────────────────────────────

interface KPIData {
  totalPnl: number;
  dayPnl: number;
  winRate: number;
  openPositions: number;
  totalWins: number;
  totalTrades: number;
}

function computeKPIs(trades: Trade[], positions: Position[]): KPIData {
  const totalPnl = trades.reduce((sum, t) => sum + t.net, 0);
  const dayPnl = trades.filter((t) => isToday(t.exit_time)).reduce((sum, t) => sum + t.net, 0);
  const wins = trades.filter((t) => t.net > 0).length;
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  return {
    totalPnl,
    dayPnl,
    winRate,
    openPositions: positions.length,
    totalWins: wins,
    totalTrades,
  };
}

// ── Equity Curve Data ────────────────────────────────────────────

interface EquityPoint {
  time: string;
  pnl: number;
  label: string;
}

function buildEquityCurve(trades: Trade[]): EquityPoint[] {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.exit_time).getTime() - new Date(b.exit_time).getTime()
  );
  let cumulative = 0;
  return sorted.map((t) => {
    cumulative += t.net;
    return {
      time: t.exit_time,
      pnl: Math.round(cumulative * 100) / 100,
      label: formatDateTime(t.exit_time),
    };
  });
}

// ── Custom Tooltip for Equity Chart ──────────────────────────────

function EquityTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: EquityPoint }> }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{data.label}</p>
      <p className={cn('text-sm font-semibold', pnlColor(data.pnl))}>
        {formatCurrency(data.pnl)}
      </p>
    </div>
  );
}

// ── Position Row ─────────────────────────────────────────────────

function PositionRow({ position }: { position: Position }) {
  const isLong = position.direction === 'LONG';
  const pnlVal = position.unrealized_pnl ?? 0;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2.5 transition-colors hover:bg-accent/50">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
            isLong
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          )}
        >
          {isLong ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {position.direction}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{position.symbol}</p>
          <p className="text-xs text-muted-foreground">
            {position.option_type
              ? `${position.option_strike} ${position.option_type}`
              : `₹${position.entry.toLocaleString('en-IN')}`}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        {position.unrealized_pnl !== undefined ? (
          <p className={cn('text-sm font-semibold', pnlColor(pnlVal))}>
            {formatCurrency(pnlVal)}
          </p>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">—</p>
        )}
        <p className="text-xs text-muted-foreground">
          Qty: {position.qty} &middot; {position.held}
        </p>
      </div>
    </div>
  );
}

// ── Trade Row ────────────────────────────────────────────────────

function TradeRow({ trade }: { trade: Trade }) {
  const isLong = trade.direction === 'LONG';

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2.5 transition-colors hover:bg-accent/50">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
            isLong
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          )}
        >
          {isLong ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {trade.direction}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{trade.symbol}</p>
          <p className="text-xs text-muted-foreground">
            {trade.option_type
              ? `${trade.option_strike} ${trade.option_type}`
              : trade.exit_reason}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-sm font-semibold', pnlColor(trade.net))}>
          {formatCurrency(trade.net)}
        </p>
        <p className="text-xs text-muted-foreground">
          RR {trade.rr.toFixed(1)} &middot; {trade.held}
        </p>
      </div>
    </div>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────────

export default function DashboardPage() {
  const {
    engineStatus,
    trades,
    positions,
    isConnected,
    isEngineLoading,
    dataFetched,
    setFetched,
    fetchStatus,
    fetchTrades,
    fetchPositions,
    startEngine,
    stopEngine,
    setActivePage,
  } = useDDLJStore();

  const [istTime, setIstTime] = useState(getISTTime);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // FIX: Use dataFetched flag instead of checking if arrays are empty
  const isLoading = !dataFetched;

  // ── IST clock ────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setIstTime(getISTTime), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Initial data fetch ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await Promise.allSettled([fetchStatus(), fetchTrades(), fetchPositions()]);
        if (!cancelled) setFetched();
      } catch {
        if (!cancelled) setLoadError('Failed to load dashboard data. Please try again.');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fetchStatus, fetchTrades, fetchPositions, setFetched]);

  // ── Auto-refresh every 30s ───────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      fetchTrades();
      fetchPositions();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchTrades, fetchPositions]);

  // ── Computed data ────────────────────────────────────────────
  const kpis = useMemo(() => computeKPIs(trades, positions), [trades, positions]);
  const equityData = useMemo(() => buildEquityCurve(trades), [trades]);
  const recentTrades = useMemo(() => {
    const sorted = [...trades].sort(
      (a, b) => new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime()
    );
    return sorted.slice(0, 8);
  }, [trades]);
  const openPositions = useMemo(() => positions.slice(0, 8), [positions]);

  // Determine equity curve gradient color based on latest P&L
  const isProfitable = equityData.length > 0 ? equityData[equityData.length - 1].pnl >= 0 : true;
  const gradientId = isProfitable ? 'equityGradientProfit' : 'equityGradientLoss';
  const strokeColor = isProfitable ? '#10b981' : '#ef4444';

  // ── Handlers ─────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      await Promise.allSettled([fetchStatus(), fetchTrades(), fetchPositions()]);
      toast.success('Dashboard refreshed');
    } catch {
      setLoadError('Refresh failed. Please try again.');
      toast.error('Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchStatus, fetchTrades, fetchPositions]);

  const handleEngineToggle = useCallback(async () => {
    try {
      if (engineStatus.engine_running) {
        await stopEngine();
        toast.success('Engine stopped');
      } else {
        await startEngine();
        toast.success('Engine started');
      }
    } catch {
      toast.error('Engine operation failed');
    }
  }, [engineStatus.engine_running, startEngine, stopEngine]);

  // ── Skeleton loading (only during first fetch) ──────────────
  if (isLoading) {
    return (
      <div className="page-enter space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-52" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-4 w-40" />
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="page-enter space-y-6">
      {/* ── Error Banner ─────────────────────────────────────── */}
      {loadError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <Circle className="size-4 fill-red-400 text-red-400" />
          <p className="text-sm font-medium text-red-400">{loadError}</p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => setLoadError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* ── Header Row ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Trading Dashboard</h1>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 border-0',
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            )}
          >
            <Circle className={cn('size-2', isConnected ? 'fill-emerald-400' : 'fill-red-400')} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>

          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 border-0',
              engineStatus.engine_running
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-zinc-500/10 text-zinc-400'
            )}
          >
            {engineStatus.engine_running ? (
              <Play className="size-3 fill-emerald-400" />
            ) : (
              <Square className="size-3" />
            )}
            {engineStatus.engine_running ? 'Engine Running' : 'Engine Stopped'}
          </Badge>

          <Badge variant="outline" className="gap-1.5 border-0 bg-zinc-500/10 text-zinc-400">
            <Clock className="size-3" />
            {istTime} IST
          </Badge>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {kpis.totalPnl >= 0 ? (
                <TrendingUp className={cn('size-5', pnlColor(kpis.totalPnl))} />
              ) : (
                <TrendingDown className={cn('size-5', pnlColor(kpis.totalPnl))} />
              )}
              <span className={cn('text-2xl font-bold tracking-tight', pnlColor(kpis.totalPnl))}>
                {formatCurrency(kpis.totalPnl)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpis.totalTrades} trade{kpis.totalTrades !== 1 ? 's' : ''} &middot; {kpis.totalWins} win{kpis.totalWins !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Day P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {kpis.dayPnl >= 0 ? (
                <TrendingUp className={cn('size-5', pnlColor(kpis.dayPnl))} />
              ) : (
                <TrendingDown className={cn('size-5', pnlColor(kpis.dayPnl))} />
              )}
              <span className={cn('text-2xl font-bold tracking-tight', pnlColor(kpis.dayPnl))}>
                {formatCurrency(kpis.dayPnl)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Today&apos;s closed trades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-2xl font-bold tracking-tight',
                  kpis.winRate >= 50 ? 'text-emerald-400' : kpis.winRate > 0 ? 'text-amber-400' : 'text-zinc-400'
                )}
              >
                {kpis.totalTrades > 0 ? `${kpis.winRate.toFixed(1)}%` : '—'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpis.totalWins} / {kpis.totalTrades} profitable
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Open Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight">
                {kpis.openPositions}
              </span>
              {kpis.openPositions > 0 && (
                <Badge variant="secondary" className="text-[10px]">Active</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpis.openPositions === 0 ? 'No open positions' : 'Currently in market'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Engine Control + Quick Actions ────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Engine Control */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Engine Control</CardTitle>
            <CardAction>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Circle
                    className={cn(
                      'size-2',
                      engineStatus.token.valid ? 'fill-emerald-400 text-emerald-400' : 'fill-amber-400 text-amber-400'
                    )}
                  />
                  <span className="text-xs text-muted-foreground">
                    {engineStatus.token.valid ? 'Token Valid' : 'Token Invalid'}
                  </span>
                </div>
                {engineStatus.error_count > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <Badge variant="destructive" className="text-[10px]">
                      {engineStatus.error_count} error{engineStatus.error_count !== 1 ? 's' : ''}
                    </Badge>
                  </>
                )}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                variant={engineStatus.engine_running ? 'destructive' : 'default'}
                className={cn(
                  'gap-2 min-w-[120px]',
                  !engineStatus.engine_running && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                )}
                onClick={handleEngineToggle}
                disabled={isEngineLoading}
              >
                {isEngineLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : engineStatus.engine_running ? (
                  <Square className="size-4" />
                ) : (
                  <Play className="size-4 fill-current" />
                )}
                {isEngineLoading
                  ? 'Loading...'
                  : engineStatus.engine_running
                    ? 'Stop Engine'
                    : 'Start Engine'}
              </Button>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Circle
                    className={cn(
                      'size-3',
                      engineStatus.engine_running
                        ? 'fill-emerald-400 text-emerald-400'
                        : 'fill-zinc-500 text-zinc-500'
                    )}
                  />
                  {engineStatus.engine_running && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {engineStatus.engine_running ? 'Running' : 'Stopped'}
                  {engineStatus.last_heartbeat && (
                    <> &middot; Last heartbeat {formatDateTime(engineStatus.last_heartbeat)}</>
                  )}
                </span>
              </div>
            </div>

            {/* FIX: Empty state CTA when engine is off and no data */}
            {!engineStatus.engine_running && trades.length === 0 && positions.length === 0 && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-border/60 bg-secondary/20 px-4 py-3">
                <Rocket className="size-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Start the engine with a valid Kite token to begin paper trading.
                  Trades and positions will appear here automatically.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
              onClick={() => setActivePage('engine')}
            >
              <Zap className="size-3.5 text-amber-400" />
              Engine Control
              <ChevronRight className="size-3 ml-auto text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
              onClick={() => setActivePage('trades')}
            >
              <BarChart3 className="size-3.5 text-emerald-400" />
              View All Trades
              <ChevronRight className="size-3 ml-auto text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
              onClick={() => setActivePage('config')}
            >
              <Settings className="size-3.5 text-zinc-400" />
              Edit Configuration
              <ChevronRight className="size-3 ml-auto text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
              onClick={() => setActivePage('risk')}
            >
              <TrendingDown className="size-3.5 text-red-400" />
              Risk Dashboard
              <ChevronRight className="size-3 ml-auto text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Equity Curve ─────────────────────────────────────── */}
      {equityData.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Equity Curve
              <Badge
                variant="outline"
                className={cn(
                  'ml-2 text-[10px] border-0',
                  isProfitable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                )}
              >
                {isProfitable ? 'Profitable' : 'In Loss'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={equityData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="equityGradientProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="equityGradientLoss" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(val: string) => {
                      const d = new Date(val);
                      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                    }}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val: number) => `₹${val >= 0 ? '' : '-'}${Math.abs(val).toLocaleString('en-IN')}`}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <RechartsTooltip content={<EquityTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke={strokeColor}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{ r: 4, fill: strokeColor, stroke: strokeColor }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Two-Column: Positions & Trades ───────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Open Positions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Open Positions
              {positions.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">{positions.length}</Badge>
              )}
            </CardTitle>
            <CardAction>
              {positions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-muted-foreground"
                  onClick={() => setActivePage('trades')}
                >
                  View All <ChevronRight className="size-3" />
                </Button>
              )}
            </CardAction>
          </CardHeader>
          <CardContent>
            {openPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Circle className="mb-2 size-8 text-zinc-600" />
                <p className="text-sm text-muted-foreground">No open positions</p>
                <p className="text-xs text-muted-foreground">
                  Positions will appear here when trades are taken
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {openPositions.map((pos) => (
                  <PositionRow key={pos.id ?? `${pos.symbol}-${pos.entry_time}`} position={pos} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Recent Trades
              {trades.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">{trades.length}</Badge>
              )}
            </CardTitle>
            <CardAction>
              {trades.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-muted-foreground"
                  onClick={() => setActivePage('trades')}
                >
                  View All <ChevronRight className="size-3" />
                </Button>
              )}
            </CardAction>
          </CardHeader>
          <CardContent>
            {recentTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="mb-2 size-8 text-zinc-600" />
                <p className="text-sm text-muted-foreground">No trades yet</p>
                <p className="text-xs text-muted-foreground">
                  Completed trades will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {recentTrades.map((trade) => (
                  <TradeRow key={trade.id ?? `${trade.symbol}-${trade.exit_time}`} trade={trade} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
