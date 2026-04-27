'use client';

/**
 * DDLJ Trades & Positions — Real Data
 * ======================================
 * Shows trade history from API. Clean, minimal.
 */

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

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
    return trades.filter(t => {
      if (symbolFilter !== 'ALL' && t.symbol !== symbolFilter) return false;
      if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;
      return true;
    });
  }, [trades, symbolFilter, directionFilter]);

  // Stats
  const totalProfit = filteredTrades.filter(t => t.net > 0).reduce((sum, t) => sum + t.net, 0);
  const totalLoss = filteredTrades.filter(t => t.net < 0).reduce((sum, t) => sum + Math.abs(t.net), 0);
  const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : '—';
  const netPnl = totalProfit - totalLoss;
  const winRate = filteredTrades.length > 0
    ? ((filteredTrades.filter(t => t.net > 0).length / filteredTrades.length) * 100).toFixed(1)
    : '—';

  const handleExportCSV = () => {
    const headers = ['ID', 'Symbol', 'Direction', 'Option', 'Entry', 'Exit', 'Net P&L', 'RR', 'Exit Reason', 'Entry Time', 'Exit Time'];
    const rows = filteredTrades.map(t => [
      t.id, t.symbol, t.direction, t.option_type ? `${t.option_strike} ${t.option_type}` : '',
      t.option_entry_premium?.toFixed(1) || t.entry.toLocaleString(),
      t.option_exit_premium?.toFixed(1) || t.exit.toLocaleString(),
      t.net, t.rr.toFixed(1), t.exit_reason, t.entry_time, t.exit_time
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ddlj-trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredTrades.length} trades`);
  };

  const hasFilters = symbolFilter !== 'ALL' || directionFilter !== 'ALL';

  return (
    <div className="space-y-4 p-4">
      {/* ── Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Total Trades</div>
            <div className="text-lg font-bold font-mono">{filteredTrades.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Win Rate</div>
            <div className="text-lg font-bold font-mono">{winRate}{winRate !== '—' ? '%' : ''}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Profit Factor</div>
            <div className="text-lg font-bold font-mono">{profitFactor}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Net P&L</div>
            <div className={cn('text-lg font-bold font-mono', pnlColor(netPnl))}>
              {formatCurrency(netPnl)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      <Card className="bg-card/60 border-border">
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={symbolFilter} onValueChange={setSymbolFilter}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Symbols</SelectItem>
                <SelectItem value="BANKNIFTY">BankNifty</SelectItem>
                <SelectItem value="NIFTY">Nifty</SelectItem>
              </SelectContent>
            </Select>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Dir.</SelectItem>
                <SelectItem value="LONG">Long</SelectItem>
                <SelectItem value="SHORT">Short</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setSymbolFilter('ALL'); setDirectionFilter('ALL'); }}>
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
            <div className="ml-auto">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleExportCSV}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> Trade History
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" /> Positions ({positions.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Trade History ── */}
        <TabsContent value="history">
          <Card className="bg-card/60 border-border">
            <CardContent className="p-0">
              {filteredTrades.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No trades yet</p>
                  <p className="text-xs mt-1">Trades will appear here once the engine starts trading</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs">#</TableHead>
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
                      {filteredTrades.map((trade) => (
                        <Fragment key={trade.id}>
                          <TableRow
                            className="border-border/50 hover:bg-secondary/30 cursor-pointer"
                            onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                          >
                            <TableCell className="text-xs font-mono">{trade.id}</TableCell>
                            <TableCell className="text-xs font-medium">{trade.symbol}</TableCell>
                            <TableCell>
                              <Badge variant={trade.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px] gap-1">
                                {trade.direction === 'LONG' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {trade.direction}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {trade.option_type ? `${trade.option_strike} ${trade.option_type}` : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              ₹{trade.option_entry_premium?.toFixed(1) || trade.entry.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              ₹{trade.option_exit_premium?.toFixed(1) || trade.exit.toLocaleString()}
                            </TableCell>
                            <TableCell className={cn('text-xs font-mono font-semibold tabular-nums', pnlColor(trade.net))}>
                              {trade.net >= 0 ? '+' : ''}₹{Math.abs(trade.net).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{trade.rr.toFixed(1)}x</TableCell>
                            <TableCell>
                              <Badge variant={
                                trade.exit_reason === 'TARGET_HIT' || trade.exit_reason === 'NEAR_TARGET' ? 'default' :
                                trade.exit_reason === 'STOP_LOSS' ? 'destructive' : 'secondary'
                              } className="text-[9px]">
                                {trade.exit_reason.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          {expandedTrade === trade.id && (
                            <TableRow className="border-border/30 bg-secondary/10">
                              <TableCell colSpan={9} className="p-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <span className="text-muted-foreground font-semibold">P&L Breakdown</span>
                                    <div className="mt-1 space-y-0.5">
                                      <p>Gross: <span className={cn('font-mono', pnlColor(trade.gross))}>₹{trade.gross.toLocaleString('en-IN')}</span></p>
                                      <p>Costs: <span className="font-mono text-red-400">-₹{trade.costs.toLocaleString('en-IN')}</span></p>
                                      <p>Net: <span className={cn('font-mono font-semibold', pnlColor(trade.net))}>₹{trade.net.toLocaleString('en-IN')}</span></p>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground font-semibold">Greeks</span>
                                    <div className="mt-1 space-y-0.5">
                                      <p>Delta: <span className="font-mono">{trade.option_delta ?? '—'}</span></p>
                                      <p>IV Entry: <span className="font-mono">{trade.option_iv_entry ? `${trade.option_iv_entry}%` : '—'}</span></p>
                                      <p>IV Exit: <span className="font-mono">{trade.option_iv_exit ? `${trade.option_iv_exit}%` : '—'}</span></p>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground font-semibold">Timing</span>
                                    <div className="mt-1 space-y-0.5">
                                      <p>Entry: <span className="font-mono">{formatDateTime(trade.entry_time)}</span></p>
                                      <p>Exit: <span className="font-mono">{formatDateTime(trade.exit_time)}</span></p>
                                      <p>Duration: <span className="font-mono">{trade.held}</span></p>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground font-semibold">Position</span>
                                    <div className="mt-1 space-y-0.5">
                                      <p>Qty: <span className="font-mono">{trade.qty} lots</span></p>
                                      <p>SL: <span className="font-mono">₹{trade.sl.toLocaleString()}</span></p>
                                      <p>Target: <span className="font-mono">₹{trade.target.toLocaleString()}</span></p>
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

        {/* ── Open Positions ── */}
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
                    <div key={pos.id} className="p-4 rounded-lg bg-secondary/30 border border-border">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center',
                            pos.direction === 'LONG' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          )}>
                            {pos.direction === 'LONG' ?
                              <ArrowUpRight className="h-4 w-4 text-emerald-400" /> :
                              <ArrowDownRight className="h-4 w-4 text-red-400" />
                            }
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{pos.symbol}</span>
                              <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px]">
                                {pos.direction}
                              </Badge>
                              {pos.option_type && (
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {pos.option_strike} {pos.option_type}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={cn('text-xl font-bold font-mono tabular-nums', pnlColor(pos.unrealized_pnl || 0))}>
                          {formatCurrency(pos.unrealized_pnl || 0)}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Entry</span>
                          <p className="font-mono">₹{pos.entry.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">SL</span>
                          <p className="font-mono text-red-400">₹{pos.sl.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Target</span>
                          <p className="font-mono text-emerald-400">₹{pos.target.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">RR</span>
                          <p className="font-mono">{pos.rr.toFixed(1)}x</p>
                        </div>
                      </div>
                    </div>
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
