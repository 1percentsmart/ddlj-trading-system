'use client';

/**
 * DDLJ Trading System — Dashboard Page
 * ========================================
 * Full dashboard with engine status, P&L summary, recent trades,
 * market connection status, and quick action buttons.
 */

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn, formatCurrency, pnlColor, formatPercent, formatDuration, formatDateTime, timeAgo } from '@/lib/utils';
import {
  Activity, TrendingUp, TrendingDown, Cpu, Wifi, WifiOff,
  Play, Square, FlaskConical, ArrowUpDown, Shield, Key,
  AlertTriangle, CheckCircle2, XCircle, Clock, Zap,
  BarChart3, Wallet, Target, Percent,
} from 'lucide-react';

export default function DashboardPage() {
  const {
    engineStatus, trades, positions, isConnected, healthStatus,
    tokenStatus, startEngine, stopEngine, isEngineLoading,
  } = useDDLJStore();

  const totalPnl = trades.reduce((s, t) => s + t.net, 0);
  const wins = trades.filter(t => t.net > 0).length;
  const losses = trades.filter(t => t.net <= 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length * 100) : 0;
  const avgTrade = trades.length > 0 ? totalPnl / trades.length : 0;
  const longTrades = trades.filter(t => t.direction === 'LONG');
  const shortTrades = trades.filter(t => t.direction === 'SHORT');
  const longPnl = longTrades.reduce((s, t) => s + t.net, 0);
  const shortPnl = shortTrades.reduce((s, t) => s + t.net, 0);

  const recentTrades = trades.slice(-5).reverse();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time overview of your DDLJ trading system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={startEngine}
            disabled={engineStatus.engine_running || isEngineLoading}
            size="sm"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Play className="h-3.5 w-3.5" />
            Start Engine
          </Button>
          <Button
            onClick={stopEngine}
            disabled={!engineStatus.engine_running || isEngineLoading}
            size="sm"
            variant="destructive"
            className="gap-2"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <Card className={cn(
        'border-2',
        engineStatus.engine_running
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-red-500/30 bg-red-500/5'
      )}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              {engineStatus.engine_running ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
              <span className={cn(
                'font-semibold',
                engineStatus.engine_running ? 'text-emerald-400' : 'text-red-400'
              )}>
                {engineStatus.engine_running ? 'Engine Running' : 'Engine Stopped'}
              </span>
            </div>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <div className="flex items-center gap-2 text-sm">
              {isConnected ? (
                <><Wifi className="h-4 w-4 text-emerald-400" /> <span className="text-emerald-400">Backend Connected</span></>
              ) : (
                <><WifiOff className="h-4 w-4 text-red-400" /> <span className="text-red-400">Backend Offline</span></>
              )}
            </div>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <div className="flex items-center gap-2 text-sm">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span>Kite Token:</span>
              <Badge variant={tokenStatus?.valid ? 'default' : 'secondary'} className="text-xs">
                {tokenStatus?.valid ? 'Valid' : tokenStatus?.stored ? 'Expired' : 'Not Set'}
              </Badge>
            </div>
            {engineStatus.uptime_seconds ? (
              <>
                <Separator orientation="vertical" className="h-5 hidden sm:block" />
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Uptime: {formatDuration(engineStatus.uptime_seconds)}
                </div>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total P&L</p>
                <p className={cn('text-xl font-bold tracking-tight', pnlColor(totalPnl))}>
                  {formatCurrency(totalPnl)}
                </p>
              </div>
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                {totalPnl >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Win Rate</p>
                <p className={cn('text-xl font-bold tracking-tight', winRate >= 50 ? 'text-emerald-400' : 'text-amber-400')}>
                  {winRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Target className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{wins}W / {losses}L</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Trades</p>
                <p className="text-xl font-bold tracking-tight">{trades.length}</p>
              </div>
              <div className="p-1.5 rounded-lg bg-zinc-500/10">
                <ArrowUpDown className="h-4 w-4 text-zinc-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{longTrades.length}L / {shortTrades.length}S</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Open Positions</p>
                <p className="text-xl font-bold tracking-tight">{positions.length}</p>
              </div>
              <div className="p-1.5 rounded-lg bg-zinc-500/10">
                <Activity className="h-4 w-4 text-zinc-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Trade</p>
                <p className={cn('text-xl font-bold tracking-tight', pnlColor(avgTrade))}>
                  {formatCurrency(avgTrade)}
                </p>
              </div>
              <div className="p-1.5 rounded-lg bg-zinc-500/10">
                <Percent className="h-4 w-4 text-zinc-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Health</p>
                <p className={cn(
                  'text-xl font-bold tracking-tight',
                  healthStatus?.status === 'healthy' ? 'text-emerald-400' :
                  healthStatus?.status === 'degraded' ? 'text-amber-400' : 'text-red-400'
                )}>
                  {healthStatus?.status ? healthStatus.status.charAt(0).toUpperCase() + healthStatus.status.slice(1) : 'Unknown'}
                </p>
              </div>
              <div className="p-1.5 rounded-lg bg-zinc-500/10">
                <Shield className="h-4 w-4 text-zinc-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Long vs Short P&L */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Direction Breakdown</CardTitle>
            <CardDescription>P&L by trade direction</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-0">LONG</Badge>
                  <span className="text-muted-foreground">{longTrades.length} trades</span>
                </div>
                <span className={cn('font-semibold font-mono', pnlColor(longPnl))}>
                  {formatCurrency(longPnl)}
                </span>
              </div>
              <Progress value={trades.length > 0 ? (longTrades.length / trades.length) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-400 border-0">SHORT</Badge>
                  <span className="text-muted-foreground">{shortTrades.length} trades</span>
                </div>
                <span className={cn('font-semibold font-mono', pnlColor(shortPnl))}>
                  {formatCurrency(shortPnl)}
                </span>
              </div>
              <Progress value={trades.length > 0 ? (shortTrades.length / trades.length) * 100 : 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System Status</CardTitle>
            <CardDescription>Current system health indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span>Engine</span>
                </div>
                <Badge variant={engineStatus.engine_running ? 'default' : 'secondary'}>
                  {engineStatus.engine_running ? 'Running' : 'Stopped'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span>Kite Token</span>
                </div>
                <Badge variant={tokenStatus?.valid ? 'default' : 'secondary'}>
                  {tokenStatus?.valid ? 'Valid' : 'Invalid'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                  <span>Backend</span>
                </div>
                <Badge variant={isConnected ? 'default' : 'secondary'}>
                  {isConnected ? 'Connected' : 'Offline'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>Errors</span>
                </div>
                <Badge variant={engineStatus.error_count > 0 ? 'destructive' : 'secondary'}>
                  {engineStatus.error_count}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <FlaskConical className="h-4 w-4 text-muted-foreground" />
                  <span>Initialized</span>
                </div>
                <Badge variant={engineStatus.initialized ? 'default' : 'secondary'}>
                  {engineStatus.initialized ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Trades</CardTitle>
          <CardDescription>Last 5 completed trades</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTrades.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No trades yet. Start the engine and wait for signals.
            </div>
          ) : (
            <div className="space-y-2">
              {recentTrades.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-semibold border-0',
                        t.direction === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      )}
                    >
                      {t.direction}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{t.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.entry_time ? formatDateTime(t.entry_time) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('font-semibold font-mono text-sm', pnlColor(t.net))}>
                      {t.net > 0 ? '+' : ''}{formatCurrency(t.net)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{t.exit_reason}</Badge>
                    </p>
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
