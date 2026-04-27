'use client';

/**
 * DDLJ Trades & Positions Page (Enhanced)
 * ==========================================
 * Date/symbol/direction filters, CSV export, cumulative P&L chart,
 * streak tracking, expandable trade details, trade analytics summary.
 */

import { useState, useMemo, Fragment } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatDateTime, formatDate } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  BarChart3,
  ChevronRight,
  ChevronDown,
  Flame,
  CalendarDays,
  X,
  Trophy,
  AlertOctagon,
  Clock,
  Scale,
  Target,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { toast } from 'sonner';
import type { Trade } from '@/lib/mock-data';

function parseHoldTime(held: string): number {
  const hMatch = held.match(/(\d+)h/);
  const mMatch = held.match(/(\d+)m/);
  return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0);
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function TradesPage() {
  const { trades, positions } = useDDLJStore();

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (symbolFilter !== 'ALL' && t.symbol !== symbolFilter) return false;
      if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;
      if (dateFrom && new Date(t.entry_time) < new Date(dateFrom)) return false;
      if (dateTo && new Date(t.entry_time) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [trades, symbolFilter, directionFilter, dateFrom, dateTo]);

  // Stats
  const totalProfit = filteredTrades.filter(t => t.net > 0).reduce((sum, t) => sum + t.net, 0);
  const totalLoss = filteredTrades.filter(t => t.net < 0).reduce((sum, t) => sum + Math.abs(t.net), 0);
  const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : 'N/A';
  const avgWin = filteredTrades.filter(t => t.net > 0).length > 0
    ? totalProfit / filteredTrades.filter(t => t.net > 0).length : 0;
  const avgLoss = filteredTrades.filter(t => t.net < 0).length > 0
    ? totalLoss / filteredTrades.filter(t => t.net < 0).length : 0;

  // Trade analytics summary
  const tradeAnalytics = useMemo(() => {
    if (filteredTrades.length === 0) return null;
    const bestTrade = filteredTrades.reduce((best, t) => t.net > best.net ? t : best, filteredTrades[0]);
    const worstTrade = filteredTrades.reduce((worst, t) => t.net < worst.net ? t : worst, filteredTrades[0]);
    const avgHoldMinutes = filteredTrades.reduce((sum, t) => sum + parseHoldTime(t.held), 0) / filteredTrades.length;
    const avgRR = filteredTrades.reduce((sum, t) => sum + t.rr, 0) / filteredTrades.length;
    const winners = filteredTrades.filter(t => t.net > 0).length;
    const winRate = (winners / filteredTrades.length) * 100;
    const maxConsecutiveWins = (() => {
      let max = 0, curr = 0;
      for (const t of filteredTrades) {
        if (t.net > 0) { curr++; max = Math.max(max, curr); }
        else { curr = 0; }
      }
      return max;
    })();
    const maxConsecutiveLosses = (() => {
      let max = 0, curr = 0;
      for (const t of filteredTrades) {
        if (t.net < 0) { curr++; max = Math.max(max, curr); }
        else { curr = 0; }
      }
      return max;
    })();
    const totalNet = filteredTrades.reduce((sum, t) => sum + t.net, 0);
    return {
      bestTrade,
      worstTrade,
      avgHoldMinutes,
      avgRR,
      winRate,
      totalNet,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      winners,
      losers: filteredTrades.length - winners,
    };
  }, [filteredTrades]);

  // Streak tracking
  const streaks = useMemo(() => {
    let currentStreak = 0;
    let currentType: 'win' | 'loss' | null = null;
    let bestWinStreak = 0;
    let bestLossStreak = 0;

    for (const trade of [...filteredTrades].reverse()) {
      const isWin = trade.net > 0;
      if (currentType === null) {
        currentType = isWin ? 'win' : 'loss';
        currentStreak = 1;
      } else if ((currentType === 'win' && isWin) || (currentType === 'loss' && !isWin)) {
        currentStreak++;
      } else {
        if (currentType === 'win') bestWinStreak = Math.max(bestWinStreak, currentStreak);
        else bestLossStreak = Math.max(bestLossStreak, currentStreak);
        currentType = isWin ? 'win' : 'loss';
        currentStreak = 1;
      }
    }
    if (currentType === 'win') bestWinStreak = Math.max(bestWinStreak, currentStreak);
    else bestLossStreak = Math.max(bestLossStreak, currentStreak);

    return {
      current: currentStreak,
      currentType: currentType,
      bestWinStreak,
      bestLossStreak,
    };
  }, [filteredTrades]);

  // Cumulative P&L chart data
  const cumulativePnlData = useMemo(() => {
    const reversed = [...filteredTrades].reverse();
    const result: { trade: string; cumPnl: number; symbol: string }[] = [];
    let runningPnl = 0;
    for (let i = 0; i < reversed.length; i++) {
      runningPnl += reversed[i].net;
      result.push({ trade: `T${i + 1}`, cumPnl: runningPnl, symbol: reversed[i].symbol });
    }
    return result;
  }, [filteredTrades]);

  const tradePnlChart = filteredTrades.slice(0, 10).map((t, i) => ({
    name: `T${i + 1}`,
    pnl: t.net,
    symbol: t.symbol,
  }));

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['ID', 'Symbol', 'Direction', 'Option Strike', 'Option Type', 'Entry Premium', 'Exit Premium', 'Qty', 'Gross P&L', 'Costs', 'Net P&L', 'RR', 'Exit Reason', 'Duration', 'Entry Time', 'Exit Time', 'Delta', 'IV Entry', 'IV Exit'];
    const rows = filteredTrades.map(t => [
      t.id, t.symbol, t.direction, t.option_strike || '', t.option_type || '',
      t.option_entry_premium || '', t.option_exit_premium || '',
      t.qty, t.gross, t.costs, t.net, t.rr, t.exit_reason, t.held,
      t.entry_time, t.exit_time, t.option_delta || '', t.option_iv_entry || '', t.option_iv_exit || ''
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ddlj-trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredTrades.length} trades to CSV`);
  };

  const hasActiveFilters = symbolFilter !== 'ALL' || directionFilter !== 'ALL' || dateFrom || dateTo;

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Trades</div>
            <div className="text-xl font-bold font-mono">{filteredTrades.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Winners</div>
            <div className="text-xl font-bold font-mono text-emerald-400">{filteredTrades.filter(t => t.net > 0).length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Losers</div>
            <div className="text-xl font-bold font-mono text-red-400">{filteredTrades.filter(t => t.net < 0).length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Profit Factor</div>
            <div className="text-xl font-bold font-mono">{profitFactor}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Avg Win / Avg Loss</div>
            <div className="text-sm font-mono">
              <span className="text-emerald-400">₹{avgWin.toFixed(0)}</span>
              {' / '}
              <span className="text-red-400">₹{avgLoss.toFixed(0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Streak Tracking ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', streaks.currentType === 'win' ? 'bg-emerald-500/20' : 'bg-red-500/20')}>
              <Flame className={cn('h-4 w-4', streaks.currentType === 'win' ? 'text-emerald-400' : 'text-red-400')} />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Current Streak</div>
              <div className={cn('text-lg font-bold font-mono', streaks.currentType === 'win' ? 'text-emerald-400' : 'text-red-400')}>
                {streaks.current} {streaks.currentType === 'win' ? 'W' : 'L'}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Best Win Streak</div>
              <div className="text-lg font-bold font-mono text-emerald-400">{streaks.bestWinStreak}W</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-red-400 rotate-180" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Worst Loss Streak</div>
              <div className="text-lg font-bold font-mono text-red-400">{streaks.bestLossStreak}L</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Trade Analytics Summary ── */}
      {tradeAnalytics && (
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" /> Trade Analytics Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <Trophy className="h-3 w-3" /> Best Trade
                </div>
                <div className={cn('font-mono text-lg font-bold mt-1', pnlColor(tradeAnalytics.bestTrade.net))}>
                  {tradeAnalytics.bestTrade.net >= 0 ? '+' : ''}₹{Math.abs(tradeAnalytics.bestTrade.net).toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {tradeAnalytics.bestTrade.symbol} {tradeAnalytics.bestTrade.direction} ({tradeAnalytics.bestTrade.id})
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertOctagon className="h-3 w-3" /> Worst Trade
                </div>
                <div className={cn('font-mono text-lg font-bold mt-1', pnlColor(tradeAnalytics.worstTrade.net))}>
                  {tradeAnalytics.worstTrade.net >= 0 ? '+' : '-'}₹{Math.abs(tradeAnalytics.worstTrade.net).toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {tradeAnalytics.worstTrade.symbol} {tradeAnalytics.worstTrade.direction} ({tradeAnalytics.worstTrade.id})
                </p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> Avg Hold Time
                </div>
                <div className="font-mono text-lg font-bold mt-1">
                  {formatMinutes(Math.round(tradeAnalytics.avgHoldMinutes))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Per trade average</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Scale className="h-3 w-3" /> Avg Risk-Reward
                </div>
                <div className={cn('font-mono text-lg font-bold mt-1', tradeAnalytics.avgRR > 1 ? 'text-emerald-400' : 'text-red-400')}>
                  {tradeAnalytics.avgRR.toFixed(2)}x
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Across all trades</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Target className="h-3 w-3" /> Win Rate
                </div>
                <div className={cn('font-mono text-lg font-bold mt-1', tradeAnalytics.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400')}>
                  {tradeAnalytics.winRate.toFixed(1)}%
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{tradeAnalytics.winners}W / {tradeAnalytics.losers}L</p>
              </div>
              <div className={cn('p-3 rounded-lg border', tradeAnalytics.totalNet >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20')}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> Net P&L
                </div>
                <div className={cn('font-mono text-lg font-bold mt-1', pnlColor(tradeAnalytics.totalNet))}>
                  {tradeAnalytics.totalNet >= 0 ? '+' : ''}₹{tradeAnalytics.totalNet.toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Filtered total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Filters ── */}
      <Card className="bg-card/80 border-border">
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Filters:</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3 w-3 text-muted-foreground hidden sm:block" />
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs w-28 sm:w-32" placeholder="From" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs w-28 sm:w-32" placeholder="To" />
            </div>
            <Select value={symbolFilter} onValueChange={setSymbolFilter}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Symbols</SelectItem>
                <SelectItem value="BANKNIFTY">BankNifty</SelectItem>
                <SelectItem value="NIFTY">Nifty</SelectItem>
              </SelectContent>
            </Select>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Dir.</SelectItem>
                <SelectItem value="LONG">Long</SelectItem>
                <SelectItem value="SHORT">Short</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setSymbolFilter('ALL'); setDirectionFilter('ALL'); setDateFrom(''); setDateTo(''); }}>
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
            <div className="ml-auto">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleExportCSV}>
                <Download className="h-3 w-3" /> <span className="hidden sm:inline">Export</span> CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Trade History
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Open Positions ({positions.length})
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> P&L Analysis
          </TabsTrigger>
          <TabsTrigger value="cumulative" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Cumulative
          </TabsTrigger>
        </TabsList>

        {/* ── Trade History Tab ── */}
        <TabsContent value="history">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Trade History ({filteredTrades.length} trades)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] sm:h-[500px]">
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
                      <TableHead className="text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrades.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                          <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                          <p>No trades match your filters</p>
                          <p className="text-xs mt-1">Try adjusting the date range or symbol filter</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                    filteredTrades.map((trade) => (
                      <Fragment key={trade.id}>
                        <TableRow className="border-border/50 hover:bg-secondary/30 cursor-pointer" onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}>
                          <TableCell className="text-xs font-mono">{trade.id}</TableCell>
                          <TableCell className="text-xs font-medium">{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge variant={trade.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px] gap-1">
                              {trade.direction === 'LONG' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {trade.direction}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {trade.option_type && (
                              <span className="font-mono">{trade.option_strike} {trade.option_type}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">₹{trade.option_entry_premium?.toFixed(1) || trade.entry.toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-mono">₹{trade.option_exit_premium?.toFixed(1) || trade.exit.toLocaleString()}</TableCell>
                          <TableCell className={cn('text-xs font-mono font-semibold tabular-nums', pnlColor(trade.net))}>
                            {trade.net >= 0 ? '+' : ''}₹{trade.net.toLocaleString('en-IN')}
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
                          <TableCell>
                            {expandedTrade === trade.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </TableCell>
                        </TableRow>
                        {expandedTrade === trade.id && (
                          <TableRow className="border-border/30 bg-secondary/20">
                            <TableCell colSpan={10} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-muted-foreground font-semibold">Option Details</span>
                                  <div className="mt-1 space-y-0.5">
                                    <p>Strike: <span className="font-mono">{trade.option_strike}</span></p>
                                    <p>Type: <span className="font-mono">{trade.option_type}</span></p>
                                    <p>Entry Premium: <span className="font-mono">₹{trade.option_entry_premium}</span></p>
                                    <p>Exit Premium: <span className="font-mono">₹{trade.option_exit_premium}</span></p>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-semibold">Greeks at Entry</span>
                                  <div className="mt-1 space-y-0.5">
                                    <p>Delta: <span className="font-mono">{trade.option_delta}</span></p>
                                    <p>IV Entry: <span className="font-mono">{trade.option_iv_entry}%</span></p>
                                    <p>IV Exit: <span className="font-mono">{trade.option_iv_exit}%</span></p>
                                    <p>IV Change: <span className={cn('font-mono', (trade.option_iv_exit || 0) - (trade.option_iv_entry || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                                      {((trade.option_iv_exit || 0) - (trade.option_iv_entry || 0)).toFixed(1)}%
                                    </span></p>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-semibold">P&L Breakdown</span>
                                  <div className="mt-1 space-y-0.5">
                                    <p>Gross: <span className={cn('font-mono', pnlColor(trade.gross))}>₹{trade.gross.toLocaleString('en-IN')}</span></p>
                                    <p>Costs: <span className="font-mono text-red-400">-₹{trade.costs.toLocaleString('en-IN')}</span></p>
                                    <p>Net: <span className={cn('font-mono font-semibold', pnlColor(trade.net))}>₹{trade.net.toLocaleString('en-IN')}</span></p>
                                    <p>Qty: <span className="font-mono">{trade.qty} lots</span></p>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-semibold">Timing</span>
                                  <div className="mt-1 space-y-0.5">
                                    <p>Entry: <span className="font-mono">{formatDateTime(trade.entry_time)}</span></p>
                                    <p>Exit: <span className="font-mono">{formatDateTime(trade.exit_time)}</span></p>
                                    <p>Duration: <span className="font-mono">{trade.held}</span></p>
                                    <p>RR: <span className="font-mono">{trade.rr.toFixed(1)}x</span></p>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Open Positions Tab ── */}
        <TabsContent value="positions">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
              <CardDescription className="text-xs">Currently active trades with live P&L tracking</CardDescription>
            </CardHeader>
            <CardContent>
              {positions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No open positions</p>
                  <p className="text-xs mt-1">Start the engine to begin paper trading</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {positions.map((pos) => (
                    <div key={pos.id} className="p-4 rounded-xl bg-secondary/30 border border-border">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            pos.direction === 'LONG' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          )}>
                            {pos.direction === 'LONG' ?
                              <ArrowUpRight className="h-5 w-5 text-emerald-400" /> :
                              <ArrowDownRight className="h-5 w-5 text-red-400" />
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
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Premium: ₹{pos.current_premium?.toFixed(1)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn('text-xl font-bold font-mono tabular-nums', pnlColor(pos.unrealized_pnl || 0))}>
                            {formatCurrency(pos.unrealized_pnl || 0)}
                          </div>
                          <div className="text-xs text-muted-foreground">Unrealized P&L</div>
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

        {/* ── P&L Analysis Tab ── */}
        <TabsContent value="analysis">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Trade P&L Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tradePnlChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }} formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'P&L']} />
                      <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {tradePnlChart.map((entry, index) => (
                          <Cell key={index} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Performance Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Gross Profit', value: totalProfit, color: 'text-emerald-400' },
                  { label: 'Gross Loss', value: -totalLoss, color: 'text-red-400' },
                  { label: 'Net Profit', value: totalProfit - totalLoss, color: pnlColor(totalProfit - totalLoss) },
                  { label: 'Average Win', value: avgWin, color: 'text-emerald-400' },
                  { label: 'Average Loss', value: -avgLoss, color: 'text-red-400' },
                  { label: 'Win Rate', value: filteredTrades.length > 0 ? (filteredTrades.filter(t => t.net > 0).length / filteredTrades.length) * 100 : 0, color: 'text-amber-400', isPercent: true },
                  { label: 'Profit Factor', value: parseFloat(profitFactor) || 0, color: parseFloat(profitFactor) > 1.5 ? 'text-emerald-400' : 'text-amber-400', isFactor: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className={cn('font-mono font-semibold tabular-nums', item.color)}>
                      {item.isPercent ? `${item.value.toFixed(1)}%` :
                       item.isFactor ? (item.value || 'N/A') :
                       `₹${Math.abs(item.value).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Cumulative P&L Tab ── */}
        <TabsContent value="cumulative">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cumulative P&L Curve</CardTitle>
              <CardDescription className="text-xs">Running total of net P&L across all trades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativePnlData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cumPnlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="50%" stopColor="#22c55e" stopOpacity={0} />
                        <stop offset="50%" stopColor="#ef4444" stopOpacity={0} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="trade" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} tickLine={false} width={55} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }}
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Cumulative P&L']}
                    />
                    <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
                    <Area type="monotone" dataKey="cumPnl" stroke="#22c55e" fill="url(#cumPnlGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#22c55e', stroke: 'var(--card)', strokeWidth: 2 }} />
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
