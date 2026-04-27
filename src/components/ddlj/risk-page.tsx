'use client';

/**
 * DDLJ Risk Management Page
 * ===========================
 * Portfolio risk, circuit breakers, Greeks exposure, drawdown, VIX regime.
 */

import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { mockRiskMetrics, mockRiskAlerts, type RiskMetrics } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle, Gauge, TrendingDown, Activity, Bell, CheckCircle2, XCircle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts';
import { toast } from 'sonner';

export function RiskPage() {
  const risk = mockRiskMetrics;
  const alerts = mockRiskAlerts;

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="space-y-4 p-4">
      {/* Risk Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> Total Exposure</div>
            <div className="text-xl font-bold font-mono tabular-nums">{formatCurrency(risk.total_exposure)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Margin Used</div>
            <div className="text-xl font-bold font-mono tabular-nums">{formatCurrency(risk.margin_used)}</div>
            <Progress value={(risk.margin_used / risk.total_exposure) * 100} className="h-1.5 mt-1" />
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Buying Power</div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-400">{formatCurrency(risk.buying_power)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Current Drawdown</div>
            <div className={cn('text-xl font-bold font-mono tabular-nums', risk.current_drawdown_pct > 3 ? 'text-red-400' : risk.current_drawdown_pct > 1 ? 'text-amber-400' : 'text-emerald-400')}>
              {risk.current_drawdown_pct.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Risk + Circuit Breakers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Risk Budget */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gauge className="h-4 w-4" /> Daily Risk Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="font-mono font-semibold">{risk.daily_risk_used_pct.toFixed(1)}% / {risk.daily_risk_budget_pct.toFixed(1)}%</span>
            </div>
            <Progress value={(risk.daily_risk_used_pct / risk.daily_risk_budget_pct) * 100} className="h-3" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Safe (&lt;50%)</span>
              <span className="text-amber-400">Caution</span>
              <span className="text-red-400">Danger (&gt;80%)</span>
            </div>
            <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-md border-2 border-white"
                style={{ left: `${Math.min(95, (risk.daily_risk_used_pct / risk.daily_risk_budget_pct) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Circuit Breakers */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Circuit Breakers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Daily Loss Limit', limit: `₹${risk.circuit_breakers.daily_loss_limit.toLocaleString()}`, used: `₹${risk.circuit_breakers.daily_loss_limit.used.toLocaleString()}`, pct: (risk.circuit_breakers.daily_loss_limit.used / risk.circuit_breakers.daily_loss_limit.limit) * 100, triggered: risk.circuit_breakers.daily_loss_limit.triggered },
              { name: 'Max Drawdown', limit: `${(risk.circuit_breakers.max_drawdown.limit * 100).toFixed(0)}%`, used: `${(risk.circuit_breakers.max_drawdown.current * 100).toFixed(1)}%`, pct: (risk.circuit_breakers.max_drawdown.current / risk.circuit_breakers.max_drawdown.limit) * 100, triggered: risk.circuit_breakers.max_drawdown.triggered },
              { name: 'Capital Floor', limit: `${(risk.circuit_breakers.capital_floor.limit * 100).toFixed(0)}%`, used: `${(risk.circuit_breakers.capital_floor.current * 100).toFixed(1)}%`, pct: ((1 - risk.circuit_breakers.capital_floor.current) / (1 - risk.circuit_breakers.capital_floor.limit)) * 100, triggered: risk.circuit_breakers.capital_floor.triggered },
            ].map((cb) => (
              <div key={cb.name} className={cn('p-3 rounded-lg border', cb.triggered ? 'bg-red-500/10 border-red-500/20' : 'bg-secondary/30 border-border/50')}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {cb.triggered ? <XCircle className="h-4 w-4 text-red-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    <span className="text-sm font-medium">{cb.name}</span>
                  </div>
                  <Badge variant={cb.triggered ? 'destructive' : 'outline'} className="text-[9px]">
                    {cb.triggered ? 'TRIGGERED' : 'OK'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{cb.used} used</span>
                  <span>Limit: {cb.limit}</span>
                </div>
                <Progress value={Math.min(100, cb.pct)} className="h-1.5 mt-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Greeks + VIX Regime */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Greeks Exposure */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Greeks Exposure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Delta', value: risk.greeks_exposure.delta, desc: 'Directional exposure', icon: 'Δ' },
              { name: 'Gamma', value: risk.greeks_exposure.gamma, desc: 'Convexity exposure', icon: 'Γ' },
              { name: 'Theta', value: risk.greeks_exposure.theta, desc: 'Time decay per day', icon: 'Θ' },
              { name: 'Vega', value: risk.greeks_exposure.vega, desc: 'Volatility sensitivity', icon: 'ν' },
            ].map((greek) => (
              <div key={greek.name} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-mono text-sm font-bold">
                    {greek.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{greek.name}</div>
                    <div className="text-[10px] text-muted-foreground">{greek.desc}</div>
                  </div>
                </div>
                <span className={cn('font-mono font-semibold text-lg tabular-nums', greek.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {greek.value >= 0 ? '+' : ''}{typeof greek.value === 'number' && greek.name === 'Gamma' ? greek.value.toFixed(4) : greek.value.toFixed(1)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* VIX Regime History */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" /> VIX Regime Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={risk.vix_regime.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} domain={[8, 30]} tickFormatter={(v) => `${v}`} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                  <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'High', position: 'right', fill: '#ef4444', fontSize: 9 }} />
                  <ReferenceLine y={12} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'Low', position: 'right', fill: '#22c55e', fontSize: 9 }} />
                  <Line type="monotone" dataKey="vix" stroke="#f59e0b" strokeWidth={2} dot={false} name="India VIX" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-muted-foreground">Current Regime:</span>
              <Badge variant="outline" className={cn('text-[10px]',
                risk.vix_regime.current === 'HIGH' ? 'text-red-400 border-red-500/30' :
                risk.vix_regime.current === 'LOW' ? 'text-emerald-400 border-emerald-500/30' :
                'text-amber-400 border-amber-500/30'
              )}>{risk.vix_regime.current}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drawdown Timeline */}
      <Card className="bg-card/80 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Drawdown Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={risk.drawdown_timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [`${value.toFixed(1)}%`, 'Drawdown']} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                <Bar dataKey="drawdown_pct" radius={[4, 4, 0, 0]} barSize={16}>
                  {risk.drawdown_timeline.map((entry, i) => (
                    <Cell key={i} fill={entry.drawdown_pct > 3 ? '#ef4444' : entry.drawdown_pct > 1 ? '#f59e0b' : '#22c55e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Risk Alerts */}
      <Card className="bg-card/80 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" /> Risk Alerts
            </CardTitle>
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">{unacknowledgedCount} unacknowledged</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-1.5">
              {alerts.map((alert) => (
                <div key={alert.id} className={cn(
                  'flex items-center gap-3 p-2.5 rounded-lg border',
                  !alert.acknowledged ? 'bg-secondary/50 border-border' : 'bg-transparent border-border/30',
                )}>
                  <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
                    alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                    alert.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-blue-500/20 text-blue-400'
                  )}>
                    {alert.severity === 'critical' ? <XCircle className="h-3.5 w-3.5" /> :
                     alert.severity === 'warning' ? <AlertTriangle className="h-3.5 w-3.5" /> :
                     <Activity className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[8px] px-1 h-3.5">{alert.type}</Badge>
                      {!alert.acknowledged && <span className="w-1.5 h-1.5 rounded-full bg-red-400 pulse-dot" />}
                    </div>
                    <p className="text-xs mt-0.5 truncate">{alert.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {new Date(alert.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
