'use client';

import { Wifi, WifiOff, Sun, Moon, Monitor, Menu, Settings, Circle } from 'lucide-react';
import { useDDLJStore } from '@/lib/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

// ── Theme Toggle ───────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setThemeMode } = useDDLJStore();

  const cycleTheme = () => {
    const modes = ['dark', 'light', 'system'] as const;
    const idx = modes.indexOf(theme.mode);
    setThemeMode(modes[(idx + 1) % modes.length]);
  };

  const icon =
    theme.mode === 'dark' ? (
      <Moon className="size-4" />
    ) : theme.mode === 'light' ? (
      <Sun className="size-4" />
    ) : (
      <Monitor className="size-4" />
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={cycleTheme}
          aria-label={`Theme: ${theme.mode}`}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        Theme: {theme.mode.charAt(0).toUpperCase() + theme.mode.slice(1)}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Settings Panel ─────────────────────────────────────────────

function SettingsPanel() {
  const { theme, setAccentColor, setNumberFormat, setCompactMode, setActivePage } =
    useDDLJStore();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label="Settings"
            >
              <Settings className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Quick Settings
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Accent Color</DropdownMenuLabel>
        {(['emerald', 'blue', 'purple', 'amber', 'red'] as const).map((color) => (
          <DropdownMenuItem
            key={color}
            className="gap-2 text-xs"
            onClick={() => setAccentColor(color)}
          >
            <span
              className={`size-3 rounded-full shrink-0 ${
                color === 'emerald'
                  ? 'bg-emerald-500'
                  : color === 'blue'
                    ? 'bg-blue-500'
                    : color === 'purple'
                      ? 'bg-purple-500'
                      : color === 'amber'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
              } ${theme.accent === color ? 'ring-2 ring-offset-1 ring-foreground' : ''}`}
            />
            {color.charAt(0).toUpperCase() + color.slice(1)}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs">Number Format</DropdownMenuLabel>
        <DropdownMenuItem
          className="text-xs"
          onClick={() => setNumberFormat('indian')}
        >
          <span className="size-3 flex items-center justify-center shrink-0">
            {theme.numberFormat === 'indian' && '✓'}
          </span>
          Indian (1,00,000)
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-xs"
          onClick={() => setNumberFormat('international')}
        >
          <span className="size-3 flex items-center justify-center shrink-0">
            {theme.numberFormat === 'international' && '✓'}
          </span>
          International (100,000)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={theme.compactMode}
          onCheckedChange={setCompactMode}
          className="text-xs"
        >
          Compact Mode
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-xs"
          onClick={() => setActivePage('config')}
        >
          <Settings className="size-3.5 mr-1" />
          Full Configuration
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main Topbar ────────────────────────────────────────────────

export function DDLJTopbar() {
  const { isConnected, engineStatus, setMobileMenuOpen, setActivePage } =
    useDDLJStore();
  const isMobile = useIsMobile();

  return (
    <header
      className="
        sticky top-0 z-30 flex items-center h-11 px-3 gap-3
        border-b border-border/50 bg-card/50 backdrop-blur-sm
      "
    >
      {/* Left Section */}
      <div className="flex items-center gap-2 min-w-0">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </Button>
        )}
        <span className="text-sm font-bold tracking-tight">DDLJ</span>
      </div>

      {/* Center Section — Connection Status */}
      <div className="flex-1 flex items-center justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs cursor-default">
              {isConnected ? (
                <Wifi className="size-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="size-3.5 text-red-500" />
              )}
              <span
                className={
                  isConnected
                    ? 'text-emerald-500 font-medium'
                    : 'text-red-500 font-medium'
                }
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {isConnected ? 'Live connection to DDLJ backend' : 'Cannot reach DDLJ backend'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1">
        {/* Engine Status Dot */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent/50 transition-colors"
              onClick={() => setActivePage('engine')}
              aria-label={`Engine ${engineStatus.engine_running ? 'running' : 'stopped'}`}
            >
              <Circle
                className={`size-2 fill-current ${
                  engineStatus.engine_running
                    ? 'text-emerald-500 animate-pulse'
                    : 'text-muted-foreground/40'
                }`}
              />
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                {engineStatus.engine_running ? 'Engine ON' : 'Engine OFF'}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {engineStatus.engine_running
              ? 'Engine is running — click to view'
              : 'Engine is stopped — click to view'}
          </TooltipContent>
        </Tooltip>

        <ThemeToggle />
        <SettingsPanel />
      </div>
    </header>
  );
}
