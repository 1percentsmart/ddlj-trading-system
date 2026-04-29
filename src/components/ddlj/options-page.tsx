'use client';

import { useState } from 'react';
import { Layers, WifiOff, Loader2, ArrowLeftRight } from 'lucide-react';
import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// ── Placeholder Row ──────────────────────────────────────────────
function PlaceholderRow({ strike, cePlaceholder, pePlaceholder }: { strike: string; cePlaceholder: string; pePlaceholder: string }) {
  return (
    <div className="grid grid-cols-[1fr_80px_1fr] items-center gap-2 border-b border-border/40 py-2 text-sm last:border-0">
      <div className="text-right text-zinc-500 dark:text-zinc-600 tabular-nums">{cePlaceholder}</div>
      <div className="text-center font-medium text-muted-foreground text-xs">{strike}</div>
      <div className="text-left text-zinc-500 dark:text-zinc-600 tabular-nums">{pePlaceholder}</div>
    </div>
  );
}

// ── Main Options Page ────────────────────────────────────────────
export default function OptionsPage() {
  const { engineStatus, isConnected } = useDDLJStore();
  const [symbol, setSymbol] = useState<'BANKNIFTY' | 'NIFTY'>('BANKNIFTY');

  const isEngineRunning = engineStatus.engine_running;
  const isTokenValid = engineStatus.token.valid;

  // Connected + engine running + token valid → show loading
  const isActive = isConnected && isEngineRunning && isTokenValid;

  const placeholderStrikes = symbol === 'BANKNIFTY'
    ? ['48,000', '48,500', '49,000', '49,500', '50,000', '50,500', '51,000']
    : ['22,000', '22,500', '23,000', '23,500', '24,000', '24,500', '25,000'];

  return (
    <div className="page-enter space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Layers className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Options Chain</h1>
          <p className="text-xs text-muted-foreground">Live options data & OI analysis</p>
        </div>
      </div>

      {/* ── Symbol Tabs ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Tabs value={symbol} onValueChange={(v) => setSymbol(v as 'BANKNIFTY' | 'NIFTY')}>
          <TabsList className="h-8">
            <TabsTrigger value="BANKNIFTY" className="text-xs px-4">BANKNIFTY</TabsTrigger>
            <TabsTrigger value="NIFTY" className="text-xs px-4">NIFTY</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Connection Status */}
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

      {/* ── Info Card ──────────────────────────────────────────── */}
      {!isActive && (
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
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Loading State (active engine) ──────────────────────── */}
      {isActive && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium">Fetching options data...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Loading {symbol} options chain from Kite
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Placeholder Table (no active engine) ───────────────── */}
      {!isActive && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {symbol} Options
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                Placeholder
              </Badge>
            </div>
            {/* Column Headers */}
            <div className="grid grid-cols-[1fr_80px_1fr] gap-2 pt-2 border-t border-border/40">
              <div className="text-right text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">
                CE (Calls)
              </div>
              <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Strike
              </div>
              <div className="text-left text-[10px] font-semibold uppercase tracking-wider text-red-500/70">
                PE (Puts)
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {placeholderStrikes.map((strike) => (
              <PlaceholderRow
                key={strike}
                strike={strike}
                cePlaceholder="—"
                pePlaceholder="—"
              />
            ))}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ArrowLeftRight className="size-3.5" />
              <span>Live LTP, OI, IV & Greeks available when engine is connected</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
