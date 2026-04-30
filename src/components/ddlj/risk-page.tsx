'use client';

import { useMemo } from 'react';
import { ShieldAlert, TrendingUp, TrendingDown, Activity, AlertTriangle, Info, PieChart } from 'lucide-react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { Trade, Position } from '@/lib/api';

// ── Helpers ──────────────────────────────────────────────────────

function isToday(isoString: string): boolean {
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

// ── Compute real risk metrics ─────────────────────────────────────

interface RiskMetrics {
  dailyLossPct: number;
  drawdownPct: number;
  capitalRemainingPct: number;
  totalExposure: number;
  exposurePerPosition: Array<{ symbol: string; exposure: number; pct: number }>;
  riskScore: number;
  dailyLossAmount: number;
  maxDrawdownAmount: number;
}

function computeRiskMetrics(
  trades: Trade[],
  positions: Position[],
  config: Record<string, unknown>
): RiskMetrics {
  const capital = Number(config.CAPITAL ?? 100000);
  const dailyRiskPct = Number(config.DAILY_RISK_LIMIT_PCT ?? 3);
  const maxDrawdownPct = Number(config.MAX_DRAWDOWN_PCT ?? 10);
  const capitalFloorPct = Number(config.CAPITAL_FLOOR_PCT ?? 80);

  // Today's closed trades P&L
  const todayTrades = trades.filter((t) => isToday(t.exit_time));
  const dailyLoss = todayTrades.reduce((sum, t) => sum + t.net, 0);
  const dailyLossPct = capital > 0 ? (Math.abs(Math.min(dailyLoss, 0)) / capital) * 100 : 0;

  // Cumulative P&L for drawdown computation
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.exit_time).getTime() - new Date(b.exit_time).getTime()
  );
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of sortedTrades) {
    cumulative += t.net;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }
  const drawdownPct = capital > 0 ? (maxDrawdown / capital) * 100 : 0;

  // Capital remaining
  const totalPnl = trades.reduce((sum, t) => sum + t.net, 0);
  const capitalRemaining = capital + totalPnl;
  const capitalRemainingPct = capital > 0 ? (capitalRemaining / capital) * 100 : 100;

  // Total exposure from positions
  const totalExposure = positions.reduce((sum, p) => sum + p.entry * p.qty, 0);

  // Per-position exposure
  const exposurePerPosition = positions.map((p) => ({
    symbol: `${p.symbol} ${p.option_type ? `${p.option_strike}${p.option_type}` : ''}`.trim(),
    exposure: p.entry * p.qty,
    pct: totalExposure > 0 ? ((p.entry * p.qty) / totalExposure) * 100 : 0,
  }));

  // Risk Score (0-100): weighted combination
  const dailyLossUsage = dailyRiskPct > 0 ? (dailyLossPct / dailyRiskPct) * 100 : 0;
  const drawdownUsage = maxDrawdownPct > 0 ? (drawdownPct / maxDrawdownPct) * 100 : 0;
  const capitalProximity = capitalFloorPct > 0 ? Math.max(0, (1 - (capitalRemainingPct - capitalFloorPct) / (100 - capitalFloorPct))) * 100 : 0;

  const riskScore = Math.min(100, Math.round(
    dailyLossUsage * 0.35 + drawdownUsage * 0.35 + capitalProximity * 0.3
  ));

  return {
    dailyLossPct,
    drawdownPct,
    capitalRemainingPct,
    totalExposure,
    exposurePerPosition,
    riskScore,
    dailyLossAmount: dailyLoss,
    maxDrawdownAmount: maxDrawdown,
  };
}

// ── Risk Score Gauge ──────────────────────────────────────────────

function RiskScoreGauge({ score }: { score: number }) {
  const radius = 58;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 80 ? '#ef4444' : score >= 50 ? '#f59e0b' : '#10b981';
  const label = score >= 80 ? 'Critical' : score >= 50 ? 'Elevated' : score >= 25 ? 'Moderate' : 'Low';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-24">
        <svg viewBox="0 0 140 80" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 75 A 58 58 0 0 1 130 75"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Foreground arc */}
          <path
            d="M 10 75 A 58 58 0 0 1 130 75"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>{score}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Circuit Breaker Row ──────────────────────────────────────────

interface CircuitBreakerProps {
  label: string;
  threshold: number;
  current: number;
  description: string;
  format?: 'pct' | 'currency';
}

function CircuitBreaker({ label, threshold, current, description, format = 'pct' }: CircuitBreakerProps) {
  const usage = threshold > 0 ? Math.min((current / threshold) * 100, 100) : 0;
  const isWarning = usage >= 70 && usage < 90;
  const isCritical = usage >= 90;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="text-right">
          {format === 'pct' ? (
            <p className="text-sm tabular-nums">
              <span className={cn(isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-foreground')}>
                {current.toFixed(1)}%
              </span>
              <span className="text-muted-foreground"> / {threshold}%</span>
            </p>
          ) : (
            <p className="text-sm tabular-nums">
              <span className={cn(isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-foreground')}>
                {formatCurrency(current)}
              </span>
              <span className="text-muted-foreground"> / {formatCurrency(threshold)}</span>
            </p>
          )}
        </div>
      </div>
      <Progress
        value={usage}
        className={cn(
          'h-2',
          isCritical && '[&>div]:bg-red-500',
          isWarning && '[&>div]:bg-amber-500',
          !isWarning && !isCritical && '[&>div]:bg-emerald-500'
        )}
      />
    </div>
  );
}

// ── Main Risk Page ───────────────────────────────────────────────

export default function RiskPage() {
  const { config, positions, trades, isConnected } = useDDLJStore();

  // ── Config values with fallbacks ─────────────────────────────
  const dailyRiskPct = Number(config.DAILY_RISK_LIMIT_PCT ?? 3);
  const maxDrawdownPct = Number(config.MAX_DRAWDOWN_PCT ?? 10);
  const capitalFloorPct = Number(config.CAPITAL_FLOOR_PCT ?? 80);
  const capital = Number(config.CAPITAL ?? 0);

  // ── Compute REAL risk metrics from trades/positions ──────────
  const metrics = useMemo(
    () => computeRiskMetrics(trades, positions, config),
    [trades, positions, config]
  );

  const openPositions = positions.length;

  return (
    <div className="page-enter space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldAlert className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Risk Management</h1>
          <p className="text-xs text-muted-foreground">Monitor exposure and circuit breakers</p>
        </div>
      </div>

      {/* ── Risk Score + Summary Cards ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Risk Score Gauge */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
            <CardDescription className="text-xs">
              Computed from daily loss, drawdown & capital proximity
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <RiskScoreGauge score={metrics.riskScore} />
            <div className="mt-3 grid grid-cols-3 gap-3 w-full text-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Daily Loss</p>
                <p className={cn('text-xs font-semibold tabular-nums', metrics.dailyLossPct > dailyRiskPct * 0.7 ? 'text-amber-400' : 'text-foreground')}>
                  {metrics.dailyLossPct.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Drawdown</p>
                <p className={cn('text-xs font-semibold tabular-nums', metrics.drawdownPct > maxDrawdownPct * 0.7 ? 'text-amber-400' : 'text-foreground')}>
                  {metrics.drawdownPct.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Capital</p>
                <p className={cn('text-xs font-semibold tabular-nums', metrics.capitalRemainingPct < capitalFloorPct + 10 ? 'text-red-400' : 'text-foreground')}>
                  {metrics.capitalRemainingPct.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Exposure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                <span className="text-2xl font-bold tracking-tight">
                  {metrics.totalExposure > 0 ? formatCurrency(metrics.totalExposure) : 'N/A'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {openPositions > 0
                  ? `Across ${openPositions} position${openPositions !== 1 ? 's' : ''}`
                  : 'No open positions'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Today&apos;s P&L
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {metrics.dailyLossAmount >= 0 ? (
                  <TrendingUp className={cn('size-5', metrics.dailyLossAmount > 0 ? 'text-emerald-400' : 'text-zinc-400')} />
                ) : (
                  <TrendingDown className="size-5 text-red-400" />
                )}
                <span className={cn(
                  'text-2xl font-bold tracking-tight',
                  metrics.dailyLossAmount > 0 ? 'text-emerald-400' : metrics.dailyLossAmount < 0 ? 'text-red-400' : 'text-zinc-400'
                )}>
                  {formatCurrency(metrics.dailyLossAmount)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {metrics.dailyLossPct.toFixed(1)}% of capital
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Max Drawdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingDown className="size-5 text-red-400" />
                <span className="text-2xl font-bold tracking-tight text-red-400">
                  {metrics.maxDrawdownAmount > 0 ? formatCurrency(metrics.maxDrawdownAmount) : '—'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {metrics.drawdownPct.toFixed(1)}% peak-to-trough
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Capital Remaining
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className={cn('size-5', metrics.capitalRemainingPct < capitalFloorPct ? 'text-red-400' : 'text-emerald-400')} />
                <span className={cn(
                  'text-2xl font-bold tracking-tight',
                  metrics.capitalRemainingPct < capitalFloorPct ? 'text-red-400' : 'text-foreground'
                )}>
                  {capital > 0 ? formatCurrency(capital + trades.reduce((s, t) => s + t.net, 0)) : 'N/A'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {metrics.capitalRemainingPct.toFixed(1)}% of starting capital
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Circuit Breakers ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <CardTitle className="text-sm font-medium">Circuit Breakers</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Automatic safety mechanisms — computed from actual trade data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <CircuitBreaker
            label="Daily Loss Limit"
            threshold={dailyRiskPct}
            current={metrics.dailyLossPct}
            description={`Engine stops trading if daily losses exceed ${dailyRiskPct}% of capital`}
            format="pct"
          />

          <Separator />

          <CircuitBreaker
            label="Max Drawdown"
            threshold={maxDrawdownPct}
            current={metrics.drawdownPct}
            description={`Engine halts when cumulative drawdown reaches ${maxDrawdownPct}%`}
            format="pct"
          />

          <Separator />

          <CircuitBreaker
            label="Capital Floor"
            threshold={capitalFloorPct}
            current={metrics.capitalRemainingPct}
            description={`Trading disabled if capital falls below ${capitalFloorPct}% of starting capital`}
            format="pct"
          />
        </CardContent>
      </Card>

      {/* ── Position Concentration ─────────────────────────────── */}
      {metrics.exposurePerPosition.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChart className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Position Concentration</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Exposure distribution across open positions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.exposurePerPosition.map((pos) => (
                <div key={pos.symbol} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{pos.symbol}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(pos.exposure)} ({pos.pct.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress
                    value={pos.pct}
                    className={cn(
                      'h-1.5',
                      pos.pct > 50 ? '[&>div]:bg-red-500' : pos.pct > 30 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'
                    )}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Info Note ──────────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
        <Info className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Risk metrics are computed from your trade history and open positions.
          {trades.length === 0 && ' No trades yet — metrics will update once trading begins.'}
        </p>
      </div>
    </div>
  );
}
