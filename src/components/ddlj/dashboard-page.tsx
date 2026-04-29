'use client';

/**
 * DDLJ Dashboard — Enhanced Modern Design
 * =======================================
 * Merges the original engine-control dashboard with GPT's modern UI:
 * - Engine start/stop controls (preserved from original)
 * - PnL Equity Curve chart (added from GPT update)
 * - Skeleton loading states (added from GPT update)
 * - Summary cards with refined styling
 * - Connection + Token + Time status bar
 * - Open Positions & Recent Trades
 */

import { useState, useEffect, useMemo } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PnlChart } from './pnl-chart';
import {
  Circle,
  Play,
  Square,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-secondary/60" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl border border-border/60 bg-card/60" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-xl border border-border/60 bg-card/60" />
      <div className="h-52 animate-pulse rounded-xl border border-border/60 bg-card/60" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border border-border/60 bg-card/60" />
        <div className="h-64 animate-pulse rounded-xl border border-border/60 bg-card/60" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const {
    engineStatus,
    trades,
    positions,
    isConnected,
    fetchStatus,
    fetchTrades,
    fetchPositions,
    startEngine,
    stopEngine,
    isEngineLoading,
    setActivePage,
  } = useDDLJStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refresh = async () => {
    setError(null);
    try {
      await Promise.all([fetchStatus(), fetchTrades(), fetchPositions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // KPI calculations
  const totalPnl = useMemo(() => trades.reduce((sum, t) => sum + Number(t.net || 0), 0), [trades]);
  const dailyPnl = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return trades
      .filter(t => t.exit_time?.startsWith(today))
      .reduce((sum, t) => sum + Number(t.net || 0), 0);
  }, [trades]);
  const winRate = useMemo(() => {
    if (trades.length === 0) return '—';
    return ((trades.filter(t => Number(t.net || 0) > 0).length / trades.length) * 100).toFixed(1);
  }, [trades]);

  const handleEngineToggle = async () => {
    try {
      if (engineStatus.engine_running) {
        await stopEngine();
        toast.success('Engine stopped');
      } else {
        await startEngine();
        toast.success('Engine started');
      }
    } catch (err) {
      toast.error(`Engine ${engineStatus.engine_running ? 'stop' : 'start'} failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // IST time
  const istTime = mounted
    ? new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';

  if (loading && trades.length === 0 && positions.length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      {/* ── Header: Title + Status Bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">DDLJ Live Desk</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Trading Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1.5">
            <Circle className={isConnected ? 'h-2 w-2 fill-emerald-400 text-emerald-400' : 'h-2 w-2 fill-red-400 text-red-400'} />
            {isConnected ? 'Connected' : 'Offline'}
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <Circle className={engineStatus.engine_running ? 'h-2 w-2 fill-emerald-400 text-emerald-400' : 'h-2 w-2 fill-zinc-500 text-zinc-500'} />
            {engineStatus.engine_running ? 'Engine running' : 'Engine stopped'}
          </Badge>
          <Badge variant="outline">Token {engineStatus.token.valid ? 'valid' : 'invalid'}</Badge>
          {engineStatus.token.user && (
            <Badge variant="outline" className="font-mono">{engineStatus.token.user}</Badge>
          )}
          <Badge variant="outline" className="gap-1.5">
            <Clock className="h-3 w-3" />
            <span className="font-mono tabular-nums">{istTime} IST</span>
          </Badge>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error ? (
        <Card className="border-red-500/40 bg-red-500/10">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-red-300">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={refresh}>Retry</Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="overflow-hidden border-border/60 bg-card/70 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Total P&L</div>
            <div className={cn('mt-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl', pnlColor(totalPnl))}>
              {formatCurrency(totalPnl)}
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/60 bg-card/70 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Day P&L</div>
            <div className={cn('mt-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl', pnlColor(dailyPnl))}>
              {formatCurrency(dailyPnl)}
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/60 bg-card/70 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Win Rate</div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl">
              {winRate === '—' ? '—' : `${winRate}%`}
            </div>
            {trades.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {trades.filter(t => Number(t.net || 0) > 0).length}W / {trades.filter(t => Number(t.net || 0) < 0).length}L
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/60 bg-card/70 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Open Positions</div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl">
              {positions.length}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{trades.length} closed trades</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Engine Control Row ── */}
      <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              variant={engineStatus.engine_running ? 'destructive' : 'default'}
              className="gap-2 h-9"
              onClick={handleEngineToggle}
              disabled={isEngineLoading}
            >
              {isEngineLoading ? (
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : engineStatus.engine_running ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {engineStatus.engine_running ? 'Stop' : 'Start'}
            </Button>
            <div className="flex items-center gap-2">
              <Circle
                className={cn(
                  'h-2.5 w-2.5 fill-current',
                  engineStatus.engine_running ? 'text-emerald-400' : 'text-zinc-500'
                )}
              />
              <span className="text-sm font-medium">
                {engineStatus.engine_running ? 'Running' : 'Stopped'}
              </span>
            </div>
            {engineStatus.engine_running && engineStatus.start_time && (
              <>
                <Separator orientation="vertical" className="h-5 bg-border" />
                <span className="text-xs text-muted-foreground">
                  Since {new Date(engineStatus.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              {engineStatus.error_count > 0 && (
                <span className="text-red-400 font-mono">{engineStatus.error_count} errors</span>
              )}
              <div className="flex items-center gap-1.5">
                <Circle
                  className={cn(
                    'h-2 w-2 fill-current',
                    engineStatus.token.valid ? 'text-emerald-400' : 'text-red-400'
                  )}
                />
                <span>Token {engineStatus.token.valid ? 'OK' : 'Invalid'}</span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                {trades.length} trades
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono">
                {positions.length} positions
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── PnL Equity Curve (NEW from GPT update) ── */}
      <PnlChart trades={trades} />

      {/* ── Open Positions + Recent Trades (side by side) ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
              <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setActivePage('trades')}>
                View All <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {positions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No open positions</p>
            ) : positions.slice(0, 8).map((pos, idx) => (
              <div key={pos.id || `pos-${idx}`} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-sm">
                <div className="min-w-0 flex items-center gap-2">
                  <Circle
                    className={cn(
                      'h-2 w-2 fill-current flex-shrink-0',
                      pos.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'
                    )}
                  />
                  <span className="truncate font-medium">{pos.symbol}</span>
                  <Badge
                    variant={pos.direction === 'LONG' ? 'default' : 'destructive'}
                    className="text-[9px] px-1.5 py-0 h-4"
                  >
                    {pos.direction}
                  </Badge>
                  {pos.option_type && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono">
                      {pos.option_strike} {pos.option_type}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                    <span>SL ₹{pos.sl.toLocaleString()}</span>
                    <span>TGT ₹{pos.target.toLocaleString()}</span>
                  </div>
                  <div className={cn('font-mono font-semibold tabular-nums', pnlColor(pos.unrealized_pnl || 0))}>
                    {formatCurrency(pos.unrealized_pnl || 0)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Trades</CardTitle>
              <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setActivePage('trades')}>
                View All <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {trades.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No trades yet</p>
            ) : trades.slice(0, 8).map((trade, idx) => (
              <div key={trade.id || `trade-${idx}`} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-sm">
                <div className="min-w-0 flex items-center gap-2">
                  {Number(trade.net || 0) > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                  )}
                  <span className="truncate font-medium">{trade.symbol}</span>
                  <Badge
                    variant={trade.direction === 'LONG' ? 'default' : 'destructive'}
                    className="text-[9px] px-1.5 py-0 h-4"
                  >
                    {trade.direction}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-[10px] text-muted-foreground font-mono">
                    {trade.exit_reason?.replace(/_/g, ' ')}
                  </div>
                  <div className={cn('font-mono font-semibold tabular-nums', pnlColor(trade.net))}>
                    {Number(trade.net || 0) >= 0 ? '+' : ''}{formatCurrency(trade.net)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
