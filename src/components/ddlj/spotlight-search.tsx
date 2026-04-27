'use client';

/**
 * DDLJ Spotlight Search — Cmd+K Command Palette
 * =================================================
 * Quick navigation. Real API calls for engine commands.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDDLJStore, type PageId } from '@/lib/store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Play,
  History,
  Settings,
  KeyRound,
  Activity,
  TrendingUp,
  Shield,
  Bell,
  BookOpen,
  Search,
  Zap,
  Square,
  FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';

interface SpotlightAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  group: string;
  keywords?: string[];
}

export function SpotlightSearch() {
  const [open, setOpen] = useState(false);
  const { setActivePage, startEngine, stopEngine } = useDDLJStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleEngineStart = useCallback(async () => {
    setOpen(false);
    try {
      await startEngine();
      toast.success('Engine started');
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [startEngine]);

  const handleEngineStop = useCallback(async () => {
    setOpen(false);
    try {
      await stopEngine();
      toast.info('Engine stopped');
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [stopEngine]);

  const navigateTo = useCallback((page: PageId) => {
    setActivePage(page);
    setOpen(false);
  }, [setActivePage]);

  const actions: SpotlightAction[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, action: () => navigateTo('dashboard'), group: 'Navigation', keywords: ['home', 'overview'] },
    { id: 'nav-engine', label: 'Engine', icon: <Play className="h-4 w-4" />, action: () => navigateTo('engine'), group: 'Navigation', keywords: ['start', 'stop'] },
    { id: 'nav-trades', label: 'Trades', icon: <History className="h-4 w-4" />, action: () => navigateTo('trades'), group: 'Navigation', keywords: ['history', 'positions'] },
    { id: 'nav-config', label: 'Configuration', icon: <Settings className="h-4 w-4" />, action: () => navigateTo('config'), group: 'Navigation', keywords: ['settings', 'parameters'] },
    { id: 'nav-token', label: 'Token', icon: <KeyRound className="h-4 w-4" />, action: () => navigateTo('token'), group: 'Navigation', keywords: ['auth', 'login', 'kite'] },
    { id: 'nav-health', label: 'Health', icon: <Activity className="h-4 w-4" />, action: () => navigateTo('health'), group: 'Navigation', keywords: ['status'] },
    { id: 'nav-backtest', label: 'Backtest (Coming Soon)', icon: <FlaskConical className="h-4 w-4" />, action: () => navigateTo('backtest'), group: 'Navigation', keywords: ['test', 'simulation'] },
    { id: 'nav-options', label: 'Options Chain (Coming Soon)', icon: <TrendingUp className="h-4 w-4" />, action: () => navigateTo('options'), group: 'Navigation', keywords: ['chain', 'greeks'] },
    { id: 'nav-risk', label: 'Risk (Coming Soon)', icon: <Shield className="h-4 w-4" />, action: () => navigateTo('risk'), group: 'Navigation', keywords: ['exposure', 'drawdown'] },
    { id: 'nav-alerts', label: 'Alerts (Coming Soon)', icon: <Bell className="h-4 w-4" />, action: () => navigateTo('alerts'), group: 'Navigation', keywords: ['telegram', 'notification'] },
    { id: 'nav-journal', label: 'Journal (Coming Soon)', icon: <BookOpen className="h-4 w-4" />, action: () => navigateTo('journal'), group: 'Navigation', keywords: ['notes', 'diary'] },
    // Commands
    { id: 'cmd-start', label: 'Start Engine', icon: <Zap className="h-4 w-4 text-emerald-400" />, action: handleEngineStart, group: 'Commands', keywords: ['play', 'begin'] },
    { id: 'cmd-stop', label: 'Stop Engine', icon: <Square className="h-4 w-4 text-red-400" />, action: handleEngineStop, group: 'Commands', keywords: ['halt', 'pause'] },
  ];

  const grouped = actions.reduce<Record<string, SpotlightAction[]>>((acc, action) => {
    if (!acc[action.group]) acc[action.group] = [];
    acc[action.group].push(action);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages and commands..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(grouped).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={item.action}
                className="flex items-center gap-3 cursor-pointer"
              >
                {item.icon}
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem className="flex items-center gap-3 text-muted-foreground">
            <Search className="h-4 w-4" />
            <span className="text-xs">Press <kbd className="px-1.5 py-0.5 text-[10px] bg-secondary rounded">⌘K</kbd> to open anytime</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
