'use client';

/**
 * DDLJ Risk Management Page — Real-time Risk Metrics
 * =====================================================
 * Displays risk KPIs, circuit breakers, Greeks exposure,
 * VIX regime, drawdown timeline, and correlation matrix.
 */

import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ShieldAlert,
  DollarSign,
  TrendingDown,
  Activity,
  Zap,
  BarChart3,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { mockRiskMetrics, type RiskMetrics } from '@/lib/mock-data';

const data: RiskMetrics = mockRiskMetrics;

function formatNum(n: number, decimals = 2): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatInt(n: number): string {
  return n.toLocaleString('en-IN');
}

function regimeColor(regime: string): string {
  switch (regime) {
    case 'HIGH': return 'text-red-400';
    case 'LOW': return 'text-emerald-400';
    case 'NORMAL': return 'text-amber-400';
    default: return 'text-zinc-400';
  }
}

function regimeBg(regime: string): string {
  switch (regime) {
    case 'HIGH': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'LOW': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'NORMAL': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

export function RiskPage() {
  const riskBudgetPct = data.daily_risk_budget_pct > 0
    ? Math.round((data.daily_risk_used_pct / data.daily_risk_budget_pct) * 100)
    : 0;

  return (
    <div className="space-y-4 p-4 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <ShieldAlert className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Risk Management</h1>
          <p className="text-xs text-muted-foreground">Real-time risk metrics, circuit breakers & exposure monitoring</p>
        </div>
      </div>

      {/* ── KPI Row (4 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Exposure */}
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Total Exposure
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
              {formatCurrency(data.total_exposure)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Margin: {formatCurrency(data.margin_used)}
            </div>
          </CardContent>
        </Card>

        {/* Margin Used */}
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Activity className="h-3 w-3" /> Margin Used
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-400">
              {formatCurrency(data.margin_used)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Buying Power: {formatCurrency(data.buying_power)}
            </div>
          </CardContent>
        </Card>

        {/* Daily Risk Budget */}
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Daily Risk Budget
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums">
              <span className={pnlColor(-data.daily_risk_used_pct)}>{data.daily_risk_used_pct.toFixed(1)}%</span>
              <span className="text-sm text-muted-foreground font-normal"> / {data.daily_risk_budget_pct.toFixed(1)}%</span>
            </div>
            <Progress
              value={riskBudgetPct}
              className={cn(
                'h-1.5 mt-2',
                riskBudgetPct > 80 ? '[&>[data-slot=progress-indicator]]:bg-red-500' :
                riskBudgetPct > 50 ? '[&>[data-slot=progress-indicator]]:bg-amber-500' :
                '[&>[data-slot=progress-indicator]]:bg-emerald-500'
              )}
            />
          </CardContent>
        </Card>

        {/* Max Drawdown */}
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Max Drawdown
            </div>
            <div className={cn(
              'text-2xl font-bold font-mono tabular-nums',
              data.max_drawdown_pct > 10 ? 'text-red-400' :
              data.max_drawdown_pct > 5 ? 'text-amber-400' : 'text-emerald-400'
            )}>
              {data.max_drawdown_pct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Current: {data.current_drawdown_pct.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Circuit Breakers ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Circuit Breakers</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Daily Loss Limit */}
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium">Daily Loss Limit</div>
                <Badge
                  variant={data.circuit_breakers.daily_loss_limit.triggered ? 'destructive' : 'outline'}
                  className={cn(
                    'text-[9px] px-1.5 py-0 h-4',
                    !data.circuit_breakers.daily_loss_limit.triggered && 'border-emerald-500/30 text-emerald-400'
                  )}
                >
                  {data.circuit_breakers.daily_loss_limit.triggered ? 'TRIGGERED' : 'OK'}
                </Badge>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-muted-foreground">Threshold</div>
                  <div className="text-sm font-mono font-semibold tabular-nums">
                    {formatCurrency(data.circuit_breakers.daily_loss_limit.limit)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">Current</div>
                  <div className={cn(
                    'text-sm font-mono font-semibold tabular-nums',
                    data.circuit_breakers.daily_loss_limit.triggered ? 'text-red-400' : 'text-zinc-200'
                  )}>
                    {formatCurrency(data.circuit_breakers.daily_loss_limit.used)}
                  </div>
                </div>
              </div>
              <Progress
                value={Math.min(100, (data.circuit_breakers.daily_loss_limit.used / data.circuit_breakers.daily_loss_limit.limit) * 100)}
                className={cn(
                  'h-1.5 mt-2',
                  data.circuit_breakers.daily_loss_limit.triggered
                    ? '[&>[data-slot=progress-indicator]]:bg-red-500'
                    : '[&>[data-slot=progress-indicator]]:bg-emerald-500'
                )}
              />
              <div className="text-[9px] text-muted-foreground mt-1 font-mono tabular-nums">
                {((data.circuit_breakers.daily_loss_limit.used / data.circuit_breakers.daily_loss_limit.limit) * 100).toFixed(0)}% used
              </div>
            </div>

            {/* Max Drawdown */}
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium">Max Drawdown</div>
                <Badge
                  variant={data.circuit_breakers.max_drawdown.triggered ? 'destructive' : 'outline'}
                  className={cn(
                    'text-[9px] px-1.5 py-0 h-4',
                    !data.circuit_breakers.max_drawdown.triggered && 'border-emerald-500/30 text-emerald-400'
                  )}
                >
                  {data.circuit_breakers.max_drawdown.triggered ? 'TRIGGERED' : 'OK'}
                </Badge>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-muted-foreground">Threshold</div>
                  <div className="text-sm font-mono font-semibold tabular-nums">
                    {(data.circuit_breakers.max_drawdown.limit * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">Current</div>
                  <div className={cn(
                    'text-sm font-mono font-semibold tabular-nums',
                    data.circuit_breakers.max_drawdown.triggered ? 'text-red-400' : 'text-zinc-200'
                  )}>
                    {(data.circuit_breakers.max_drawdown.current * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <Progress
                value={Math.min(100, (data.circuit_breakers.max_drawdown.current / data.circuit_breakers.max_drawdown.limit) * 100)}
                className={cn(
                  'h-1.5 mt-2',
                  data.circuit_breakers.max_drawdown.triggered
                    ? '[&>[data-slot=progress-indicator]]:bg-red-500'
                    : '[&>[data-slot=progress-indicator]]:bg-amber-500'
                )}
              />
              <div className="text-[9px] text-muted-foreground mt-1 font-mono tabular-nums">
                {((data.circuit_breakers.max_drawdown.current / data.circuit_breakers.max_drawdown.limit) * 100).toFixed(0)}% of limit
              </div>
            </div>

            {/* Capital Floor */}
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium">Capital Floor</div>
                <Badge
                  variant={data.circuit_breakers.capital_floor.triggered ? 'destructive' : 'outline'}
                  className={cn(
                    'text-[9px] px-1.5 py-0 h-4',
                    !data.circuit_breakers.capital_floor.triggered && 'border-emerald-500/30 text-emerald-400'
                  )}
                >
                  {data.circuit_breakers.capital_floor.triggered ? 'TRIGGERED' : 'OK'}
                </Badge>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-muted-foreground">Threshold</div>
                  <div className="text-sm font-mono font-semibold tabular-nums">
                    {(data.circuit_breakers.capital_floor.limit * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">Current</div>
                  <div className={cn(
                    'text-sm font-mono font-semibold tabular-nums',
                    data.circuit_breakers.capital_floor.triggered ? 'text-red-400' : 'text-zinc-200'
                  )}>
                    {data.circuit_breakers.capital_floor.current.toFixed(3)}x
                  </div>
                </div>
              </div>
              <Progress
                value={Math.min(100, (data.circuit_breakers.capital_floor.limit / data.circuit_breakers.capital_floor.current) * 100)}
                className={cn(
                  'h-1.5 mt-2',
                  data.circuit_breakers.capital_floor.triggered
                    ? '[&>[data-slot=progress-indicator]]:bg-red-500'
                    : '[&>[data-slot=progress-indicator]]:bg-emerald-500'
                )}
              />
              <div className="text-[9px] text-muted-foreground mt-1 font-mono tabular-nums">
                Capital at {((1 / data.circuit_breakers.capital_floor.current) * 100).toFixed(1)}% of starting
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Greeks Exposure ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Greeks Exposure</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Delta */}
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Delta</div>
              <div className={cn(
                'text-lg font-bold font-mono tabular-nums',
                data.greeks_exposure.delta > 0 ? 'text-emerald-400' :
                data.greeks_exposure.delta < 0 ? 'text-red-400' : 'text-zinc-400'
              )}>
                {data.greeks_exposure.delta > 0 ? '+' : ''}{data.greeks_exposure.delta.toFixed(3)}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
                {data.greeks_exposure.delta > 0.05 ? (
                  <><ArrowUpRight className="h-3 w-3 text-emerald-400" /> Bullish bias</>
                ) : data.greeks_exposure.delta < -0.05 ? (
                  <><ArrowDownRight className="h-3 w-3 text-red-400" /> Bearish bias</>
                ) : (
                  <><Minus className="h-3 w-3 text-zinc-400" /> Neutral</>
                )}
              </div>
            </div>

            {/* Gamma */}
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Gamma</div>
              <div className="text-lg font-bold font-mono tabular-nums text-zinc-200">
                {data.greeks_exposure.gamma > 0 ? '+' : ''}{data.greeks_exposure.gamma.toFixed(4)}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
                {data.greeks_exposure.gamma > 0 ? (
                  <><ArrowUpRight className="h-3 w-3 text-emerald-400" /> Long gamma</>
                ) : (
                  <><ArrowDownRight className="h-3 w-3 text-red-400" /> Short gamma</>
                )}
              </div>
            </div>

            {/* Theta */}
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Theta</div>
              <div className={cn(
                'text-lg font-bold font-mono tabular-nums',
                data.greeks_exposure.theta < 0 ? 'text-red-400' : 'text-emerald-400'
              )}>
                {data.greeks_exposure.theta.toFixed(2)}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
                {data.greeks_exposure.theta < 0 ? (
                  <><ArrowDownRight className="h-3 w-3 text-red-400" /> Time decay cost</>
                ) : (
                  <><ArrowUpRight className="h-3 w-3 text-emerald-400" /> Earning theta</>
                )}
              </div>
            </div>

            {/* Vega */}
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Vega</div>
              <div className={cn(
                'text-lg font-bold font-mono tabular-nums',
                data.greeks_exposure.vega > 0 ? 'text-amber-400' : 'text-zinc-200'
              )}>
                {data.greeks_exposure.vega > 0 ? '+' : ''}{data.greeks_exposure.vega.toFixed(1)}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
                {data.greeks_exposure.vega > 0 ? (
                  <><ArrowUpRight className="h-3 w-3 text-amber-400" /> Long vol exposure</>
                ) : (
                  <><ArrowDownRight className="h-3 w-3 text-zinc-400" /> Short vol exposure</>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── VIX Regime & Drawdown Timeline (side by side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* VIX Regime */}
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">VIX Regime</CardTitle>
              </div>
              <Badge className={cn('text-[10px] px-2 border', regimeBg(data.vix_regime.current))}>
                {data.vix_regime.current}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-4">
              <div className={cn(
                'text-3xl font-bold font-mono tabular-nums',
                regimeColor(data.vix_regime.current)
              )}>
                {data.vix_regime.vix.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">India VIX</div>
            </div>

            {/* VIX History Bar Chart */}
            <div className="space-y-1.5">
              {data.vix_regime.history.map((point, idx) => {
                const maxVix = Math.max(...data.vix_regime.history.map(p => p.vix));
                const minVix = Math.min(...data.vix_regime.history.map(p => p.vix));
                const range = maxVix - minVix || 1;
                const widthPct = ((point.vix - minVix) / range) * 70 + 30; // min 30% width

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground w-8 text-right tabular-nums">
                      {point.time}
                    </span>
                    <div className="flex-1 h-3 bg-secondary/30 rounded-sm overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-sm transition-all',
                          point.regime === 'HIGH' ? 'bg-red-500/40' :
                          point.regime === 'LOW' ? 'bg-emerald-500/40' :
                          'bg-amber-500/30'
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className={cn(
                      'text-[9px] font-mono tabular-nums w-8',
                      regimeColor(point.regime)
                    )}>
                      {point.vix.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Drawdown Timeline */}
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">Drawdown Timeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
              {data.drawdown_timeline.map((point, idx) => {
                const maxDD = Math.max(...data.drawdown_timeline.map(p => Math.abs(p.drawdown_pct)));
                const barWidth = maxDD > 0 ? (Math.abs(point.drawdown_pct) / maxDD) * 100 : 0;
                const isRecovery = point.drawdown_pct >= 0;

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground w-8 text-right tabular-nums flex-shrink-0">
                      {point.date}
                    </span>
                    <div className="flex-1 h-3 bg-secondary/30 rounded-sm overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-sm transition-all',
                          isRecovery
                            ? 'bg-emerald-500/30'
                            : barWidth > 60 ? 'bg-red-500/40'
                            : barWidth > 30 ? 'bg-amber-500/30'
                            : 'bg-amber-500/20'
                        )}
                        style={{ width: `${Math.max(barWidth, 2)}%` }}
                      />
                    </div>
                    <span className={cn(
                      'text-[9px] font-mono tabular-nums w-10 text-right flex-shrink-0',
                      isRecovery ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {point.drawdown_pct >= 0 ? '+' : ''}{point.drawdown_pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
              Peak drawdown: <span className="text-red-400 font-mono">{data.max_drawdown_pct.toFixed(1)}%</span>
              {' · '}Current: <span className="text-amber-400 font-mono">{data.current_drawdown_pct.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Correlation Matrix ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Correlation Matrix</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground" />
                  <th className="text-center py-2 px-3 font-medium text-amber-400">BANKNIFTY</th>
                  <th className="text-center py-2 px-3 font-medium text-emerald-400">NIFTY</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-amber-400">BANKNIFTY</td>
                  <td className="py-2 px-3 text-center">
                    <CorrelationCell value={1.0} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <CorrelationCell value={0.87} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-emerald-400">NIFTY</td>
                  <td className="py-2 px-3 text-center">
                    <CorrelationCell value={0.87} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <CorrelationCell value={1.0} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500/30" /> High (0.8–1.0)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-500/30" /> Medium (0.5–0.8)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500/30" /> Low (0–0.5)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Footer Note ── */}
      <div className="text-[10px] text-muted-foreground text-center pb-2">
        Risk metrics based on mock data for demonstration. Live risk monitoring requires engine connection.
        &middot; DDLJ Trading System v9
      </div>
    </div>
  );
}

/* ── Correlation Cell Sub-component ── */
function CorrelationCell({ value }: { value: number }) {
  const color = value >= 0.8
    ? 'text-emerald-400'
    : value >= 0.5
      ? 'text-amber-400'
      : 'text-red-400';

  const bgColor = value >= 0.8
    ? 'bg-emerald-500/10'
    : value >= 0.5
      ? 'bg-amber-500/10'
      : 'bg-red-500/10';

  return (
    <span className={cn(
      'inline-flex items-center justify-center px-2.5 py-1 rounded-md font-mono font-semibold tabular-nums text-sm',
      color, bgColor
    )}>
      {value.toFixed(2)}
    </span>
  );
}
