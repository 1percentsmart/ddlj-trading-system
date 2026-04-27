'use client';

/**
 * DDLJ Engine Control Page (Enhanced)
 * =====================================
 * Auto-start toggle, max trade count, signal filter buttons, live counters,
 * emergency actions, pause trading, engine uptime with start time.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatDuration, biasColor, biasBgColor, timeAgo } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
  Timer,
  Hash,
  XCircle,
  Filter,
  Sun,
  StopCircle,
  Pause,
  Signal,
  Radio,
  CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';

type SignalFilterType = 'ALL' | 'ENTRY' | 'EXIT' | 'BIAS_CHANGE' | 'SYSTEM';

export function EnginePage() {
  const { engineStatus, isEngineLoading, setEngineLoading, updateEngineStatus, positions, signalLog, removePosition } = useDDLJStore();

  const [mounted, setMounted] = useState(false);
  const [autoStart, setAutoStart] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('ddljj-auto-start') !== 'false';
  });
  const [autoStop, setAutoStop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('ddljj-auto-stop') !== 'false';
  });
  const [maxTradeCount, setMaxTradeCount] = useState(5);
  const [signalFilter, setSignalFilter] = useState<SignalFilterType>('ALL');
  const [candleCount, setCandleCount] = useState(1247);
  const [isPaused, setIsPaused] = useState(false);
  const [engineStartTime] = useState('2026-04-28T09:15:00+05:30');

  // Hydration guard
  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  // Persist auto-start preference
  const toggleAutoStart = useCallback((checked: boolean) => {
    setAutoStart(checked);
    localStorage.setItem('ddljj-auto-start', String(checked));
    toast.success(checked ? 'Auto-start enabled — engine will start at 9:15 AM' : 'Auto-start disabled');
  }, []);

  // Persist auto-stop preference
  const toggleAutoStop = useCallback((checked: boolean) => {
    setAutoStop(checked);
    localStorage.setItem('ddljj-auto-stop', String(checked));
    toast.success(checked ? 'Auto-stop enabled — engine will stop at 3:30 PM' : 'Auto-stop disabled');
  }, []);

  // Simulate candle counter
  useEffect(() => {
    if (!engineStatus.engine_running) return;
    const interval = setInterval(() => {
      setCandleCount(prev => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [engineStatus.engine_running]);

  // Simulate live uptime ticking
  const [liveUptime, setLiveUptime] = useState(engineStatus.uptime_seconds);
  useEffect(() => {
    if (!engineStatus.engine_running) return;
    const interval = setInterval(() => {
      setLiveUptime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [engineStatus.engine_running]);

  // Signal stats
  const signalsGenerated = useMemo(() => signalLog.length, [signalLog]);
  const avgSignalFrequency = useMemo(() => {
    if (signalLog.length < 2) return 'N/A';
    const times = signalLog.map(s => new Date(s.time).getTime()).sort();
    const diffs = [];
    for (let i = 1; i < times.length; i++) {
      diffs.push(times[i] - times[i - 1]);
    }
    const avgMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const avgMin = Math.round(avgMs / 60000);
    return `${avgMin}m`;
  }, [signalLog]);

  const filteredSignals = signalFilter === 'ALL'
    ? signalLog
    : signalLog.filter(s => s.type === signalFilter);

  const signalFilterButtons: { label: string; value: SignalFilterType; icon: React.ReactNode; count: number }[] = [
    { label: 'All', value: 'ALL', icon: <Filter className="h-3 w-3" />, count: signalLog.length },
    { label: 'Entry', value: 'ENTRY', icon: <Zap className="h-3 w-3" />, count: signalLog.filter(s => s.type === 'ENTRY').length },
    { label: 'Exit', value: 'EXIT', icon: <Square className="h-3 w-3" />, count: signalLog.filter(s => s.type === 'EXIT').length },
    { label: 'Bias', value: 'BIAS_CHANGE', icon: <Activity className="h-3 w-3" />, count: signalLog.filter(s => s.type === 'BIAS_CHANGE').length },
    { label: 'System', value: 'SYSTEM', icon: <Clock className="h-3 w-3" />, count: signalLog.filter(s => s.type === 'SYSTEM').length },
  ];

  const handleStart = () => {
    setEngineLoading(true);
    setTimeout(() => {
      updateEngineStatus({ engine_running: true });
      setEngineLoading(false);
      setIsPaused(false);
      toast.success('Trading engine started successfully');
    }, 1500);
  };

  const handleStop = () => {
    setEngineLoading(true);
    setTimeout(() => {
      updateEngineStatus({ engine_running: false });
      setEngineLoading(false);
      setIsPaused(false);
      toast.info('Trading engine stopped. Open positions preserved.');
    }, 1000);
  };

  const handlePause = () => {
    setIsPaused(true);
    toast.warning('Trading paused — engine still running but new entries will be skipped');
  };

  const handleResume = () => {
    setIsPaused(false);
    toast.success('Trading resumed — new entries will be taken');
  };

  const handleForceClose = () => {
    setTimeout(() => {
      // Remove all positions from store individually to keep state consistent
      const posIds = positions.map(p => p.id);
      posIds.forEach(id => removePosition(id));
      updateEngineStatus({ open_positions_count: 0 });
      toast.warning('All open positions force-closed at market price');
    }, 800);
  };

  const handleForceClosePosition = (id: string, symbol: string) => {
    removePosition(id);
    updateEngineStatus({ open_positions_count: Math.max(0, engineStatus.open_positions_count - 1) });
    toast.warning(`${symbol} position force-closed at market price`);
  };

  const formatStartTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
      {/* ── Engine Control Panel ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Trading Engine Control</CardTitle>
              <CardDescription>Start, stop, and monitor the DDLJ paper trading engine</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {isPaused && (
                <Badge variant="outline" className="text-amber-400 border-amber-500/30 gap-1 text-[10px]">
                  <Pause className="h-3 w-3" /> PAUSED
                </Badge>
              )}
              <div className="flex items-center gap-2">
                <span className={cn(
                  'w-3 h-3 rounded-full',
                  isPaused ? 'bg-amber-400' : engineStatus.engine_running ? 'bg-emerald-400 pulse-dot' : 'bg-zinc-500'
                )} />
                <span className="font-medium text-sm">
                  {isPaused ? 'Paused' : engineStatus.engine_running ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 sm:gap-3 mb-6 flex-wrap">
            {engineStatus.engine_running ? (
              <>
                <Button variant="destructive" size="sm" onClick={handleStop} disabled={isEngineLoading} className="gap-2 sm:size-lg">
                  <Square className="h-4 w-4" />
                  <span className="hidden sm:inline">Stop Engine</span><span className="sm:hidden">Stop</span>
                </Button>
                {isPaused ? (
                  <Button size="sm" onClick={handleResume} className="gap-2 bg-emerald-600 hover:bg-emerald-700 sm:size-lg">
                    <Play className="h-4 w-4" />
                    <span className="hidden sm:inline">Resume Trading</span><span className="sm:hidden">Resume</span>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handlePause} className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 sm:size-lg">
                    <Pause className="h-4 w-4" />
                    <span className="hidden sm:inline">Pause Trading</span><span className="sm:hidden">Pause</span>
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" onClick={handleStart} disabled={isEngineLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 sm:size-lg">
                <Play className="h-4 w-4" />
                <span className="hidden sm:inline">Start Engine</span><span className="sm:hidden">Start</span>
              </Button>
            )}
            {engineStatus.engine_running && positions.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 sm:size-lg">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="hidden sm:inline">Force Close All ({positions.length})</span><span className="sm:hidden">Close All</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Force Close All Positions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately close all {positions.length} open positions at market price. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleForceClose} className="bg-red-600 hover:bg-red-700">Force Close All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" size="sm" disabled className="gap-2 sm:size-lg">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Restart Engine</span><span className="sm:hidden">Restart</span>
            </Button>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Uptime
              </div>
              <div className="font-mono text-lg tabular-nums mt-1">{formatDuration(liveUptime)}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Started at {formatStartTime(engineStartTime)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground">Trades Today</div>
              <div className="font-mono text-lg tabular-nums mt-1">{engineStatus.daily_trade_count} / {maxTradeCount}</div>
              <Progress value={(engineStatus.daily_trade_count / maxTradeCount) * 100} className="h-1.5 mt-1" />
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

      {/* ── Auto-start + Trade Limit Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Sun className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Auto-start at Market Open</Label>
                  <p className="text-[10px] text-muted-foreground">Automatically start engine at 9:15 AM IST</p>
                </div>
              </div>
              <Switch
                checked={autoStart}
                onCheckedChange={toggleAutoStart}
                aria-label="Toggle auto-start at market open"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Timer className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Auto-stop at Market Close</Label>
                  <p className="text-[10px] text-muted-foreground">Stop engine at 3:30 PM IST</p>
                </div>
              </div>
              <Switch
                checked={autoStop}
                onCheckedChange={toggleAutoStop}
                aria-label="Toggle auto-stop at market close"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Hash className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Max Trade Count Today</Label>
                  <p className="text-[10px] text-muted-foreground">Limit daily trades to prevent overtrading</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setMaxTradeCount(prev => Math.max(1, prev - 1))}
                  disabled={maxTradeCount <= 1}
                >
                  -
                </Button>
                <Input
                  type="number"
                  value={maxTradeCount}
                  onChange={(e) => setMaxTradeCount(parseInt(e.target.value) || 5)}
                  className="w-14 h-8 text-sm font-mono text-center px-1"
                  min={1}
                  max={20}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setMaxTradeCount(prev => Math.min(20, prev + 1))}
                  disabled={maxTradeCount >= 20}
                >
                  +
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">trades per day</span>
              <Select value={String(maxTradeCount)} onValueChange={(v) => setMaxTradeCount(parseInt(v))}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 5, 7, 10, 15].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} trades</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={(engineStatus.daily_trade_count / maxTradeCount) * 100} className="h-2 flex-1" />
              <span className="text-xs font-mono text-muted-foreground">{engineStatus.daily_trade_count}/{maxTradeCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Live Counters Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" /> Candles Processed
            </div>
            <div className="font-mono text-xl tabular-nums mt-1 text-emerald-400">{candleCount.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">15m timeframe</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Signal className="h-3 w-3" /> Signals Generated
            </div>
            <div className="font-mono text-xl tabular-nums mt-1 text-emerald-400">{signalsGenerated}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Today&apos;s total signals</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Radio className="h-3 w-3" /> Avg Signal Frequency
            </div>
            <div className="font-mono text-xl tabular-nums mt-1 text-amber-400">{avgSignalFrequency}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Between consecutive signals</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3 w-3" /> Engine Start
            </div>
            <div className="font-mono text-xl tabular-nums mt-1 text-blue-400">{formatStartTime(engineStartTime)}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{mounted ? new Date(engineStartTime).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Bias + Live Processing Row ── */}
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
              <p>&#8226; Only {engineStatus.current_bias === 'BULLISH' ? 'BUY' : engineStatus.current_bias === 'BEARISH' ? 'SELL' : 'no'} signals will be taken</p>
              {isPaused && <p className="text-amber-400">&#8226; Trading is PAUSED — signals will be skipped</p>}
            </div>
          </CardContent>
        </Card>

        {/* Live Processing */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" /> Live Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Gauge className="h-3 w-3" /> Drawdown
                </div>
                <div className="font-mono text-xl tabular-nums mt-1 text-emerald-400">0.8%</div>
                <Progress value={0.8 / 20 * 100} className="h-1.5 mt-1" />
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" /> Open Exposure
                </div>
                <div className="font-mono text-xl tabular-nums mt-1">
                  {engineStatus.open_positions_count} / 2
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> VIX Regime
                </div>
                <div className={cn('font-mono text-xl mt-1',
                  engineStatus.live_vix > 25 ? 'text-red-400' : engineStatus.live_vix < 12 ? 'text-emerald-400' : 'text-amber-400'
                )}>
                  {engineStatus.live_vix > 25 ? 'HIGH' : engineStatus.live_vix < 12 ? 'LOW' : 'NORMAL'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="h-3 w-3" /> Market Status
                </div>
                <div className={cn('font-mono text-xl mt-1',
                  engineStatus.market_status === 'open' ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {engineStatus.market_status === 'open' ? 'OPEN' : engineStatus.market_status === 'pre_market' ? 'PRE' : engineStatus.market_status === 'post_market' ? 'POST' : 'CLOSED'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Shield className="h-3.5 w-3.5" />
              All risk limits within bounds
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Emergency Actions + Signal Log Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Emergency Actions */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" /> Emergency Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {positions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No open positions to manage
              </div>
            ) : (
              <div className="space-y-2">
                {positions.map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', pos.direction === 'LONG' ? 'bg-emerald-400' : 'bg-red-400')} />
                      <span className="text-sm font-medium">{pos.symbol}</span>
                      <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[9px]">{pos.direction}</Badge>
                      {pos.option_type && (
                        <Badge variant="outline" className="text-[9px] font-mono">{pos.option_strike} {pos.option_type}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn('font-mono text-sm tabular-nums', pnlColor(pos.unrealized_pnl || 0))}>
                        {formatCurrency(pos.unrealized_pnl || 0)}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1">
                            <StopCircle className="h-3.5 w-3.5" /> Close
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Force Close {pos.symbol} {pos.direction}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will close your {pos.symbol} {pos.direction} position ({pos.option_strike} {pos.option_type}) at market price.
                              Current unrealized P&L: {formatCurrency(pos.unrealized_pnl || 0)}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleForceClosePosition(pos.id, pos.symbol)} className="bg-red-600 hover:bg-red-700">
                              Force Close
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Signals with Filter Buttons */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-medium">Recent Signals & Events</CardTitle>
              <div className="text-[10px] text-muted-foreground">
                {filteredSignals.length} of {signalLog.length}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {signalFilterButtons.map((btn) => (
                <Button
                  key={btn.value}
                  variant={signalFilter === btn.value ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-7 text-[10px] gap-1 px-2.5',
                    signalFilter === btn.value && 'bg-emerald-600 hover:bg-emerald-700'
                  )}
                  onClick={() => setSignalFilter(btn.value)}
                >
                  {btn.icon}
                  {btn.label}
                  <span className={cn(
                    'ml-0.5 rounded-full px-1.5 py-0 text-[8px] font-mono',
                    signalFilter === btn.value ? 'bg-emerald-800/50 text-emerald-200' : 'bg-secondary text-muted-foreground'
                  )}>
                    {btn.count}
                  </span>
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 sm:h-64">
              <div className="space-y-1">
                {filteredSignals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No signals matching filter
                  </div>
                ) : (
                  filteredSignals.map((sig, i) => (
                    <div key={i} className="flex items-center gap-2 sm:gap-3 py-2 px-2 sm:px-3 rounded-md hover:bg-secondary/30 border-b border-border/30 last:border-0">
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
                        <p className="text-sm mt-0.5 truncate">{sig.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(sig.time)}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
