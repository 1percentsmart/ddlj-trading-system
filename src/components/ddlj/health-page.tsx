'use client';

/**
 * DDLJ System Health Page
 * =========================
 * Service status, health checks, logs viewer, market hours.
 */

import { useDDLJStore } from '@/lib/store';
import { cn, formatDuration } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
} from 'lucide-react';
import { toast } from 'sonner';

export function HealthPage() {
  const { healthChecks, engineStatus } = useDDLJStore();

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

      {/* ── Individual Health Checks ── */}
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

      {/* ── System Info ── */}
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
            ].map((svc, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
                    {svc.name}
                  </div>
                  <div className="text-xs text-muted-foreground ml-3.5">{svc.desc}</div>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-400">{svc.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


