'use client';

/**
 * DDLJ Settings Panel
 * ====================
 * Theme & layout settings accessible from topbar.
 */

import { useDDLJStore, type AccentColor } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  SidebarOpen,
  PanelRight,
  Minimize2,
  Hash,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';

// Accent color → CSS variable mapping
const accentColorMap: Record<AccentColor, { hsl: string; css: Record<string, string> }> = {
  emerald: {
    hsl: '160 84% 39%',
    css: {
      '--primary': '160 84% 39%',
      '--primary-foreground': '0 0% 100%',
      '--ring': '160 84% 39%',
      '--accent': '160 84% 39%',
      '--accent-foreground': '0 0% 100%',
    },
  },
  blue: {
    hsl: '217 91% 60%',
    css: {
      '--primary': '217 91% 60%',
      '--primary-foreground': '0 0% 100%',
      '--ring': '217 91% 60%',
      '--accent': '217 91% 60%',
      '--accent-foreground': '0 0% 100%',
    },
  },
  purple: {
    hsl: '271 91% 65%',
    css: {
      '--primary': '271 91% 65%',
      '--primary-foreground': '0 0% 100%',
      '--ring': '271 91% 65%',
      '--accent': '271 91% 65%',
      '--accent-foreground': '0 0% 100%',
    },
  },
  amber: {
    hsl: '38 92% 50%',
    css: {
      '--primary': '38 92% 50%',
      '--primary-foreground': '0 0% 100%',
      '--ring': '38 92% 50%',
      '--accent': '38 92% 50%',
      '--accent-foreground': '0 0% 100%',
    },
  },
  red: {
    hsl: '0 84% 60%',
    css: {
      '--primary': '0 84% 60%',
      '--primary-foreground': '0 0% 100%',
      '--ring': '0 84% 60%',
      '--accent': '0 84% 60%',
      '--accent-foreground': '0 0% 100%',
    },
  },
};

function applyAccentColor(color: AccentColor) {
  const mapping = accentColorMap[color];
  if (!mapping) return;
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(mapping.css)) {
    root.style.setProperty(prop, value);
  }
}

function applyCompactMode(enabled: boolean) {
  if (enabled) {
    document.documentElement.classList.add('compact');
  } else {
    document.documentElement.classList.remove('compact');
  }
}

const accentColors: { name: string; value: AccentColor; color: string; tw: string }[] = [
  { name: 'Emerald', value: 'emerald', color: '#22c55e', tw: 'bg-emerald-500' },
  { name: 'Blue', value: 'blue', color: '#3b82f6', tw: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', color: '#a855f7', tw: 'bg-purple-500' },
  { name: 'Amber', value: 'amber', color: '#f59e0b', tw: 'bg-amber-500' },
  { name: 'Red', value: 'red', color: '#ef4444', tw: 'bg-red-500' },
];

export function SettingsPanel() {
  const {
    theme,
    setThemeMode,
    setAccentColor,
    setSidebarPosition,
    setCompactMode,
    setNumberFormat,
  } = useDDLJStore();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Card className="bg-popover border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette className="h-4 w-4" /> Display Settings
            </CardTitle>
            <CardDescription className="text-[11px]">
              Customize theme and layout
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Theme Mode */}
            <div className="space-y-2">
              <Label className="text-xs">Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'dark' as const, icon: <Moon className="h-3.5 w-3.5" />, label: 'Dark' },
                  { value: 'light' as const, icon: <Sun className="h-3.5 w-3.5" />, label: 'Light' },
                  { value: 'system' as const, icon: <Monitor className="h-3.5 w-3.5" />, label: 'System' },
                ].map((mode) => (
                  <Button
                    key={mode.value}
                    variant={theme.mode === mode.value ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      setThemeMode(mode.value);
                      if (mode.value === 'dark') {
                        document.documentElement.classList.add('dark');
                      } else if (mode.value === 'light') {
                        document.documentElement.classList.remove('dark');
                      } else {
                        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                          document.documentElement.classList.add('dark');
                        } else {
                          document.documentElement.classList.remove('dark');
                        }
                      }
                      toast.success(`Theme set to ${mode.label}`);
                    }}
                  >
                    {mode.icon} {mode.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Accent Color */}
            <div className="space-y-2">
              <Label className="text-xs">Accent Color</Label>
              <div className="flex items-center gap-2">
                {accentColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      setAccentColor(color.value);
                      applyAccentColor(color.value);
                      toast.success(`Accent color: ${color.name}`);
                    }}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center',
                      color.tw,
                      theme.accent === color.value
                        ? 'border-white ring-2 ring-white/20 scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                  >
                    {theme.accent === color.value && (
                      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Sidebar Position */}
            <div className="space-y-2">
              <Label className="text-xs">Sidebar Position</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={theme.sidebarPosition === 'left' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setSidebarPosition('left')}
                >
                  <SidebarOpen className="h-3.5 w-3.5" /> Left
                </Button>
                <Button
                  variant={theme.sidebarPosition === 'right' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setSidebarPosition('right')}
                >
                  <PanelRight className="h-3.5 w-3.5" /> Right
                </Button>
              </div>
            </div>

            <Separator />

            {/* Compact Mode */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs">Compact Mode</Label>
              </div>
              <Switch
                checked={theme.compactMode}
                onCheckedChange={(checked) => {
                  setCompactMode(checked);
                  applyCompactMode(checked);
                  toast.success(checked ? 'Compact mode enabled' : 'Compact mode disabled');
                }}
              />
            </div>

            {/* Number Format */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs">Number Format</Label>
              </div>
              <Select value={theme.numberFormat} onValueChange={(v) => {
                setNumberFormat(v as 'indian' | 'international');
                toast.success(`Number format: ${v === 'indian' ? 'Indian' : 'International'}`);
              }}>
                <SelectTrigger className="w-24 h-7 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indian">Indian</SelectItem>
                  <SelectItem value="international">International</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
