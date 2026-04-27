'use client';

/**
 * DDLJ Risk Management Page (Enhanced)
 * ======================================
 * Quick edit, heat map, risk score gauge, correlation matrix,
 * what-if analysis (market drop + VIX spike).
 */

import { useState } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { mockRiskMetrics, mockRiskAlerts, type RiskMetrics } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle, Gauge, TrendingDown, Activity, Bell, CheckCircle2, XCircle, Edit3, Flame, Zap, Waves, Save } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts';
import { toast } from 'sonner';

export function RiskPage() {
  const risk = mockRiskMetrics;
  const alerts = mockRiskAlerts;
  const { config, updateConfigParam } = useDDLJStore();

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  // Quick edit state
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // What-if state
  const [whatIfDrop, setWhatIfDrop] = useState(5);
  const [whatIfVix, setWhatIfVix] = useState(25);

  // Risk Score calculation
  const riskScore = (() => {
    let score = 50;
    score -= risk.daily_risk_used_pct * 5;
    score += risk.current_drawdown_pct * 5;
    score -= risk.greeks_exposure.delta * 10;
    if (risk.circuit_breakers.daily_loss_limit.triggered) score += 30;
    if (risk.circuit_breakers.max_drawdown.triggered) score += 30;
    return Math.max(0, Math.min(100, Math.round(score)));
  })();

  const riskScoreColor = riskScore < 30 ? 'text-emerald-400' : riskScore < 60 ? 'text-amber-400' : 'text-red-400';
  const riskScoreLabel = riskScore < 30 ? 'Low Risk' : riskScore < 60 ? 'Moderate Risk' : 'High Risk';
  const riskScoreArcColor = riskScore < 30 ? '#22c55e' : riskScore < 60 ? '#f59e0b' : '#ef4444';

  // What-if: market drop calculation
  const whatIfPnl = (() => {
    const capital = 245800;
    const deltaExposure = risk.greeks_exposure.delta * capital * 0.01;
    return Math.round(deltaExposure * (whatIfDrop / 100) * -1);
  })();

  // What-if: VIX spike calculation
  const whatIfVixPnl = (() => {
    const currentVix = risk.vix_regime.vix;
    const vixChange = (whatIfVix - currentVix) / currentVix;
    const vegaImpact = risk.greeks_exposure.vega * vixChange * 100;
    const thetaDecay = risk.greeks_exposure.theta * 2; // Extra time decay in high vol
    return Math.round(vegaImpact + thetaDecay);
  })();

  // Portfolio heat map data (enhanced with more positions)
  const heatMapData = [
    { name: 'BankNifty CE 56300', exposure: 35, pnl: 2150, risk: 'medium' },
    { name: 'Nifty PE 24300', exposure: 25, pnl: 850, risk: 'low' },
    { name: 'BankNifty (Cash)', exposure: 40, pnl: 0, risk: 'low' },
    { name: 'Nifty CE 24500', exposure: 15, pnl: -420, risk: 'high' },
    { name: 'BankNifty PE 56000', exposure: 10, pnl: 180, risk: 'low' },
  ];

  const handleQuickEdit = (paramKey: string, currentValue: string | number) => {
    setEditingParam(paramKey);
    setEditValue(String(currentValue));
  };

  const handleSaveEdit = (paramKey: string) => {
    const numVal = parseFloat(editValue);
    if (!isNaN(numVal)) {
      updateConfigParam(paramKey, numVal);
      toast.success(`${paramKey} updated to ${editValue}`);
    }
    setEditingParam(null);
    setEditValue('');
  };

  // Circular gauge SVG for risk score
  const gaugeRadius = 54;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference - (riskScore / 100) * gaugeCircumference;

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
      {/* Risk Overview Cards + Risk Score Gauge */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
        {/* Risk Score Gauge */}
        <Card className={cn('bg-card/80 border', riskScore < 30 ? 'border-emerald-500/20' : riskScore < 60 ? 'border-amber-500/20' : 'border-red-500/20')}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={gaugeRadius} fill="none" stroke="var(--secondary)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r={gaugeRadius} fill="none"
                  stroke={riskScoreArcColor}
                  strokeWidth="8"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-xl font-bold font-mono tabular-nums', riskScoreColor)}>{riskScore}</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Flame className="h-3 w-3" /> Risk Score</div>
              <p className={cn('text-xs font-medium', riskScoreColor)}>{riskScoreLabel}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">0 = Safe, 100 = Danger</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Parameter Quick Edit + Daily Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick Edit */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Edit3 className="h-4 w-4" /> Quick Risk Edit
            </CardTitle>
            <CardDescription className="text-xs">Adjust key risk parameters without navigating to config</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: 'DAILY_RISK_PCT', label: 'Daily Risk %', value: config.find(c => c.key === 'DAILY_RISK_PCT')?.value || 3.0, min: 0.5, max: 10, step: 0.5, unit: '%' },
              { key: 'MAX_OPEN_POSITIONS', label: 'Max Positions', value: config.find(c => c.key === 'MAX_OPEN_POSITIONS')?.value || 2, min: 1, max: 5, step: 1, unit: '' },
              { key: 'DRAWDOWN_CIRCUIT_BREAKER', label: 'Circuit Breaker', value: config.find(c => c.key === 'DRAWDOWN_CIRCUIT_BREAKER')?.value || 0.80, min: 0.5, max: 0.95, step: 0.05, unit: '' },
            ].map((param) => (
              <div key={param.key} className="p-3 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium">{param.label}</Label>
                  {editingParam === param.key ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-7 text-xs font-mono w-20"
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(param.key)}
                      />
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => handleSaveEdit(param.key)}>
                        <Save className="h-3 w-3" /> Save
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setEditingParam(null)}>×</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{String(param.value)}{param.unit}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => handleQuickEdit(param.key, param.value as number)}>
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <Slider
                  value={[Number(param.value)]}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  onValueChange={([val]) => updateConfigParam(param.key, val)}
                  className="py-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{param.min}</span>
                  <span>{param.max}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

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
            {/* Circuit Breakers */}
            <Separator />
            <div className="space-y-2">
              {[
                { name: 'Daily Loss Limit', limit: `₹${risk.circuit_breakers.daily_loss_limit.limit.toLocaleString()}`, used: `₹${risk.circuit_breakers.daily_loss_limit.used.toLocaleString()}`, pct: (risk.circuit_breakers.daily_loss_limit.used / risk.circuit_breakers.daily_loss_limit.limit) * 100, triggered: risk.circuit_breakers.daily_loss_limit.triggered },
                { name: 'Max Drawdown', limit: `${(risk.circuit_breakers.max_drawdown.limit * 100).toFixed(0)}%`, used: `${(risk.circuit_breakers.max_drawdown.current * 100).toFixed(1)}%`, pct: (risk.circuit_breakers.max_drawdown.current / risk.circuit_breakers.max_drawdown.limit) * 100, triggered: risk.circuit_breakers.max_drawdown.triggered },
                { name: 'Capital Floor', limit: `${(risk.circuit_breakers.capital_floor.limit * 100).toFixed(0)}%`, used: `${(risk.circuit_breakers.capital_floor.current * 100).toFixed(1)}%`, pct: ((1 - risk.circuit_breakers.capital_floor.current) / (1 - risk.circuit_breakers.capital_floor.limit)) * 100, triggered: risk.circuit_breakers.capital_floor.triggered },
              ].map((cb) => (
                <div key={cb.name} className={cn('p-2.5 rounded-lg border', cb.triggered ? 'bg-red-500/10 border-red-500/20' : 'bg-secondary/30 border-border/50')}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {cb.triggered ? <XCircle className="h-3.5 w-3.5 text-red-400" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                      <span className="text-xs font-medium">{cb.name}</span>
                    </div>
                    <Badge variant={cb.triggered ? 'destructive' : 'outline'} className="text-[8px]">{cb.triggered ? 'TRIGGERED' : 'OK'}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{cb.used}</span>
                    <span>Limit: {cb.limit}</span>
                  </div>
                  <Progress value={Math.min(100, cb.pct)} className="h-1 mt-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Heat Map + Correlation Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" /> Portfolio Heat Map
            </CardTitle>
            <CardDescription className="text-xs">Positions sized by exposure, colored by P&L impact</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {heatMapData.map((item) => (
                <div key={item.name} className={cn(
                  'p-3 rounded-lg border transition-all',
                  item.pnl < 0 ? 'bg-red-500/10 border-red-500/20' :
                  item.risk === 'high' ? 'bg-amber-500/10 border-amber-500/20' :
                  item.risk === 'medium' ? 'bg-amber-500/8 border-amber-500/15' :
                  'bg-emerald-500/10 border-emerald-500/20'
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{item.name}</span>
                    <div className="flex items-center gap-2">
                      {item.pnl !== 0 && (
                        <span className={cn('font-mono text-sm font-semibold', pnlColor(item.pnl))}>
                          {item.pnl >= 0 ? '+' : ''}₹{item.pnl.toLocaleString('en-IN')}
                        </span>
                      )}
                      <Badge variant={item.risk === 'high' ? 'destructive' : item.risk === 'medium' ? 'secondary' : 'outline'} className="text-[9px]">
                        {item.risk.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">Exposure: {item.exposure}%</span>
                  </div>
                  <div className="mt-1.5 h-3 rounded-full bg-secondary overflow-hidden relative">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        item.pnl < 0 ? 'bg-red-500' : item.risk === 'high' ? 'bg-amber-500' : item.risk === 'medium' ? 'bg-amber-400' : 'bg-emerald-500'
                      )}
                      style={{ width: `${item.exposure}%` }}
                    />
                    {item.pnl !== 0 && (
                      <div
                        className={cn(
                          'absolute top-0 h-full rounded-full opacity-40',
                          item.pnl >= 0 ? 'bg-emerald-300' : 'bg-red-300'
                        )}
                        style={{ width: `${Math.min(100, Math.abs(item.pnl) / 50)}%` }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Correlation Matrix */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Correlation Matrix</CardTitle>
            <CardDescription className="text-xs">Cross-asset correlation for diversification analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-muted-foreground"></th>
                    <th className="p-2 text-center font-mono">BANKNIFTY</th>
                    <th className="p-2 text-center font-mono">NIFTY</th>
                  </tr>
                </thead>
                <tbody>
                  {['BANKNIFTY', 'NIFTY'].map((row) => (
                    <tr key={row}>
                      <td className="p-2 font-mono text-muted-foreground font-medium">{row}</td>
                      {['BANKNIFTY', 'NIFTY'].map((col) => {
                        const corr = risk.correlation_matrix.find(c => c.symbol1 === row && c.symbol2 === col)?.correlation || 0;
                        return (
                          <td key={col} className={cn(
                            'p-3 text-center font-mono font-bold tabular-nums rounded-lg m-0.5',
                            corr === 1 ? 'bg-emerald-500/20 text-emerald-400' :
                            corr > 0.8 ? 'bg-amber-500/15 text-amber-400' :
                            corr > 0.5 ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-zinc-500/10 text-zinc-400'
                          )}>
                            {corr.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/40" /> 1.00 (Self)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/40" /> 0.80+ (High)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500/40" /> 0.50+ (Moderate)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-zinc-500/40" /> &lt;0.50 (Low)</span>
            </div>
            <div className="mt-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-amber-400 inline mr-1" />
              BankNifty-Nifty correlation at {risk.correlation_matrix.find(c => c.symbol1 === 'BANKNIFTY' && c.symbol2 === 'NIFTY')?.correlation.toFixed(2)} — diversification benefit is limited.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* What-if Analysis (Market Drop + VIX Spike) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Market Drop What-if */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> What-if: Market Drop
            </CardTitle>
            <CardDescription className="text-xs">Estimate portfolio P&L if market drops by X%</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">If market drops by</Label>
              <div className="flex items-center gap-3 mt-2">
                <Slider
                  value={[whatIfDrop]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={([v]) => setWhatIfDrop(v)}
                  className="flex-1"
                />
                <span className="font-mono text-lg font-semibold w-12 text-right">{whatIfDrop}%</span>
              </div>
            </div>
            <div className={cn(
              'p-4 rounded-xl text-center border',
              whatIfPnl < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'
            )}>
              <div className="text-xs text-muted-foreground mb-1">Estimated Portfolio P&L Impact</div>
              <div className={cn('text-3xl font-bold font-mono tabular-nums', pnlColor(whatIfPnl))}>
                {formatCurrency(whatIfPnl)}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Based on current delta exposure of {risk.greeks_exposure.delta.toFixed(2)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { drop: 2, label: 'Minor' },
                { drop: 5, label: 'Moderate' },
                { drop: 10, label: 'Severe' },
              ].map((scenario) => {
                const estPnl = Math.round(risk.greeks_exposure.delta * 245800 * 0.01 * (scenario.drop / 100) * -1);
                return (
                  <button
                    key={scenario.drop}
                    className={cn('p-2 rounded-lg border text-center transition-colors hover:bg-secondary/50', whatIfDrop === scenario.drop ? 'border-primary/30 bg-primary/5' : 'border-border')}
                    onClick={() => setWhatIfDrop(scenario.drop)}
                  >
                    <div className="text-muted-foreground">{scenario.label}</div>
                    <div className={cn('font-mono font-semibold', pnlColor(estPnl))}>{scenario.drop}%</div>
                    <div className={cn('font-mono text-[10px]', pnlColor(estPnl))}>{formatCurrency(estPnl)}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* VIX Spike What-if */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Waves className="h-4 w-4" /> What-if: VIX Spike
            </CardTitle>
            <CardDescription className="text-xs">Estimate options P&L impact if VIX spikes to Y</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">If VIX spikes to</Label>
              <div className="flex items-center gap-3 mt-2">
                <Slider
                  value={[whatIfVix]}
                  min={10}
                  max={50}
                  step={1}
                  onValueChange={([v]) => setWhatIfVix(v)}
                  className="flex-1"
                />
                <span className="font-mono text-lg font-semibold w-12 text-right">{whatIfVix}</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Low (10)</span>
                <span>Normal (16)</span>
                <span>High (25)</span>
                <span>Panic (50)</span>
              </div>
            </div>
            <div className={cn(
              'p-4 rounded-xl text-center border',
              whatIfVixPnl < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'
            )}>
              <div className="text-xs text-muted-foreground mb-1">Estimated Options P&L Impact</div>
              <div className={cn('text-3xl font-bold font-mono tabular-nums', pnlColor(whatIfVixPnl))}>
                {formatCurrency(whatIfVixPnl)}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Based on vega ({risk.greeks_exposure.vega.toFixed(1)}) + theta ({risk.greeks_exposure.theta.toFixed(1)}) exposure
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { vix: 18, label: 'Mild Spike' },
                { vix: 25, label: 'High Vol' },
                { vix: 40, label: 'Panic' },
              ].map((scenario) => {
                const currentVix = risk.vix_regime.vix;
                const vixChange = (scenario.vix - currentVix) / currentVix;
                const estPnl = Math.round(risk.greeks_exposure.vega * vixChange * 100 + risk.greeks_exposure.theta * 2);
                return (
                  <button
                    key={scenario.vix}
                    className={cn('p-2 rounded-lg border text-center transition-colors hover:bg-secondary/50', whatIfVix === scenario.vix ? 'border-primary/30 bg-primary/5' : 'border-border')}
                    onClick={() => setWhatIfVix(scenario.vix)}
                  >
                    <div className="text-muted-foreground">{scenario.label}</div>
                    <div className={cn('font-mono font-semibold', pnlColor(estPnl))}>VIX {scenario.vix}</div>
                    <div className={cn('font-mono text-[10px]', pnlColor(estPnl))}>{formatCurrency(estPnl)}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* VIX Regime + Drawdown Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" /> VIX Regime Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={risk.vix_regime.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} domain={[8, 30]} tickFormatter={(v) => `${v}`} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }} />
                  <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="5 5" />
                  <ReferenceLine y={12} stroke="#22c55e" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="vix" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Drawdown Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={risk.drawdown_timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--foreground)' }} formatter={(value: number) => [`${value.toFixed(1)}%`, 'DD']} />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                  <Bar dataKey="drawdown_pct" radius={[3, 3, 0, 0]} barSize={12}>
                    {risk.drawdown_timeline.map((entry, i) => (
                      <Cell key={i} fill={entry.drawdown_pct > 3 ? '#ef4444' : entry.drawdown_pct > 1 ? '#f59e0b' : '#22c55e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

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
                      {!alert.acknowledged && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
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
