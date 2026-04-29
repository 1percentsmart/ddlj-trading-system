'use client';

/**
 * DDLJ Sidebar — Simplified Navigation
 * =======================================
 * Three groups: Trading, Settings, Coming Soon
 */

import { useEffect } from 'react';
import {
  LayoutDashboard,
  Play,
  History,
  Settings,
  KeyRound,
  Activity,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  FlaskConical,
  Shield,
  Bell,
  BookOpen,
  Clock,
} from 'lucide-react';
import { useDDLJStore, type PageId } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function SidebarContent({ onNavigate, onToggleCollapse, isCollapsed }: {
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
}) {
  const { activePage, setActivePage, engineStatus } = useDDLJStore();
  const collapsed = isCollapsed ?? false;

  const navGroups: NavGroup[] = [
    {
      title: 'Trading',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
        { id: 'engine', label: 'Engine', icon: <Play className="h-4 w-4" />, badge: engineStatus.engine_running ? 'ON' : 'OFF', badgeColor: engineStatus.engine_running ? 'bg-emerald-500' : 'bg-zinc-500' },
        { id: 'trades', label: 'Trades', icon: <History className="h-4 w-4" /> },
      ],
    },
    {
      title: 'Settings',
      items: [
        { id: 'config', label: 'Configuration', icon: <Settings className="h-4 w-4" /> },
        { id: 'token', label: 'Token', icon: <KeyRound className="h-4 w-4" />, badge: engineStatus.token.valid ? 'OK' : '!', badgeColor: engineStatus.token.valid ? 'bg-emerald-500' : 'bg-red-500' },
        { id: 'health', label: 'Health', icon: <Activity className="h-4 w-4" /> },
      ],
    },
    {
      title: 'Analysis',
      items: [
        { id: 'backtest', label: 'Backtest', icon: <FlaskConical className="h-4 w-4" /> },
        { id: 'options', label: 'Options Chain', icon: <TrendingUp className="h-4 w-4" /> },
        { id: 'risk', label: 'Risk', icon: <Shield className="h-4 w-4" /> },
      ],
    },
    {
      title: 'Logs',
      items: [
        { id: 'alerts', label: 'Alerts', icon: <Bell className="h-4 w-4" /> },
        { id: 'journal', label: 'Journal', icon: <BookOpen className="h-4 w-4" /> },
      ],
    },
  ];

  const handleNav = (id: PageId, disabled?: boolean) => {
    if (disabled) return;
    setActivePage(id);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Logo ── */}
      <div className={cn(
        "flex items-center gap-3 border-b border-sidebar-border h-12 flex-shrink-0",
        collapsed ? "px-3 justify-center" : "px-4"
      )}>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex-shrink-0">
          <TrendingUp className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-sidebar-foreground tracking-wide">DDLJ</span>
            <span className="text-[9px] text-muted-foreground">Trading System</span>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <ScrollArea className="flex-1 py-1">
        <div className="flex flex-col gap-1 px-2">
          {navGroups.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </div>
              )}
              {collapsed && <Separator className="my-1 bg-sidebar-border" />}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id, item.disabled)}
                  className={cn(
                    'flex items-center gap-3 rounded-md text-sm transition-colors relative group w-full',
                    collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-1.5',
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : activePage === item.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left text-xs">{item.label}</span>
                      {item.badge && !item.disabled && (
                        <span className={cn(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded text-white',
                          item.badgeColor || 'bg-primary'
                        )}>
                          {item.badge}
                        </span>
                      )}
                      {item.disabled && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-muted-foreground">
                          Soon
                        </Badge>
                      )}
                    </>
                  )}
                  {collapsed && !item.disabled && item.badge && (
                    <span className={cn(
                      'absolute top-1 right-1 text-[7px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full text-white',
                      item.badgeColor || 'bg-primary'
                    )}>
                      {item.badge}
                    </span>
                  )}
                  {collapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg border border-border">
                      {item.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* ── Bottom ── */}
      <div className="border-t border-sidebar-border p-2 flex-shrink-0">
        {!collapsed && (
          <div className="px-2 py-1 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="font-mono tabular-nums">
                {new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })} IST
              </span>
            </div>
          </div>
        )}

        {/* Collapse Toggle (desktop only) */}
        {!onNavigate && onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="w-full justify-center gap-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 mt-1"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /><span className="text-[10px]">Collapse</span></>}
          </Button>
        )}
      </div>
    </div>
  );
}

export function DDLJSidebar() {
  const isMobile = useIsMobile();
  const { sidebarCollapsed, toggleSidebar, mobileMenuOpen, setMobileMenuOpen } = useDDLJStore();

  useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile, toggleSidebar]);

  if (isMobile) {
    return (
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out flex-shrink-0 overflow-hidden',
        sidebarCollapsed ? 'w-14' : 'w-52'
      )}
    >
      <SidebarContent
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
    </aside>
  );
}
