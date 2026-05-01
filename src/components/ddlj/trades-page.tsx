'use client';

/**
 * DDLJ Trading System — Trades Page
 * =====================================
 * Full trade history with detailed columns, filtering,
 * and export capabilities.
 */

import { useState, useMemo } from 'react';
import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn, formatCurrency, pnlColor, formatDateTime } from '@/lib/utils';
import { ArrowUpDown, Search, Filter, Download, TrendingUp, TrendingDown, Target } from 'lucide-react';

export function TradesPage() {
  const { trades, positions } = useDDLJStore();
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState<'all' | 'LONG' | 'SHORT'>('all');

  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (dirFilter !== 'all' && t.direction !== dirFilter) return false;
      if (search && !t.symbol.toLowerCase().includes(search.toLowerCase()) &&
          !t.exit_reason.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [trades, search, dirFilter]);

  const totalPnl = filteredTrades.reduce((s, t) => s + t.net, 0);
  const wins = filteredTrades.filter(t => t.net > 0).length;
  const winRate = filteredTrades.length > 0 ? (wins / filteredTrades.length * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trade History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete record of all completed trades
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Target className="h-3 w-3" />
            {filteredTrades.length} trades
          </Badge>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Total P&L</p>
            <p className={cn('text-lg font-bold', pnlColor(totalPnl))}>
              {formatCurrency(totalPnl)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Win Rate</p>
            <p className={cn('text-lg font-bold', winRate >= 50 ? 'text-emerald-400' : 'text-amber-400')}>
              {winRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Open Positions</p>
            <p className="text-lg font-bold">{positions.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Avg Trade</p>
            <p className={cn('text-lg font-bold', pnlColor(filteredTrades.length > 0 ? totalPnl / filteredTrades.length : 0))}>
              {formatCurrency(filteredTrades.length > 0 ? totalPnl / filteredTrades.length : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by symbol or exit reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="flex rounded-lg border border-border/50 overflow-hidden">
              {(['all', 'LONG', 'SHORT'] as const).map((dir) => (
                <Button
                  key={dir}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-8 px-3 text-xs rounded-none',
                    dirFilter === dir
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setDirFilter(dir)}
                >
                  {dir === 'all' ? 'All' : dir}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trade Table */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Trades</CardTitle>
          <CardDescription>Click column headers to sort</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTrades.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ArrowUpDown className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="font-medium">No trades found</p>
              <p className="text-sm">Trades will appear here once the engine starts executing</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs h-9">#</TableHead>
                    <TableHead className="text-xs h-9">Date/Time</TableHead>
                    <TableHead className="text-xs h-9">Symbol</TableHead>
                    <TableHead className="text-xs h-9">Direction</TableHead>
                    <TableHead className="text-xs h-9 text-right">Entry</TableHead>
                    <TableHead className="text-xs h-9 text-right">Exit</TableHead>
                    <TableHead className="text-xs h-9 text-right">SL</TableHead>
                    <TableHead className="text-xs h-9 text-right">Target</TableHead>
                    <TableHead className="text-xs h-9 text-right">Qty</TableHead>
                    <TableHead className="text-xs h-9">Exit Reason</TableHead>
                    <TableHead className="text-xs h-9 text-right">Net P&L</TableHead>
                    <TableHead className="text-xs h-9 text-right">R:R</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map((t, i) => (
                    <TableRow key={i} className="text-xs hover:bg-muted/30">
                      <TableCell className="py-2 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="py-2 whitespace-nowrap">
                        {t.entry_time ? formatDateTime(t.entry_time) : '—'}
                      </TableCell>
                      <TableCell className="py-2 font-medium">{t.symbol}</TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0 font-semibold border-0',
                            t.direction === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                          )}
                        >
                          {t.direction}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono">{formatCurrency(t.entry)}</TableCell>
                      <TableCell className="py-2 text-right font-mono">{formatCurrency(t.exit)}</TableCell>
                      <TableCell className="py-2 text-right font-mono text-red-400/80">{formatCurrency(t.sl)}</TableCell>
                      <TableCell className="py-2 text-right font-mono text-emerald-400/80">{formatCurrency(t.target)}</TableCell>
                      <TableCell className="py-2 text-right">{t.qty}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.exit_reason}</Badge>
                      </TableCell>
                      <TableCell className={cn('py-2 text-right font-semibold font-mono', pnlColor(t.net))}>
                        {t.net > 0 ? '+' : ''}{formatCurrency(t.net)}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono">
                        {t.rr > 0 ? t.rr.toFixed(2) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
