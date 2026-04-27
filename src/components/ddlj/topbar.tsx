'use client';

/**
 * DDLJ Top Bar — Simplified
 * ============================
 * Left: Hamburger + DDLJ brand
 * Center: Connection status
 * Right: Theme toggle + Settings
 */

import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { SettingsPanel } from '@/components/ddlj/settings-panel';
import { Wifi, WifiOff, Menu, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export function DDLJTopBar() {
  const { isConnected, theme, setThemeMode, setMobileMenuOpen } = useDDLJStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleThemeToggle = () => {
    const newMode = theme.mode === 'dark' ? 'light' : 'dark';
    setThemeMode(newMode);
    if (newMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="h-11 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-3 sm:px-4 gap-2">
      {/* ── Left: Hamburger + Brand ── */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 flex-shrink-0"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open navigation</span>
        </Button>
        <span className="text-sm font-bold tracking-wide">DDLJ</span>
      </div>

      {/* ── Center: Connection Status ── */}
      <div className="flex items-center gap-2 text-xs">
        {isConnected ? (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Wifi className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-red-400">
            <WifiOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Disconnected</span>
          </div>
        )}
      </div>

      {/* ── Right: Theme + Settings ── */}
      <div className="flex items-center gap-1">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleThemeToggle}
          >
            {theme.mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}
        <SettingsPanel />
      </div>
    </header>
  );
}
