'use client';

/**
 * DDLJ Configuration Page — Simplified
 * =======================================
 * Fetches real config from backend (flat key-value).
 * Groups by prefix. No presets, diff view, or undo history.
 * Scroll fix: no ScrollArea wrapper — normal page flow.
 */

import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Settings,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronRight,
  Zap,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useMemo } from 'react';

// ── Config Grouping Logic ─────────────────────────────────────
interface ConfigGroup {
  title: string;
  keys: string[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

function getConfigGroups(keys: string[]): ConfigGroup[] {
  const groups: ConfigGroup[] = [];
  const assigned = new Set<string>();

  // Define groups by prefix patterns
  const groupDefs: { title: string; prefixes: string[] }[] = [
    { title: 'Index Settings', prefixes: ['BANKNIFTY_', 'NIFTY_', 'TRADE_INDEX', 'STARTING_CAPITAL', 'LOT_SIZE', 'NUM_LOTS'] },
    { title: 'EMA Settings', prefixes: ['EMA_'] },
    { title: 'Bias Settings', prefixes: ['BIAS_', 'BIAS_TIMEFRAME', 'ENTRY_TIMEFRAME'] },
    { title: 'Risk Management', prefixes: ['DAILY_RISK_', 'DRAWDOWN_', 'CAPITAL_FLOOR_', 'RISK_PER_POSITION', 'MAX_OPEN_POSITIONS'] },
    { title: 'Entry Rules', prefixes: ['ENTRY_', 'ATR_SL_', 'ATR_TARGET_'] },
    { title: 'Exit Rules', prefixes: ['FORCE_CLOSE_', 'MAX_TRADE_', 'BE_TRIGGER_', 'TRAILING_', 'NEAR_TARGET_', 'BIAS_FLIP_'] },
    { title: 'Position Limits', prefixes: ['MAX_'] },
    { title: 'Options Settings', prefixes: ['OPTION_', 'IV_', 'STRIKE_OFFSET_'] },
    { title: 'Notifications', prefixes: ['NOTIFY_', 'TELEGRAM_', 'ALERT_'] },
    { title: 'Advanced', prefixes: ['POLL_', 'CACHE_', 'LOG_', 'KITE_', 'WARMUP_', 'SAVE_', 'COST_', 'USE_REAL_', 'VIX_', 'RSI_'] },
  ];

  for (const def of groupDefs) {
    const matchingKeys = keys.filter(key => {
      if (assigned.has(key)) return false;
      // Check if key starts with any prefix, or matches exactly
      return def.prefixes.some(prefix => key.startsWith(prefix) || key === prefix);
    });
    if (matchingKeys.length > 0) {
      matchingKeys.forEach(k => assigned.add(k));
      groups.push({
        title: def.title,
        keys: matchingKeys,
        collapsible: def.title === 'Advanced',
        defaultCollapsed: def.title === 'Advanced',
      });
    }
  }

  // Catch any remaining keys
  const remaining = keys.filter(k => !assigned.has(k));
  if (remaining.length > 0) {
    groups.push({
      title: 'Other',
      keys: remaining,
      collapsible: true,
      defaultCollapsed: true,
    });
  }

  return groups;
}

function guessValueType(value: unknown): 'boolean' | 'number' | 'string' {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') {
    if (value === 'true' || value === 'false') return 'boolean';
    if (!isNaN(Number(value)) && value !== '') return 'number';
  }
  return 'string';
}

function parseValue(value: unknown): boolean | number | string {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;
  }
  return String(value);
}

export function ConfigPage() {
  const { config, fetchConfig, updateConfig } = useDDLJStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const keys = useMemo(() => Object.keys(localConfig).sort(), [localConfig]);
  const groups = useMemo(() => getConfigGroups(keys), [keys]);

  // Filter groups by search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    return groups
      .map(g => ({
        ...g,
        keys: g.keys.filter(k => k.toLowerCase().includes(searchTerm.toLowerCase())),
      }))
      .filter(g => g.keys.length > 0);
  }, [groups, searchTerm]);

  const handleLocalChange = (key: string, value: boolean | number | string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      // Find changed keys
      const changes: Record<string, unknown> = {};
      for (const key of Object.keys(localConfig)) {
        if (JSON.stringify(localConfig[key]) !== JSON.stringify(config[key])) {
          changes[key] = localConfig[key];
        }
      }
      if (Object.keys(changes).length === 0) {
        toast.info('No changes to save');
        return;
      }
      await updateConfig(changes);
      setHasChanges(false);
      toast.success(`${Object.keys(changes).length} parameter(s) saved`);
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleResetKey = (key: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: config[key] }));
    setHasChanges(true);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(localConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ddlj-config.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Config exported');
  };

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="space-y-4 p-4 max-w-4xl">
      {/* ── Header ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Strategy Configuration</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {keys.length} parameters — edit and save to apply
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges} className="gap-1.5 text-xs">
                <Save className="h-3.5 w-3.5" /> Save Changes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search parameters... (e.g., EMA, risk, VIX)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* ── Config Sections (normal flow, no ScrollArea) ── */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Settings className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No parameters match your search</p>
        </div>
      ) : (
        filteredGroups.map((group) => {
          const isCollapsed = collapsedGroups[group.title] ?? group.defaultCollapsed ?? false;

          const content = (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.keys.map((key) => {
                const rawValue = localConfig[key];
                const valueType = guessValueType(rawValue);
                const parsedValue = parseValue(rawValue);
                const isChanged = JSON.stringify(localConfig[key]) !== JSON.stringify(config[key]);

                return (
                  <div key={key} className={cn(
                    'space-y-1.5 p-3 rounded-lg bg-secondary/30 border',
                    isChanged ? 'border-primary/30' : 'border-border/50'
                  )}>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-mono font-semibold">{key}</Label>
                      {isChanged && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[10px] text-muted-foreground hover:text-foreground px-1"
                          onClick={() => handleResetKey(key)}
                        >
                          <RotateCcw className="h-3 w-3 mr-0.5" /> Reset
                        </Button>
                      )}
                    </div>

                    {valueType === 'boolean' ? (
                      <div className="flex items-center justify-between">
                        <Switch
                          checked={!!parsedValue}
                          onCheckedChange={(checked) => handleLocalChange(key, checked)}
                        />
                        <span className={cn('text-xs font-mono', parsedValue ? 'text-emerald-400' : 'text-muted-foreground')}>
                          {parsedValue ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    ) : valueType === 'number' ? (
                      <Input
                        type="number"
                        value={typeof parsedValue === 'number' ? parsedValue : Number(parsedValue)}
                        step="any"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) handleLocalChange(key, val);
                        }}
                        className="h-8 text-xs font-mono"
                      />
                    ) : (
                      <Input
                        value={String(parsedValue)}
                        onChange={(e) => handleLocalChange(key, e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    )}

                    {isChanged && (
                      <div className="text-[10px] text-muted-foreground">
                        Original: <span className="font-mono">{String(config[key])}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );

          if (group.collapsible) {
            return (
              <Collapsible
                key={group.title}
                open={!isCollapsed}
                onOpenChange={() => toggleGroup(group.title)}
              >
                <Card className="bg-card/60 border-border">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-secondary/20 transition-colors pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-sm font-medium">{group.title}</CardTitle>
                          <Badge variant="outline" className="text-[10px]">{group.keys.length}</Badge>
                        </div>
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>{content}</CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          }

          return (
            <Card key={group.title} className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">{group.title}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{group.keys.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>{content}</CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
