'use client';

/**
 * DDLJ Dashboard — Main Overview Page
 * =====================================
 * Shows KPI cards, engine status, positions summary, recent trades,
 * equity curve, daily P&L, and signal log.
 */

import { useDDLJStore } from '@/lib/store';
import { formatCurrency, pnlColor, pnlBgColor, formatDuration, timeAgo, biasColor, biasBgColor } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Target,
  BarChart3,
  Clock,
  Wifi,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Shield,
  Gauge,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { mockEquityCurve, mockDailyPnl } from '@/lib/mock-data';

export function DashboardPage() {
  const { engineStatus, positions, trades, signalLog } = useDDLJStore();

  const winRate = trades.length > 0
    ? ((trades.filter(t => t.net > 0).length / trades.length) * 100).toFixed(1)
    : '0.0';

  const totalPnlPct = engineStatus.starting_capital > 0
    ? ((engineStatus.total_pnl / engineStatus.starting_capital) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-4 p-4">
      {/* ── KPI Cards Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Capital Card */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Current Capital</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums">{formatCurrency(engineStatus.capital)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Started: {formatCurrency(engineStatus.starting_capital)}
            </p>
          </CardContent>
        </Card>

        {/* Daily P&L Card */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Day P&L</CardTitle>
            {engineStatus.daily_pnl >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold font-mono tabular-nums', pnlColor(engineStatus.daily_pnl))}>
              {formatCurrency(engineStatus.daily_pnl)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {engineStatus.daily_trade_count} trades today
            </p>
          </CardContent>
        </Card>

        {/* Total P&L Card */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total P&L</CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold font-mono tabular-nums', pnlColor(engineStatus.total_pnl))}>
              {formatCurrency(engineStatus.total_pnl)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalPnlPct}% return ({engineStatus.total_closed_trades} trades)
            </p>
          </CardContent>
        </Card>

        {/* Win Rate Card */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums">{winRate}%</div>
            <Progress value={parseFloat(winRate)} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* ── Engine Status + Bias + VIX Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Engine Status Card */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Engine Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn('w-2.5 h-2.5 rounded-full', engineStatus.engine_running ? 'bg-emerald-400 pulse-dot' : 'bg-zinc-500')} />
              <span className="text-sm font-medium">
                {engineStatus.engine_running ? 'Running' : 'Stopped'}
              </span>
              <Badge variant={engineStatus.engine_running ? 'default' : 'secondary'} className="text-[10px] ml-auto">
                {engineStatus.engine_running ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Uptime</span>
                <p className="font-mono tabular-nums">{formatDuration(engineStatus.uptime_seconds)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Errors</span>
                <p className={engineStatus.error_count > 0 ? 'text-red-400 font-mono' : 'font-mono'}>{engineStatus.error_count}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Open Positions</span>
                <p className="font-mono">{engineStatus.open_positions_count}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Token</span>
                <p className={engineStatus.token.valid ? 'text-emerald-400' : 'text-red-400'}>
                  {engineStatus.token.valid ? 'Valid' : 'Invalid'}
                </p>
              </div>
            </div>
            {engineStatus.last_signal && (
              <>
                <Separator className="bg-border" />
                <div className="text-xs">
                  <span className="text-muted-foreground">Last Signal</span>
                  <p className="mt-0.5 text-emerald-400 truncate">{engineStatus.last_signal}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">
                    {timeAgo(engineStatus.last_signal_time!)}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bias Card */}
        <Card className={cn('bg-card/80 border', biasBgColor(engineStatus.current_bias))}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Market Bias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              {engineStatus.current_bias === 'BULLISH' ? (
                <ArrowUpRight className="h-8 w-8 text-emerald-400" />
              ) : engineStatus.current_bias === 'BEARISH' ? (
                <ArrowDownRight className="h-8 w-8 text-red-400" />
              ) : (
                <Activity className="h-8 w-8 text-amber-400" />
              )}
              <div>
                <div className={cn('text-2xl font-bold', biasColor(engineStatus.current_bias))}>
                  {engineStatus.current_bias}
                </div>
                <div className="text-xs text-muted-foreground">
                  Strength: {(engineStatus.bias_strength * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <Progress value={engineStatus.bias_strength * 100} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Based on {engineStatus.current_bias === 'BULLISH' ? 'EMA fast above slow' :
                engineStatus.current_bias === 'BEARISH' ? 'EMA fast below slow' :
                'EMAs crossing / no clear direction'} on 60m timeframe
            </div>
          </CardContent>
        </Card>

        {/* VIX + Risk Card */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">India VIX & Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Gauge className="h-8 w-8 text-amber-400" />
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums">{engineStatus.live_vix.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">India VIX</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Volatility</span>
                <p className={engineStatus.live_vix > 25 ? 'text-red-400' : engineStatus.live_vix < 12 ? 'text-emerald-400' : 'text-amber-400'}>
                  {engineStatus.live_vix > 25 ? 'HIGH' : engineStatus.live_vix < 12 ? 'LOW' : 'NORMAL'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Risk Level</span>
                <p className="text-amber-400">
                  {engineStatus.live_vix > 25 ? 'Aggressive' : engineStatus.live_vix < 12 ? 'Conservative' : 'Moderate'}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Low (&lt;12)</span>
                <span>Normal</span>
                <span>High (&gt;25)</span>
              </div>
              <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 relative">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-md border border-white"
                  style={{ left: `${Math.min(100, Math.max(0, (engineStatus.live_vix / 40) * 100))}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Equity Curve */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Equity Curve</CardTitle>
            <CardDescription className="text-xs">Capital growth over current month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockEquityCurve}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Capital']}
                  />
                  <ReferenceLine y={engineStatus.starting_capital} stroke="rgba(255,255,255,0.2)" strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="capital" stroke="#22c55e" fill="url(#equityGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily P&L */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Daily P&L</CardTitle>
            <CardDescription className="text-xs">Last 7 trading days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockDailyPnl}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'P&L']}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {mockDailyPnl.map((entry, index) => (
                      <rect key={index} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom Row: Open Positions + Signal Log ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Open Positions */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Positions ({positions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {positions.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                No open positions
              </div>
            ) : (
              <div className="space-y-2">
                {positions.map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        pos.direction === 'LONG' ? 'bg-emerald-400' : 'bg-red-400'
                      )} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{pos.symbol}</span>
                          <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px]">
                            {pos.direction}
                          </Badge>
                          {pos.option_type && (
                            <Badge variant="outline" className="text-[10px]">
                              {pos.option_strike} {pos.option_type}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Entry: ₹{pos.entry.toLocaleString()} | SL: ₹{pos.sl.toLocaleString()} | TGT: ₹{pos.target.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn('font-mono font-semibold text-sm tabular-nums', pnlColor(pos.unrealized_pnl || 0))}>
                        {formatCurrency(pos.unrealized_pnl || 0)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        RR {pos.rr.toFixed(1)}x | {pos.held}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signal Log */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Signal Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-1.5">
                {signalLog.map((sig, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                      sig.severity === 'success' ? 'bg-emerald-400' :
                      sig.severity === 'warning' ? 'bg-amber-400' :
                      sig.severity === 'error' ? 'bg-red-400' : 'bg-blue-400'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          {sig.type}
                        </Badge>
                        <span className="text-muted-foreground text-[10px]">{timeAgo(sig.time)}</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 truncate">{sig.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
