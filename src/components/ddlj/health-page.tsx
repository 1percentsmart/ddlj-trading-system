'use client';

/**
 * DDLJ System Health Page (Enhanced)
 * =====================================
 * Log viewer with level + service filtering, 50 log entries,
 * system metrics (CPU/Mem/Disk/Network), restart service with
 * confirmation dialog, uptime graph (last 24h).
 */

import { useState, useEffect, useMemo } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatDuration } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  Wifi,
  RefreshCw,
  Server,
  Shield,
  Database,
  Bell,
  RotateCcw,
  FileText,
  MemoryStick,
  Trash2,
  WifiOff,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { toast } from 'sonner';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  service: string;
  message: string;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  networkLatency: number;
  cpuHistory: { time: string; value: number }[];
  memoryHistory: { time: string; value: number }[];
  uptimeHistory: { time: string; uptime: number }[];
}

// Generate 50 mock log entries — deterministic to avoid hydration mismatch
const generateMockLogs = (): LogEntry[] => {
  const services = ['Engine', 'Telegram', 'Token', 'Market', 'Session', 'WebSocket', 'Database', 'Risk', 'Health', 'Scheduler'];
  const messages: Record<string, string[]> = {
    Engine: [
      'Candle processed: BankNifty 15m #1247',
      'EMA calculation complete — Fast: 56280, Slow: 56050',
      'Signal generated: BUY BankNifty CE 56300 @ ₹320',
      'Market hours guard active — 3h 15m until close',
      'Strategy evaluation complete — no signal',
      'Position tracker synced — 2 open positions',
      'Candle processed: Nifty 15m #891',
    ],
    Telegram: [
      'Message delivery delayed by 2.1s (rate limit)',
      'Trade alert sent: BUY BankNifty CE 56300',
      'Daily summary notification queued',
      'Bot polling restarted after timeout',
    ],
    Token: [
      'Token validity check — 8h 12m remaining',
      'Token auto-refresh scheduled for 23:30 IST',
      'Token exchange successful — new session started',
    ],
    Market: [
      'VIX refreshed: 16.42 (NORMAL regime)',
      'Market status changed: PRE_MARKET → OPEN',
      'Index data refreshed: BankNifty 56350, Nifty 24320',
      'Options chain data refreshed for BankNifty',
      'Market closing soon — 15 minutes remaining',
    ],
    Session: [
      'Session state auto-saved — 2 open positions, 3 trades today',
      'Session recovery file written to disk',
      'Session checkpoint created — 47 trades logged',
    ],
    WebSocket: [
      'Connection dropped — reconnected in 1.2s',
      'WebSocket heartbeat OK — latency 45ms',
      'Tick data stream active — 12 subscriptions',
      'Reconnection attempt #1 after network blip',
    ],
    Database: [
      'Trade log committed — T047 exit recorded',
      'Database vacuum completed — 2.1MB freed',
      'Journal entry saved — J005',
      'Configuration backup created',
    ],
    Risk: [
      'Daily risk usage at 53% — approaching caution zone',
      'Circuit breaker check — all limits within bounds',
      'Greeks recalculated — Delta: 0.15, Vega: 35.2',
      'Position risk assessment updated',
    ],
    Health: [
      'Health check cycle completed — 6/6 checks healthy',
      'System memory usage: 45% (normal)',
      'Service ping sweep — all services responding',
    ],
    Scheduler: [
      'Scheduled task: VIX refresh (every 5min)',
      'Scheduled task: Session save (every 60s)',
      'Scheduled task: Health check (every 30s)',
      'Cron job executed: daily_report at 15:35 IST',
    ],
  };

  // Use a fixed base time to avoid Date.now() hydration mismatch
  const baseTime = new Date('2026-04-28T15:00:00+05:30').getTime();
  const logs: LogEntry[] = [];
  let id = 1;
  for (let i = 0; i < 50; i++) {
    const service = services[i % services.length];
    const serviceMessages = messages[service];
    const message = serviceMessages[i % serviceMessages.length];
    // Deterministic level based on index instead of Math.random()
    const levelRoll = (i * 7 + 3) % 10;
    const level: 'info' | 'warning' | 'error' = levelRoll < 7 ? 'info' : levelRoll < 9 ? 'warning' : 'error';
    logs.push({
      id: `L${String(id++).padStart(3, '0')}`,
      // Deterministic timestamp based on fixed base time
      timestamp: new Date(baseTime - (i + 1) * 60000 * (1 + ((i * 3) % 3) * 0.5)).toISOString(),
      level,
      service,
      message,
    });
  }
  return logs;
};

export function HealthPage() {
  const { healthChecks, engineStatus } = useDDLJStore();

  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [logs, setLogs] = useState<LogEntry[]>(generateMockLogs);
  const [restartingService, setRestartingService] = useState<string | null>(null);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [restartTarget, setRestartTarget] = useState<string>('');

  // Mock system metrics
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 23,
    memory: 45,
    disk: 32,
    networkLatency: 42,
    cpuHistory: [
      { time: '00:00', value: 12 }, { time: '01:00', value: 10 }, { time: '02:00', value: 8 },
      { time: '03:00', value: 7 }, { time: '04:00', value: 6 }, { time: '05:00', value: 8 },
      { time: '06:00', value: 10 }, { time: '07:00', value: 15 }, { time: '08:00', value: 22 },
      { time: '09:00', value: 28 }, { time: '09:15', value: 35 }, { time: '10:00', value: 30 },
      { time: '11:00', value: 28 }, { time: '12:00', value: 20 }, { time: '13:00', value: 22 },
      { time: '14:00', value: 25 }, { time: '15:00', value: 23 }, { time: '16:00', value: 18 },
      { time: '17:00', value: 14 }, { time: '18:00', value: 12 }, { time: '19:00', value: 10 },
      { time: '20:00', value: 9 }, { time: '21:00', value: 8 }, { time: '22:00', value: 7 },
      { time: '23:00', value: 6 },
    ],
    memoryHistory: [
      { time: '00:00', value: 35 }, { time: '01:00', value: 34 }, { time: '02:00', value: 33 },
      { time: '03:00', value: 33 }, { time: '04:00', value: 32 }, { time: '05:00', value: 33 },
      { time: '06:00', value: 34 }, { time: '07:00', value: 36 }, { time: '08:00', value: 38 },
      { time: '09:00', value: 40 }, { time: '09:15', value: 42 }, { time: '10:00', value: 44 },
      { time: '11:00', value: 45 }, { time: '12:00', value: 44 }, { time: '13:00', value: 43 },
      { time: '14:00', value: 46 }, { time: '15:00', value: 45 }, { time: '16:00', value: 42 },
      { time: '17:00', value: 40 }, { time: '18:00', value: 38 }, { time: '19:00', value: 37 },
      { time: '20:00', value: 36 }, { time: '21:00', value: 35 }, { time: '22:00', value: 35 },
      { time: '23:00', value: 34 },
    ],
    uptimeHistory: Array.from({ length: 25 }, (_, i) => ({
      time: `${String(i).padStart(2, '0')}:00`,
      uptime: i === 0 ? 100 : Math.max(95, 100 - ((i * 7 + 3) % 10) * 0.3),
    })),
  });

  // Simulate metrics updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        cpu: Math.max(5, Math.min(90, prev.cpu + (Math.random() - 0.5) * 8)),
        memory: Math.max(30, Math.min(80, prev.memory + (Math.random() - 0.5) * 3)),
        disk: prev.disk,
        networkLatency: Math.max(10, Math.min(200, prev.networkLatency + (Math.random() - 0.5) * 20)),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Get unique services for filter
  const allServices = useMemo(() => {
    const svcs = new Set(logs.map(l => l.service));
    return Array.from(svcs).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchesLevel = logFilter === 'ALL' || l.level === logFilter;
      const matchesService = serviceFilter === 'ALL' || l.service === serviceFilter;
      return matchesLevel && matchesService;
    });
  }, [logs, logFilter, serviceFilter]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <Activity className="h-4 w-4 text-zinc-400" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[10px]">HEALTHY</Badge>;
      case 'degraded': return <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-[10px]">DEGRADED</Badge>;
      case 'unhealthy': return <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/20 text-[10px]">UNHEALTHY</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">UNKNOWN</Badge>;
    }
  };

  const healthyCount = healthChecks.filter(h => h.status === 'healthy').length;
  const overallHealth = healthyCount === healthChecks.length ? 'healthy' :
    healthChecks.some(h => h.status === 'unhealthy') ? 'unhealthy' : 'degraded';

  const handleRestartClick = (serviceName: string) => {
    setRestartTarget(serviceName);
    setRestartConfirmOpen(true);
  };

  const handleRestartConfirm = () => {
    setRestartingService(restartTarget);
    setRestartConfirmOpen(false);
    toast.info(`Restarting ${restartTarget}...`);
    setTimeout(() => {
      setRestartingService(null);
      toast.success(`${restartTarget} restarted successfully`);
      setRestartTarget('');
    }, 2000);
  };

  const handleClearLogs = () => {
    setLogs([]);
    toast.success('Logs cleared');
  };

  const metricColor = (value: number) => value < 50 ? 'text-emerald-400' : value < 75 ? 'text-amber-400' : 'text-red-400';
  const metricBg = (value: number) => value < 50 ? 'bg-emerald-500' : value < 75 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
      {/* ── Overall Health ── */}
      <Card className={cn('bg-card/80 border',
        overallHealth === 'healthy' ? 'border-emerald-500/20' :
        overallHealth === 'degraded' ? 'border-amber-500/20' : 'border-red-500/20'
      )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {statusIcon(overallHealth)}
              <div>
                <CardTitle className="text-lg">System Health</CardTitle>
                <CardDescription>Overall system status and service health</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge(overallHealth)}
              <Button variant="outline" size="sm" onClick={() => toast.success('Health checks refreshed')} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">{healthyCount}</div>
              <div className="text-[10px] text-muted-foreground">Healthy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">{healthChecks.filter(h => h.status === 'degraded').length}</div>
              <div className="text-[10px] text-muted-foreground">Degraded</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400">{healthChecks.filter(h => h.status === 'unhealthy').length}</div>
              <div className="text-[10px] text-muted-foreground">Unhealthy</div>
            </div>
            <Separator orientation="vertical" className="h-12 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold">{healthChecks.length}</div>
              <div className="text-[10px] text-muted-foreground">Total Checks</div>
            </div>
          </div>
          <Progress value={(healthyCount / healthChecks.length) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* ── System Metrics Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">CPU Usage</span>
              </div>
              <span className={cn('text-xl font-bold font-mono tabular-nums', metricColor(metrics.cpu))}>
                {metrics.cpu.toFixed(0)}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-1000 ease-out', metricBg(metrics.cpu))}
                style={{ width: `${metrics.cpu}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Memory</span>
              </div>
              <span className={cn('text-xl font-bold font-mono tabular-nums', metricColor(metrics.memory))}>
                {metrics.memory.toFixed(0)}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-1000 ease-out', metricBg(metrics.memory))}
                style={{ width: `${metrics.memory}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Disk Usage</span>
              </div>
              <span className={cn('text-xl font-bold font-mono tabular-nums', metricColor(metrics.disk))}>
                {metrics.disk}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-1000 ease-out', metricBg(metrics.disk))}
                style={{ width: `${metrics.disk}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {metrics.networkLatency < 100 ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-red-400" />}
                <span className="text-xs text-muted-foreground">Network Latency</span>
              </div>
              <span className={cn('text-xl font-bold font-mono tabular-nums',
                metrics.networkLatency < 50 ? 'text-emerald-400' : metrics.networkLatency < 100 ? 'text-amber-400' : 'text-red-400'
              )}>
                {metrics.networkLatency.toFixed(0)}ms
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="outline" className={cn('text-[9px]',
                metrics.networkLatency < 50 ? 'border-emerald-500/30 text-emerald-400' :
                metrics.networkLatency < 100 ? 'border-amber-500/30 text-amber-400' :
                'border-red-500/30 text-red-400'
              )}>
                {metrics.networkLatency < 50 ? 'Excellent' : metrics.networkLatency < 100 ? 'Normal' : 'High Latency'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Health Checks + Services ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Health Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {healthChecks.map((check, i) => (
                <div key={i} className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  check.status === 'healthy' ? 'bg-emerald-500/5 border-emerald-500/10' :
                  check.status === 'degraded' ? 'bg-amber-500/5 border-amber-500/10' :
                  'bg-red-500/5 border-red-500/10'
                )}>
                  <div className="flex items-center gap-3">
                    {statusIcon(check.status)}
                    <div>
                      <div className="text-sm font-medium">{check.name}</div>
                      <div className="text-xs text-muted-foreground">{check.message}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(check.last_checked).toLocaleTimeString('en-IN')}
                    </span>
                    {statusBadge(check.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" /> Active Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Market Hours Guard', status: 'active', desc: 'Auto start/stop at 9:15–3:30 IST' },
              { name: 'Token Refresh Service', status: 'active', desc: 'Monitors Kite token validity every 5min' },
              { name: 'Session Recovery', status: 'active', desc: 'Auto-saves state every 60 seconds' },
              { name: 'Telegram Notifier', status: 'active', desc: 'Trade alerts + daily summaries' },
              { name: 'Health Monitor', status: 'active', desc: '6 health checks running' },
              { name: 'WebSocket Server', status: 'active', desc: 'Real-time dashboard updates' },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {svc.name}
                  </div>
                  <div className="text-xs text-muted-foreground ml-3.5">{svc.desc}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] text-emerald-400">{svc.status}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[9px] gap-1 text-muted-foreground hover:text-foreground"
                    disabled={restartingService === svc.name}
                    onClick={() => handleRestartClick(svc.name)}
                  >
                    {restartingService === svc.name ? (
                      <><RefreshCw className="h-3 w-3 animate-spin" /> Restarting</>
                    ) : (
                      <><RotateCcw className="h-3 w-3" /> Restart</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Uptime Graph (Last 24 Hours) ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" /> Uptime — Last 24 Hours
          </CardTitle>
          <CardDescription className="text-xs">System availability across the day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.uptimeHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} domain={[90, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--foreground)' }} formatter={(value: number) => [`${value.toFixed(1)}%`, 'Uptime']} />
                <ReferenceLine y={99} stroke="#22c55e" strokeDasharray="5 5" strokeOpacity={0.5} />
                <ReferenceLine y={95} stroke="#ef4444" strokeDasharray="5 5" strokeOpacity={0.5} />
                <Area type="monotone" dataKey="uptime" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-1 bg-emerald-500 rounded" /> 99% SLA target</span>
            <span className="flex items-center gap-1"><span className="w-2 h-1 bg-red-500 rounded" /> 95% minimum</span>
            <span>Current uptime: {formatDuration(engineStatus.uptime_seconds)}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Server Info + Log Viewer ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" /> Server Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Version', value: '10.1.0 (Production)', icon: <Cpu className="h-3.5 w-3.5" /> },
              { label: 'Framework', value: 'FastAPI + Python 3.12', icon: <Server className="h-3.5 w-3.5" /> },
              { label: 'Database', value: 'SQLite (dev) / Supabase (prod)', icon: <Database className="h-3.5 w-3.5" /> },
              { label: 'Uptime', value: formatDuration(engineStatus.uptime_seconds), icon: <Clock className="h-3.5 w-3.5" /> },
              { label: 'Connection', value: engineStatus.token.valid ? 'Connected (Kite API)' : 'Disconnected', icon: <Wifi className="h-3.5 w-3.5" /> },
              { label: 'Notifications', value: 'Telegram (Active)', icon: <Bell className="h-3.5 w-3.5" /> },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted-foreground flex items-center gap-2">{item.icon} {item.label}</span>
                <span className="text-sm font-mono">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Log Viewer (Enhanced) */}
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> System Logs
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={logFilter} onValueChange={setLogFilter}>
                  <SelectTrigger className="h-7 text-[10px] w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Levels</SelectItem>
                    <SelectItem value="info">Info Only</SelectItem>
                    <SelectItem value="warning">Warnings Only</SelectItem>
                    <SelectItem value="error">Errors Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="h-7 text-[10px] w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Services</SelectItem>
                    {allServices.map(svc => (
                      <SelectItem key={svc} value={svc}>{svc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <div className="space-y-1">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {logs.length === 0 ? 'No logs — click Clear Logs to remove entries' : 'No logs matching filter'}
                  </div>
                ) : (
                  filteredLogs.slice(0, 50).map((log) => (
                    <div key={log.id} className={cn(
                      'flex items-start gap-2 py-1.5 px-2 rounded text-xs border-b border-border/20 last:border-0',
                      log.level === 'error' ? 'bg-red-500/5' : log.level === 'warning' ? 'bg-amber-500/5' : ''
                    )}>
                      <Badge className={cn(
                        'text-[7px] px-1 h-4 flex-shrink-0',
                        log.level === 'error' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/20' :
                        log.level === 'warning' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/20' :
                        'bg-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                      )}>
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground font-mono flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="text-primary font-mono flex-shrink-0">[{log.service}]</span>
                      <span className="text-foreground/80 flex-1">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
              <span>{filteredLogs.length} of {logs.length} entries</span>
              <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-1" onClick={handleClearLogs}>
                <Trash2 className="h-2.5 w-2.5" /> Clear Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Restart Confirmation Dialog */}
      <Dialog open={restartConfirmOpen} onOpenChange={setRestartConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Restart Service
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restart <span className="font-semibold text-foreground">{restartTarget}</span>?
              This may cause temporary interruption to dependent services.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs text-muted-foreground">
            <p>• The service will be unavailable during restart (typically 2-5 seconds)</p>
            <p>• Any in-progress operations may be interrupted</p>
            <p>• The service will automatically resume after restart</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestartConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRestartConfirm} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Restart {restartTarget}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
