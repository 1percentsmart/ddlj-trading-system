'use client';

/**
 * DDLJ Trading System — Risk Management Page
 * ===============================================
 * Risk dashboard with position sizing, drawdown metrics,
 * max daily trades toggle, and risk controls.
 */

import { useState, useMemo } from 'react';
import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn, formatCurrency, pnlColor, formatPercent } from '@/lib/utils';
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle,
  TrendingDown, Target, Activity, Percent, Gauge,
  Wallet, Lock, Unlock, Zap,
} from 'lucide-react';
import { toast } from 'sonner';

export default function RiskPage() {
  const { trades, positions, engineStatus, config } = useDDLJStore();

  // Risk parameters
  const [maxDailyTradesEnabled, setMaxDailyTradesEnabled] = useState(true);
  const [maxDailyTrades, setMaxDailyTrades] = useState(4);
  const [dailyRiskPct, setDailyRiskPct] = useState(2);
  const [maxDrawdownPct, setMaxDrawdownPct] = useState(25);

  // Compute risk metrics from trades
  const totalPnl = trades.reduce((s, t) => s + t.net, 0);
  const losses = trades.filter(t => t.net < 0);
  const wins = trades.filter(t => t.net > 0);

  // Running drawdown calculation
  let peak = 50000; // default capital
  let maxDrawdown = 0;
  let maxDrawdownPctActual = 0;
  let running = 50000;
  for (const t of trades) {
    running += t.net;
    if (running > peak) peak = running;
    const dd = peak - running;
    const ddPct = (dd / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (ddPct > maxDrawdownPctActual) maxDrawdownPctActual = ddPct;
  }

  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + Math.abs(t.net), 0) / losses.length : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.net, 0) / wins.length : 0;
  const profitFactor = losses.length > 0 && losses.reduce((s, t) => s + Math.abs(t.net), 0) > 0
    ? wins.reduce((s, t) => s + t.net, 0) / losses.reduce((s, t) => s + Math.abs(t.net), 0)
    : 0;

  const currentCapital = 50000 + totalPnl;
  const dailyRiskAmt = currentCapital * (dailyRiskPct / 100);
  const maxPositionRisk = dailyRiskAmt;

  // Consecutive losses
  let maxConsecLosses = 0;
  let currentStreak = 0;
  for (const t of trades) {
    if (t.net < 0) {
      currentStreak++;
      maxConsecLosses = Math.max(maxConsecLosses, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and control risk parameters for the trading engine
          </p>
        </div>
      </div>

      {/* Risk Controls */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risk Controls
          </CardTitle>
          <CardDescription>Configure risk parameters — changes apply on next engine restart</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Max Daily Trades */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Max Daily Trades</label>
                <Switch
                  checked={maxDailyTradesEnabled}
                  onCheckedChange={setMaxDailyTradesEnabled}
                />
              </div>
              {maxDailyTradesEnabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={maxDailyTrades}
                    onChange={(e) => setMaxDailyTrades(parseInt(e.target.value) || 1)}
                    className="w-20 h-8 text-center text-sm"
                  />
                  <span className="text-xs text-muted-foreground">trades/day</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Unlock className="h-4 w-4" />
                  Unlimited trades
                </div>
              )}
            </div>

            {/* Daily Risk % */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Daily Risk %</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={dailyRiskPct}
                  onChange={(e) => setDailyRiskPct(parseFloat(e.target.value) || 2)}
                  className="w-20 h-8 text-center text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  = {formatCurrency(dailyRiskAmt)}/day
                </span>
              </div>
            </div>

            {/* Max Drawdown Circuit Breaker */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Max Drawdown</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={50}
                  step={5}
                  value={maxDrawdownPct}
                  onChange={(e) => setMaxDrawdownPct(parseInt(e.target.value) || 25)}
                  className="w-20 h-8 text-center text-sm"
                />
                <span className="text-xs text-muted-foreground">% circuit breaker</span>
              </div>
            </div>

            {/* Current Capital */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Current Capital</label>
              <p className={cn('text-lg font-bold font-mono', pnlColor(totalPnl))}>
                {formatCurrency(currentCapital)}
              </p>
              <p className="text-xs text-muted-foreground">
                Max position risk: {formatCurrency(maxPositionRisk)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Max Drawdown</p>
            <p className={cn('text-lg font-bold', maxDrawdownPctActual <= 25 ? 'text-emerald-400' : maxDrawdownPctActual <= 40 ? 'text-amber-400' : 'text-red-400')}>
              {maxDrawdownPctActual.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">{formatCurrency(maxDrawdown)}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Profit Factor</p>
            <p className={cn('text-lg font-bold', profitFactor >= 1.5 ? 'text-emerald-400' : profitFactor >= 1 ? 'text-amber-400' : 'text-red-400')}>
              {profitFactor.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Avg Win</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(avgWin)}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Avg Loss</p>
            <p className="text-lg font-bold text-red-400">{formatCurrency(avgLoss)}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Max Consec. Losses</p>
            <p className={cn('text-lg font-bold', maxConsecLosses <= 3 ? 'text-emerald-400' : maxConsecLosses <= 5 ? 'text-amber-400' : 'text-red-400')}>
              {maxConsecLosses}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Open Positions</p>
            <p className="text-lg font-bold">{positions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Drawdown gauge */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Drawdown Status
          </CardTitle>
          <CardDescription>Current drawdown vs circuit breaker threshold</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Drawdown</span>
              <span className={cn('font-semibold', maxDrawdownPctActual <= 25 ? 'text-emerald-400' : maxDrawdownPctActual <= 40 ? 'text-amber-400' : 'text-red-400')}>
                {maxDrawdownPctActual.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(maxDrawdownPctActual, 100)}
              className={cn(
                'h-3',
                maxDrawdownPctActual > maxDrawdownPct ? '[&>div]:bg-red-500' : undefined
              )}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="text-amber-400">Warning: 15%</span>
              <span className="text-red-400">Circuit Breaker: {maxDrawdownPct}%</span>
              <span>100%</span>
            </div>
            {maxDrawdownPctActual > maxDrawdownPct && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">
                  Circuit breaker triggered! Current drawdown ({maxDrawdownPctActual.toFixed(1)}%) exceeds threshold ({maxDrawdownPct}%).
                  The engine should stop trading.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Risk-reward analysis */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Win/Loss Analysis</CardTitle>
          <CardDescription>Distribution of winning and losing trades</CardDescription>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No trade data available for analysis</p>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-400">Winning Trades ({wins.length})</p>
                <div className="flex items-center gap-2">
                  <Progress value={trades.length > 0 ? (wins.length / trades.length) * 100 : 0} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {trades.length > 0 ? (wins.length / trades.length * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Avg win: {formatCurrency(avgWin)}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-400">Losing Trades ({losses.length})</p>
                <div className="flex items-center gap-2">
                  <Progress value={trades.length > 0 ? (losses.length / trades.length) * 100 : 0} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {trades.length > 0 ? (losses.length / trades.length * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Avg loss: {formatCurrency(avgLoss)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
