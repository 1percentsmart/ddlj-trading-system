'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  LayoutDashboard,
  Activity,
  ArrowLeftRight,
  FlaskConical,
  Layers,
  ShieldAlert,
  Settings,
  KeyRound,
  HeartPulse,
  Bell,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Search,
} from 'lucide-react';
import { useDDLJStore, type PageId, PAGE_LABELS } from '@/lib/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// ── Navigation Definition ──────────────────────────────────────

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ElementType;
  badge?: () => React.ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Trading',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      {
        id: 'engine',
        label: 'Engine',
        icon: Activity,
        badge: () => {
          const running = useDDLJStore.getState().engineStatus.engine_running;
          return (
            <Badge
              variant={running ? 'default' : 'secondary'}
              className={
                running
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0'
                  : 'text-[10px] px-1.5 py-0'
              }
            >
              {running ? 'ON' : 'OFF'}
            </Badge>
          );
        },
      },
      { id: 'trades', label: 'Trades', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'Analysis',
    items: [
      { id: 'backtest', label: 'Backtest', icon: FlaskConical },
      { id: 'options', label: 'Options Chain', icon: Layers },
      { id: 'risk', label: 'Risk', icon: ShieldAlert },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'config', label: 'Configuration', icon: Settings },
      {
        id: 'token',
        label: 'Token',
        icon: KeyRound,
        badge: () => {
          const valid = useDDLJStore.getState().engineStatus.token?.valid;
          return (
            <Badge
              variant={valid ? 'default' : 'destructive'}
              className={
                valid
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0'
                  : 'text-[10px] px-1.5 py-0'
              }
            >
              {valid ? 'OK' : '!'}
            </Badge>
          );
        },
      },
      { id: 'health', label: 'Health', icon: HeartPulse },
    ],
  },
  {
    title: 'Logs',
    items: [
      { id: 'alerts', label: 'Alerts', icon: Bell },
      { id: 'journal', label: 'Journal', icon: BookOpen },
    ],
  },
];

// ── IST Clock ──────────────────────────────────────────────────

function ISTClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const fmt = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
      <Clock className="size-3.5" />
      <span>{time} IST</span>
    </div>
  );
}

// ── Nav Item Row ───────────────────────────────────────────────

function NavItemRow({
  item,
  collapsed,
  active,
  onClick,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const BadgeEl = item.badge;

  const inner = (
    <button
      onClick={onClick}
      className={`
        group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm
        transition-colors duration-150
        hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
        ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70'}
        ${collapsed ? 'justify-center px-0' : ''}
      `}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {BadgeEl && (
            <span className="ml-auto">
              <BadgeEl />
            </span>
          )}
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <div className="flex items-center gap-2">
            {item.label}
            {BadgeEl && <BadgeEl />}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

// ── Desktop Sidebar ────────────────────────────────────────────

function DesktopSidebar() {
  const { activePage, setActivePage, sidebarCollapsed, toggleSidebar, engineStatus } =
    useDDLJStore();

  const _engineRunning = engineStatus.engine_running;
  const _tokenValid = engineStatus.token?.valid;

  return (
    <aside
      className={`
        hidden md:flex flex-col h-screen sticky top-0
        border-r border-border/50 bg-sidebar text-sidebar-foreground
        transition-[width] duration-200 ease-in-out
        ${sidebarCollapsed ? 'w-14' : 'w-52'}
      `}
    >
      {/* Logo */}
      <div
        className={`
          flex items-center gap-2.5 px-4 h-14 border-b border-border/50 shrink-0
          ${sidebarCollapsed ? 'justify-center px-0' : ''}
        `}
      >
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 shrink-0">
          <TrendingUp className="size-4.5" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold tracking-tight leading-none">
              DDLJ
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              Trading System
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <div className="flex flex-col gap-1 px-2">
          {navGroups.map((group, gi) => (
            <div key={group.title}>
              {gi > 0 && <Separator className="my-2 opacity-50" />}
              {!sidebarCollapsed && (
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => (
                <NavItemRow
                  key={item.id}
                  item={item}
                  collapsed={sidebarCollapsed}
                  active={activePage === item.id}
                  onClick={() => setActivePage(item.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom Section */}
      <div className="border-t border-border/50 px-3 py-3 shrink-0">
        {!sidebarCollapsed && (
          <div className="mb-2">
            <ISTClock />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="w-full h-8 text-muted-foreground hover:text-sidebar-foreground"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <ChevronsLeft className="size-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}

// ── Mobile Sidebar (Sheet) ─────────────────────────────────────

function MobileSidebar() {
  const { activePage, setActivePage, mobileMenuOpen, setMobileMenuOpen, engineStatus } =
    useDDLJStore();

  const _engineRunning = engineStatus.engine_running;
  const _tokenValid = engineStatus.token?.valid;

  const handleNav = useCallback(
    (page: PageId) => {
      setActivePage(page);
      setMobileMenuOpen(false);
    },
    [setActivePage, setMobileMenuOpen]
  );

  return (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground border-border/50">
        <SheetHeader className="px-4 h-14 flex flex-row items-center gap-2.5 border-b border-border/50 space-y-0">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 shrink-0">
            <TrendingUp className="size-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <SheetTitle className="text-sm font-bold tracking-tight leading-none text-sidebar-foreground">
              DDLJ
            </SheetTitle>
            <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              Trading System
            </span>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 py-3">
          <div className="flex flex-col gap-1 px-2">
            {navGroups.map((group, gi) => (
              <div key={group.title}>
                {gi > 0 && <Separator className="my-2 opacity-50" />}
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.title}
                </p>
                {group.items.map((item) => (
                  <NavItemRow
                    key={item.id}
                    item={item}
                    collapsed={false}
                    active={activePage === item.id}
                    onClick={() => handleNav(item.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t border-border/50 px-4 py-3 shrink-0">
          <ISTClock />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Export ────────────────────────────────────────────────

export function DDLJSidebar() {
  const toggleSidebar = useDDLJStore((s) => s.toggleSidebar);
  const isMobile = useIsMobile();

  // Ctrl+B keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar]);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    if (!isMobile) {
      useDDLJStore.getState().setMobileMenuOpen(false);
    }
  }, [isMobile]);

  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  );
}
