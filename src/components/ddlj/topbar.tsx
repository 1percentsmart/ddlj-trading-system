'use client';

/**
 * DDLJ Trading Dashboard — Top Navigation Bar
 * =============================================
 * Shows: account summary, connection status, P&L, market status, clock
 */

import { useDDLJStore } from '@/lib/store';
import { formatCurrency, pnlColor, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Clock, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

export function DDLJTopBar() {
  const { engineStatus, isConnected } = useDDLJStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const istTime = currentTime.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <header className="h-12 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4">
      {/* ── Left: Account Summary ── */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Capital:</span>
          <span className="font-mono font-semibold tabular-nums">
            {formatCurrency(engineStatus.capital)}
          </span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Day P&L:</span>
          <span className={cn('font-mono font-semibold tabular-nums', pnlColor(engineStatus.daily_pnl))}>
            {formatCurrency(engineStatus.daily_pnl)}
          </span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Total P&L:</span>
          <span className={cn('font-mono font-semibold tabular-nums', pnlColor(engineStatus.total_pnl))}>
            {formatCurrency(engineStatus.total_pnl)}
          </span>
        </div>
      </div>

      {/* ── Right: Status Indicators ── */}
      <div className="flex items-center gap-3 text-sm">
        {/* Engine Status */}
        <div className="flex items-center gap-1.5">
          <Zap className={cn('h-3.5 w-3.5', engineStatus.engine_running ? 'text-emerald-400' : 'text-zinc-500')} />
          <span className={engineStatus.engine_running ? 'text-emerald-400' : 'text-zinc-500'}>
            {engineStatus.engine_running ? 'Engine Running' : 'Engine Off'}
          </span>
          {engineStatus.engine_running && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          )}
        </div>

        {/* Connection */}
        <div className="flex items-center gap-1">
          {isConnected ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-red-400" />
          )}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Market Status */}
        <Badge
          variant={engineStatus.market_status === 'open' ? 'default' : 'destructive'}
          className="text-[10px] font-bold"
        >
          {engineStatus.market_status === 'open' ? 'MARKET OPEN' :
           engineStatus.market_status === 'pre_market' ? 'PRE-MARKET' :
           engineStatus.market_status === 'post_market' ? 'POST-MARKET' : 'MARKET CLOSED'}
        </Badge>

        <div className="w-px h-4 bg-border" />

        {/* IST Clock */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-mono tabular-nums text-xs">{istTime} IST</span>
        </div>
      </div>
    </header>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
