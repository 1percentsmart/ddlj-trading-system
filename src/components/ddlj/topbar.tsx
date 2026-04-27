'use client';

/**
 * DDLJ Trading Dashboard — Top Navigation Bar
 * =============================================
 * Shows: account summary, connection status, P&L, market status, clock, settings
 * Responsive: collapses info on mobile, shows essential indicators only
 */

import { useDDLJStore } from '@/lib/store';
import { cn, formatCurrency, pnlColor, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SettingsPanel } from '@/components/ddlj/settings-panel';
import { Wifi, WifiOff, Clock, Zap, Search, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export function DDLJTopBar() {
  const { engineStatus, isConnected, setMobileMenuOpen } = useDDLJStore();
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
    <header className="h-12 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-2 sm:px-4 gap-2">
      {/* ── Left: Hamburger (mobile) + Account Summary ── */}
      <div className="flex items-center gap-2 sm:gap-4 text-sm min-w-0">
        {/* Mobile sidebar trigger — just a button, not the full sidebar component */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 flex-shrink-0"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </Button>

        {/* Capital — always visible */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs sm:text-sm">Capital:</span>
          <span className="font-mono font-semibold tabular-nums text-xs sm:text-sm">
            {formatCurrency(engineStatus.capital)}
          </span>
        </div>

        {/* Day P&L — hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-1.5">
          <div className="w-px h-4 bg-border" />
          <span className="text-muted-foreground">Day P&L:</span>
          <span className={cn('font-mono font-semibold tabular-nums', pnlColor(engineStatus.daily_pnl))}>
            {formatCurrency(engineStatus.daily_pnl)}
          </span>
        </div>

        {/* Total P&L — hidden on small screens */}
        <div className="hidden md:flex items-center gap-1.5">
          <div className="w-px h-4 bg-border" />
          <span className="text-muted-foreground">Total P&L:</span>
          <span className={cn('font-mono font-semibold tabular-nums', pnlColor(engineStatus.total_pnl))}>
            {formatCurrency(engineStatus.total_pnl)}
          </span>
        </div>
      </div>

      {/* ── Right: Status Indicators ── */}
      <div className="flex items-center gap-1.5 sm:gap-3 text-sm">
        {/* Engine Status — compact on mobile */}
        <div className="flex items-center gap-1">
          <Zap className={cn('h-3.5 w-3.5', engineStatus.engine_running ? 'text-emerald-400' : 'text-zinc-500')} />
          <span className={cn(
            'hidden sm:inline',
            engineStatus.engine_running ? 'text-emerald-400' : 'text-zinc-500'
          )}>
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

        <div className="w-px h-4 bg-border hidden sm:block" />

        {/* Spotlight Search */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-2 text-xs text-muted-foreground hidden sm:flex"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
        >
          <Search className="h-3 w-3" />
          <span>Search</span>
          <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ⌘K
          </kbd>
        </Button>

        {/* Mobile search button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 sm:hidden"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
        >
          <Search className="h-4 w-4" />
        </Button>

        <div className="w-px h-4 bg-border hidden sm:block" />

        {/* Market Status */}
        <Badge
          variant={engineStatus.market_status === 'open' ? 'default' : 'destructive'}
          className="text-[10px] font-bold hidden sm:flex"
        >
          {engineStatus.market_status === 'open' ? 'MARKET OPEN' :
           engineStatus.market_status === 'pre_market' ? 'PRE-MARKET' :
           engineStatus.market_status === 'post_market' ? 'POST-MARKET' : 'MARKET CLOSED'}
        </Badge>

        {/* Compact market badge on mobile */}
        <Badge
          variant={engineStatus.market_status === 'open' ? 'default' : 'destructive'}
          className="text-[9px] font-bold px-1 sm:hidden"
        >
          {engineStatus.market_status === 'open' ? 'OPEN' : 'CLOSED'}
        </Badge>

        <div className="w-px h-4 bg-border hidden md:block" />

        {/* IST Clock — hidden on small screens */}
        <div className="hidden md:flex items-center gap-1 text-muted-foreground">
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
