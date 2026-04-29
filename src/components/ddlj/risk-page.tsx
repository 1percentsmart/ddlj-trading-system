'use client';

import { useMemo } from 'react';
import { ShieldAlert, TrendingUp, TrendingDown, Activity, AlertTriangle, Info } from 'lucide-react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

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
  const { config, positions, isConnected } = useDDLJStore();

  // ── Config values with fallbacks ─────────────────────────────
  const dailyRiskPct = Number(config.DAILY_RISK_LIMIT_PCT ?? 3);
  const maxDrawdownPct = Number(config.MAX_DRAWDOWN_PCT ?? 10);
  const capitalFloorPct = Number(config.CAPITAL_FLOOR_PCT ?? 80);
  const capital = Number(config.CAPITAL ?? 0);

  // ── Computed KPIs ────────────────────────────────────────────
  const kpis = useMemo(() => {
    const openPositions = positions.length;
    const totalExposure = positions.reduce((sum, p) => sum + (p.entry * p.qty), 0);

    return {
      totalExposure,
      dailyRisk: capital > 0 ? capital * (dailyRiskPct / 100) : 0,
      maxDrawdown: capital > 0 ? capital * (maxDrawdownPct / 100) : 0,
      openPositions,
    };
  }, [positions, capital, dailyRiskPct, maxDrawdownPct]);

  // ── Circuit breaker current values (placeholder since no live P&L) ──
  const currentDailyLossPct = 0; // Would come from live engine
  const currentDrawdownPct = 0;  // Would come from live engine
  const currentCapitalPct = 100; // Would come from live engine

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

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Exposure */}
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
                {kpis.totalExposure > 0 ? formatCurrency(kpis.totalExposure) : 'N/A'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpis.openPositions > 0
                ? `Across ${kpis.openPositions} position${kpis.openPositions !== 1 ? 's' : ''}`
                : 'No open positions'}
            </p>
          </CardContent>
        </Card>

        {/* Daily Risk */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Daily Risk Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-amber-500" />
              <span className="text-2xl font-bold tracking-tight">
                {kpis.dailyRisk > 0 ? formatCurrency(kpis.dailyRisk) : 'N/A'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {dailyRiskPct}% of capital
            </p>
          </CardContent>
        </Card>

        {/* Max Drawdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Max Drawdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="size-5 text-red-400" />
              <span className="text-2xl font-bold tracking-tight">
                {kpis.maxDrawdown > 0 ? formatCurrency(kpis.maxDrawdown) : 'N/A'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {maxDrawdownPct}% threshold
            </p>
          </CardContent>
        </Card>

        {/* Open Positions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Open Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight">
                {kpis.openPositions}
              </span>
              {kpis.openPositions > 0 && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpis.openPositions === 0 ? 'No open positions' : 'Currently in market'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Circuit Breakers ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <CardTitle className="text-sm font-medium">Circuit Breakers</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Automatic safety mechanisms to protect capital
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Daily Loss Limit */}
          <CircuitBreaker
            label="Daily Loss Limit"
            threshold={dailyRiskPct}
            current={currentDailyLossPct}
            description={`Engine stops trading if daily losses exceed ${dailyRiskPct}% of capital`}
            format="pct"
          />

          <Separator />

          {/* Max Drawdown */}
          <CircuitBreaker
            label="Max Drawdown"
            threshold={maxDrawdownPct}
            current={currentDrawdownPct}
            description={`Engine halts when cumulative drawdown reaches ${maxDrawdownPct}%`}
            format="pct"
          />

          <Separator />

          {/* Capital Floor */}
          <CircuitBreaker
            label="Capital Floor"
            threshold={capitalFloorPct}
            current={currentCapitalPct}
            description={`Trading disabled if capital falls below ${capitalFloorPct}% of starting capital`}
            format="pct"
          />
        </CardContent>
      </Card>

      {/* ── Info Note ──────────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
        <Info className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Live risk metrics require an active engine connection. Configuration values are shown above.
          Start the engine with a valid token to see real-time risk usage.
        </p>
      </div>
    </div>
  );
}
