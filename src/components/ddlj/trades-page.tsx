'use client';

/**
 * DDLJ Trades & Positions Page
 * =============================
 * Summary cards, filter bar, trade history table with expandable rows,
 * open positions card layout, and CSV export.
 */

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatDateTime } from '@/lib/utils';
import type { Trade, Position } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  History,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  X,
  BarChart3,
  Target,
  Percent,
  IndianRupee,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Helpers ──────────────────────────────────────────────────────

function exitReasonVariant(reason: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (reason === 'TARGET_HIT' || reason === 'NEAR_TARGET') return 'default';
  if (reason === 'STOP_LOSS') return 'destructive';
  return 'secondary';
}

// ── Component ────────────────────────────────────────────────────

export function TradesPage() {
  const { trades, positions, fetchTrades, fetchPositions } = useDDLJStore();

  useEffect(() => {
    fetchTrades();
    fetchPositions();
  }, [fetchTrades, fetchPositions]);

  // Filters
  const [symbolFilter, setSymbolFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (symbolFilter !== 'ALL' && t.symbol !== symbolFilter) return false;
      if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;
      return true;
    });
  }, [trades, symbolFilter, directionFilter]);

  // ── Summary Stats (from filteredTrades) ──────────────────────
  const totalTrades = filteredTrades.length;
  const wins = filteredTrades.filter((t) => t.net > 0).length;
  const totalProfit = filteredTrades.filter((t) => t.net > 0).reduce((sum, t) => sum + t.net, 0);
  const totalLoss = filteredTrades.filter((t) => t.net < 0).reduce((sum, t) => sum + Math.abs(t.net), 0);
  const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss) : totalProfit > 0 ? Infinity : 0;
  const netPnl = filteredTrades.reduce((sum, t) => sum + t.net, 0);
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  const hasFilters = symbolFilter !== 'ALL' || directionFilter !== 'ALL';

  // ── CSV Export ────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Symbol',
      'Direction',
      'Option',
      'Entry',
      'Exit',
      'Net P&L',
      'RR',
      'Exit Reason',
      'Entry Time',
      'Exit Time',
      'Gross',
      'Costs',
      'Qty',
      'SL',
      'Target',
    ];
    const rows = filteredTrades.map((t) => [
      t.id ?? '',
      t.symbol,
      t.direction,
      t.option_type ? `${t.option_strike} ${t.option_type}` : '',
      t.option_entry_premium?.toFixed(1) ?? t.entry.toLocaleString('en-IN'),
      t.option_exit_premium?.toFixed(1) ?? t.exit.toLocaleString('en-IN'),
      t.net.toString(),
      t.rr.toFixed(1),
      t.exit_reason,
      t.entry_time,
      t.exit_time,
      t.gross.toString(),
      t.costs.toString(),
      t.qty.toString(),
      t.sl.toString(),
      t.target.toString(),
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ddlj-trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredTrades.length} trades`);
  };

  return (
    <div className="page-enter space-y-4">
      {/* ── Summary Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Trades</span>
            </div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums">{totalTrades}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Win Rate</span>
            </div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums">
              {totalTrades > 0 ? `${winRate.toFixed(1)}%` : '—'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Profit Factor</span>
            </div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums">
              {totalTrades > 0
                ? profitFactor === Infinity
                  ? '∞'
                  : profitFactor.toFixed(2)
                : '—'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Net P&L</span>
            </div>
            <div className={cn('mt-1 text-2xl font-bold font-mono tabular-nums', pnlColor(netPnl))}>
              {formatCurrency(netPnl)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────── */}
      <Card className="bg-card/60 border-border">
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select value={symbolFilter} onValueChange={setSymbolFilter}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Symbols</SelectItem>
                <SelectItem value="BANKNIFTY">BankNifty</SelectItem>
                <SelectItem value="NIFTY">Nifty</SelectItem>
              </SelectContent>
            </Select>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Directions</SelectItem>
                <SelectItem value="LONG">Long</SelectItem>
                <SelectItem value="SHORT">Short</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => {
                  setSymbolFilter('ALL');
                  setDirectionFilter('ALL');
                }}
              >
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleExportCSV}
                disabled={filteredTrades.length === 0}
              >
                <Download className="h-3 w-3" /> CSV Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs: Trade History / Open Positions ────────────────── */}
      <Tabs defaultValue="history">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> Trade History
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" /> Open Positions ({positions.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Trade History Tab ─────────────────────────────────── */}
        <TabsContent value="history">
          <Card className="bg-card/60 border-border">
            <CardContent className="p-0">
              {filteredTrades.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No trades yet</p>
                  <p className="text-xs mt-1">
                    Trades will appear here once the engine starts trading
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs w-10">#</TableHead>
                        <TableHead className="text-xs">Symbol</TableHead>
                        <TableHead className="text-xs">Direction</TableHead>
                        <TableHead className="text-xs">Option</TableHead>
                        <TableHead className="text-xs">Entry</TableHead>
                        <TableHead className="text-xs">Exit</TableHead>
                        <TableHead className="text-xs">Net P&L</TableHead>
                        <TableHead className="text-xs">RR</TableHead>
                        <TableHead className="text-xs">Exit Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTrades.map((trade, idx) => (
                        <Fragment key={trade.id ?? `${trade.symbol}-${trade.exit_time}-${idx}`}>
                          <TableRow
                            className="border-border/50 hover:bg-secondary/30 cursor-pointer"
                            onClick={() =>
                              setExpandedTrade(
                                expandedTrade === (trade.id ?? `${trade.symbol}-${trade.exit_time}-${idx}`)
                                  ? null
                                  : (trade.id ?? `${trade.symbol}-${trade.exit_time}-${idx}`)
                              )
                            }
                          >
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {trade.symbol}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={trade.direction === 'LONG' ? 'default' : 'destructive'}
                                className="text-[10px] gap-1"
                              >
                                {trade.direction === 'LONG' ? (
                                  <ArrowUpRight className="h-3 w-3" />
                                ) : (
                                  <ArrowDownRight className="h-3 w-3" />
                                )}
                                {trade.direction}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {trade.option_type
                                ? `${trade.option_strike} ${trade.option_type}`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              ₹{trade.option_entry_premium?.toFixed(1) ?? trade.entry.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              ₹{trade.option_exit_premium?.toFixed(1) ?? trade.exit.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-xs font-mono font-semibold tabular-nums',
                                pnlColor(trade.net)
                              )}
                            >
                              {trade.net >= 0 ? '+' : ''}₹
                              {Math.abs(trade.net).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {trade.rr.toFixed(1)}x
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={exitReasonVariant(trade.exit_reason)}
                                className="text-[9px]"
                              >
                                {trade.exit_reason.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {/* ── Expanded Row ─────────────────────── */}
                          {expandedTrade === (trade.id ?? `${trade.symbol}-${trade.exit_time}-${idx}`) && (
                            <TableRow className="border-border/30 bg-secondary/10">
                              <TableCell colSpan={9} className="p-4">
                                <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
                                  {/* P&L Breakdown */}
                                  <div>
                                    <span className="text-muted-foreground font-semibold">
                                      P&L Breakdown
                                    </span>
                                    <div className="mt-1.5 space-y-1">
                                      <p>
                                        Gross:{' '}
                                        <span className={cn('font-mono', pnlColor(trade.gross))}>
                                          ₹{trade.gross.toLocaleString('en-IN')}
                                        </span>
                                      </p>
                                      <p>
                                        Costs:{' '}
                                        <span className="font-mono text-red-400">
                                          -₹{trade.costs.toLocaleString('en-IN')}
                                        </span>
                                      </p>
                                      <p>
                                        Net:{' '}
                                        <span
                                          className={cn(
                                            'font-mono font-semibold',
                                            pnlColor(trade.net)
                                          )}
                                        >
                                          ₹{trade.net.toLocaleString('en-IN')}
                                        </span>
                                      </p>
                                    </div>
                                  </div>

                                  {/* Greeks */}
                                  <div>
                                    <span className="text-muted-foreground font-semibold">
                                      Greeks
                                    </span>
                                    <div className="mt-1.5 space-y-1">
                                      <p>
                                        Delta:{' '}
                                        <span className="font-mono">
                                          {trade.option_delta ?? '—'}
                                        </span>
                                      </p>
                                      <p>
                                        IV Entry:{' '}
                                        <span className="font-mono">
                                          {trade.option_iv_entry
                                            ? `${trade.option_iv_entry.toFixed(1)}%`
                                            : '—'}
                                        </span>
                                      </p>
                                      <p>
                                        IV Exit:{' '}
                                        <span className="font-mono">
                                          {trade.option_iv_exit
                                            ? `${trade.option_iv_exit.toFixed(1)}%`
                                            : '—'}
                                        </span>
                                      </p>
                                    </div>
                                  </div>

                                  {/* Timing */}
                                  <div>
                                    <span className="text-muted-foreground font-semibold">
                                      Timing
                                    </span>
                                    <div className="mt-1.5 space-y-1">
                                      <p>
                                        Entry:{' '}
                                        <span className="font-mono">
                                          {formatDateTime(trade.entry_time)}
                                        </span>
                                      </p>
                                      <p>
                                        Exit:{' '}
                                        <span className="font-mono">
                                          {formatDateTime(trade.exit_time)}
                                        </span>
                                      </p>
                                      <p>
                                        Duration:{' '}
                                        <span className="font-mono">{trade.held}</span>
                                      </p>
                                    </div>
                                  </div>

                                  {/* Position Details */}
                                  <div>
                                    <span className="text-muted-foreground font-semibold">
                                      Position
                                    </span>
                                    <div className="mt-1.5 space-y-1">
                                      <p>
                                        Qty:{' '}
                                        <span className="font-mono">{trade.qty} lots</span>
                                      </p>
                                      <p>
                                        SL:{' '}
                                        <span className="font-mono text-red-400">
                                          ₹{trade.sl.toLocaleString('en-IN')}
                                        </span>
                                      </p>
                                      <p>
                                        Target:{' '}
                                        <span className="font-mono text-emerald-400">
                                          ₹{trade.target.toLocaleString('en-IN')}
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Open Positions Tab ────────────────────────────────── */}
        <TabsContent value="positions">
          <Card className="bg-card/60 border-border">
            <CardContent className="p-4">
              {positions.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No open positions</p>
                  <p className="text-xs mt-1">Start the engine to begin trading</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {positions.map((pos) => (
                    <PositionCard key={pos.id ?? `${pos.symbol}-${pos.entry_time}`} position={pos} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Position Card Sub-component ────────────────────────────────

function PositionCard({ position }: { position: Position }) {
  const isLong = position.direction === 'LONG';
  const unrealizedPnl = position.unrealized_pnl ?? 0;

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50">
      {/* Top row: icon + symbol + unrealized P&L */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              isLong ? 'bg-emerald-500/20' : 'bg-red-500/20'
            )}
          >
            {isLong ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-400" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{position.symbol}</span>
              <Badge
                variant={isLong ? 'default' : 'destructive'}
                className="text-[10px]"
              >
                {position.direction}
              </Badge>
              {position.option_type && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {position.option_strike} {position.option_type}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Entry: {formatDateTime(position.entry_time)} &middot; {position.held}
            </p>
          </div>
        </div>
        <div
          className={cn(
            'text-xl font-bold font-mono tabular-nums',
            pnlColor(unrealizedPnl)
          )}
        >
          {formatCurrency(unrealizedPnl)}
        </div>
      </div>

      {/* Bottom row: entry / SL / target / RR */}
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Entry</span>
          <p className="font-mono mt-0.5">
            ₹{position.entry.toLocaleString('en-IN')}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">SL</span>
          <p className="font-mono mt-0.5 text-red-400">
            ₹{position.sl.toLocaleString('en-IN')}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Target</span>
          <p className="font-mono mt-0.5 text-emerald-400">
            ₹{position.target.toLocaleString('en-IN')}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">RR</span>
          <p className="font-mono mt-0.5">{position.rr.toFixed(1)}x</p>
        </div>
      </div>
    </div>
  );
}
