'use client';

/**
 * DDLJ Trading System — Engine (Live Testing) Page
 * ====================================================
 * Full engine control panel with start/stop, status details,
 * token management, positions, and real-time monitoring.
 */

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { cn, formatCurrency, pnlColor, formatDuration, formatDateTime } from '@/lib/utils';
import {
  Play, Square, Loader2, CheckCircle2, XCircle, Clock,
  Key, Activity, ShieldAlert, Cpu, Wifi, WifiOff,
  ArrowUpDown, TrendingUp, TrendingDown, Target,
  RefreshCw, AlertTriangle, Zap, Gauge,
} from 'lucide-react';
import { toast } from 'sonner';

export default function EnginePage() {
  const {
    engineStatus, isEngineLoading, startEngine, stopEngine,
    isConnected, tokenStatus, positions, trades, refreshAll,
    healthStatus, readiness,
  } = useDDLJStore();

  const dailyPnl = trades.reduce((s, t) => s + t.net, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Testing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control the paper trading engine with live market data from Zerodha Kite
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={refreshAll}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            onClick={startEngine}
            disabled={engineStatus.engine_running || isEngineLoading}
            size="lg"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {isEngineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start Engine
          </Button>
          <Button
            onClick={stopEngine}
            disabled={!engineStatus.engine_running || isEngineLoading}
            variant="destructive"
            size="lg"
            className="gap-2 font-semibold"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      </div>

      {/* Engine Status Card */}
      <Card className={cn(
        'border-2',
        engineStatus.engine_running
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-red-500/30 bg-red-500/5'
      )}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            {engineStatus.engine_running ? (
              <div className="p-3 rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
            ) : (
              <div className="p-3 rounded-full bg-red-500/20">
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            )}
            <div>
              <p className={cn('text-2xl font-bold', engineStatus.engine_running ? 'text-emerald-400' : 'text-red-400')}>
                {engineStatus.engine_running ? 'Engine Running' : 'Engine Stopped'}
              </p>
              {engineStatus.uptime_seconds ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Uptime: {formatDuration(engineStatus.uptime_seconds)}
                  {engineStatus.manually_started && ' (Manual)'}
                </p>
              ) : null}
            </div>
          </div>

          {/* Status grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Initialized</p>
              <Badge variant={engineStatus.initialized ? 'default' : 'secondary'}>
                {engineStatus.initialized ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Backend</p>
              <div className="flex items-center gap-1.5">
                {isConnected ? (
                  <><Wifi className="h-4 w-4 text-emerald-400" /> <span className="text-emerald-400 text-sm font-medium">Connected</span></>
                ) : (
                  <><WifiOff className="h-4 w-4 text-red-400" /> <span className="text-red-400 text-sm font-medium">Offline</span></>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Token Status</p>
              <Badge variant={tokenStatus?.valid ? 'default' : 'destructive'}>
                {tokenStatus?.valid ? 'Valid' : tokenStatus?.stored ? 'Expired' : 'Not Set'}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Errors</p>
              <Badge variant={engineStatus.error_count > 0 ? 'destructive' : 'secondary'}>
                {engineStatus.error_count}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Daily P&L</p>
            <p className={cn('text-lg font-bold', pnlColor(dailyPnl))}>
              {formatCurrency(dailyPnl)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Trades Today</p>
            <p className="text-lg font-bold">{trades.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Open Positions</p>
            <p className="text-lg font-bold">{positions.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Health</p>
            <p className={cn(
              'text-lg font-bold',
              healthStatus?.status === 'healthy' ? 'text-emerald-400' :
              healthStatus?.status === 'degraded' ? 'text-amber-400' : 'text-red-400'
            )}>
              {healthStatus?.status || 'Unknown'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column: Readiness + Open Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Readiness Checks */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Readiness Checks</CardTitle>
            <CardDescription>System requirements for live trading</CardDescription>
          </CardHeader>
          <CardContent>
            {readiness ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Status</span>
                  <Badge variant={readiness.status === 'ready' ? 'default' : 'destructive'}>
                    {readiness.status === 'ready' ? 'Ready' : 'Not Ready'}
                  </Badge>
                </div>
                {Object.entries(readiness.checks).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                    {value ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                ))}
                {readiness.blockers.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs font-semibold text-red-400 mb-1">Blockers:</p>
                    {readiness.blockers.map((b, i) => (
                      <p key={i} className="text-xs text-red-300">{b.replace(/_/g, ' ')}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground text-sm">
                {isConnected ? 'Loading readiness data...' : 'Backend offline — cannot check readiness'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Positions */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Open Positions</CardTitle>
            <CardDescription>Currently held positions</CardDescription>
          </CardHeader>
          <CardContent>
            {positions.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                No open positions
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {positions.map((pos, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-semibold border-0',
                          pos.direction === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        )}
                      >
                        {pos.direction}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{pos.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          Entry: {formatCurrency(pos.entry)} | Qty: {pos.qty}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono">
                        SL: {formatCurrency(pos.sl)} | Tgt: {formatCurrency(pos.target)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        RR: {pos.rr?.toFixed(2) ?? '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Last Heartbeat */}
      {engineStatus.last_heartbeat && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span>Last Heartbeat: {formatDateTime(engineStatus.last_heartbeat)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
