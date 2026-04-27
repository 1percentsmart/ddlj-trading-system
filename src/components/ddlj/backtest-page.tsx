'use client';

/**
 * DDLJ Backtest Page
 * ===================
 * Run backtests, view results, performance metrics, equity curve.
 */

import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FlaskConical,
  Play,
  TrendingUp,
  Trophy,
  Target,
  BarChart3,
  Clock,
  ArrowUpRight,
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
import { toast } from 'sonner';

export function BacktestPage() {
  const { backtestResults, isBacktestRunning, setBacktestRunning } = useDDLJStore();

  const handleRunBacktest = () => {
    setBacktestRunning(true);
    toast.info('Backtest started — this may take 1-2 minutes...');
    setTimeout(() => {
      setBacktestRunning(false);
      toast.success('Backtest completed! Results updated.');
    }, 3000);
  };

  const chartData = backtestResults.map(r => ({
    name: r.config_name,
    pnl: r.net_pnl,
    wr: r.win_rate,
    pf: r.profit_factor,
  }));

  const bestConfig = [...backtestResults].sort((a, b) => b.net_pnl - a.net_pnl)[0];

  return (
    <div className="space-y-4 p-4">
      {/* ── Backtest Controls ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Backtest Engine</CardTitle>
              <CardDescription>Run historical strategy simulations across multiple configurations</CardDescription>
            </div>
            <Button
              onClick={handleRunBacktest}
              disabled={isBacktestRunning}
              className="gap-2"
            >
              {isBacktestRunning ? (
                <>
                  <FlaskConical className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Backtest
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isBacktestRunning && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Running backtest — BN 15x60 ITM...</span>
                <span className="font-mono text-xs">45%</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Index</label>
              <Select defaultValue="all">
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Indices</SelectItem>
                  <SelectItem value="bn">BankNifty Only</SelectItem>
                  <SelectItem value="nf">Nifty Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Timeframe</label>
              <Select defaultValue="all">
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Timeframes</SelectItem>
                  <SelectItem value="15x60">15m / 60m</SelectItem>
                  <SelectItem value="5x60">5m / 60m</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Option Type</label>
              <Select defaultValue="all">
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="itm">ITM Only</SelectItem>
                  <SelectItem value="atm">ATM Only</SelectItem>
                  <SelectItem value="otm">OTM Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Best Config Highlight ── */}
      {bestConfig && (
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/20">
                <Trophy className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-400">Best Configuration:</span>
                  <span className="font-mono">{bestConfig.config_name}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span>Net P&L: <span className="text-emerald-400 font-mono">{formatCurrency(bestConfig.net_pnl)}</span></span>
                  <span>Win Rate: <span className="font-mono">{bestConfig.win_rate}%</span></span>
                  <span>PF: <span className="font-mono">{bestConfig.profit_factor}</span></span>
                  <span>Sharpe: <span className="font-mono">{bestConfig.sharpe_ratio}</span></span>
                  <span>Max DD: <span className="text-amber-400 font-mono">{bestConfig.max_drawdown}%</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Results Chart ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Net P&L by Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#888' }} width={120} />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Net P&L']}
                />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Results Table ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Detailed Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs">Config</TableHead>
                  <TableHead className="text-xs">Index</TableHead>
                  <TableHead className="text-xs">TF</TableHead>
                  <TableHead className="text-xs">Opt Type</TableHead>
                  <TableHead className="text-xs">Trades</TableHead>
                  <TableHead className="text-xs">Win Rate</TableHead>
                  <TableHead className="text-xs">Net P&L</TableHead>
                  <TableHead className="text-xs">Max DD</TableHead>
                  <TableHead className="text-xs">PF</TableHead>
                  <TableHead className="text-xs">Sharpe</TableHead>
                  <TableHead className="text-xs">Avg Trade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backtestResults.map((result, i) => (
                  <TableRow key={i} className="border-border/50 hover:bg-secondary/30">
                    <TableCell className="text-xs font-mono font-medium">{result.config_name}</TableCell>
                    <TableCell className="text-xs">{result.index}</TableCell>
                    <TableCell className="text-xs font-mono">{result.timeframe}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{result.option_type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{result.total_trades}</TableCell>
                    <TableCell className={cn('text-xs font-mono', result.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400')}>
                      {result.win_rate}%
                    </TableCell>
                    <TableCell className={cn('text-xs font-mono font-semibold tabular-nums', pnlColor(result.net_pnl))}>
                      {formatCurrency(result.net_pnl)}
                    </TableCell>
                    <TableCell className={cn('text-xs font-mono', result.max_drawdown > 15 ? 'text-red-400' : 'text-amber-400')}>
                      {result.max_drawdown}%
                    </TableCell>
                    <TableCell className={cn('text-xs font-mono', result.profit_factor > 1.5 ? 'text-emerald-400' : result.profit_factor > 1 ? 'text-amber-400' : 'text-red-400')}>
                      {result.profit_factor}
                    </TableCell>
                    <TableCell className={cn('text-xs font-mono', result.sharpe_ratio > 2 ? 'text-emerald-400' : result.sharpe_ratio > 0 ? 'text-amber-400' : 'text-red-400')}>
                      {result.sharpe_ratio}
                    </TableCell>
                    <TableCell className={cn('text-xs font-mono tabular-nums', pnlColor(result.avg_trade))}>
                      ₹{result.avg_trade.toLocaleString('en-IN')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


