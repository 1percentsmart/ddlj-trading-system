'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  Activity,
  Server,
  ShieldCheck,
  Circle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/lib/api';

// ── API Endpoint definitions ─────────────────────────────────────

interface EndpointDef {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  description: string;
}

const API_ENDPOINTS: EndpointDef[] = [
  { method: 'GET', path: '/status', description: 'Engine status & heartbeat' },
  { method: 'GET', path: '/health', description: 'Health check' },
  { method: 'GET', path: '/config', description: 'Current configuration' },
  { method: 'GET', path: '/trades', description: 'Trade history' },
  { method: 'GET', path: '/positions', description: 'Open positions' },
  { method: 'GET', path: '/token/status', description: 'Token validity check' },
  { method: 'GET', path: '/token/login', description: 'Kite login URL' },
  { method: 'GET', path: '/readiness', description: 'Readiness probe' },
  { method: 'POST', path: '/start', description: 'Start the engine' },
  { method: 'POST', path: '/stop', description: 'Stop the engine' },
  { method: 'POST', path: '/token', description: 'Exchange request token' },
  { method: 'POST', path: '/backtest/run', description: 'Run backtest' },
  { method: 'PUT', path: '/config', description: 'Update configuration' },
];

// ── Method badge colors ──────────────────────────────────────────

function methodColor(method: string): string {
  switch (method) {
    case 'GET':
      return 'bg-emerald-500/10 text-emerald-400';
    case 'POST':
      return 'bg-amber-500/10 text-amber-400';
    case 'PUT':
      return 'bg-purple-500/10 text-purple-400';
    default:
      return 'bg-zinc-500/10 text-zinc-400';
  }
}

// ── Health Status Helpers ────────────────────────────────────────

function healthIcon(status: string) {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="size-12 text-emerald-400" />;
    case 'degraded':
      return <AlertTriangle className="size-12 text-amber-400" />;
    case 'unhealthy':
      return <XCircle className="size-12 text-red-400" />;
    default:
      return <Activity className="size-12 text-zinc-400" />;
  }
}

function healthBorderColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'border-emerald-500/40';
    case 'degraded':
      return 'border-amber-500/40';
    case 'unhealthy':
      return 'border-red-500/40';
    default:
      return 'border-zinc-500/40';
  }
}

function healthBadgeClass(status: string): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'degraded':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'unhealthy':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    default:
      return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
  }
}

// ── Main Health Page ─────────────────────────────────────────────

export default function HealthPage() {
  const {
    healthStatus,
    readiness,
    isConnected,
    fetchHealth,
    fetchReadiness,
  } = useDDLJStore();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Fetch on mount ───────────────────────────────────────────
  useEffect(() => {
    fetchHealth();
    fetchReadiness();
  }, [fetchHealth, fetchReadiness]);

  // ── Refresh handler ──────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([fetchHealth(), fetchReadiness()]);
      toast.success('Health status refreshed');
    } catch {
      toast.error('Failed to refresh health status');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchHealth, fetchReadiness]);

  // ── Computed values ──────────────────────────────────────────
  const status = healthStatus?.status ?? 'unknown';
  const isHealthy = status === 'healthy';
  const isDegraded = status === 'degraded';
  const isUnhealthy = status === 'unhealthy';

  const readinessChecks = readiness?.checks ?? {};
  const blockers = readiness?.blockers ?? [];
  const nextActions = readiness?.next_actions ?? [];

  return (
    <div className="page-enter space-y-6">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <Activity className="size-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Health & Readiness
            </h1>
            <p className="text-xs text-muted-foreground">
              System health status, API endpoints, and readiness checks
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {/* ── Overall Health Card ──────────────────────────────────── */}
      <Card className={cn('border-2', healthBorderColor(status))}>
        <CardContent className="flex flex-col items-center gap-4 py-8 sm:flex-row sm:items-center sm:gap-6">
          {/* Large status icon */}
          <div className="shrink-0">{healthIcon(status)}</div>

          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold">System Health</h2>
            <p className="text-sm text-muted-foreground">
              {isHealthy
                ? 'All systems operational'
                : isDegraded
                  ? 'System is running with limitations'
                  : isUnhealthy
                    ? 'System is not functioning properly'
                    : 'Health status unknown'}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:items-end">
            {/* Status badge */}
            <Badge
              className={cn(
                'px-3 py-1 text-xs font-bold uppercase tracking-wider border',
                healthBadgeClass(status)
              )}
            >
              {status.toUpperCase()}
            </Badge>

            {/* Connection status */}
            <div className="flex items-center gap-1.5 text-sm">
              {isConnected ? (
                <Wifi className="size-4 text-emerald-400" />
              ) : (
                <WifiOff className="size-4 text-red-400" />
              )}
              <span
                className={cn(
                  'font-medium',
                  isConnected ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Degraded Reason ──────────────────────────────────────── */}
      {healthStatus?.reason && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-400">Degraded Reason</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {healthStatus.reason}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Action Needed ────────────────────────────────────────── */}
      {healthStatus?.action && (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="size-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-sky-400">Action Needed</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {healthStatus.action}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── API URL & Connection Details ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Server className="size-4" />
            Connection Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">API Base URL</span>
              <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                {API_BASE}
              </code>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">Connection Status</span>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="size-4 text-emerald-400" />
                ) : (
                  <WifiOff className="size-4 text-red-400" />
                )}
                <span
                  className={cn(
                    'text-sm font-medium',
                    isConnected ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            {healthStatus?.engine_running !== undefined && (
              <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">Engine Running</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'border-0 text-xs',
                    healthStatus.engine_running
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-zinc-500/10 text-zinc-400'
                  )}
                >
                  <Circle
                    className={cn(
                      'size-2 mr-1',
                      healthStatus.engine_running
                        ? 'fill-emerald-400'
                        : 'fill-zinc-400'
                    )}
                  />
                  {healthStatus.engine_running ? 'Yes' : 'No'}
                </Badge>
              </div>
            )}
            {healthStatus?.token_valid !== undefined && (
              <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">Token Valid</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'border-0 text-xs',
                    healthStatus.token_valid
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  )}
                >
                  <Circle
                    className={cn(
                      'size-2 mr-1',
                      healthStatus.token_valid
                        ? 'fill-emerald-400'
                        : 'fill-red-400'
                    )}
                  />
                  {healthStatus.token_valid ? 'Valid' : 'Invalid'}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── API Endpoints Card ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Server className="size-4" />
            API Endpoints
          </CardTitle>
          <CardDescription className="text-xs">
            All available backend endpoints and their current reachability
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-4">
          <div className="space-y-1">
            {API_ENDPOINTS.map((ep) => (
              <div
                key={`${ep.method}-${ep.path}`}
                className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/50"
              >
                {/* Status dot */}
                <Circle
                  className={cn(
                    'size-2 shrink-0',
                    isConnected
                      ? 'fill-emerald-400 text-emerald-400'
                      : 'fill-red-400 text-red-400'
                  )}
                />

                {/* Method badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    'w-16 justify-center text-[10px] font-bold border-0',
                    methodColor(ep.method)
                  )}
                >
                  {ep.method}
                </Badge>

                {/* Path */}
                <code className="min-w-0 text-xs font-mono text-foreground">
                  {ep.path}
                </code>

                {/* Description */}
                <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
                  {ep.description}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Readiness Checks Card ────────────────────────────────── */}
      {readiness && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4" />
              Readiness Checks
            </CardTitle>
            <CardDescription className="text-xs">
              Individual system readiness checks — all must pass for the system to be
              fully operational
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Overall readiness status */}
              <div
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-4 py-3',
                  readiness.status === 'ready'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                )}
              >
                {readiness.status === 'ready' ? (
                  <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="size-5 text-red-400 shrink-0" />
                )}
                <div>
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      readiness.status === 'ready'
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    )}
                  >
                    {readiness.status === 'ready' ? 'System Ready' : 'System Not Ready'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {readiness.engine_running
                      ? 'Engine is currently running'
                      : 'Engine is stopped'}
                  </p>
                </div>
              </div>

              <Separator className="my-3" />

              {/* Individual checks */}
              {Object.entries(readinessChecks).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Individual Checks
                  </p>
                  {Object.entries(readinessChecks).map(([name, passed]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        {passed ? (
                          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="size-4 text-red-400 shrink-0" />
                        )}
                        <span className="text-sm font-medium">
                          {name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] border-0',
                          passed
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        )}
                      >
                        {passed ? 'Pass' : 'Fail'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Blockers */}
              {blockers.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">
                      Blockers
                    </p>
                    {blockers.map((blocker, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5"
                      >
                        <XCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
                        <span className="text-sm text-red-300">{blocker}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Next Actions */}
              {nextActions.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-sky-400 uppercase tracking-wider mb-2">
                      Recommended Actions
                    </p>
                    {nextActions.map((action, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-2.5"
                      >
                        <Info className="size-4 text-sky-400 shrink-0 mt-0.5" />
                        <span className="text-sm text-sky-300">{action}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
