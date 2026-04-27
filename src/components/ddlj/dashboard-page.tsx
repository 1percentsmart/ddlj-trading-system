'use client';

/**
 * DDLJ Dashboard — Clean Minimal Design
 * =======================================
 * Data-first, dark-first. No mock data. Fetches real API on mount.
 * Inspired by TradingView / Zerodha Kite / Sensibull.
 */

import { useState, useEffect } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Circle,
  Play,
  Square,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchTrades();
    fetchPositions();
  }, [fetchStatus, fetchTrades, fetchPositions]);

  // KPI calculations
  const totalPnl = trades.reduce((sum, t) => sum + t.net, 0);
  const dailyPnl = trades.length > 0
    ? trades.filter(t => {
        const today = new Date().toISOString().split('T')[0];
        return t.exit_time.startsWith(today);
      }).reduce((sum, t) => sum + t.net, 0)
    : 0;
  const winRate = trades.length > 0
    ? ((trades.filter(t => t.net > 0).length / trades.length) * 100).toFixed(1)
    : '—';
  const capital = totalPnl; // Approximation since backend doesn't expose capital directly yet

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

  return (
    <div className="space-y-4 p-4 max-w-5xl">
      {/* ── Top Bar: Connection + Token + Time ── */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Circle
              className={cn(
                'h-2 w-2 fill-current',
                isConnected ? 'text-emerald-400' : 'text-red-400'
              )}
            />
            <span className="text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span className="text-muted-foreground">|</span>
          <div className="flex items-center gap-1.5">
            <Circle
              className={cn(
                'h-2 w-2 fill-current',
                engineStatus.token.valid ? 'text-emerald-400' : 'text-red-400'
              )}
            />
            <span className="text-muted-foreground">
              Token {engineStatus.token.valid ? 'Valid' : 'Invalid'}
            </span>
          </div>
          {engineStatus.token.user && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground font-mono">{engineStatus.token.user}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="font-mono tabular-nums">{istTime} IST</span>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Capital (P&L)</div>
            <div className={cn('text-2xl font-bold font-mono tabular-nums', pnlColor(capital))}>
              {formatCurrency(capital)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Day P&L</div>
            <div className={cn('text-2xl font-bold font-mono tabular-nums', pnlColor(dailyPnl))}>
              {formatCurrency(dailyPnl)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total P&L</div>
            <div className={cn('text-2xl font-bold font-mono tabular-nums', pnlColor(totalPnl))}>
              {formatCurrency(totalPnl)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
            <div className="text-2xl font-bold font-mono tabular-nums">
              {winRate}{winRate !== '—' ? '%' : ''}
            </div>
            {trades.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {trades.filter(t => t.net > 0).length}W / {trades.filter(t => t.net < 0).length}L
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Engine Control Row ── */}
      <Card className="bg-card/60 border-border">
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

      {/* ── Open Positions ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setActivePage('trades')}>
              View All <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No open positions
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between p-2.5 rounded-md bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Circle
                      className={cn(
                        'h-2 w-2 fill-current flex-shrink-0',
                        pos.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'
                      )}
                    />
                    <span className="font-medium text-sm">{pos.symbol}</span>
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
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                      <span>SL ₹{pos.sl.toLocaleString()}</span>
                      <span>TGT ₹{pos.target.toLocaleString()}</span>
                    </div>
                    <div className={cn('font-mono font-semibold text-sm tabular-nums', pnlColor(pos.unrealized_pnl || 0))}>
                      {formatCurrency(pos.unrealized_pnl || 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Trades ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent Trades</CardTitle>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setActivePage('trades')}>
              View All <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No trades yet
            </div>
          ) : (
            <div className="space-y-2">
              {trades.slice(0, 10).map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-2.5 rounded-md bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-2 min-w-0">
                    {trade.net > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm">{trade.symbol}</span>
                    <Badge
                      variant={trade.direction === 'LONG' ? 'default' : 'destructive'}
                      className="text-[9px] px-1.5 py-0 h-4"
                    >
                      {trade.direction}
                    </Badge>
                    {trade.option_type && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono">
                        {trade.option_strike} {trade.option_type}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block text-[10px] text-muted-foreground font-mono">
                      {trade.exit_reason.replace(/_/g, ' ')}
                    </div>
                    <div className={cn('font-mono font-semibold text-sm tabular-nums', pnlColor(trade.net))}>
                      {trade.net >= 0 ? '+' : ''}{formatCurrency(trade.net)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
