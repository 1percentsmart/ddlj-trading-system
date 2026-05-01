'use client';

import { useDDLJStore, PAGE_LABELS } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Menu, Wifi, WifiOff, Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from 'next-themes';

export function DDLJTopbar() {
  const { activePage, mobileMenuOpen, setMobileMenuOpen, engineStatus, isConnected } = useDDLJStore();
  const { setTheme, theme: currentTheme } = useTheme();

  return (
    <header className="flex items-center h-14 px-4 border-b border-border/50 bg-card/80 backdrop-blur-sm shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 sm:hidden mr-2"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        <Menu className="h-4 w-4" />
      </Button>
      <h2 className="font-semibold text-lg">{PAGE_LABELS[activePage]}</h2>
      <div className="ml-auto flex items-center gap-2">
        {isConnected ? (
          <Wifi className="h-4 w-4 text-emerald-400" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-400" />
        )}
        {engineStatus.engine_running && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400">
            Engine Running
          </Badge>
        )}

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {currentTheme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : currentTheme === 'light' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')} className="gap-2">
              <Sun className="h-4 w-4" />
              Light
              {currentTheme === 'light' && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')} className="gap-2">
              <Moon className="h-4 w-4" />
              Dark
              {currentTheme === 'dark' && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')} className="gap-2">
              <Monitor className="h-4 w-4" />
              System
              {currentTheme === 'system' && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
