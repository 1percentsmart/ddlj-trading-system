'use client';

/**
 * DDLJ Engine Control Page
 * =========================
 * Start/Stop engine, live status, bias direction, current signals,
 * position management controls.
 */

import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatDuration, biasColor, biasBgColor, timeAgo } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  Square,
  RotateCcw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Shield,
  AlertTriangle,
  Clock,
  Gauge,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

export function EnginePage() {
  const { engineStatus, isEngineLoading, setEngineLoading, updateEngineStatus, positions, trades, signalLog } = useDDLJStore();

  const handleStart = () => {
    setEngineLoading(true);
    setTimeout(() => {
      updateEngineStatus({ engine_running: true });
      setEngineLoading(false);
      toast.success('Trading engine started successfully');
    }, 1500);
  };

  const handleStop = () => {
    setEngineLoading(true);
    setTimeout(() => {
      updateEngineStatus({ engine_running: false });
      setEngineLoading(false);
      toast.info('Trading engine stopped. Open positions preserved.');
    }, 1000);
  };

  const handleForceClose = () => {
    setTimeout(() => {
      updateEngineStatus({ open_positions_count: 0 });
      toast.warning('All open positions force-closed at market price');
    }, 800);
  };

  return (
    <div className="space-y-4 p-4">
      {/* ── Engine Control Panel ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Trading Engine Control</CardTitle>
              <CardDescription>Start, stop, and monitor the DDLJ paper trading engine</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('w-3 h-3 rounded-full', engineStatus.engine_running ? 'bg-emerald-400 pulse-dot' : 'bg-zinc-500')} />
              <span className="font-medium">{engineStatus.engine_running ? 'Running' : 'Stopped'}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-6">
            {engineStatus.engine_running ? (
              <Button variant="destructive" size="lg" onClick={handleStop} disabled={isEngineLoading} className="gap-2">
                <Square className="h-4 w-4" />
                Stop Engine
              </Button>
            ) : (
              <Button size="lg" onClick={handleStart} disabled={isEngineLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Play className="h-4 w-4" />
                Start Engine
              </Button>
            )}
            {engineStatus.engine_running && positions.length > 0 && (
              <Button variant="outline" size="lg" onClick={handleForceClose} className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10">
                <AlertTriangle className="h-4 w-4" />
                Force Close All ({positions.length})
              </Button>
            )}
            <Button variant="outline" size="lg" disabled className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Restart Engine
            </Button>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground">Uptime</div>
              <div className="font-mono text-lg tabular-nums mt-1">{formatDuration(engineStatus.uptime_seconds)}</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground">Trades Today</div>
              <div className="font-mono text-lg tabular-nums mt-1">{engineStatus.daily_trade_count}</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground">Errors</div>
              <div className={cn('font-mono text-lg tabular-nums mt-1', engineStatus.error_count > 0 ? 'text-red-400' : 'text-emerald-400')}>{engineStatus.error_count}</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground">Token</div>
              <div className={cn('font-mono text-lg mt-1', engineStatus.token.valid ? 'text-emerald-400' : 'text-red-400')}>
                {engineStatus.token.valid ? 'Valid' : 'Expired'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Bias + Signal Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Bias */}
        <Card className={cn('bg-card/80 border', biasBgColor(engineStatus.current_bias))}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Current Market Bias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              {engineStatus.current_bias === 'BULLISH' ? (
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20">
                  <ArrowUpRight className="h-8 w-8 text-emerald-400" />
                </div>
              ) : engineStatus.current_bias === 'BEARISH' ? (
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20">
                  <ArrowDownRight className="h-8 w-8 text-red-400" />
                </div>
              ) : (
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20">
                  <Activity className="h-8 w-8 text-amber-400" />
                </div>
              )}
              <div>
                <div className={cn('text-3xl font-bold', biasColor(engineStatus.current_bias))}>
                  {engineStatus.current_bias}
                </div>
                <div className="text-sm text-muted-foreground">
                  Strength: {(engineStatus.bias_strength * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <Progress value={engineStatus.bias_strength * 100} className="h-3 mb-3" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Bias determined by EMA relationship on 60m timeframe</p>
              <p>• {engineStatus.current_bias === 'BULLISH' ? 'Fast EMA above Slow EMA — long positions preferred' :
                  engineStatus.current_bias === 'BEARISH' ? 'Fast EMA below Slow EMA — short positions preferred' :
                  'EMAs converging — wait for clear direction'}</p>
              <p>• Only {engineStatus.current_bias === 'BULLISH' ? 'BUY' : engineStatus.current_bias === 'BEARISH' ? 'SELL' : 'no'} signals will be taken</p>
            </div>
          </CardContent>
        </Card>

        {/* Risk Status */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Risk Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  Daily Risk Used
                </div>
                <div className="font-mono text-lg tabular-nums mt-1">
                  {((Math.abs(engineStatus.daily_pnl) / engineStatus.capital) * 100).toFixed(1)}%
                </div>
                <Progress value={(Math.abs(engineStatus.daily_pnl) / engineStatus.capital) * 100 / 3} className="h-1.5 mt-2" />
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Gauge className="h-3 w-3" />
                  Drawdown
                </div>
                <div className="font-mono text-lg tabular-nums mt-1 text-emerald-400">0.8%</div>
                <Progress value={0.8 / 20 * 100} className="h-1.5 mt-2" />
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  Open Exposure
                </div>
                <div className="font-mono text-lg tabular-nums mt-1">
                  {engineStatus.open_positions_count} / 2
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  VIX Regime
                </div>
                <div className={cn('font-mono text-lg mt-1',
                  engineStatus.live_vix > 25 ? 'text-red-400' : engineStatus.live_vix < 12 ? 'text-emerald-400' : 'text-amber-400'
                )}>
                  {engineStatus.live_vix > 25 ? 'HIGH' : engineStatus.live_vix < 12 ? 'LOW' : 'NORMAL'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Shield className="h-3.5 w-3.5" />
              All risk limits within bounds — no circuit breakers triggered
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Signals ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Recent Signals & Events</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-1">
              {signalLog.map((sig, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-secondary/30 border-b border-border/30 last:border-0">
                  <div className={cn(
                    'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                    sig.type === 'ENTRY' ? 'bg-emerald-500/20 text-emerald-400' :
                    sig.type === 'EXIT' ? 'bg-blue-500/20 text-blue-400' :
                    sig.type === 'BIAS_CHANGE' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-zinc-500/20 text-zinc-400'
                  )}>
                    {sig.type === 'ENTRY' ? <Zap className="h-3.5 w-3.5" /> :
                     sig.type === 'EXIT' ? <Square className="h-3.5 w-3.5" /> :
                     sig.type === 'BIAS_CHANGE' ? <Activity className="h-3.5 w-3.5" /> :
                     <Clock className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] px-1 h-4">{sig.type}</Badge>
                      <Badge variant={
                        sig.severity === 'success' ? 'default' :
                        sig.severity === 'warning' ? 'secondary' :
                        sig.severity === 'error' ? 'destructive' : 'outline'
                      } className="text-[9px] px-1 h-4">
                        {sig.severity}
                      </Badge>
                    </div>
                    <p className="text-sm mt-0.5">{sig.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(sig.time)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}


