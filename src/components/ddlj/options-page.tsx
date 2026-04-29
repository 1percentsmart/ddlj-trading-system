'use client';

/**
 * DDLJ Options Chain Page — Full Options Chain with Greeks
 * ============================================================
 * Displays a full options chain table for BANKNIFTY / NIFTY with:
 * - CE/PE data (LTP, Volume, OI, IV, Delta)
 * - ATM strike highlighting
 * - ITM background shading
 * - Greeks summary card
 * - Spot price & expiry info
 */

import { useState, useMemo } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  TrendingUp,
  ArrowUpDown,
  Activity,
  Target,
  BarChart3,
  Info,
} from 'lucide-react';
import {
  mockOptionsChain,
  mockNiftyOptionsChain,
  type OptionsChainData,
} from '@/lib/mock-data';

const chainMap: Record<string, OptionsChainData> = {
  BANKNIFTY: mockOptionsChain,
  NIFTY: mockNiftyOptionsChain,
};

function formatNum(n: number, decimals = 2): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatInt(n: number): string {
  return n.toLocaleString('en-IN');
}

function deltaColor(delta: number): string {
  if (delta > 0.3) return 'text-emerald-400';
  if (delta < -0.3) return 'text-red-400';
  return 'text-amber-400';
}

function ivColor(iv: number): string {
  if (iv > 20) return 'text-red-400';
  if (iv < 14) return 'text-emerald-400';
  return 'text-zinc-300';
}

export function OptionsPage() {
  const [activeIndex, setActiveIndex] = useState('BANKNIFTY');

  const data = useMemo(() => chainMap[activeIndex], [activeIndex]);

  const atmStrike = data.atm_strike;
  const spotPrice = data.spot_price;

  // Compute aggregated OI for PCR
  const totalCEOI = data.strikes.reduce((s, r) => s + r.ce.oi, 0);
  const totalPEOI = data.strikes.reduce((s, r) => s + r.pe.oi, 0);
  const pcr = totalCEOI > 0 ? (totalPEOI / totalCEOI).toFixed(2) : '—';

  // Max pain (simplified — strike with least total buyer loss)
  const maxPainStrike = useMemo(() => {
    let bestStrike = data.strikes[0].strike;
    let minLoss = Infinity;
    for (const row of data.strikes) {
      const loss = data.strikes.reduce((acc, r) => {
        const ceLoss = r.strike < row.strike ? (row.strike - r.strike) * r.ce.oi : 0;
        const peLoss = r.strike > row.strike ? (r.strike - row.strike) * r.pe.oi : 0;
        return acc + ceLoss + peLoss;
      }, 0);
      if (loss < minLoss) {
        minLoss = loss;
        bestStrike = row.strike;
      }
    }
    return bestStrike;
  }, [data]);

  return (
    <div className="space-y-4 p-4 max-w-7xl">
      {/* ── Header Row ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Options Chain</h1>
            <p className="text-xs text-muted-foreground">Live chain with Greeks & OI analysis</p>
          </div>
        </div>
        <Tabs value={activeIndex} onValueChange={setActiveIndex}>
          <TabsList className="h-8">
            <TabsTrigger value="BANKNIFTY" className="text-xs px-3 h-6">BANKNIFTY</TabsTrigger>
            <TabsTrigger value="NIFTY" className="text-xs px-3 h-6">NIFTY</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Spot / Expiry / PCR Info Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <Target className="h-3 w-3" /> Spot Price
            </div>
            <div className="text-xl font-bold font-mono tabular-nums">
              {formatInt(spotPrice)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <Activity className="h-3 w-3" /> ATM Strike
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-400">
              {formatInt(atmStrike)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3" /> PCR (OI)
            </div>
            <div className={cn(
              'text-xl font-bold font-mono tabular-nums',
              Number(pcr) > 1 ? 'text-emerald-400' : Number(pcr) < 1 ? 'text-red-400' : 'text-zinc-400'
            )}>
              {pcr}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Max Pain
            </div>
            <div className="text-xl font-bold font-mono tabular-nums">
              {formatInt(maxPainStrike)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Expiry & Legend ── */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-[10px] gap-1">
            <Activity className="h-3 w-3" />
            Expiry: {data.expiry}
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px] gap-1">
            <Info className="h-3 w-3" />
            {data.strikes.length} strikes
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/40" />
            ATM
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/8 border border-emerald-500/20" />
            CE ITM
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500/8 border border-red-500/20" />
            PE ITM
          </span>
        </div>
      </div>

      {/* ── Options Chain Table ── */}
      <Card className="bg-card/60 border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto custom-scrollbar">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  {/* CE Header Group */}
                  <TableHead className="text-center bg-emerald-500/5 border-r border-border text-emerald-400 font-semibold text-[10px] py-2" colSpan={5}>
                    CALLS (CE)
                  </TableHead>
                  {/* Strike */}
                  <TableHead className="text-center bg-amber-500/5 font-semibold text-[10px] py-2 text-amber-400">
                    STRIKE
                  </TableHead>
                  {/* PE Header Group */}
                  <TableHead className="text-center bg-red-500/5 border-l border-border text-red-400 font-semibold text-[10px] py-2" colSpan={5}>
                    PUTS (PE)
                  </TableHead>
                </TableRow>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px] bg-emerald-500/5">LTP</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px] bg-emerald-500/5">Vol</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px] bg-emerald-500/5">OI</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px] bg-emerald-500/5">IV</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px] bg-emerald-500/5 border-r border-border">Delta</TableHead>
                  <TableHead className="text-center font-semibold text-amber-400 text-[10px] bg-amber-500/5 min-w-[80px]">Strike</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px] bg-red-500/5 border-l border-border">Delta</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px] bg-red-500/5">IV</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px] bg-red-500/5">OI</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px] bg-red-500/5">Vol</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px] bg-red-500/5">LTP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.strikes.map((row) => {
                  const isATM = row.isATM;
                  const ceITM = row.ce.itm;
                  const peITM = row.pe.itm;

                  return (
                    <TableRow
                      key={row.strike}
                      className={cn(
                        'border-border/50 transition-colors',
                        isATM
                          ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
                          : ceITM
                            ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                            : peITM
                              ? 'bg-red-500/5 hover:bg-red-500/10'
                              : 'hover:bg-secondary/30',
                      )}
                    >
                      {/* CE LTP */}
                      <TableCell className={cn(
                        'text-right font-mono tabular-nums py-1.5',
                        ceITM ? 'font-semibold text-emerald-300' : 'text-zinc-300'
                      )}>
                        {formatNum(row.ce.ltp)}
                      </TableCell>
                      {/* CE Volume */}
                      <TableCell className="text-right font-mono tabular-nums py-1.5 text-muted-foreground">
                        {formatInt(row.ce.volume)}
                      </TableCell>
                      {/* CE OI */}
                      <TableCell className={cn(
                        'text-right font-mono tabular-nums py-1.5',
                        row.ce.oi > 100000 ? 'text-zinc-200' : 'text-muted-foreground'
                      )}>
                        {formatInt(row.ce.oi)}
                      </TableCell>
                      {/* CE IV */}
                      <TableCell className={cn(
                        'text-right font-mono tabular-nums py-1.5',
                        ivColor(row.ce.iv)
                      )}>
                        {row.ce.iv.toFixed(1)}%
                      </TableCell>
                      {/* CE Delta */}
                      <TableCell className={cn(
                        'text-right font-mono tabular-nums py-1.5 border-r border-border',
                        deltaColor(row.ce.delta)
                      )}>
                        {row.ce.delta.toFixed(2)}
                      </TableCell>

                      {/* Strike */}
                      <TableCell className={cn(
                        'text-center font-mono tabular-nums py-1.5 bg-amber-500/5',
                        isATM ? 'font-bold text-amber-400 text-sm' : 'font-semibold text-zinc-200'
                      )}>
                        {isATM && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[8px] px-1 py-0 h-3.5 mr-1">
                            ATM
                          </Badge>
                        )}
                        {formatInt(row.strike)}
                      </TableCell>

                      {/* PE Delta */}
                      <TableCell className={cn(
                        'text-right font-mono tabular-nums py-1.5 border-l border-border',
                        deltaColor(row.pe.delta)
                      )}>
                        {row.pe.delta.toFixed(2)}
                      </TableCell>
                      {/* PE IV */}
                      <TableCell className={cn(
                        'text-right font-mono tabular-nums py-1.5',
                        ivColor(row.pe.iv)
                      )}>
                        {row.pe.iv.toFixed(1)}%
                      </TableCell>
                      {/* PE OI */}
                      <TableCell className={cn(
                        'text-right font-mono tabular-nums py-1.5',
                        row.pe.oi > 100000 ? 'text-zinc-200' : 'text-muted-foreground'
                      )}>
                        {formatInt(row.pe.oi)}
                      </TableCell>
                      {/* PE Volume */}
                      <TableCell className="text-right font-mono tabular-nums py-1.5 text-muted-foreground">
                        {formatInt(row.pe.volume)}
                      </TableCell>
                      {/* PE LTP */}
                      <TableCell className={cn(
                        'text-right font-mono tabular-nums py-1.5',
                        peITM ? 'font-semibold text-red-300' : 'text-zinc-300'
                      )}>
                        {formatNum(row.pe.ltp)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Greeks Summary ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Greeks Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Net Delta</div>
              <div className={cn(
                'text-lg font-bold font-mono tabular-nums',
                data.greeks_summary.total_delta > 0 ? 'text-emerald-400' :
                data.greeks_summary.total_delta < 0 ? 'text-red-400' : 'text-zinc-400'
              )}>
                {data.greeks_summary.total_delta > 0 ? '+' : ''}
                {data.greeks_summary.total_delta.toFixed(3)}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {data.greeks_summary.total_delta > 0 ? 'Bullish bias' : data.greeks_summary.total_delta < 0 ? 'Bearish bias' : 'Neutral'}
              </div>
            </div>
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Net Gamma</div>
              <div className="text-lg font-bold font-mono tabular-nums text-zinc-200">
                {data.greeks_summary.total_gamma > 0 ? '+' : ''}
                {data.greeks_summary.total_gamma.toFixed(4)}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {data.greeks_summary.total_gamma > 0 ? 'Long gamma' : 'Short gamma'}
              </div>
            </div>
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Net Theta</div>
              <div className={cn(
                'text-lg font-bold font-mono tabular-nums',
                data.greeks_summary.total_theta < 0 ? 'text-red-400' : 'text-emerald-400'
              )}>
                {data.greeks_summary.total_theta.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {data.greeks_summary.total_theta < 0 ? 'Time decay cost' : 'Earning theta'}
              </div>
            </div>
            <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
              <div className="text-[10px] text-muted-foreground mb-1">Net Vega</div>
              <div className={cn(
                'text-lg font-bold font-mono tabular-nums',
                data.greeks_summary.total_vega > 0 ? 'text-amber-400' : 'text-zinc-200'
              )}>
                {data.greeks_summary.total_vega > 0 ? '+' : ''}
                {data.greeks_summary.total_vega.toFixed(1)}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {data.greeks_summary.total_vega > 0 ? 'Long vol exposure' : 'Short vol exposure'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── OI Analysis ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top CE OI */}
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Top CE Open Interest
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...data.strikes]
                .sort((a, b) => b.ce.oi - a.ce.oi)
                .slice(0, 5)
                .map((row, idx) => {
                  const maxOI = data.strikes.reduce((m, r) => Math.max(m, r.ce.oi), 0);
                  const pct = maxOI > 0 ? (row.ce.oi / maxOI) * 100 : 0;
                  return (
                    <div key={row.strike} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground w-4">{idx + 1}.</span>
                      <span className="text-xs font-mono font-semibold w-16 text-right">{formatInt(row.strike)}</span>
                      <div className="flex-1 h-4 bg-secondary/30 rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/30 rounded-sm"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-16 text-right">
                        {formatInt(row.ce.oi)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Top PE OI */}
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Top PE Open Interest
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...data.strikes]
                .sort((a, b) => b.pe.oi - a.pe.oi)
                .slice(0, 5)
                .map((row, idx) => {
                  const maxOI = data.strikes.reduce((m, r) => Math.max(m, r.pe.oi), 0);
                  const pct = maxOI > 0 ? (row.pe.oi / maxOI) * 100 : 0;
                  return (
                    <div key={row.strike} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground w-4">{idx + 1}.</span>
                      <span className="text-xs font-mono font-semibold w-16 text-right">{formatInt(row.strike)}</span>
                      <div className="flex-1 h-4 bg-secondary/30 rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-red-500/30 rounded-sm"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-16 text-right">
                        {formatInt(row.pe.oi)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── IV Skew Table ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            IV Skew Across Strikes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-medium text-muted-foreground text-[10px]">Strike</TableHead>
                  <TableHead className="text-right font-medium text-emerald-400 text-[10px]">CE IV</TableHead>
                  <TableHead className="text-right font-medium text-red-400 text-[10px]">PE IV</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground text-[10px]">Skew</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.iv_skew.map((row) => {
                  const skew = row.pe_iv - row.ce_iv;
                  return (
                    <TableRow key={row.strike} className="border-border/50">
                      <TableCell className={cn(
                        'font-mono py-1.5',
                        row.strike === atmStrike ? 'font-bold text-amber-400' : 'text-zinc-300'
                      )}>
                        {formatInt(row.strike)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums py-1.5 text-emerald-300">
                        {row.ce_iv.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums py-1.5 text-red-300">
                        {row.pe_iv.toFixed(2)}%
                      </TableCell>
                      <TableCell className={cn(
                        'text-right font-mono tabular-nums py-1.5',
                        skew > 0 ? 'text-red-400' : skew < 0 ? 'text-emerald-400' : 'text-zinc-400'
                      )}>
                        {skew > 0 ? '+' : ''}{skew.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Footer Note ── */}
      <div className="text-[10px] text-muted-foreground text-center pb-2">
        Mock data for demonstration. Live options chain requires Kite API connection.
        &middot; DDLJ Trading System v9
      </div>
    </div>
  );
}
