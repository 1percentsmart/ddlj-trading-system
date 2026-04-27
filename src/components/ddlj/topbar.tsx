'use client';

/**
 * DDLJ Trading Dashboard — Top Navigation Bar
 * =============================================
 * Shows: account summary, connection status, P&L, market status, clock, settings
 */

import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SettingsPanel } from '@/components/ddlj/settings-panel';
import { Wifi, WifiOff, Clock, Zap, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export function DDLJTopBar() {
  const { engineStatus, isConnected, setSpotlightOpen } = useDDLJStore();
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

        {/* Spotlight Search */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-2 text-xs text-muted-foreground"
          onClick={() => setSpotlightOpen(true)}
        >
          <Search className="h-3 w-3" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ⌘K
          </kbd>
        </Button>

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

        <div className="w-px h-4 bg-border" />

        {/* Settings */}
        <SettingsPanel />
      </div>
    </header>
  );
}
