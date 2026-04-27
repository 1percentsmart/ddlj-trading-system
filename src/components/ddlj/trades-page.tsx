'use client';

/**
 * DDLJ Trades & Positions Page
 * ==============================
 * Full trade history table, open positions, P&L breakdown.
 */

import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatDateTime, formatTime } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

export function TradesPage() {
  const { trades, positions } = useDDLJStore();

  const totalProfit = trades.filter(t => t.net > 0).reduce((sum, t) => sum + t.net, 0);
  const totalLoss = trades.filter(t => t.net < 0).reduce((sum, t) => sum + Math.abs(t.net), 0);
  const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : 'N/A';
  const avgWin = trades.filter(t => t.net > 0).length > 0
    ? totalProfit / trades.filter(t => t.net > 0).length : 0;
  const avgLoss = trades.filter(t => t.net < 0).length > 0
    ? totalLoss / trades.filter(t => t.net < 0).length : 0;

  const tradePnlChart = trades.slice(0, 10).map((t, i) => ({
    name: `T${i + 1}`,
    pnl: t.net,
    symbol: t.symbol,
  }));

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Trades</div>
            <div className="text-xl font-bold font-mono">{trades.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Winners</div>
            <div className="text-xl font-bold font-mono text-emerald-400">{trades.filter(t => t.net > 0).length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Losers</div>
            <div className="text-xl font-bold font-mono text-red-400">{trades.filter(t => t.net < 0).length}</div>
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
        </TabsList>

        {/* ── Trade History Tab ── */}
        <TabsContent value="history">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Trade History</CardTitle>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Download className="h-3 w-3" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">Symbol</TableHead>
                      <TableHead className="text-xs">Direction</TableHead>
                      <TableHead className="text-xs">Option</TableHead>
                      <TableHead className="text-xs">Entry</TableHead>
                      <TableHead className="text-xs">Exit</TableHead>
                      <TableHead className="text-xs">Qty</TableHead>
                      <TableHead className="text-xs">Net P&L</TableHead>
                      <TableHead className="text-xs">RR</TableHead>
                      <TableHead className="text-xs">Exit Reason</TableHead>
                      <TableHead className="text-xs">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((trade) => (
                      <TableRow key={trade.id} className="border-border/50 hover:bg-secondary/30">
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
                        <TableCell className="text-xs font-mono">{trade.qty}</TableCell>
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
                        <TableCell className="text-xs">{trade.held}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                              Entry Premium: ₹{pos.current_premium?.toFixed(1)} | Delta: {pos.option_type === 'CE' ? '+' : '-'}0.50
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
                          <span className="text-muted-foreground">Entry Price</span>
                          <p className="font-mono">₹{pos.entry.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Stop Loss</span>
                          <p className="font-mono text-red-400">₹{pos.sl.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Target</span>
                          <p className="font-mono text-emerald-400">₹{pos.target.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">RR Ratio</span>
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
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tradePnlChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }}
                        formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'P&L']}
                      />
                      <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {tradePnlChart.map((entry, index) => (
                          <Cell key={index} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
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
                  { label: 'Win Rate', value: ((trades.filter(t => t.net > 0).length / trades.length) * 100), color: 'text-amber-400', isPercent: true },
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
      </Tabs>
    </div>
  );
}


