'use client';

import { useEffect } from 'react';
import { useDDLJStore } from '@/lib/store';
import { formatCurrency, pnlColor } from '@/lib/utils';
import SummaryCard from './summary-card';
import { PnlChart } from './pnl-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Circle } from 'lucide-react';

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

  useEffect(() => {
    fetchStatus();
    fetchTrades();
    fetchPositions();
  }, [fetchStatus, fetchTrades, fetchPositions]);

  const totalPnl = trades.reduce((sum, trade) => sum + Number(trade.net || 0), 0);
  const day = new Date().toISOString().slice(0, 10);
  const dayPnl = trades
    .filter((trade) => trade.exit_time?.startsWith(day))
    .reduce((sum, trade) => sum + Number(trade.net || 0), 0);
  const wins = trades.filter((trade) => Number(trade.net || 0) > 0).length;
  const losses = trades.filter((trade) => Number(trade.net || 0) < 0).length;
  const winRate = trades.length ? ((wins / trades.length) * 100).toFixed(1) : '—';

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
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard title="Total P&L" value={formatCurrency(totalPnl)} valueClass={pnlColor(totalPnl)} />
        <SummaryCard title="Day P&L" value={formatCurrency(dayPnl)} valueClass={pnlColor(dayPnl)} />
        <SummaryCard title="Win Rate" value={winRate === '—' ? '—' : `${winRate}%`} sub={trades.length ? `${wins}W / ${losses}L` : 'No closed trades'} />
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
            ) : positions.slice(0, 8).map((position) => (
              <div key={position.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-sm">
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
            ) : trades.slice(0, 8).map((trade) => (
              <div key={trade.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-sm">
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
