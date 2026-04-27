'use client';

/**
 * DDLJ Engine Control — Simplified
 * ===================================
 * Real start/stop with API calls. Clean status display.
 */

import { useState, useEffect } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatDuration } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  Square,
  Circle,
  Clock,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';

export function EnginePage() {
  const {
    engineStatus,
    isEngineLoading,
    fetchStatus,
    startEngine,
    stopEngine,
  } = useDDLJStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Live uptime counter
  const [liveUptime, setLiveUptime] = useState(0);
  useEffect(() => {
    if (!engineStatus.engine_running || !engineStatus.start_time) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveUptime(0);
      return;
    }
    const start = new Date(engineStatus.start_time).getTime();
    const update = () => setLiveUptime(Math.floor((Date.now() - start) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [engineStatus.engine_running, engineStatus.start_time]);

  const handleStart = async () => {
    try {
      await startEngine();
      toast.success('Engine started');
    } catch (err) {
      toast.error(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleStop = async () => {
    try {
      await stopEngine();
      toast.info('Engine stopped');
    } catch (err) {
      toast.error(`Failed to stop: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4 p-4 max-w-3xl">
      {/* ── Engine Control ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Trading Engine</CardTitle>
            <div className="flex items-center gap-2">
              <Circle
                className={cn(
                  'h-3 w-3 fill-current',
                  engineStatus.engine_running ? 'text-emerald-400' : 'text-zinc-500'
                )}
              />
              <span className="text-sm font-medium">
                {engineStatus.engine_running ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {engineStatus.engine_running ? (
              <Button variant="destructive" onClick={handleStop} disabled={isEngineLoading} className="gap-2">
                <Square className="h-4 w-4" /> Stop Engine
              </Button>
            ) : (
              <Button onClick={handleStart} disabled={isEngineLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Play className="h-4 w-4" /> Start Engine
              </Button>
            )}
            {isEngineLoading && (
              <span className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                Processing...
              </span>
            )}
          </div>

          <Separator />

          {/* Status Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Uptime
              </div>
              <div className="font-mono text-lg tabular-nums mt-1">
                {engineStatus.engine_running ? formatDuration(liveUptime) : '—'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="text-xs text-muted-foreground">Errors</div>
              <div className={cn('font-mono text-lg tabular-nums mt-1', engineStatus.error_count > 0 ? 'text-red-400' : 'text-emerald-400')}>
                {engineStatus.error_count}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="text-xs text-muted-foreground">Initialized</div>
              <div className={cn('font-mono text-lg mt-1', engineStatus.initialized ? 'text-emerald-400' : 'text-amber-400')}>
                {engineStatus.initialized ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="text-xs text-muted-foreground">Token</div>
              <div className={cn('font-mono text-lg mt-1', engineStatus.token.valid ? 'text-emerald-400' : 'text-red-400')}>
                {engineStatus.token.valid ? 'Valid' : 'Invalid'}
              </div>
            </div>
          </div>

          {/* Last heartbeat */}
          {engineStatus.last_heartbeat && (
            <div className="text-xs text-muted-foreground">
              Last heartbeat: {mounted ? new Date(engineStatus.last_heartbeat).toLocaleTimeString('en-IN') : '—'}
            </div>
          )}

          {/* Start / Stop times */}
          {(engineStatus.start_time || engineStatus.stop_time) && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {engineStatus.start_time && (
                <span>Started: {new Date(engineStatus.start_time).toLocaleTimeString('en-IN')}</span>
              )}
              {engineStatus.stop_time && (
                <span>Stopped: {new Date(engineStatus.stop_time).toLocaleTimeString('en-IN')}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Token Status ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" /> Token Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Circle className={cn('h-3 w-3 fill-current', engineStatus.token.valid ? 'text-emerald-400' : 'text-red-400')} />
            <div>
              <div className="text-sm font-medium">
                {engineStatus.token.valid ? 'Token is valid' : 'Token is invalid or missing'}
              </div>
              {engineStatus.token.user && (
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  User: {engineStatus.token.user}
                </div>
              )}
            </div>
          </div>
          {!engineStatus.token.valid && (
            <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 flex items-center gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span className="text-muted-foreground">
                The engine requires a valid Kite token to run. Go to Token settings to set one up.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
