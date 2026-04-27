'use client';

/**
 * DDLJ Options Chain Page (Enhanced)
 * ====================================
 * P&L calculator with various spot prices + breakeven, positions overlay,
 * expiry selector, PCR, max pain, OI analysis chart.
 */

import { useState, useMemo } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { mockOptionsChain, mockNiftyOptionsChain, type OptionsChainData } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, BarChart3, Target, Sigma, Calculator, Crosshair, Percent, Skull, Eye, LineChart } from 'lucide-react';
import {
  LineChart as RechartsLineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, AreaChart, Area,
} from 'recharts';
import { toast } from 'sonner';

export function OptionsPage() {
  const { positions } = useDDLJStore();
  const [selectedIndex, setSelectedIndex] = useState<'BANKNIFTY' | 'NIFTY'>('BANKNIFTY');
  const [expiryType, setExpiryType] = useState<'weekly' | 'monthly'>('weekly');
  const chainData: OptionsChainData = selectedIndex === 'BANKNIFTY' ? mockOptionsChain : mockNiftyOptionsChain;

  // P&L Calculator state
  const [calcStrike, setCalcStrike] = useState<string>(String(chainData.atm_strike));
  const [calcOptionType, setCalcOptionType] = useState<'CE' | 'PE'>('CE');
  const [calcQty, setCalcQty] = useState('1');
  const [calcEntryPrice, setCalcEntryPrice] = useState('');
  const [calcTargetPrice, setCalcTargetPrice] = useState('');

  // PCR Calculation
  const pcr = useMemo(() => {
    const totalPEOI = chainData.strikes.reduce((sum, s) => sum + s.pe.oi, 0);
    const totalCEOI = chainData.strikes.reduce((sum, s) => sum + s.ce.oi, 0);
    return totalCEOI > 0 ? totalPEOI / totalCEOI : 0;
  }, [chainData]);

  // Max Pain Calculation
  const maxPain = useMemo(() => {
    let minPain = Infinity;
    let maxPainStrike = chainData.atm_strike;
    for (const strike of chainData.strikes) {
      let pain = 0;
      for (const s of chainData.strikes) {
        if (strike.strike > s.strike) {
          pain += s.ce.oi * (strike.strike - s.strike);
        }
        if (strike.strike < s.strike) {
          pain += s.pe.oi * (s.strike - strike.strike);
        }
      }
      if (pain < minPain) {
        minPain = pain;
        maxPainStrike = strike.strike;
      }
    }
    return maxPainStrike;
  }, [chainData]);

  // Find current premium for selected strike
  const selectedStrikeData = chainData.strikes.find(s => s.strike === parseInt(calcStrike));
  const currentPremium = calcOptionType === 'CE' ? selectedStrikeData?.ce.ltp : selectedStrikeData?.pe.ltp;
  const effectiveEntryPrice = parseFloat(calcEntryPrice) || currentPremium || 0;

  // P&L Calculator result
  const calcResult = useMemo(() => {
    const target = parseFloat(calcTargetPrice);
    const qty = parseInt(calcQty) || 1;
    const lotSize = selectedIndex === 'BANKNIFTY' ? 15 : 25;
    if (!effectiveEntryPrice || !target) return null;
    const pnlPerLot = (target - effectiveEntryPrice) * lotSize;
    const totalPnl = pnlPerLot * qty;
    return { pnlPerLot, totalPnl, pnlPct: ((target - effectiveEntryPrice) / effectiveEntryPrice) * 100 };
  }, [calcTargetPrice, calcQty, effectiveEntryPrice, selectedIndex]);

  // Breakeven point
  const breakeven = useMemo(() => {
    if (!effectiveEntryPrice) return null;
    const strike = parseInt(calcStrike);
    if (calcOptionType === 'CE') {
      return strike + effectiveEntryPrice;
    } else {
      return strike - effectiveEntryPrice;
    }
  }, [effectiveEntryPrice, calcStrike, calcOptionType]);

  // P&L at various spot prices table
  const spotPriceTable = useMemo(() => {
    if (!effectiveEntryPrice) return [];
    const strike = parseInt(calcStrike);
    const lotSize = selectedIndex === 'BANKNIFTY' ? 15 : 25;
    const qty = parseInt(calcQty) || 1;
    const step = selectedIndex === 'BANKNIFTY' ? 100 : 50;
    const spot = chainData.spot_price;
    const rows = [];
    for (let offset = -5; offset <= 5; offset++) {
      const spotPrice = spot + offset * step;
      let intrinsicValue: number;
      if (calcOptionType === 'CE') {
        intrinsicValue = Math.max(0, spotPrice - strike);
      } else {
        intrinsicValue = Math.max(0, strike - spotPrice);
      }
      const pnlPerLot = (intrinsicValue - effectiveEntryPrice) * lotSize;
      const totalPnl = pnlPerLot * qty;
      const isBreakeven = breakeven && Math.abs(spotPrice - breakeven) < step / 2;
      rows.push({
        spotPrice,
        intrinsicValue: intrinsicValue.toFixed(1),
        pnlPerLot,
        totalPnl,
        isBreakeven,
        distance: ((spotPrice - spot) / spot * 100).toFixed(2),
      });
    }
    return rows;
  }, [effectiveEntryPrice, calcStrike, calcOptionType, calcQty, selectedIndex, chainData.spot_price, breakeven]);

  // OI vs Strike chart data
  const oiChartData = useMemo(() => {
    return chainData.strikes.map(s => ({
      strike: s.strike,
      ceOI: Math.round(s.ce.oi / 1000),
      peOI: Math.round(s.pe.oi / 1000),
      isATM: s.isATM,
    }));
  }, [chainData]);

  // Position strikes for overlay
  const positionStrikes = useMemo(() => {
    return new Set(positions.filter(p => p.option_strike).map(p => p.option_strike));
  }, [positions]);

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
      {/* Header */}
      <Card className="bg-card/80 border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Options Chain</CardTitle>
              <CardDescription>Live options chain with Greeks, IV skew, and payoff analysis</CardDescription>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Select value={selectedIndex} onValueChange={(v) => {
                setSelectedIndex(v as 'BANKNIFTY' | 'NIFTY');
                const newChain = v === 'BANKNIFTY' ? mockOptionsChain : mockNiftyOptionsChain;
                setCalcStrike(String(newChain.atm_strike));
                setCalcEntryPrice('');
                setCalcTargetPrice('');
              }}>
                <SelectTrigger className="w-32 sm:w-40 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANKNIFTY">BankNifty</SelectItem>
                  <SelectItem value="NIFTY">Nifty</SelectItem>
                </SelectContent>
              </Select>
              <Select value={expiryType} onValueChange={(v) => setExpiryType(v as 'weekly' | 'monthly')}>
                <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-[10px]">
                Spot: ₹{chainData.spot_price.toLocaleString()}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Expiry: {chainData.expiry}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* PCR + Max Pain + Greeks Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3" /> PCR</div>
            <div className={cn('text-xl font-bold font-mono tabular-nums', pcr > 1 ? 'text-red-400' : pcr < 0.7 ? 'text-emerald-400' : 'text-amber-400')}>
              {pcr.toFixed(2)}
            </div>
            <p className="text-[9px] text-muted-foreground">{pcr > 1 ? 'Put-heavy (Bearish)' : pcr < 0.7 ? 'Call-heavy (Bullish)' : 'Balanced'}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Skull className="h-3 w-3" /> Max Pain</div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-400">₹{maxPain.toLocaleString()}</div>
            <p className="text-[9px] text-muted-foreground">Max seller pain strike</p>
          </CardContent>
        </Card>
        {[
          { label: 'Total Delta', value: chainData.greeks_summary.total_delta.toFixed(2), color: chainData.greeks_summary.total_delta >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Total Gamma', value: chainData.greeks_summary.total_gamma.toFixed(4), color: 'text-blue-400' },
          { label: 'Total Theta', value: chainData.greeks_summary.total_theta.toFixed(1), color: chainData.greeks_summary.total_theta >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Total Vega', value: chainData.greeks_summary.total_vega.toFixed(1), color: 'text-purple-400' },
        ].map((greek) => (
          <Card key={greek.label} className="bg-card/80 border-border">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{greek.label}</div>
              <div className={cn('text-xl font-bold font-mono tabular-nums', greek.color)}>{greek.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── My Positions Overlay Info ── */}
      {positions.length > 0 && (
        <Card className="bg-card/80 border-emerald-500/20 border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Eye className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Your Active Positions:</span>
              {positions.filter(p => p.option_strike).map(p => (
                <Badge key={p.id} variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 gap-1">
                  {p.symbol} {p.direction} {p.option_strike} {p.option_type}
                  <span className={p.unrealized_pnl && p.unrealized_pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                    ({formatCurrency(p.unrealized_pnl || 0)})
                  </span>
                </Badge>
              ))}
              <span className="text-[10px] text-muted-foreground ml-2">Highlighted as POS in the chain table below</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="chain" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="chain" className="gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" /> Chain
          </TabsTrigger>
          <TabsTrigger value="oi" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> OI Analysis
          </TabsTrigger>
          <TabsTrigger value="iv" className="gap-1.5 text-xs">
            <LineChart className="h-3.5 w-3.5" /> IV Skew
          </TabsTrigger>
          <TabsTrigger value="payoff" className="gap-1.5 text-xs">
            <Target className="h-3.5 w-3.5" /> Payoff
          </TabsTrigger>
          <TabsTrigger value="calculator" className="gap-1.5 text-xs">
            <Calculator className="h-3.5 w-3.5" /> Calculator
          </TabsTrigger>
        </TabsList>

        {/* Options Chain Table with Position Overlay */}
        <TabsContent value="chain">
          <Card className="bg-card/80 border-border overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto -mx-0">
                <table className="w-full text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th colSpan={6} className="py-2 text-center text-emerald-400 bg-emerald-500/5 text-[11px] font-semibold">CALLS (CE)</th>
                      <th className="py-2 text-center bg-secondary text-[11px] font-bold">STRIKE</th>
                      <th colSpan={6} className="py-2 text-center text-red-400 bg-red-500/5 text-[11px] font-semibold">PUTS (PE)</th>
                    </tr>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-1.5 text-right">LTP</th>
                      <th className="px-2 py-1.5 text-right">Vol</th>
                      <th className="px-2 py-1.5 text-right">OI</th>
                      <th className="px-2 py-1.5 text-right">IV</th>
                      <th className="px-2 py-1.5 text-right">Delta</th>
                      <th className="px-2 py-1.5 text-right">Gamma</th>
                      <th className="px-2 py-1.5 text-center font-bold"></th>
                      <th className="px-2 py-1.5 text-right">Gamma</th>
                      <th className="px-2 py-1.5 text-right">Delta</th>
                      <th className="px-2 py-1.5 text-right">IV</th>
                      <th className="px-2 py-1.5 text-right">OI</th>
                      <th className="px-2 py-1.5 text-right">Vol</th>
                      <th className="px-2 py-1.5 text-right">LTP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chainData.strikes.map((row) => {
                      const isPosition = positionStrikes.has(row.strike);
                      const isMaxPain = row.strike === maxPain;
                      return (
                        <tr
                          key={row.strike}
                          className={cn(
                            'border-b border-border/30 hover:bg-secondary/20 transition-colors',
                            row.isATM && 'bg-primary/10 border-primary/30',
                            row.ce.itm && !row.isATM && 'bg-emerald-500/5',
                            row.pe.itm && !row.isATM && 'bg-red-500/5',
                            isPosition && 'ring-1 ring-inset ring-emerald-500/40',
                          )}
                        >
                          <td className={cn('px-2 py-1.5 text-right font-mono', row.ce.itm ? 'text-emerald-300' : 'text-foreground')}>{row.ce.ltp.toFixed(1)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{(row.ce.volume / 1000).toFixed(0)}K</td>
                          <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{(row.ce.oi / 1000).toFixed(0)}K</td>
                          <td className="px-2 py-1.5 text-right font-mono text-amber-400">{row.ce.iv.toFixed(1)}</td>
                          <td className={cn('px-2 py-1.5 text-right font-mono', row.ce.delta > 0 ? 'text-emerald-400' : 'text-red-400')}>{row.ce.delta.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{row.ce.gamma.toFixed(4)}</td>
                          <td className={cn('px-3 py-1.5 text-center font-mono font-bold relative', row.isATM ? 'text-primary text-sm' : 'text-foreground')}>
                            {row.strike.toLocaleString()}
                            {row.isATM && <span className="ml-1 text-[8px] text-primary">ATM</span>}
                            {isMaxPain && <span className="ml-1 text-[8px] text-amber-400">MP</span>}
                            {isPosition && <span className="ml-1 text-[8px] text-emerald-400">POS</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{row.pe.gamma.toFixed(4)}</td>
                          <td className={cn('px-2 py-1.5 text-right font-mono', row.pe.delta > 0 ? 'text-emerald-400' : 'text-red-400')}>{row.pe.delta.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-amber-400">{row.pe.iv.toFixed(1)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{(row.pe.oi / 1000).toFixed(0)}K</td>
                          <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{(row.pe.volume / 1000).toFixed(0)}K</td>
                          <td className={cn('px-2 py-1.5 text-right font-mono', row.pe.itm ? 'text-red-300' : 'text-foreground')}>{row.pe.ltp.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OI Analysis Chart */}
        <TabsContent value="oi">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Open Interest vs Strike</CardTitle>
                <CardDescription className="text-xs">CE and PE OI distribution across strikes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-56 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={oiChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="strike"
                        tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                        tickFormatter={(v) => `${(v / 1000).toFixed(1)}K`}
                      />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `${v}K`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--foreground)' }}
                        formatter={(value: number, name: string) => [`${value}K`, name === 'ceOI' ? 'CE OI' : 'PE OI']}
                        labelFormatter={(label) => `Strike: ₹${label.toLocaleString()}`}
                      />
                      <ReferenceLine x={chainData.atm_strike} stroke="var(--muted-foreground)" strokeDasharray="5 5" label={{ value: 'ATM', position: 'top', fill: 'var(--muted-foreground)', fontSize: 9 }} />
                      <ReferenceLine x={maxPain} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Max Pain', position: 'top', fill: '#f59e0b', fontSize: 9 }} />
                      <Bar dataKey="ceOI" fill="#22c55e" fillOpacity={0.7} name="ceOI" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="peOI" fill="#ef4444" fillOpacity={0.7} name="peOI" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">OI Highlights</CardTitle>
                <CardDescription className="text-xs">Key OI levels and interpretation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Highest CE OI */}
                {(() => {
                  const maxCEOI = chainData.strikes.reduce((max, s) => s.ce.oi > max.ce.oi ? s : max, chainData.strikes[0]);
                  const maxPEOI = chainData.strikes.reduce((max, s) => s.pe.oi > max.pe.oi ? s : max, chainData.strikes[0]);
                  return (
                    <>
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                          <TrendingUp className="h-3.5 w-3.5" /> Highest CE OI (Resistance)
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono text-sm font-bold">₹{maxCEOI.strike.toLocaleString()}</span>
                          <span className="font-mono text-xs text-muted-foreground">{(maxCEOI.ce.oi / 1000).toFixed(0)}K contracts</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Strong call writing — acts as resistance for upside</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-2 text-xs text-red-400 font-medium">
                          <TrendingUp className="h-3.5 w-3.5 rotate-180" /> Highest PE OI (Support)
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono text-sm font-bold">₹{maxPEOI.strike.toLocaleString()}</span>
                          <span className="font-mono text-xs text-muted-foreground">{(maxPEOI.pe.oi / 1000).toFixed(0)}K contracts</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Strong put writing — acts as support for downside</p>
                      </div>
                    </>
                  );
                })()}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
                    <Skull className="h-3.5 w-3.5" /> Max Pain: ₹{maxPain.toLocaleString()}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Price where option writers have minimum losses — expiry tends to gravitate here</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Percent className="h-3.5 w-3.5 text-muted-foreground" /> PCR: {pcr.toFixed(2)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {pcr > 1 ? 'Put-heavy sentiment — typically bearish indication' :
                     pcr < 0.7 ? 'Call-heavy sentiment — typically bullish indication' :
                     'Balanced sentiment — no clear directional bias'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-xs font-medium">Expected Range (based on OI)</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-sm text-red-400">
                      ₹{Math.min(...chainData.strikes.filter(s => s.pe.oi > 50000).map(s => s.strike)).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">← Support | Resistance →</span>
                    <span className="font-mono text-sm text-emerald-400">
                      ₹{Math.max(...chainData.strikes.filter(s => s.ce.oi > 50000).map(s => s.strike)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* IV Skew Chart */}
        <TabsContent value="iv">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Implied Volatility Skew</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chainData.iv_skew}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="strike" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}K`} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }} />
                    <ReferenceLine x={chainData.atm_strike} stroke="var(--muted-foreground)" strokeDasharray="5 5" label={{ value: 'ATM', position: 'top', fill: 'var(--muted-foreground)', fontSize: 10 }} />
                    <ReferenceLine x={maxPain} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Max Pain', position: 'top', fill: '#f59e0b', fontSize: 9 }} />
                    <Line type="monotone" dataKey="ce_iv" stroke="#22c55e" strokeWidth={2} name="CE IV" dot={false} />
                    <Line type="monotone" dataKey="pe_iv" stroke="#ef4444" strokeWidth={2} name="PE IV" dot={false} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payoff Diagram */}
        <TabsContent value="payoff">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">P&L Payoff at Expiry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chainData.payoff}>
                    <defs>
                      <linearGradient id="payoffGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="50%" stopColor="#22c55e" stopOpacity={0} />
                        <stop offset="50%" stopColor="#ef4444" stopOpacity={0} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="price" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}K`} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }} formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'P&L']} />
                    <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                    <ReferenceLine x={chainData.spot_price} stroke="var(--muted-foreground)" strokeDasharray="5 5" label={{ value: 'Spot', position: 'top', fill: 'var(--muted-foreground)', fontSize: 10 }} />
                    <ReferenceLine x={maxPain} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Max Pain', position: 'top', fill: '#f59e0b', fontSize: 9 }} />
                    <Area type="monotone" dataKey="pnl" stroke="#22c55e" fill="url(#payoffGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* P&L Calculator Tab */}
        <TabsContent value="calculator">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Calculator Input */}
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calculator className="h-4 w-4" /> Option P&L Calculator
                </CardTitle>
                <CardDescription className="text-xs">Calculate potential profit/loss for option positions at expiry</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Strike Price</Label>
                    <Select value={calcStrike} onValueChange={setCalcStrike}>
                      <SelectTrigger className="h-9 text-xs font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {chainData.strikes.map(s => (
                          <SelectItem key={s.strike} value={String(s.strike)} className="text-xs font-mono">
                            ₹{s.strike.toLocaleString()} {s.isATM ? '(ATM)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Option Type</Label>
                    <Select value={calcOptionType} onValueChange={(v) => setCalcOptionType(v as 'CE' | 'PE')}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CE">CE (Call)</SelectItem>
                        <SelectItem value="PE">PE (Put)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Entry Price (Premium)</Label>
                    <Input
                      type="number"
                      placeholder={currentPremium ? `Current: ₹${currentPremium.toFixed(1)}` : 'Enter premium'}
                      value={calcEntryPrice}
                      onChange={(e) => setCalcEntryPrice(e.target.value)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Quantity (Lots)</Label>
                    <Input type="number" value={calcQty} onChange={(e) => setCalcQty(e.target.value)} className="h-9 text-xs font-mono" min="1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Target Exit Price (Premium)</Label>
                  <Input
                    type="number"
                    placeholder="Enter target premium"
                    value={calcTargetPrice}
                    onChange={(e) => setCalcTargetPrice(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                {/* Breakeven Display */}
                {breakeven && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
                      <Crosshair className="h-3.5 w-3.5" /> Breakeven Point (at Expiry)
                    </div>
                    <div className="font-mono text-xl font-bold text-amber-400 mt-1">₹{breakeven.toLocaleString()}</div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {calcOptionType === 'CE'
                        ? `Spot must be above ₹${breakeven.toLocaleString()} for profit`
                        : `Spot must be below ₹${breakeven.toLocaleString()} for profit`
                      }
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => {
                    setCalcStrike(String(chainData.atm_strike));
                    setCalcEntryPrice('');
                    setCalcTargetPrice('');
                    setCalcQty('1');
                    setCalcOptionType('CE');
                    toast.info('Calculator reset');
                  }}>
                    Reset Calculator
                  </Button>
                  {currentPremium && !calcEntryPrice && (
                    <Button size="sm" className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => setCalcEntryPrice(String(currentPremium?.toFixed(1)))}>
                      Use Current Premium (₹{currentPremium.toFixed(1)})
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Calculator Results + Spot Price Table */}
            <div className="space-y-4">
              {/* P&L Result */}
              <Card className="bg-card/80 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Calculation Result</CardTitle>
                </CardHeader>
                <CardContent>
                  {calcResult ? (
                    <div className="space-y-4">
                      <div className={cn(
                        'p-6 rounded-xl text-center border',
                        calcResult.totalPnl >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
                      )}>
                        <div className="text-xs text-muted-foreground mb-1">
                          {parseInt(calcQty) > 1 ? `${calcQty} lots × ` : ''}₹{effectiveEntryPrice.toFixed(1)} → ₹{parseFloat(calcTargetPrice).toFixed(1)}
                        </div>
                        <div className={cn('text-4xl font-bold font-mono tabular-nums', pnlColor(calcResult.totalPnl))}>
                          {calcResult.totalPnl >= 0 ? '+' : ''}{formatCurrency(calcResult.totalPnl)}
                        </div>
                        <div className={cn('text-sm font-mono mt-1', pnlColor(calcResult.totalPnl))}>
                          {calcResult.pnlPct >= 0 ? '+' : ''}{calcResult.pnlPct.toFixed(1)}%
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                          <div className="text-muted-foreground">P&L per Lot</div>
                          <div className={cn('font-mono font-semibold text-lg mt-1', pnlColor(calcResult.pnlPerLot))}>
                            {calcResult.pnlPerLot >= 0 ? '+' : ''}₹{calcResult.pnlPerLot.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                          <div className="text-muted-foreground">Lot Size</div>
                          <div className="font-mono font-semibold text-lg mt-1">
                            {selectedIndex === 'BANKNIFTY' ? 15 : 25}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calculator className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>Enter values to calculate P&L</p>
                      <p className="text-xs mt-1">Set strike, entry price, and target price</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* P&L at Various Spot Prices */}
              {spotPriceTable.length > 0 && (
                <Card className="bg-card/80 border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Crosshair className="h-4 w-4 text-amber-400" /> P&L at Various Spot Prices
                    </CardTitle>
                    <CardDescription className="text-xs">Estimated P&L at expiry for different spot levels ({calcOptionType} ₹{parseInt(calcStrike).toLocaleString()})</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-2 py-1.5 text-left text-muted-foreground">Spot</th>
                            <th className="px-2 py-1.5 text-left text-muted-foreground">Distance</th>
                            <th className="px-2 py-1.5 text-right text-muted-foreground">Intrinsic</th>
                            <th className="px-2 py-1.5 text-right text-muted-foreground">P&L/Lot</th>
                            <th className="px-2 py-1.5 text-right text-muted-foreground">Total P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {spotPriceTable.map((row, i) => (
                            <tr
                              key={i}
                              className={cn(
                                'border-b border-border/30',
                                row.isBreakeven && 'bg-amber-500/10',
                                Math.abs(row.spotPrice - chainData.spot_price) < 1 && 'bg-primary/5',
                              )}
                            >
                              <td className={cn('px-2 py-1.5 font-mono', row.isBreakeven && 'text-amber-400 font-bold')}>
                                ₹{row.spotPrice.toLocaleString()}
                                {row.isBreakeven && <span className="ml-1 text-[8px] text-amber-400">BE</span>}
                              </td>
                              <td className={cn('px-2 py-1.5 font-mono', parseFloat(row.distance) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                                {parseFloat(row.distance) >= 0 ? '+' : ''}{row.distance}%
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">₹{row.intrinsicValue}</td>
                              <td className={cn('px-2 py-1.5 text-right font-mono', pnlColor(row.pnlPerLot))}>
                                {row.pnlPerLot >= 0 ? '+' : ''}₹{Math.abs(row.pnlPerLot).toLocaleString('en-IN')}
                              </td>
                              <td className={cn('px-2 py-1.5 text-right font-mono font-semibold', pnlColor(row.totalPnl))}>
                                {row.totalPnl >= 0 ? '+' : ''}₹{Math.abs(row.totalPnl).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2">
                      BE = Breakeven point. P&L assumes holding to expiry with no IV change.
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
