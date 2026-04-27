'use client';

/**
 * DDLJ Trading Dashboard — Sidebar Navigation
 * =============================================
 * Professional dark sidebar with icon + label navigation.
 * Collapsible to icon-only mode.
 */

import {
  LayoutDashboard,
  Play,
  History,
  Settings,
  FlaskConical,
  KeyRound,
  Activity,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useDDLJStore, type PageId } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

export function DDLJSidebar() {
  const { activePage, setActivePage, sidebarCollapsed, toggleSidebar, engineStatus } = useDDLJStore();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'engine', label: 'Engine Control', icon: <Play className="h-4 w-4" />, badge: engineStatus.engine_running ? 'LIVE' : 'OFF', badgeColor: engineStatus.engine_running ? 'bg-emerald-500' : 'bg-zinc-500' },
    { id: 'trades', label: 'Trades & Positions', icon: <History className="h-4 w-4" />, badge: engineStatus.open_positions_count > 0 ? String(engineStatus.open_positions_count) : undefined },
    { id: 'config', label: 'Configuration', icon: <Settings className="h-4 w-4" /> },
    { id: 'backtest', label: 'Backtest', icon: <FlaskConical className="h-4 w-4" /> },
    { id: 'token', label: 'Kite Token', icon: <KeyRound className="h-4 w-4" />, badge: engineStatus.token.valid ? 'OK' : '!', badgeColor: engineStatus.token.valid ? 'bg-emerald-500' : 'bg-red-500' },
    { id: 'health', label: 'System Health', icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* ── Logo / Brand ── */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400">
          <TrendingUp className="h-5 w-5" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground tracking-wide">DDLJ</span>
            <span className="text-[10px] text-muted-foreground">Trading System v10.1</span>
          </div>
        )}
      </div>

      {/* ── Navigation Items ── */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-1 px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative group',
                activePage === item.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded text-white',
                      item.badgeColor || 'bg-primary'
                    )}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {sidebarCollapsed && item.badge && (
                <span className={cn(
                  'absolute top-1 right-1 text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full text-white',
                  item.badgeColor || 'bg-primary'
                )}>
                  {item.badge}
                </span>
              )}
              {sidebarCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>
      </ScrollArea>

      {/* ── Bottom Section ── */}
      <div className="border-t border-sidebar-border p-2">
        {/* ── Quick Stats ── */}
        {!sidebarCollapsed && (
          <div className="px-2 py-2 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Market</span>
              <Badge variant={engineStatus.market_status === 'open' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                {engineStatus.market_status === 'open' ? 'OPEN' : 'CLOSED'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>VIX</span>
              <span className="tabular-nums font-mono">{engineStatus.live_vix.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Bias</span>
              <span className={cn('font-semibold', 
                engineStatus.current_bias === 'BULLISH' ? 'text-emerald-400' :
                engineStatus.current_bias === 'BEARISH' ? 'text-red-400' : 'text-amber-400'
              )}>
                {engineStatus.current_bias}
              </span>
            </div>
          </div>
        )}

        <Separator className="my-1 bg-sidebar-border" />

        {/* ── Collapse Toggle ── */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
