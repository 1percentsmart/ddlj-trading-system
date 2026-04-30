'use client';

/**
 * DDLJ Command Palette (Cmd+K)
 * Quick navigation and actions with keyboard-first interaction.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useDDLJStore, type PageId, PAGE_LABELS } from '@/lib/store';
import {
  LayoutDashboard,
  Activity,
  ArrowLeftRight,
  Settings,
  KeyRound,
  HeartPulse,
  FlaskConical,
  Layers,
  ShieldAlert,
  Bell,
  BookOpen,
  Play,
  Square,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Page Icon Map ─────────────────────────────────────────────────

const PAGE_ICONS: Record<PageId, React.ElementType> = {
  dashboard: LayoutDashboard,
  engine: Activity,
  trades: ArrowLeftRight,
  config: Settings,
  token: KeyRound,
  health: HeartPulse,
  backtest: FlaskConical,
  options: Layers,
  risk: ShieldAlert,
  alerts: Bell,
  journal: BookOpen,
};

// ── Navigation items ──────────────────────────────────────────────

const NAV_ITEMS: PageId[] = [
  'dashboard', 'engine', 'trades', 'backtest',
  'options', 'risk', 'config', 'token', 'health', 'alerts', 'journal',
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { setActivePage, engineStatus, startEngine, stopEngine, refreshAll } = useDDLJStore();

  // ── Cmd+K handler ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Navigation handler ──────────────────────────────────────
  const handleNavigate = useCallback((page: PageId) => {
    setActivePage(page);
    setOpen(false);
  }, [setActivePage]);

  // ── Action handlers ─────────────────────────────────────────
  const handleEngineToggle = useCallback(async () => {
    setOpen(false);
    try {
      if (engineStatus.engine_running) {
        await stopEngine();
        toast.success('Engine stopped');
      } else {
        await startEngine();
        toast.success('Engine started');
      }
    } catch {
      toast.error('Engine operation failed');
    }
  }, [engineStatus.engine_running, startEngine, stopEngine]);

  const handleRefresh = useCallback(async () => {
    setOpen(false);
    try {
      await refreshAll();
      toast.success('Data refreshed');
    } catch {
      toast.error('Refresh failed');
    }
  }, [refreshAll]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* ── Navigation ────────────────────────────────────── */}
        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((page) => {
            const Icon = PAGE_ICONS[page];
            return (
              <CommandItem
                key={page}
                onSelect={() => handleNavigate(page)}
                className="gap-2"
              >
                <Icon className="size-4 text-muted-foreground" />
                <span>{PAGE_LABELS[page]}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* ── Actions ────────────────────────────────────────── */}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={handleEngineToggle} className="gap-2">
            {engineStatus.engine_running ? (
              <>
                <Square className="size-4 text-red-400" />
                <span>Stop Engine</span>
              </>
            ) : (
              <>
                <Play className="size-4 text-emerald-400" />
                <span>Start Engine</span>
              </>
            )}
          </CommandItem>
          <CommandItem onSelect={handleRefresh} className="gap-2">
            <RefreshCw className="size-4 text-muted-foreground" />
            <span>Refresh All Data</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* ── Shortcuts ──────────────────────────────────────── */}
        <CommandGroup heading="Keyboard Shortcuts">
          <CommandItem className="gap-2 opacity-60 pointer-events-none">
            <span className="text-xs">⌘K</span>
            <span>Open command palette</span>
          </CommandItem>
          <CommandItem className="gap-2 opacity-60 pointer-events-none">
            <span className="text-xs">⌃B</span>
            <span>Toggle sidebar</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
