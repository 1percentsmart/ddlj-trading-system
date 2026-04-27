'use client';

/**
 * DDLJ Backtest Page — Major Enhancement v2
 * ========================================
 * New Backtest dialog with config name, saved results with expand/collapse,
 * monthly returns heatmap, animated progress, equity curve, comparison mode,
 * delete/rename actions, compare checkbox.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  FlaskConical,
  Play,
  Trophy,
  BarChart3,
  Save,
  GitCompareArrows,
  ChevronDown,
  ChevronRight,
  History,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Settings2,
  CalendarDays,
  ArrowUpRight,
  X,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Minus,
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
  LabelList,
} from 'recharts';
import { toast } from 'sonner';
import type { BacktestResult } from '@/lib/mock-data';

// ── Mock Data (inline) ───────────────────────────────────────────

const mockBacktestEquity = [
  { day: 1, capital: 200000 }, { day: 2, capital: 201200 }, { day: 3, capital: 199500 },
  { day: 4, capital: 203800 }, { day: 5, capital: 206500 }, { day: 6, capital: 204200 },
  { day: 7, capital: 208100 }, { day: 8, capital: 212400 }, { day: 9, capital: 210200 },
  { day: 10, capital: 215800 }, { day: 11, capital: 219500 }, { day: 12, capital: 217200 },
  { day: 13, capital: 222100 }, { day: 14, capital: 225800 }, { day: 15, capital: 223500 },
  { day: 16, capital: 228200 }, { day: 17, capital: 231800 }, { day: 18, capital: 229500 },
  { day: 19, capital: 234200 }, { day: 20, capital: 238100 }, { day: 21, capital: 241500 },
  { day: 22, capital: 244800 }, { day: 23, capital: 242500 }, { day: 24, capital: 247200 },
  { day: 25, capital: 251300 }, { day: 26, capital: 249100 }, { day: 27, capital: 254200 },
  { day: 28, capital: 258500 }, { day: 29, capital: 262100 }, { day: 30, capital: 267300 },
];

const mockTradeDistribution = [
  { range: '-6K to -4K', count: 2, type: 'loss' },
  { range: '-4K to -2K', count: 5, type: 'loss' },
  { range: '-2K to 0', count: 8, type: 'loss' },
  { range: '0 to 2K', count: 12, type: 'win' },
  { range: '2K to 4K', count: 9, type: 'win' },
  { range: '4K to 6K', count: 5, type: 'win' },
  { range: '6K to 8K', count: 3, type: 'win' },
  { range: '8K+', count: 2, type: 'win' },
];

// Monthly returns heatmap data — Jan-Jun, 2 years
const mockMonthlyReturns = [
  { month: 'Jan', y2025: 3.2, y2026: 5.8 },
  { month: 'Feb', y2025: -1.5, y2026: 2.1 },
  { month: 'Mar', y2025: 4.8, y2026: 6.5 },
  { month: 'Apr', y2025: 2.1, y2026: 3.7 },
  { month: 'May', y2025: -0.8, y2026: 0 },
  { month: 'Jun', y2025: 1.9, y2026: 0 },
  { month: 'Jul', y2025: 3.5, y2026: 0 },
  { month: 'Aug', y2025: -2.3, y2026: 0 },
  { month: 'Sep', y2025: 1.2, y2026: 0 },
  { month: 'Oct', y2025: 4.1, y2026: 0 },
  { month: 'Nov', y2025: -1.1, y2026: 0 },
  { month: 'Dec', y2025: 2.7, y2026: 0 },
];

// ── Types ─────────────────────────────────────────────────────────

interface SavedBacktest {
  id: string;
  name: string;
  result: BacktestResult;
  savedAt: string;
  expanded: boolean;
}

// ── Helper: Monthly Returns Heatmap Cell ──────────────────────────

function HeatmapCell({ value }: { value: number }) {
  if (value === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center rounded text-[9px] font-mono bg-secondary/30 text-muted-foreground">
        —
      </div>
    );
  }
  const isPositive = value > 0;
  const intensity = Math.min(Math.abs(value) / 6, 1);
  const bgClass = isPositive
    ? `bg-emerald-500/${Math.round(intensity * 30 + 5)}`
    : `bg-red-500/${Math.round(intensity * 30 + 5)}`;
  return (
    <div className={cn('w-full h-full flex items-center justify-center rounded text-[9px] font-mono font-semibold tabular-nums', bgClass, isPositive ? 'text-emerald-400' : 'text-red-400')}>
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </div>
  );
}

// ── Custom Tooltip for Distribution ───────────────────────────────

function DistributionTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { type: string } }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">P&L Range: {label}</p>
      <p className={cn('font-mono font-semibold', entry.type === 'win' ? 'text-emerald-400' : 'text-red-400')}>
        {payload[0].value} trades
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

export function BacktestPage() {
  const { backtestResults, isBacktestRunning, setBacktestRunning } = useDDLJStore();
  const [newBacktestOpen, setNewBacktestOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [savedBacktests, setSavedBacktests] = useState<SavedBacktest[]>([
    { id: 'SB001', name: 'BN ITM Conservative', result: backtestResults[0], savedAt: new Date(Date.now() - 86400000).toISOString(), expanded: false },
    { id: 'SB002', name: 'NF ATM Best Run', result: backtestResults[3], savedAt: new Date(Date.now() - 172800000).toISOString(), expanded: false },
    { id: 'SB003', name: 'BN ATM Aggressive', result: backtestResults[1], savedAt: new Date(Date.now() - 259200000).toISOString(), expanded: false },
  ]);
  const [saveName, setSaveName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Form state for new backtest
  const [btConfigName, setBtConfigName] = useState('');
  const [btIndex, setBtIndex] = useState('BANKNIFTY');
  const [btTimeframe, setBtTimeframe] = useState('15m/60m');
  const [btOptionType, setBtOptionType] = useState('ITM');
  const [btDateFrom, setBtDateFrom] = useState('2026-01-01');
  const [btDateTo, setBtDateTo] = useState('2026-04-27');
  const [btCapital, setBtCapital] = useState('200000');
  const [btEmaFast, setBtEmaFast] = useState('9');
  const [btEmaSlow, setBtEmaSlow] = useState('55');
  const [btRiskPct, setBtRiskPct] = useState('3.0');
  const [btMaxPositions, setBtMaxPositions] = useState('2');
  const [btDrawdownLimit, setBtDrawdownLimit] = useState('20');

  const chartData = backtestResults.map(r => ({
    name: r.config_name,
    pnl: r.net_pnl,
    wr: r.win_rate,
    pf: r.profit_factor,
  }));

  const bestConfig = [...backtestResults].sort((a, b) => b.net_pnl - a.net_pnl)[0];

  const handleRunBacktest = useCallback(() => {
    setBacktestRunning(true);
    setProgress(0);
    toast.info('Backtest started — this may take 1-2 minutes...');
  }, [setBacktestRunning]);

  // Animated progress
  useEffect(() => {
    if (!isBacktestRunning) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 8 + 2;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [isBacktestRunning]);

  useEffect(() => {
    if (!isBacktestRunning) return;
    const timeout = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setBacktestRunning(false);
        setProgress(0);
        toast.success('Backtest completed! Results updated.');
      }, 500);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [isBacktestRunning, setBacktestRunning]);

  const handleSaveResult = (result: BacktestResult, name: string) => {
    if (!name.trim()) {
      toast.error('Please enter a name for this result');
      return;
    }
    const newSaved: SavedBacktest = {
      id: `SB${Date.now()}`,
      name: name.trim(),
      result,
      savedAt: new Date().toISOString(),
      expanded: false,
    };
    setSavedBacktests(prev => [newSaved, ...prev]);
    setSaveName('');
    toast.success(`Backtest saved as "${newSaved.name}"`);
  };

  const handleDeleteSaved = (id: string, name: string) => {
    setSavedBacktests(prev => prev.filter(s => s.id !== id));
    toast.info(`Deleted "${name}"`);
  };

  const handleRenameSaved = (id: string) => {
    if (!renameValue.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setSavedBacktests(prev => prev.map(s => s.id === id ? { ...s, name: renameValue.trim() } : s));
    setRenamingId(null);
    setRenameValue('');
    toast.success('Renamed successfully');
  };

  const toggleExpandSaved = (id: string) => {
    setSavedBacktests(prev => prev.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s));
  };

  const handleNewBacktest = () => {
    if (!btConfigName.trim()) {
      toast.error('Please enter a config name');
      return;
    }
    setNewBacktestOpen(false);
    handleRunBacktest();
  };

  const toggleCompare = (name: string) => {
    setCompareIds(prev =>
      prev.includes(name) ? prev.filter(id => id !== name) : prev.length < 2 ? [...prev, name] : [prev[1], name]
    );
  };

  const compareResults = backtestResults.filter(r => compareIds.includes(r.config_name));

  // Compute P&L chart domain
  const pnlValues = chartData.map(d => d.pnl);
  const pnlMin = Math.min(...pnlValues, 0);
  const pnlMax = Math.max(...pnlValues, 0);

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
      {/* ── Backtest Controls ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Backtest Engine</CardTitle>
              <CardDescription>Run historical strategy simulations across multiple configurations</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={compareIds.length < 2}>
                    <GitCompareArrows className="h-3.5 w-3.5" /> Compare ({compareIds.length}/2)
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Compare Backtest Results</DialogTitle>
                    <DialogDescription>Side by side comparison of two configurations</DialogDescription>
                  </DialogHeader>
                  {compareResults.length === 2 && (
                    <div className="space-y-3 py-4">
                      <div className="grid grid-cols-3 gap-4 text-center text-sm">
                        <div className="font-semibold text-muted-foreground">Metric</div>
                        <div className="font-semibold text-emerald-400">{compareResults[0].config_name}</div>
                        <div className="font-semibold text-amber-400">{compareResults[1].config_name}</div>
                      </div>
                      <Separator />
                      {[
                        { label: 'Net P&L', key: 'net_pnl', format: (v: number) => formatCurrency(v) },
                        { label: 'Win Rate', key: 'win_rate', format: (v: number) => `${v}%` },
                        { label: 'Profit Factor', key: 'profit_factor', format: (v: number) => v.toFixed(2) },
                        { label: 'Sharpe Ratio', key: 'sharpe_ratio', format: (v: number) => v.toFixed(2) },
                        { label: 'Max Drawdown', key: 'max_drawdown', format: (v: number) => `${v}%` },
                        { label: 'Total Trades', key: 'total_trades', format: (v: number) => String(v) },
                        { label: 'Avg Trade', key: 'avg_trade', format: (v: number) => `₹${v.toLocaleString('en-IN')}` },
                        { label: 'Best Trade', key: 'best_trade', format: (v: number) => `₹${v.toLocaleString('en-IN')}` },
                        { label: 'Worst Trade', key: 'worst_trade', format: (v: number) => `₹${v.toLocaleString('en-IN')}` },
                      ].map((metric) => {
                        const v0 = compareResults[0][metric.key as keyof BacktestResult] as number;
                        const v1 = compareResults[1][metric.key as keyof BacktestResult] as number;
                        const isHigherBetter = metric.key !== 'max_drawdown' && metric.key !== 'worst_trade';
                        const winner0 = isHigherBetter ? v0 > v1 : v0 < v1;
                        const winner1 = isHigherBetter ? v1 > v0 : v1 < v0;
                        const tied = v0 === v1;
                        return (
                          <div key={metric.key} className="grid grid-cols-3 gap-4 text-center text-sm py-2 border-b border-border/30">
                            <div className="text-muted-foreground text-left font-medium">{metric.label}</div>
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={cn('font-mono tabular-nums', winner0 && !tied && 'text-emerald-400 font-semibold')}>{metric.format(v0)}</span>
                              {winner0 && !tied && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                            </div>
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={cn('font-mono tabular-nums', winner1 && !tied && 'text-emerald-400 font-semibold')}>{metric.format(v1)}</span>
                              {winner1 && !tied && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 text-center">
                        <p className="text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 inline text-emerald-400" /> = better value &nbsp;&nbsp;
                          For Max DD &amp; Worst Trade, lower is better
                        </p>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* New Backtest Dialog */}
              <Dialog open={newBacktestOpen} onOpenChange={setNewBacktestOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <FlaskConical className="h-3.5 w-3.5" /> New Backtest
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>New Backtest Configuration</DialogTitle>
                    <DialogDescription>Configure and run a new backtest simulation</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* Config Name */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Config Name <span className="text-red-400">*</span></Label>
                      <Input
                        placeholder="e.g. BN ITM Conservative v2"
                        value={btConfigName}
                        onChange={e => setBtConfigName(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Index</Label>
                        <Select value={btIndex} onValueChange={setBtIndex}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BANKNIFTY">BankNifty</SelectItem>
                            <SelectItem value="NIFTY">Nifty</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Timeframe</Label>
                        <Select value={btTimeframe} onValueChange={setBtTimeframe}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5m/60m">5m / 60m</SelectItem>
                            <SelectItem value="15m/60m">15m / 60m</SelectItem>
                            <SelectItem value="15m/1D">15m / 1D</SelectItem>
                            <SelectItem value="60m/1D">60m / 1D</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Option Type</Label>
                        <Select value={btOptionType} onValueChange={setBtOptionType}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ITM">ITM (In The Money)</SelectItem>
                            <SelectItem value="ATM">ATM (At The Money)</SelectItem>
                            <SelectItem value="OTM">OTM (Out of The Money)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Starting Capital (₹)</Label>
                        <Input type="number" value={btCapital} onChange={e => setBtCapital(e.target.value)} className="h-9 text-xs font-mono" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Date From</Label>
                        <Input type="date" value={btDateFrom} onChange={e => setBtDateFrom(e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Date To</Label>
                        <Input type="date" value={btDateTo} onChange={e => setBtDateTo(e.target.value)} className="h-9 text-xs" />
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">EMA Fast Period</Label>
                        <Input type="number" value={btEmaFast} onChange={e => setBtEmaFast(e.target.value)} className="h-9 text-xs font-mono" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">EMA Slow Period</Label>
                        <Input type="number" value={btEmaSlow} onChange={e => setBtEmaSlow(e.target.value)} className="h-9 text-xs font-mono" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Risk % per Position</Label>
                        <Input type="number" value={btRiskPct} onChange={e => setBtRiskPct(e.target.value)} className="h-9 text-xs font-mono" step="0.5" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Max Drawdown %</Label>
                        <Input type="number" value={btDrawdownLimit} onChange={e => setBtDrawdownLimit(e.target.value)} className="h-9 text-xs font-mono" />
                      </div>
                    </div>

                    {/* Advanced Settings */}
                    <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full py-1">
                        <Settings2 className="h-3 w-3" />
                        Advanced Settings
                        {showAdvanced ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-3 pt-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs">RSI Period</Label>
                            <Input type="number" defaultValue="14" className="h-9 text-xs font-mono" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">ATR Period</Label>
                            <Input type="number" defaultValue="14" className="h-9 text-xs font-mono" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs">ATR SL Multiplier</Label>
                            <Input type="number" defaultValue="1.5" className="h-9 text-xs font-mono" step="0.25" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">ATR Target Multiplier</Label>
                            <Input type="number" defaultValue="2.5" className="h-9 text-xs font-mono" step="0.25" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Trailing Stop Enabled</Label>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">BE Trigger at 2x Risk</Label>
                          <Switch defaultChecked />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewBacktestOpen(false)}>Cancel</Button>
                    <Button onClick={handleNewBacktest} className="gap-1.5">
                      <Play className="h-3.5 w-3.5" /> Create &amp; Run
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button onClick={handleRunBacktest} disabled={isBacktestRunning} size="sm" className="gap-1.5">
                {isBacktestRunning ? (
                  <><FlaskConical className="h-3.5 w-3.5 animate-spin" /> Running...</>
                ) : (
                  <><Play className="h-3.5 w-3.5" /> Quick Run</>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isBacktestRunning && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Running backtest — {btIndex} {btTimeframe} {btOptionType}...</span>
                <span className="font-mono text-xs tabular-nums">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2.5 transition-all duration-300" />
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className={cn('w-1.5 h-1.5 rounded-full', progress < 30 ? 'bg-amber-400' : progress < 70 ? 'bg-blue-400' : 'bg-emerald-400')} />
                {progress < 30 ? 'Loading historical data...' : progress < 70 ? 'Processing signals...' : progress < 95 ? 'Calculating metrics...' : 'Almost done...'}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Index</label>
              <Select defaultValue="all">
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
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
              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-emerald-400">Best Configuration:</span>
                  <span className="font-mono">{bestConfig.config_name}</span>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
                  <span>Net P&L: <span className="text-emerald-400 font-mono">{formatCurrency(bestConfig.net_pnl)}</span></span>
                  <span>WR: <span className="font-mono">{bestConfig.win_rate}%</span></span>
                  <span>Sharpe: <span className="font-mono">{bestConfig.sharpe_ratio}</span></span>
                  <span>Max DD: <span className="text-amber-400 font-mono">{bestConfig.max_drawdown}%</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Comparison Inline Banner ── */}
      {compareIds.length === 2 && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm">
              <GitCompareArrows className="h-4 w-4 text-amber-400" />
              <span className="font-medium">Comparing:</span>
              <span className="text-emerald-400 font-mono text-xs">{compareIds[0]}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="text-amber-400 font-mono text-xs">{compareIds[1]}</span>
            </div>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={() => setCompareOpen(true)}>
              View Comparison
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="results" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="results" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> Results
          </TabsTrigger>
          <TabsTrigger value="equity" className="gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" /> Equity Curve
          </TabsTrigger>
          <TabsTrigger value="distribution" className="gap-1.5 text-xs">
            <Target className="h-3.5 w-3.5" /> Distribution
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5" /> Monthly
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> Saved
          </TabsTrigger>
        </TabsList>

        {/* ── Results Tab ── */}
        <TabsContent value="results" className="space-y-4">
          {/* Results Chart */}
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net P&L by Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} width={110} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }}
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Net P&L']}
                    />
                    <ReferenceLine x={0} stroke="var(--muted-foreground)" />
                    <Bar dataKey="pnl" radius={[0, 6, 6, 0]} barSize={24}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.85} />
                      ))}
                      <LabelList
                        dataKey="pnl"
                        position="right"
                        formatter={(value: number) => `${value >= 0 ? '+' : ''}₹${(Math.abs(value) / 1000).toFixed(0)}K`}
                        style={{ fontSize: 9, fill: 'var(--muted-foreground)', fontFamily: 'monospace' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Detailed Results</CardTitle>
                {compareIds.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {compareIds.length}/2 selected for compare
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs w-8">Cmp</TableHead>
                      <TableHead className="text-xs">Config</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Index</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">TF</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Opt</TableHead>
                      <TableHead className="text-xs text-right">Net P&L</TableHead>
                      <TableHead className="text-xs text-right">Win Rate</TableHead>
                      <TableHead className="text-xs text-right hidden sm:table-cell">Sharpe</TableHead>
                      <TableHead className="text-xs text-right hidden lg:table-cell">Max DD</TableHead>
                      <TableHead className="text-xs text-right hidden lg:table-cell">PF</TableHead>
                      <TableHead className="text-xs w-8">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backtestResults.map((result, i) => (
                      <TableRow key={i} className={cn("border-border/50 hover:bg-secondary/30", selectedResult === result.config_name && 'bg-primary/5')}>
                        <TableCell>
                          <Checkbox
                            checked={compareIds.includes(result.config_name)}
                            onCheckedChange={() => toggleCompare(result.config_name)}
                            className="h-3.5 w-3.5"
                          />
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium">{result.config_name}</TableCell>
                        <TableCell className="text-xs hidden sm:table-cell">{result.index}</TableCell>
                        <TableCell className="text-xs font-mono hidden md:table-cell">{result.timeframe}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="text-[10px]">{result.option_type}</Badge>
                        </TableCell>
                        <TableCell className={cn('text-xs font-mono font-semibold tabular-nums text-right', pnlColor(result.net_pnl))}>
                          {formatCurrency(result.net_pnl)}
                        </TableCell>
                        <TableCell className={cn('text-xs font-mono text-right', result.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400')}>
                          {result.win_rate}%
                        </TableCell>
                        <TableCell className={cn('text-xs font-mono text-right hidden sm:table-cell', result.sharpe_ratio > 2 ? 'text-emerald-400' : result.sharpe_ratio > 0 ? 'text-amber-400' : 'text-red-400')}>
                          {result.sharpe_ratio}
                        </TableCell>
                        <TableCell className={cn('text-xs font-mono text-right hidden lg:table-cell', result.max_drawdown > 15 ? 'text-red-400' : 'text-amber-400')}>
                          {result.max_drawdown}%
                        </TableCell>
                        <TableCell className={cn('text-xs font-mono text-right hidden lg:table-cell', result.profit_factor > 1.5 ? 'text-emerald-400' : result.profit_factor > 1 ? 'text-amber-400' : 'text-red-400')}>
                          {result.profit_factor}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-6 text-[9px] px-1" onClick={() => setSelectedResult(result.config_name)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Save Result */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                <Input
                  placeholder="Name for this result..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="h-8 text-xs max-w-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => {
                    const result = selectedResult ? backtestResults.find(r => r.config_name === selectedResult) : bestConfig;
                    if (result) handleSaveResult(result, saveName);
                  }}
                >
                  <Save className="h-3 w-3" /> Save Result
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Equity Curve Tab ── */}
        <TabsContent value="equity">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Backtest Equity Curve</CardTitle>
                  <CardDescription className="text-xs">Capital progression over 30 trading days</CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {selectedResult || bestConfig?.config_name || 'Best Config'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockBacktestEquity} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="btEquityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} tickLine={false} axisLine={false} width={55} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }}
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Capital']}
                      labelFormatter={(label) => `Day ${label}`}
                    />
                    <ReferenceLine y={200000} stroke="var(--muted-foreground)" strokeDasharray="5 5" strokeOpacity={0.5} label={{ value: 'Start', position: 'right', fill: 'var(--muted-foreground)', fontSize: 9 }} />
                    <Area type="monotone" dataKey="capital" stroke="#22c55e" fill="url(#btEquityGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#22c55e', stroke: 'var(--card)', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Summary stats below curve */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground">Starting Capital</span>
                  <p className="text-sm font-mono font-semibold">₹2,00,000</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Final Capital</span>
                  <p className="text-sm font-mono font-semibold text-emerald-400">₹2,67,300</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Total Return</span>
                  <p className="text-sm font-mono font-semibold text-emerald-400">+33.65%</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Max Drawdown</span>
                  <p className="text-sm font-mono font-semibold text-amber-400">-4.8%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Trade Distribution Tab ── */}
        <TabsContent value="distribution">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Win/Loss Distribution</CardTitle>
              <CardDescription className="text-xs">Frequency of trades by P&L range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockTradeDistribution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<DistributionTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.08 }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={36}>
                      {mockTradeDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.type === 'win' ? '#22c55e' : '#ef4444'} fillOpacity={0.85} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 9, fill: 'var(--muted-foreground)', fontFamily: 'monospace' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Win/Loss Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Winning Trades</span>
                    <span className="text-sm font-mono font-semibold">{mockTradeDistribution.filter(d => d.type === 'win').reduce((s, d) => s + d.count, 0)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-red-500 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Losing Trades</span>
                    <span className="text-sm font-mono font-semibold">{mockTradeDistribution.filter(d => d.type === 'loss').reduce((s, d) => s + d.count, 0)}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Win Rate</span>
                  <span className="text-sm font-mono font-semibold text-emerald-400">
                    {((mockTradeDistribution.filter(d => d.type === 'win').reduce((s, d) => s + d.count, 0) / mockTradeDistribution.reduce((s, d) => s + d.count, 0)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Profit Factor</span>
                  <span className="text-sm font-mono font-semibold">1.96</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Monthly Returns Heatmap Tab ── */}
        <TabsContent value="heatmap">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Monthly Returns Heatmap</CardTitle>
              <CardDescription className="text-xs">Monthly P&L percentage — green = profit, red = loss</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Heatmap Grid */}
              <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                  {/* Header row */}
                  <div className="grid grid-cols-[60px_1fr_1fr] gap-1 mb-1">
                    <div className="text-[10px] text-muted-foreground font-medium px-1 py-1">Month</div>
                    <div className="text-[10px] text-muted-foreground font-medium px-1 py-1 text-center">2025</div>
                    <div className="text-[10px] text-muted-foreground font-medium px-1 py-1 text-center">2026</div>
                  </div>
                  {/* Data rows */}
                  {mockMonthlyReturns.map(row => (
                    <div key={row.month} className="grid grid-cols-[60px_1fr_1fr] gap-1 mb-1">
                      <div className="text-[10px] text-muted-foreground font-medium px-1 py-1.5">{row.month}</div>
                      <div className="h-7">
                        <HeatmapCell value={row.y2025} />
                      </div>
                      <div className="h-7">
                        <HeatmapCell value={row.y2026} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-3 rounded-sm bg-red-500/25" /> Loss
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-3 rounded-sm bg-secondary/30" /> No data
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-3 rounded-sm bg-emerald-500/25" /> Profit
                </div>
                <span className="ml-auto">Intensity = magnitude</span>
              </div>

              {/* Yearly Summary */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Card className="bg-secondary/30 border-border/50">
                  <CardContent className="p-3 text-center">
                    <div className="text-[10px] text-muted-foreground">2025 Total</div>
                    <div className={cn(
                      'text-sm font-mono font-bold',
                      mockMonthlyReturns.reduce((s, r) => s + r.y2025, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      +{mockMonthlyReturns.reduce((s, r) => s + r.y2025, 0).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-secondary/30 border-border/50">
                  <CardContent className="p-3 text-center">
                    <div className="text-[10px] text-muted-foreground">2026 YTD</div>
                    <div className={cn(
                      'text-sm font-mono font-bold',
                      mockMonthlyReturns.reduce((s, r) => s + r.y2026, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      +{mockMonthlyReturns.reduce((s, r) => s + r.y2026, 0).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Saved Backtests Tab ── */}
        <TabsContent value="saved">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Saved Backtest Results</CardTitle>
                  <CardDescription className="text-xs">{savedBacktests.length} saved configurations</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={() => setNewBacktestOpen(true)}>
                  <FlaskConical className="h-3 w-3" /> New
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {savedBacktests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No saved backtests yet</p>
                  <p className="text-xs mt-1">Save a backtest result to access it later</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedBacktests.map((saved) => (
                    <div key={saved.id} className="rounded-lg bg-secondary/30 border border-border hover:bg-secondary/50 transition-colors overflow-hidden">
                      {/* Main Row */}
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            {renamingId === saved.id ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value)}
                                  className="h-6 text-xs w-36"
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSaved(saved.id); if (e.key === 'Escape') setRenamingId(null); }}
                                />
                                <Button variant="ghost" size="sm" className="h-6 text-[9px] px-1" onClick={() => handleRenameSaved(saved.id)}>
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 text-[9px] px-1" onClick={() => setRenamingId(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="text-sm font-medium truncate">{saved.name}</div>
                            )}
                            <div className="text-[10px] text-muted-foreground">
                              {saved.result.config_name} • Saved {new Date(saved.savedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <div className={cn('text-sm font-mono font-semibold', pnlColor(saved.result.net_pnl))}>
                              {formatCurrency(saved.result.net_pnl)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              WR: {saved.result.win_rate}% | PF: {saved.result.profit_factor}
                            </div>
                          </div>
                          {/* Compare Checkbox */}
                          <div className="flex items-center gap-1" title="Select for comparison">
                            <Checkbox
                              checked={compareIds.includes(saved.result.config_name)}
                              onCheckedChange={() => toggleCompare(saved.result.config_name)}
                              className="h-3.5 w-3.5"
                            />
                          </div>
                          {/* Actions Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toggleExpandSaved(saved.id)}>
                                <Eye className="h-3 w-3 mr-2" />
                                {saved.expanded ? 'Hide Details' : 'View Details'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setRenamingId(saved.id); setRenameValue(saved.name); }}>
                                <Pencil className="h-3 w-3 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-400 focus:text-red-400"
                                onClick={() => handleDeleteSaved(saved.id, saved.name)}
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Mobile stats row */}
                      <div className="px-3 pb-2 sm:hidden">
                        <div className={cn('text-sm font-mono font-semibold', pnlColor(saved.result.net_pnl))}>
                          {formatCurrency(saved.result.net_pnl)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          WR: {saved.result.win_rate}% | Sharpe: {saved.result.sharpe_ratio} | DD: {saved.result.max_drawdown}%
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {saved.expanded && (
                        <div className="border-t border-border/50 p-3 space-y-3">
                          {/* Quick stats grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Net P&L</span>
                              <p className={cn('font-mono font-semibold', pnlColor(saved.result.net_pnl))}>{formatCurrency(saved.result.net_pnl)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Win Rate</span>
                              <p className={cn('font-mono', saved.result.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400')}>{saved.result.win_rate}%</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Sharpe Ratio</span>
                              <p className="font-mono">{saved.result.sharpe_ratio}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Max Drawdown</span>
                              <p className="font-mono text-amber-400">{saved.result.max_drawdown}%</p>
                            </div>
                          </div>

                          {/* Mini Equity Curve */}
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Equity Curve</p>
                            <div className="h-32">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={mockBacktestEquity} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id={`eqGrad-${saved.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <Area type="monotone" dataKey="capital" stroke="#22c55e" fill={`url(#eqGrad-${saved.id})`} strokeWidth={1.5} dot={false} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Mini Distribution */}
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Trade Distribution</p>
                            <div className="h-24">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={mockTradeDistribution} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                  <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={20}>
                                    {mockTradeDistribution.map((entry, idx) => (
                                      <Cell key={idx} fill={entry.type === 'win' ? '#22c55e' : '#ef4444'} fillOpacity={0.7} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      )}
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
