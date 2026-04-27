'use client';

/**
 * DDLJ Health Page — Real API
 * ==============================
 * Shows health status from backend. Clean, minimal.
 */

import { useState, useEffect } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Circle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';

export function HealthPage() {
  const { healthStatus, isConnected, fetchHealth } = useDDLJStore();

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleRefresh = async () => {
    try {
      await fetchHealth();
      toast.success('Health check refreshed');
    } catch (err) {
      toast.error(`Health check failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const isHealthy = healthStatus?.status === 'healthy';
  const isDegraded = healthStatus?.status === 'degraded';

  return (
    <div className="space-y-4 p-4 max-w-3xl">
      {/* ── Overall Health ── */}
      <Card className={cn(
        'bg-card/60 border',
        isHealthy ? 'border-emerald-500/20' : isDegraded ? 'border-amber-500/20' : 'border-red-500/20'
      )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isHealthy ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              ) : isDegraded ? (
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              ) : (
                <XCircle className="h-6 w-6 text-red-400" />
              )}
              <div>
                <CardTitle className="text-lg">System Health</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isHealthy ? 'All systems operational' : isDegraded ? 'Some services degraded' : 'System unhealthy'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  'text-xs',
                  isHealthy ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' :
                  isDegraded ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/20' :
                  'bg-red-500/20 text-red-400 hover:bg-red-500/20'
                )}
              >
                {(healthStatus?.status || 'UNKNOWN').toUpperCase()}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5 text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
            {isConnected ? (
              <Wifi className="h-5 w-5 text-emerald-400" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-400" />
            )}
            <div>
              <div className="text-sm font-medium">
                {isConnected ? 'Connected to backend' : 'Disconnected from backend'}
              </div>
              <div className="text-xs text-muted-foreground">
                API: {process.env.NEXT_PUBLIC_API_URL || 'Not configured'}
              </div>
            </div>
          </div>

          {/* Degraded reason */}
          {healthStatus?.reason && (
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <span className="font-medium text-amber-400">Reason:</span>
                <span className="text-muted-foreground">{healthStatus.reason}</span>
              </div>
            </div>
          )}

          {/* Action needed */}
          {healthStatus?.action && (
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <div className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <span className="font-medium text-blue-400">Action:</span>
                <span className="text-muted-foreground">{healthStatus.action}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── API Endpoints Status ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: 'GET /status', desc: 'Engine status & token info' },
              { name: 'GET /health', desc: 'Health check' },
              { name: 'GET /config', desc: 'Strategy configuration' },
              { name: 'GET /trades', desc: 'Trade history' },
              { name: 'GET /positions', desc: 'Open positions' },
              { name: 'GET /token/status', desc: 'Token validity' },
              { name: 'GET /token/login', desc: 'Login URL' },
              { name: 'POST /start', desc: 'Start engine' },
              { name: 'POST /stop', desc: 'Stop engine' },
              { name: 'POST /token', desc: 'Exchange token' },
              { name: 'PUT /config', desc: 'Update config' },
            ].map((ep) => (
              <div key={ep.name} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2">
                  <Circle className={cn('h-2 w-2 fill-current', isConnected ? 'text-emerald-400' : 'text-zinc-500')} />
                  <span className="text-xs font-mono font-semibold">{ep.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{ep.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
