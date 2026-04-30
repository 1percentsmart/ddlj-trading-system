'use client';

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { Layers, WifiOff, ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Position } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────

interface OptionsChainRow {
  strike: number;
  ceLtp: number;
  ceOi: number;
  ceIv: number;
  ceDelta: number;
  peLtp: number;
  peOi: number;
  peIv: number;
  peDelta: number;
  isATM: boolean;
}

// ── Build options chain from positions ────────────────────────────

function buildOptionsChain(positions: Position[]): OptionsChainRow[] {
  const cePositions = positions.filter((p) => p.option_type === 'CE');
  const pePositions = positions.filter((p) => p.option_type === 'PE');

  // Collect all unique strikes
  const strikes = new Set<number>();
  cePositions.forEach((p) => { if (p.option_strike) strikes.add(p.option_strike); });
  pePositions.forEach((p) => { if (p.option_strike) strikes.add(p.option_strike); });

  if (strikes.size === 0) return [];

  const sortedStrikes = Array.from(strikes).sort((a, b) => a - b);

  // Find ATM (closest to middle)
  const midStrike = sortedStrikes[Math.floor(sortedStrikes.length / 2)];

  return sortedStrikes.map((strike) => {
    const ce = cePositions.find((p) => p.option_strike === strike);
    const pe = pePositions.find((p) => p.option_strike === strike);
    return {
      strike,
      ceLtp: ce?.current_premium ?? ce?.entry ?? 0,
      ceOi: 0, // OI not available from positions API
      ceIv: 0, // IV from trade data only
      ceDelta: 0, // Delta from trade data only
      peLtp: pe?.current_premium ?? pe?.entry ?? 0,
      peOi: 0,
      peIv: 0,
      peDelta: 0,
      isATM: strike === midStrike,
    };
  });
}

// ── PCR Computation ───────────────────────────────────────────────

function computePCR(positions: Position[]): number {
  const ceCount = positions.filter((p) => p.option_type === 'CE').length;
  const peCount = positions.filter((p) => p.option_type === 'PE').length;
  if (ceCount === 0) return peCount > 0 ? Infinity : 0;
  return peCount / ceCount;
}

// ── IV Skew Data ──────────────────────────────────────────────────

interface IVSkewPoint {
  strike: string;
  iv: number;
  type: 'CE' | 'PE';
}

function buildIVSkew(positions: Position[]): IVSkewPoint[] {
  const points: IVSkewPoint[] = [];
  positions.forEach((p) => {
    if (p.option_strike) {
      points.push({
        strike: `${p.option_strike}`,
        iv: 0, // IV not available in Position type currently
        type: p.option_type ?? 'CE',
      });
    }
  });
  return points;
}

// ── Main Options Page ─────────────────────────────────────────────
export default function OptionsPage() {
  const { engineStatus, isConnected, positions } = useDDLJStore();
  const [symbol, setSymbol] = useState<'BANKNIFTY' | 'NIFTY'>('BANKNIFTY');

  const isEngineRunning = engineStatus.engine_running;
  const isTokenValid = engineStatus.token.valid;
  const isActive = isConnected && isEngineRunning && isTokenValid;

  // Build data from positions
  const optionsChain = useMemo(() => buildOptionsChain(positions), [positions]);
  const pcr = useMemo(() => computePCR(positions), [positions]);
  const ivSkew = useMemo(() => buildIVSkew(positions), [positions]);

  const optionPositions = positions.filter((p) => p.option_type);
  const ceCount = optionPositions.filter((p) => p.option_type === 'CE').length;
  const peCount = optionPositions.filter((p) => p.option_type === 'PE').length;

  return (
    <div className="page-enter space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Layers className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Options Chain</h1>
          <p className="text-xs text-muted-foreground">Options positions, PCR & IV analysis</p>
        </div>
      </div>

      {/* ── Controls Row ───────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Tabs value={symbol} onValueChange={(v) => setSymbol(v as 'BANKNIFTY' | 'NIFTY')}>
          <TabsList className="h-8">
            <TabsTrigger value="BANKNIFTY" className="text-xs px-4">BANKNIFTY</TabsTrigger>
            <TabsTrigger value="NIFTY" className="text-xs px-4">NIFTY</TabsTrigger>
          </TabsList>
        </Tabs>

        {!isActive ? (
          <Badge variant="outline" className="gap-1.5 border-0 bg-amber-500/10 text-amber-500 text-xs">
            <WifiOff className="size-3" />
            Connect engine for live data
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 border-0 bg-emerald-500/10 text-emerald-400 text-xs">
            <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </Badge>
        )}
      </div>

      {/* ── No Engine Info Card ────────────────────────────────── */}
      {!isActive && optionPositions.length === 0 && (
        <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <WifiOff className="size-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Live Options Chain requires active engine
              </p>
              <p className="text-xs text-muted-foreground">
                Start the engine with a valid Kite token to see live options data, OI changes, and Greeks.
                When trades are taken, the options chain will populate from your positions.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-1.5 text-xs"
                onClick={() => useDDLJStore.getState().setActivePage('engine')}
              >
                Go to Engine
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── PCR & Summary Cards ────────────────────────────────── */}
      {optionPositions.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Put-Call Ratio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className={cn(
                'text-2xl font-bold tracking-tight',
                pcr > 1 ? 'text-emerald-400' : pcr < 0.5 ? 'text-red-400' : 'text-amber-400'
              )}>
                {pcr === Infinity ? '∞' : pcr.toFixed(2)}
              </span>
              <p className="mt-1 text-xs text-muted-foreground">
                {pcr > 1 ? 'Bullish sentiment (more puts)' : pcr < 0.5 ? 'Bearish sentiment (more calls)' : 'Neutral sentiment'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                CE Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-emerald-400" />
                <span className="text-2xl font-bold tracking-tight">{ceCount}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Call option positions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                PE Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingDown className="size-5 text-red-400" />
                <span className="text-2xl font-bold tracking-tight">{peCount}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Put option positions</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Options Chain Table ────────────────────────────────── */}
      {optionPositions.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Options Chain</CardTitle>
                <CardDescription className="text-xs mt-1">
                  From active positions — LTP shown as entry price when live premium unavailable
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {optionPositions.length} positions
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">CE LTP</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">CE OI</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">CE IV</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">CE Δ</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-center text-muted-foreground">Strike</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-red-500/70">PE Δ</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-red-500/70">PE IV</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-red-500/70">PE OI</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-red-500/70">PE LTP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {optionsChain.map((row) => (
                    <TableRow
                      key={row.strike}
                      className={cn(
                        'border-border/40',
                        row.isATM && 'bg-primary/5'
                      )}
                    >
                      <TableCell className="text-xs font-mono tabular-nums text-emerald-400">
                        {row.ceLtp > 0 ? `₹${row.ceLtp.toFixed(1)}` : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono tabular-nums text-muted-foreground">—</TableCell>
                      <TableCell className="text-xs font-mono tabular-nums text-muted-foreground">—</TableCell>
                      <TableCell className="text-xs font-mono tabular-nums text-muted-foreground">—</TableCell>
                      <TableCell className={cn(
                        'text-xs font-bold tabular-nums text-center',
                        row.isATM ? 'text-primary' : 'text-foreground'
                      )}>
                        {row.strike.toLocaleString('en-IN')}
                        {row.isATM && <span className="ml-1 text-[9px] text-primary font-normal">ATM</span>}
                      </TableCell>
                      <TableCell className="text-xs font-mono tabular-nums text-muted-foreground">—</TableCell>
                      <TableCell className="text-xs font-mono tabular-nums text-muted-foreground">—</TableCell>
                      <TableCell className="text-xs font-mono tabular-nums text-muted-foreground">—</TableCell>
                      <TableCell className="text-xs font-mono tabular-nums text-red-400">
                        {row.peLtp > 0 ? `₹${row.peLtp.toFixed(1)}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground px-4">
              <ArrowLeftRight className="size-3.5" />
              <span>IV, Delta & OI columns require live market data from Kite API</span>
            </div>
          </CardContent>
        </Card>
      ) : isActive ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Layers className="size-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Waiting for options data...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Options positions will populate when the engine takes trades
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* ── IV Skew Visualization ──────────────────────────────── */}
      {ivSkew.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">IV Skew</CardTitle>
            <CardDescription className="text-xs">
              Implied volatility across strikes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ivSkew}>
                  <XAxis
                    dataKey="strike"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Bar dataKey="iv" radius={[4, 4, 0, 0]}>
                    {ivSkew.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.type === 'CE' ? '#10b981' : '#ef4444'}
                        fillOpacity={0.7}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-sm bg-emerald-500" />
                <span>CE (Calls)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-sm bg-red-500" />
                <span>PE (Puts)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Active Options Positions List ──────────────────────── */}
      {optionPositions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Options Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {optionPositions.map((pos) => (
                <div
                  key={pos.id ?? `${pos.symbol}-${pos.entry_time}`}
                  className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                      pos.option_type === 'CE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    )}>
                      {pos.option_type === 'CE' ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {pos.option_type}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{pos.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        Strike: ₹{pos.option_strike?.toLocaleString('en-IN')} &middot; Qty: {pos.qty}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">
                      ₹{pos.entry.toLocaleString('en-IN')}
                    </p>
                    {pos.unrealized_pnl !== undefined && (
                      <p className={cn('text-xs', pnlColor(pos.unrealized_pnl))}>
                        {formatCurrency(pos.unrealized_pnl)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
