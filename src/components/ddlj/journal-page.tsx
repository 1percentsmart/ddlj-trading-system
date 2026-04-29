'use client';

import { useMemo, useState } from 'react';
import { BookOpen, TrendingUp, TrendingDown, ChevronDown, Circle } from 'lucide-react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatDateTime } from '@/lib/utils';
import type { Trade } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ── Journal Entry Card ───────────────────────────────────────────
function JournalEntry({ trade }: { trade: Trade }) {
  const [isOpen, setIsOpen] = useState(false);
  const isLong = trade.direction === 'LONG';
  const isWin = trade.net > 0;
  const isOptions = !!(trade.option_type || trade.option_strike);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden transition-colors hover:bg-accent/30">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardContent className="flex items-center gap-4 py-3 px-4">
              {/* Direction Badge */}
              <div
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase shrink-0',
                  isLong
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                )}
              >
                {isLong ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {trade.direction}
              </div>

              {/* Symbol & Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{trade.symbol}</p>
                  {isOptions && trade.option_type && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                      {trade.option_strike} {trade.option_type}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {formatDateTime(trade.entry_time)} → {formatDateTime(trade.exit_time)}
                </p>
              </div>

              {/* P&L */}
              <div className="text-right shrink-0">
                <p className={cn('text-sm font-semibold tabular-nums', pnlColor(trade.net))}>
                  {formatCurrency(trade.net)}
                </p>
                <p className="text-xs text-muted-foreground">
                  RR {trade.rr.toFixed(1)} &middot; {trade.held}
                </p>
              </div>

              {/* Expand Chevron */}
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </CardContent>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/40 px-4 py-3 space-y-3">
            {/* Trade Details Grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Trade ID</span>
                <p className="font-medium mt-0.5">{trade.id ?? '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Entry Price</span>
                <p className="font-medium mt-0.5">₹{trade.entry.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Exit Price</span>
                <p className="font-medium mt-0.5">₹{trade.exit.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Quantity</span>
                <p className="font-medium mt-0.5">{trade.qty}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Gross P&L</span>
                <p className={cn('font-medium mt-0.5', pnlColor(trade.gross))}>
                  {formatCurrency(trade.gross)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Costs</span>
                <p className="font-medium mt-0.5 text-red-400">-{formatCurrency(trade.costs)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stop Loss</span>
                <p className="font-medium mt-0.5">₹{trade.sl.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Target</span>
                <p className="font-medium mt-0.5">₹{trade.target.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Exit Reason</span>
                <p className="font-medium mt-0.5">{trade.exit_reason}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Mode</span>
                <p className="font-medium mt-0.5 capitalize">{trade.mode}</p>
              </div>
            </div>

            {/* Greeks (if options trade) */}
            {isOptions && (
              <div className="border-t border-border/30 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Option Greeks & Details
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                  {trade.option_entry_premium !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Entry Premium</span>
                      <p className="font-medium mt-0.5">₹{trade.option_entry_premium.toFixed(2)}</p>
                    </div>
                  )}
                  {trade.option_exit_premium !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Exit Premium</span>
                      <p className="font-medium mt-0.5">₹{trade.option_exit_premium.toFixed(2)}</p>
                    </div>
                  )}
                  {trade.option_delta !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Delta</span>
                      <p className="font-medium mt-0.5">{trade.option_delta.toFixed(3)}</p>
                    </div>
                  )}
                  {trade.option_iv_entry !== undefined && (
                    <div>
                      <span className="text-muted-foreground">IV (Entry)</span>
                      <p className="font-medium mt-0.5">{trade.option_iv_entry.toFixed(1)}%</p>
                    </div>
                  )}
                  {trade.option_iv_exit !== undefined && (
                    <div>
                      <span className="text-muted-foreground">IV (Exit)</span>
                      <p className="font-medium mt-0.5">{trade.option_iv_exit.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ── Main Journal Page ────────────────────────────────────────────
export default function JournalPage() {
  const { trades, positions } = useDDLJStore();

  // ── Computed stats ────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.net > 0).length;
    const losses = trades.filter((t) => t.net <= 0).length;
    return { totalTrades, wins, losses };
  }, [trades]);

  // ── Sorted trades (newest first) ──────────────────────────────
  const sortedTrades = useMemo(() => {
    return [...trades].sort(
      (a, b) => new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime()
    );
  }, [trades]);

  return (
    <div className="page-enter space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Trading Journal</h1>
          <p className="text-xs text-muted-foreground">Review and analyze your trades</p>
        </div>
      </div>

      {/* ── Analytics Summary ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Trades */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Trades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold tracking-tight">{stats.totalTrades}</span>
            <p className="mt-1 text-xs text-muted-foreground">
              {positions.length} open position{positions.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        {/* Wins */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Winning Trades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-emerald-400" />
              <span className="text-2xl font-bold tracking-tight text-emerald-400">{stats.wins}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.totalTrades > 0
                ? `${((stats.wins / stats.totalTrades) * 100).toFixed(1)}% win rate`
                : 'No trades yet'}
            </p>
          </CardContent>
        </Card>

        {/* Losses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Losing Trades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="size-5 text-red-400" />
              <span className="text-2xl font-bold tracking-tight text-red-400">{stats.losses}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.losses > 0 ? 'Review for improvement' : 'No losses'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Journal Entries ────────────────────────────────────── */}
      {sortedTrades.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Circle className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No journal entries yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start trading to see entries here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
          {sortedTrades.map((trade) => (
            <JournalEntry
              key={trade.id ?? `${trade.symbol}-${trade.exit_time}`}
              trade={trade}
            />
          ))}
        </div>
      )}
    </div>
  );
}
