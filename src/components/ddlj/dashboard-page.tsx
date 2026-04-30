'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatPercent, formatDuration } from '@/lib/utils';
import { Activity, TrendingUp, TrendingDown, Cpu, Wifi } from 'lucide-react';

export default function DashboardPage() {
  const { engineStatus, trades, positions, isConnected } = useDDLJStore();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Engine</p>
            <p className={cn('text-lg font-bold', engineStatus.engine_running ? 'text-emerald-400' : 'text-red-400')}>
              {engineStatus.engine_running ? 'Running' : 'Stopped'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Trades</p>
            <p className="text-lg font-bold">{trades.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Positions</p>
            <p className="text-lg font-bold">{positions.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Connection</p>
            <p className={cn('text-lg font-bold', isConnected ? 'text-emerald-400' : 'text-red-400')}>
              {isConnected ? 'Connected' : 'Offline'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
