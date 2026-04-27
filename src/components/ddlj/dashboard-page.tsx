'use client';

/**
 * DDLJ Dashboard — Main Overview Page (Enhanced v2)
 * ================================================
 * Shows Market Summary, Quick Actions, KPI cards, engine status,
 * positions summary, recent trades, equity curve, daily P&L (fixed),
 * and signal log.
 */

import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, pnlBgColor, formatDuration, timeAgo, biasColor, biasBgColor } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Shield,
  Gauge,
  Landmark,
  IndianRupee,
  Play,
  FlaskConical,
  Bell,
  ChevronRight,
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
  Cell,
  LabelList,
} from 'recharts';
import { mockEquityCurve, mockDailyPnl } from '@/lib/mock-data';
import { toast } from 'sonner';

// Custom tooltip for Daily P&L
function DailyPnlTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { pnl: number; date: string } }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  const val = payload[0].value;
  const isPositive = val >= 0;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className={cn('font-mono font-semibold tabular-nums text-sm', isPositive ? 'text-emerald-400' : 'text-red-400')}>
        {isPositive ? '+' : ''}₹{Math.abs(val).toLocaleString('en-IN')}
      </p>
    </div>
  );
}

export function DashboardPage() {
  const { engineStatus, positions, trades, signalLog, setActivePage, updateEngineStatus } = useDDLJStore();

  const winRate = trades.length > 0
    ? ((trades.filter(t => t.net > 0).length / trades.length) * 100).toFixed(1)
    : '0.0';

  const totalPnlPct = engineStatus.starting_capital > 0
    ? ((engineStatus.total_pnl / engineStatus.starting_capital) * 100).toFixed(2)
    : '0.00';

  // Market summary data — now 3 items including VIX
  const marketSummary = [
    { name: 'BankNifty', value: 56350.80, change: 215.60, changePct: 0.38, icon: Landmark },
    { name: 'Nifty 50', value: 24320.45, change: 128.30, changePct: 0.53, icon: IndianRupee },
    { name: 'India VIX', value: engineStatus.live_vix, change: -0.82, changePct: -4.75, icon: Gauge },
  ];

  // Compute daily PnL min/max for better Y-axis
  const pnlValues = mockDailyPnl.map(d => d.pnl);
  const pnlMin = Math.min(...pnlValues);
  const pnlMax = Math.max(...pnlValues);
  const pnlDomainMin = Math.floor(pnlMin / 2000) * 2000 - 1000;
  const pnlDomainMax = Math.ceil(pnlMax / 2000) * 2000 + 1000;

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
      {/* ── Market Summary Mini Section ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {marketSummary.map((mkt) => {
          const Icon = mkt.icon;
          const isVix = mkt.name === 'India VIX';
          const isPositive = mkt.change >= 0;
          return (
            <Card key={mkt.name} className="bg-card/80 border-border">
              <CardContent className="p-2.5 sm:p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">{mkt.name}</span>
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-mono text-xs sm:text-sm font-semibold tabular-nums">
                    {isVix ? mkt.value.toFixed(2) : `₹${mkt.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  </span>
                  <span className={cn(
                    'text-[9px] sm:text-[10px] font-mono tabular-nums',
                    isVix
                      ? (mkt.change <= 0 ? 'text-emerald-400' : 'text-red-400')
                      : (isPositive ? 'text-emerald-400' : 'text-red-400')
                  )}>
                    {isPositive ? '+' : ''}{mkt.change.toFixed(2)} ({isPositive ? '+' : ''}{mkt.changePct}%)
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Quick Actions Row ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={engineStatus.engine_running ? 'destructive' : 'default'}
          className="gap-1.5 text-xs h-8"
          onClick={() => {
            updateEngineStatus({ engine_running: !engineStatus.engine_running });
            toast.success(engineStatus.engine_running ? 'Engine stopped' : 'Engine started');
          }}
        >
          {engineStatus.engine_running ? (
            <><Zap className="h-3.5 w-3.5" /> Stop Engine</>
          ) : (
            <><Play className="h-3.5 w-3.5" /> Start Engine</>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={() => setActivePage('backtest')}
        >
          <FlaskConical className="h-3.5 w-3.5" /> Run Backtest
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={() => setActivePage('alerts')}
        >
          <Bell className="h-3.5 w-3.5" /> Configure Alerts
        </Button>
      </div>

      {/* ── KPI Cards Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="bg-card/80 border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Current Capital</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums">{formatCurrency(engineStatus.capital)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Started: {formatCurrency(engineStatus.starting_capital)}
            </p>
          </CardContent>
        </Card>

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
            <div className={cn('text-xl sm:text-2xl font-bold font-mono tabular-nums', pnlColor(engineStatus.daily_pnl))}>
              {formatCurrency(engineStatus.daily_pnl)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {engineStatus.daily_trade_count} trades today
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total P&L</CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-xl sm:text-2xl font-bold font-mono tabular-nums', pnlColor(engineStatus.total_pnl))}>
              {formatCurrency(engineStatus.total_pnl)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalPnlPct}% return ({engineStatus.total_closed_trades} trades)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums">{winRate}%</div>
            <Progress value={parseFloat(winRate)} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* ── Engine Status + Bias + VIX Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
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

        <Card className="bg-card/80 border-border sm:col-span-2 lg:col-span-1">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
        {/* Equity Curve */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Equity Curve</CardTitle>
            <CardDescription className="text-xs">Capital growth over current month — {mockEquityCurve.length} data points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockEquityCurve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} tickLine={false} axisLine={false} width={55} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }}
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Capital']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <ReferenceLine y={engineStatus.starting_capital} stroke="var(--muted-foreground)" strokeDasharray="5 5" strokeOpacity={0.5} />
                  <Area type="monotone" dataKey="capital" stroke="#22c55e" fill="url(#equityGradient)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#22c55e', stroke: 'var(--card)', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily P&L - FIXED */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Daily P&L</CardTitle>
                <CardDescription className="text-xs">Last 7 trading days</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Profit</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> Loss</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockDailyPnl} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[pnlDomainMin, pnlDomainMax]}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(v: number) => {
                      if (v === 0) return '0';
                      return `${v >= 0 ? '' : '-'}₹${Math.abs(v / 1000).toFixed(0)}K`;
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                  />
                  <Tooltip content={<DailyPnlTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.08 }} />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]} barSize={32} maxBarSize={40}>
                    {mockDailyPnl.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'}
                        fillOpacity={0.85}
                      />
                    ))}
                    <LabelList
                      dataKey="pnl"
                      position="top"
                      formatter={(value: number) => {
                        const abs = Math.abs(value);
                        return `${value >= 0 ? '+' : '-'}${abs >= 1000 ? `${(abs / 1000).toFixed(1)}K` : abs}`;
                      }}
                      style={{ fontSize: 9, fill: 'var(--muted-foreground)', fontFamily: 'monospace' }}
                      offset={4}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] sm:text-xs text-muted-foreground gap-1">
              <span>Week: <span className={cn('font-mono font-semibold', pnlColor(mockDailyPnl.reduce((s, d) => s + d.pnl, 0)))}>
                {formatCurrency(mockDailyPnl.reduce((s, d) => s + d.pnl, 0))}
              </span></span>
              <span>Best: <span className="text-emerald-400 font-mono">+₹{Math.max(...mockDailyPnl.map(d => d.pnl)).toLocaleString('en-IN')}</span></span>
              <span>Worst: <span className="text-red-400 font-mono">₹{Math.min(...mockDailyPnl.map(d => d.pnl)).toLocaleString('en-IN')}</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom Row: Open Positions + Signal Log ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
        {/* Open Positions — Compact */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Open Positions ({positions.length})</CardTitle>
              <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setActivePage('trades')}>
                View All <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {positions.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-6">
                No open positions
              </div>
            ) : (
              <div className="space-y-1.5">
                {positions.map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/40 border border-border/50 hover:bg-secondary/60 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        pos.direction === 'LONG' ? 'bg-emerald-400' : 'bg-red-400'
                      )} />
                      <span className="font-medium text-xs truncate">{pos.symbol}</span>
                      <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[8px] px-1 py-0 h-3.5">
                        {pos.direction}
                      </Badge>
                      {pos.option_type && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 font-mono hidden sm:inline-flex">
                          {pos.option_strike} {pos.option_type}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:block text-[10px] text-muted-foreground font-mono">
                        SL ₹{pos.sl.toLocaleString()} | TGT ₹{pos.target.toLocaleString()}
                      </div>
                      <div className={cn('font-mono font-semibold text-xs tabular-nums', pnlColor(pos.unrealized_pnl || 0))}>
                        {formatCurrency(pos.unrealized_pnl || 0)}
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Signal Log</CardTitle>
              <Badge variant="outline" className="text-[10px]">{signalLog.length} events</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-56">
              <div className="space-y-1">
                {signalLog.map((sig, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                      sig.severity === 'success' ? 'bg-emerald-400' :
                      sig.severity === 'warning' ? 'bg-amber-400' :
                      sig.severity === 'error' ? 'bg-red-400' : 'bg-blue-400'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 font-mono">
                          {sig.type}
                        </Badge>
                        <span className="text-muted-foreground text-[10px]">{timeAgo(sig.time)}</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{sig.message}</p>
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
