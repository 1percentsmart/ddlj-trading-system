'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDDLJStore } from '@/lib/store';
import { formatCurrency, pnlColor } from '@/lib/utils';
import SummaryCard from './summary-card';
import { PnlChart } from './pnl-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Circle, RefreshCw } from 'lucide-react';

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-secondary/60" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl border border-border/60 bg-card/60" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border/60 bg-card/60" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border border-border/60 bg-card/60" />
        <div className="h-64 animate-pulse rounded-xl border border-border/60 bg-card/60" />
      </div>
    </div>
  );
}

export function DashboardPhaseA() {
  const {
    engineStatus,
    trades,
    positions,
    isConnected,
    fetchStatus,
    fetchTrades,
    fetchPositions,
  } = useDDLJStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const stats = useMemo(() => {
    const totalPnl = trades.reduce((sum, trade) => sum + Number(trade.net || 0), 0);
    const day = new Date().toISOString().slice(0, 10);
    const dayPnl = trades
      .filter((trade) => trade.exit_time?.startsWith(day))
      .reduce((sum, trade) => sum + Number(trade.net || 0), 0);
    const wins = trades.filter((trade) => Number(trade.net || 0) > 0).length;
    const losses = trades.filter((trade) => Number(trade.net || 0) < 0).length;
    const winRate = trades.length ? ((wins / trades.length) * 100).toFixed(1) : '—';
    return { totalPnl, dayPnl, wins, losses, winRate };
  }, [trades]);

  if (loading && trades.length === 0 && positions.length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
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
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-red-500/40 bg-red-500/10">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-red-300">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={refresh}>Retry</Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard title="Total P&L" value={formatCurrency(stats.totalPnl)} valueClass={pnlColor(stats.totalPnl)} />
        <SummaryCard title="Day P&L" value={formatCurrency(stats.dayPnl)} valueClass={pnlColor(stats.dayPnl)} />
        <SummaryCard title="Win Rate" value={stats.winRate === '—' ? '—' : `${stats.winRate}%`} sub={trades.length ? `${stats.wins}W / ${stats.losses}L` : 'No closed trades'} />
        <SummaryCard title="Open Positions" value={positions.length} sub={`${trades.length} closed trades`} />
      </div>

      <PnlChart trades={trades} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {positions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No open positions</p>
            ) : positions.slice(0, 8).map((position, idx) => (
              <div key={position.id || `pos-${idx}`} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{position.symbol}</div>
                  <div className="text-xs text-muted-foreground">{position.direction} · Qty {position.qty}</div>
                </div>
                <div className={pnlColor(position.unrealized_pnl || 0)}>{formatCurrency(position.unrealized_pnl || 0)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Trades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trades.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No trades yet</p>
            ) : trades.slice(0, 8).map((trade, idx) => (
              <div key={trade.id || `trade-${idx}`} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{trade.symbol}</div>
                  <div className="text-xs text-muted-foreground">{trade.direction} · {trade.exit_reason?.replace(/_/g, ' ')}</div>
                </div>
                <div className={pnlColor(trade.net)}>{trade.net >= 0 ? '+' : ''}{formatCurrency(trade.net)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPhaseA;
