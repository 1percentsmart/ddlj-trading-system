'use client';

/**
 * DDLJ Options Chain Page
 * ========================
 * Options chain display with Greeks, IV skew, and P&L payoff diagram.
 */

import { useState } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency } from '@/lib/utils';
import { mockOptionsChain, mockNiftyOptionsChain, type OptionsChainData } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, BarChart3, Target, Sigma } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, AreaChart, Area,
} from 'recharts';

export function OptionsPage() {
  const [selectedIndex, setSelectedIndex] = useState<'BANKNIFTY' | 'NIFTY'>('BANKNIFTY');
  const chainData: OptionsChainData = selectedIndex === 'BANKNIFTY' ? mockOptionsChain : mockNiftyOptionsChain;

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
              <Select value={selectedIndex} onValueChange={(v) => setSelectedIndex(v as 'BANKNIFTY' | 'NIFTY')}>
                <SelectTrigger className="w-32 sm:w-40 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANKNIFTY">BankNifty</SelectItem>
                  <SelectItem value="NIFTY">Nifty</SelectItem>
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

      {/* Greeks Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

      <Tabs defaultValue="chain" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="chain" className="gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" /> Chain
          </TabsTrigger>
          <TabsTrigger value="iv" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> IV Skew
          </TabsTrigger>
          <TabsTrigger value="payoff" className="gap-1.5 text-xs">
            <Target className="h-3.5 w-3.5" /> Payoff
          </TabsTrigger>
        </TabsList>

        {/* Options Chain Table */}
        <TabsContent value="chain">
          <Card className="bg-card/80 border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
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
                    {chainData.strikes.map((row) => (
                      <tr
                        key={row.strike}
                        className={cn(
                          'border-b border-border/30 hover:bg-secondary/20 transition-colors',
                          row.isATM && 'bg-primary/10 border-primary/30',
                          row.ce.itm && !row.isATM && 'bg-emerald-500/5',
                          row.pe.itm && !row.isATM && 'bg-red-500/5',
                        )}
                      >
                        {/* CE Side */}
                        <td className={cn('px-2 py-1.5 text-right font-mono', row.ce.itm ? 'text-emerald-300' : 'text-foreground')}>{row.ce.ltp.toFixed(1)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{(row.ce.volume / 1000).toFixed(0)}K</td>
                        <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{(row.ce.oi / 1000).toFixed(0)}K</td>
                        <td className="px-2 py-1.5 text-right font-mono text-amber-400">{row.ce.iv.toFixed(1)}</td>
                        <td className={cn('px-2 py-1.5 text-right font-mono', row.ce.delta > 0 ? 'text-emerald-400' : 'text-red-400')}>{row.ce.delta.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{row.ce.gamma.toFixed(4)}</td>
                        {/* Strike */}
                        <td className={cn('px-3 py-1.5 text-center font-mono font-bold', row.isATM ? 'text-primary text-sm' : 'text-foreground')}>
                          {row.strike.toLocaleString()}
                          {row.isATM && <span className="ml-1 text-[8px] text-primary">ATM</span>}
                        </td>
                        {/* PE Side */}
                        <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{row.pe.gamma.toFixed(4)}</td>
                        <td className={cn('px-2 py-1.5 text-right font-mono', row.pe.delta > 0 ? 'text-emerald-400' : 'text-red-400')}>{row.pe.delta.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-amber-400">{row.pe.iv.toFixed(1)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{(row.pe.oi / 1000).toFixed(0)}K</td>
                        <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{(row.pe.volume / 1000).toFixed(0)}K</td>
                        <td className={cn('px-2 py-1.5 text-right font-mono', row.pe.itm ? 'text-red-300' : 'text-foreground')}>{row.pe.ltp.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
                  <LineChart data={chainData.iv_skew}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="strike" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}K`} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }} />
                    <ReferenceLine x={chainData.atm_strike} stroke="var(--muted-foreground)" strokeDasharray="5 5" label={{ value: 'ATM', position: 'top', fill: 'var(--muted-foreground)', fontSize: 10 }} />
                    <Line type="monotone" dataKey="ce_iv" stroke="#22c55e" strokeWidth={2} name="CE IV" dot={false} />
                    <Line type="monotone" dataKey="pe_iv" stroke="#ef4444" strokeWidth={2} name="PE IV" dot={false} />
                  </LineChart>
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
                    <Area type="monotone" dataKey="pnl" stroke="#22c55e" fill="url(#payoffGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
