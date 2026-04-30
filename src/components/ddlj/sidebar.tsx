'use client';

import { useDDLJStore, PAGE_LABELS, type PageId } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Cpu,
  ArrowUpDown,
  Settings,
  FlaskConical,
  Key,
  Heart,
  TrendingUp,
  Shield,
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const pageIcons: Record<PageId, React.ElementType> = {
  dashboard: LayoutDashboard,
  engine: Cpu,
  trades: ArrowUpDown,
  config: Settings,
  backtest: FlaskConical,
  token: Key,
  health: Heart,
  options: TrendingUp,
  risk: Shield,
  alerts: Bell,
  journal: BookOpen,
};

const pageOrder: PageId[] = [
  'dashboard', 'engine', 'trades', 'config', 'backtest',
  'token', 'health', 'options', 'risk', 'alerts', 'journal',
];

export function DDLJSidebar() {
  const { activePage, setActivePage, sidebarCollapsed, toggleSidebar } = useDDLJStore();

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-200 shrink-0',
        sidebarCollapsed ? 'w-14' : 'w-52'
      )}
    >
      <div className={cn('flex items-center h-14 px-3 border-b border-border/50', sidebarCollapsed ? 'justify-center' : 'gap-2')}>
        {!sidebarCollapsed && (
          <span className="font-bold text-lg tracking-tight text-primary">DDLJ</span>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={toggleSidebar}>
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="flex-1 py-2 space-y-0.5 px-1.5 overflow-y-auto">
        {pageOrder.map((page) => {
          const Icon = pageIcons[page];
          const isActive = activePage === page;
          return (
            <Button
              key={page}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'w-full justify-start gap-2 h-8 text-xs',
                sidebarCollapsed && 'justify-center px-0',
                isActive && 'font-semibold'
              )}
              onClick={() => setActivePage(page)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{PAGE_LABELS[page]}</span>}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
