'use client';

/**
 * DDLJ Engine Control Page
 * =========================
 * Engine start/stop, live uptime, status grid, token status,
 * system readiness checks with auto-refresh every 15s.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatDuration, formatDateTime } from '@/lib/utils';
import type { ReadinessCheck } from '@/lib/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play,
  Square,
  Circle,
  CircleDot,
  Clock,
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Loader2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Skeleton Loader ──────────────────────────────────────────────

function EnginePageSkeleton() {
  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-6 w-24" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-36" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Readiness Check Row ──────────────────────────────────────────

function ReadinessCheckRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-2.5 transition-colors hover:bg-accent/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      {passed ? (
        <CheckCircle2 className="size-5 text-emerald-400" />
      ) : (
        <XCircle className="size-5 text-red-400" />
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export default function EnginePage() {
  const {
    engineStatus,
    isEngineLoading,
    readiness,
    fetchStatus,
    fetchReadiness,
    startEngine,
    stopEngine,
    setActivePage,
  } = useDDLJStore();

  const [liveUptime, setLiveUptime] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // ── Live uptime counter ─────────────────────────────────────
  useEffect(() => {
    if (!engineStatus.engine_running || !engineStatus.start_time) {
      setLiveUptime(0);
      return;
    }
    const start = new Date(engineStatus.start_time).getTime();
    const update = () => setLiveUptime(Math.floor((Date.now() - start) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [engineStatus.engine_running, engineStatus.start_time]);

  // ── Initial data fetch ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await Promise.allSettled([fetchStatus(), fetchReadiness()]);
      } catch {
        // handled by store
      } finally {
        if (!cancelled) setInitialLoad(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchStatus, fetchReadiness]);

  // ── Auto-refresh every 15 seconds ───────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      fetchReadiness();
    }, 15_000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchReadiness]);

  // ── Handlers ────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    try {
      await startEngine();
      toast.success('Engine started successfully');
    } catch (err) {
      toast.error(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [startEngine]);

  const handleStop = useCallback(async () => {
    try {
      await stopEngine();
      toast.info('Engine stopped');
    } catch (err) {
      toast.error(`Failed to stop: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [stopEngine]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([fetchStatus(), fetchReadiness()]);
      toast.success('Status refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchStatus, fetchReadiness]);

  // ── Skeleton loading ────────────────────────────────────────
  if (initialLoad) {
    return <EnginePageSkeleton />;
  }

  const isRunning = engineStatus.engine_running;

  return (
    <div className="page-enter space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Engine Control</h1>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 border-0',
              isRunning ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'
            )}
          >
            <CircleDot
              className={cn(
                'size-3',
                isRunning ? 'text-emerald-400' : 'text-zinc-400'
              )}
            />
            {isRunning ? 'Running' : 'Stopped'}
          </Badge>
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
      </div>

      {/* ── Engine Control Card ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Trading Engine</CardTitle>
          <CardDescription>
            Start or stop the DDLJ trading engine. The engine requires a valid token and completed readiness checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Start / Stop Button + Status */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {isRunning ? (
              <Button
                variant="destructive"
                size="lg"
                onClick={handleStop}
                disabled={isEngineLoading}
                className="gap-2 min-w-[140px]"
              >
                {isEngineLoading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Square className="size-5" />
                )}
                {isEngineLoading ? 'Stopping...' : 'Stop Engine'}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleStart}
                disabled={isEngineLoading}
                className="gap-2 min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isEngineLoading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Play className="size-5 fill-current" />
                )}
                {isEngineLoading ? 'Starting...' : 'Start Engine'}
              </Button>
            )}

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <CircleDot
                  className={cn(
                    'size-4',
                    isRunning ? 'text-emerald-400' : 'text-zinc-500'
                  )}
                />
                {isRunning && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {isRunning ? 'Running' : 'Stopped'}
              </span>
              {engineStatus.last_heartbeat && (
                <span className="text-xs text-muted-foreground">
                  &middot; Heartbeat {formatDateTime(engineStatus.last_heartbeat)}
                </span>
              )}
            </div>
          </div>

          <Separator />

          {/* Status Grid — 4 cells */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Uptime */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Clock className="size-3" /> Uptime
              </div>
              <div className="font-mono text-lg tabular-nums">
                {isRunning ? formatDuration(liveUptime) : '—'}
              </div>
            </div>

            {/* Errors */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="size-3" /> Errors
              </div>
              <div
                className={cn(
                  'font-mono text-lg tabular-nums',
                  engineStatus.error_count > 0 ? 'text-red-400' : 'text-emerald-400'
                )}
              >
                {engineStatus.error_count}
              </div>
            </div>

            {/* Initialized */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Activity className="size-3" /> Initialized
              </div>
              <div
                className={cn(
                  'font-mono text-lg',
                  engineStatus.initialized ? 'text-emerald-400' : 'text-amber-400'
                )}
              >
                {engineStatus.initialized ? 'Yes' : 'No'}
              </div>
            </div>

            {/* Token */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <ShieldCheck className="size-3" /> Token
              </div>
              <div
                className={cn(
                  'font-mono text-lg',
                  engineStatus.token.valid ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {engineStatus.token.valid ? 'Valid' : 'Invalid'}
              </div>
            </div>
          </div>

          {/* Start / Stop timestamps */}
          {(engineStatus.start_time || engineStatus.stop_time) && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {engineStatus.start_time && (
                <span>
                  Started: {formatDateTime(engineStatus.start_time)}
                </span>
              )}
              {engineStatus.stop_time && !isRunning && (
                <span>
                  Stopped: {formatDateTime(engineStatus.stop_time)}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Token Status Card ───────────────────────────────────── */}
      <Card
        className={cn(
          'border',
          engineStatus.token.valid ? 'border-emerald-500/20' : 'border-red-500/20'
        )}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'size-10 rounded-xl flex items-center justify-center',
                engineStatus.token.valid ? 'bg-emerald-500/20' : 'bg-red-500/20'
              )}
            >
              <ShieldCheck
                className={cn(
                  'size-5',
                  engineStatus.token.valid ? 'text-emerald-400' : 'text-red-400'
                )}
              />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Token Status</CardTitle>
              <CardDescription className="mt-0.5">
                Kite API authentication state
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'ml-auto gap-1.5 border-0',
                engineStatus.token.valid
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}
            >
              {engineStatus.token.valid ? (
                <>
                  <CheckCircle2 className="size-3" /> Valid
                </>
              ) : (
                <>
                  <XCircle className="size-3" />{' '}
                  {engineStatus.token.stored ? 'Expired' : 'Not Set'}
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Circle
              className={cn(
                'size-3 fill-current',
                engineStatus.token.valid ? 'text-emerald-400' : 'text-red-400'
              )}
            />
            <div>
              <p className="text-sm font-medium">
                {engineStatus.token.valid
                  ? 'Token is valid and active'
                  : 'Token is invalid or missing'}
              </p>
              {engineStatus.token.user && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  User: {engineStatus.token.user}
                </p>
              )}
            </div>
          </div>
          {!engineStatus.token.valid && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-amber-400 mb-1">Token Required</p>
                The engine requires a valid Kite token to run. Go to the{' '}
                <button
                  onClick={() => setActivePage('token')}
                  className="text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-center gap-0.5"
                >
                  Token page
                  <ChevronRight className="size-3" />
                </button>{' '}
                to set one up.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── System Readiness Card ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'size-10 rounded-xl flex items-center justify-center',
                readiness?.status === 'ready'
                  ? 'bg-emerald-500/20'
                  : 'bg-amber-500/20'
              )}
            >
              <CheckCircle2
                className={cn(
                  'size-5',
                  readiness?.status === 'ready'
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                )}
              />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">System Readiness</CardTitle>
              <CardDescription className="mt-0.5">
                Pre-flight checks before starting the engine
              </CardDescription>
            </div>
            {readiness && (
              <Badge
                variant="outline"
                className={cn(
                  'ml-auto gap-1.5 border-0',
                  readiness.status === 'ready'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                )}
              >
                {readiness.status === 'ready' ? 'All Clear' : 'Not Ready'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {readiness ? (
            <>
              {/* Check Rows */}
              {Object.keys(readiness.checks).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(readiness.checks).map(([key, passed]) => (
                    <ReadinessCheckRow
                      key={key}
                      label={formatCheckLabel(key)}
                      passed={passed}
                    />
                  ))}
                </div>
              )}

              {/* Blockers */}
              {readiness.blockers.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2 flex items-center gap-1.5">
                      <XCircle className="size-3.5" /> Blockers
                    </p>
                    <div className="space-y-1.5">
                      {readiness.blockers.map((blocker, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-md bg-red-500/5 border border-red-500/10 px-3 py-2"
                        >
                          <XCircle className="size-3.5 text-red-400 flex-shrink-0" />
                          <span className="text-xs text-red-300">{blocker}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Next Actions */}
              {readiness.next_actions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                      <ChevronRight className="size-3.5" /> Next Actions
                    </p>
                    <div className="space-y-1.5">
                      {readiness.next_actions.map((action, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-md bg-amber-500/5 border border-amber-500/10 px-3 py-2"
                        >
                          <span className="flex size-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <span className="text-xs text-amber-200">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* All ready message */}
              {readiness.status === 'ready' && readiness.blockers.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-4 py-3">
                  <CheckCircle2 className="size-5 text-emerald-400" />
                  <p className="text-sm text-emerald-400 font-medium">
                    All systems ready. You can start the engine.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading readiness checks...
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function formatCheckLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
