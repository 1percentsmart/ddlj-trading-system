'use client';

/**
 * DDLJ Spotlight Search — Cmd+K Command Palette
 * =================================================
 * Quick navigation, search, and command execution.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDDLJStore, type PageId } from '@/lib/store';
import { cn } from '@/lib/utils';
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
  FlaskConical,
  KeyRound,
  Activity,
  TrendingUp,
  Shield,
  Bell,
  BookOpen,
  Search,
  Zap,
  Square,
  RotateCcw,
  FlaskConicalIcon,
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
  const { setActivePage, engineStatus, updateEngineStatus, setEngineLoading } = useDDLJStore();

  // Cmd+K shortcut
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

  const handleEngineStart = useCallback(() => {
    setEngineLoading(true);
    setTimeout(() => {
      updateEngineStatus({ engine_running: true });
      setEngineLoading(false);
      toast.success('Trading engine started');
    }, 1000);
    setOpen(false);
  }, [setEngineLoading, updateEngineStatus]);

  const handleEngineStop = useCallback(() => {
    updateEngineStatus({ engine_running: false });
    toast.info('Trading engine stopped');
    setOpen(false);
  }, [updateEngineStatus]);

  const handleRunBacktest = useCallback(() => {
    toast.info('Starting backtest...');
    setOpen(false);
  }, []);

  const navigateTo = useCallback((page: PageId) => {
    setActivePage(page);
    setOpen(false);
  }, [setActivePage]);

  const actions: SpotlightAction[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, action: () => navigateTo('dashboard'), group: 'Navigation', keywords: ['home', 'overview'] },
    { id: 'nav-engine', label: 'Go to Engine Control', icon: <Play className="h-4 w-4" />, action: () => navigateTo('engine'), group: 'Navigation', keywords: ['start', 'stop', 'trading'] },
    { id: 'nav-trades', label: 'Go to Trades & Positions', icon: <History className="h-4 w-4" />, action: () => navigateTo('trades'), group: 'Navigation', keywords: ['history', 'pnl', 'positions'] },
    { id: 'nav-config', label: 'Go to Configuration', icon: <Settings className="h-4 w-4" />, action: () => navigateTo('config'), group: 'Navigation', keywords: ['settings', 'parameters', 'ema', 'risk'] },
    { id: 'nav-backtest', label: 'Go to Backtest', icon: <FlaskConical className="h-4 w-4" />, action: () => navigateTo('backtest'), group: 'Navigation', keywords: ['test', 'simulation', 'historical'] },
    { id: 'nav-token', label: 'Go to Kite Token', icon: <KeyRound className="h-4 w-4" />, action: () => navigateTo('token'), group: 'Navigation', keywords: ['auth', 'login', 'api', 'zerodha'] },
    { id: 'nav-health', label: 'Go to System Health', icon: <Activity className="h-4 w-4" />, action: () => navigateTo('health'), group: 'Navigation', keywords: ['status', 'monitoring'] },
    { id: 'nav-options', label: 'Go to Options Chain', icon: <TrendingUp className="h-4 w-4" />, action: () => navigateTo('options'), group: 'Navigation', keywords: ['chain', 'greeks', 'strikes', 'iv'] },
    { id: 'nav-risk', label: 'Go to Risk Management', icon: <Shield className="h-4 w-4" />, action: () => navigateTo('risk'), group: 'Navigation', keywords: ['exposure', 'drawdown', 'var', 'margin'] },
    { id: 'nav-alerts', label: 'Go to Alerts & Notifications', icon: <Bell className="h-4 w-4" />, action: () => navigateTo('alerts'), group: 'Navigation', keywords: ['telegram', 'notification', 'price', 'warning'] },
    { id: 'nav-journal', label: 'Go to Trade Journal', icon: <BookOpen className="h-4 w-4" />, action: () => navigateTo('journal'), group: 'Navigation', keywords: ['notes', 'review', 'diary'] },
    // Commands
    { id: 'cmd-start', label: 'Start Trading Engine', icon: <Zap className="h-4 w-4 text-emerald-400" />, action: handleEngineStart, group: 'Commands', keywords: ['play', 'begin', 'activate'] },
    { id: 'cmd-stop', label: 'Stop Trading Engine', icon: <Square className="h-4 w-4 text-red-400" />, action: handleEngineStop, group: 'Commands', keywords: ['halt', 'pause', 'deactivate'] },
    { id: 'cmd-backtest', label: 'Run Backtest', icon: <FlaskConicalIcon className="h-4 w-4 text-blue-400" />, action: handleRunBacktest, group: 'Commands', keywords: ['simulate', 'test', 'run'] },
  ];

  const grouped = actions.reduce<Record<string, SpotlightAction[]>>((acc, action) => {
    if (!acc[action.group]) acc[action.group] = [];
    acc[action.group].push(action);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, commands, settings..." />
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
                {item.keywords && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {item.keywords.slice(0, 2).join(', ')}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem className="flex items-center gap-3 text-muted-foreground">
            <Search className="h-4 w-4" />
            <span className="text-xs">Press <kbd className="px-1.5 py-0.5 text-[10px] bg-secondary rounded">Cmd+K</kbd> to open anytime</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
