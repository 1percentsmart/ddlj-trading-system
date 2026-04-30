'use client';

/**
 * DDLJ Strategy Configuration Page
 * ==================================
 * Groups config keys by prefix, supports search, inline editing,
 * change tracking with reset, strategy presets, and correct save format.
 */

import { useState, useEffect, useMemo } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Download,
  Search,
  Loader2,
  BookmarkPlus,
  Bookmark,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// ── Config Group Definitions (Strategy Alter Mode) ────────────────

interface ConfigGroup {
  title: string;
  icon: string;
  keys: string[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const GROUP_DEFS: { title: string; icon: string; prefixes: string[]; collapsible?: boolean; defaultCollapsed?: boolean }[] = [
  { title: 'Entry Rules', icon: '🎯', prefixes: ['ENTRY_', 'ATR_SL_', 'ATR_TARGET_'] },
  { title: 'Exit Rules', icon: '🚪', prefixes: ['FORCE_CLOSE_', 'MAX_TRADE_', 'BE_TRIGGER_', 'TRAILING_', 'NEAR_TARGET_', 'BIAS_FLIP_'] },
  { title: 'Risk Management', icon: '🛡️', prefixes: ['DAILY_RISK_', 'DRAWDOWN_', 'CAPITAL_FLOOR_', 'RISK_PER_POSITION', 'MAX_OPEN_POSITIONS', 'STARTING_CAPITAL', 'CAPITAL', 'LOT_SIZE', 'NUM_LOTS'] },
  { title: 'Options Selection', icon: '📊', prefixes: ['OPTION_', 'IV_', 'STRIKE_OFFSET_'] },
  { title: 'Index Settings', icon: '📈', prefixes: ['BANKNIFTY_', 'NIFTY_', 'TRADE_INDEX'] },
  { title: 'EMA Settings', icon: '〰️', prefixes: ['EMA_'] },
  { title: 'Bias Settings', icon: '🧭', prefixes: ['BIAS_', 'BIAS_TIMEFRAME', 'ENTRY_TIMEFRAME'] },
  { title: 'Notifications', icon: '🔔', prefixes: ['NOTIFY_', 'TELEGRAM_', 'ALERT_'] },
  { title: 'Position Limits', icon: '📏', prefixes: ['MAX_'] },
  { title: 'Advanced', icon: '⚙️', prefixes: ['POLL_', 'CACHE_', 'LOG_', 'KITE_', 'WARMUP_', 'SAVE_', 'COST_', 'USE_REAL_', 'VIX_', 'RSI_'], collapsible: true, defaultCollapsed: true },
];

function buildGroups(allKeys: string[]): ConfigGroup[] {
  const groups: ConfigGroup[] = [];
  const assigned = new Set<string>();

  for (const def of GROUP_DEFS) {
    const matchingKeys = allKeys.filter((key) => {
      if (assigned.has(key)) return false;
      return def.prefixes.some((prefix) => key.startsWith(prefix) || key === prefix);
    });
    if (matchingKeys.length > 0) {
      matchingKeys.forEach((k) => assigned.add(k));
      groups.push({
        title: def.title,
        icon: def.icon,
        keys: matchingKeys,
        collapsible: def.collapsible,
        defaultCollapsed: def.defaultCollapsed,
      });
    }
  }

  // Catch any remaining keys
  const remaining = allKeys.filter((k) => !assigned.has(k));
  if (remaining.length > 0) {
    groups.push({
      title: 'Other',
      icon: '📦',
      keys: remaining,
      collapsible: true,
      defaultCollapsed: true,
    });
  }

  return groups;
}

// ── Value Type Helpers ────────────────────────────────────────────

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

// ── Strategy Preset Type ──────────────────────────────────────────

interface StrategyPreset {
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
}

function loadPresets(): StrategyPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('ddljj-presets');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: StrategyPreset[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ddljj-presets', JSON.stringify(presets));
}

// ── Component ────────────────────────────────────────────────────

export function ConfigPage() {
  const { config, fetchConfig, updateConfig } = useDDLJStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [presets, setPresets] = useState<StrategyPreset[]>(() => loadPresets());
  const [presetName, setPresetName] = useState('');
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);

  // Derive localConfig from remote config + local edits
  // "edits" tracks only keys the user has changed locally
  const [edits, setEdits] = useState<Record<string, unknown>>({});

  // Merge remote config with local edits
  const localConfig = useMemo(() => ({ ...config, ...edits }), [config, edits]);

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ── Derived data ─────────────────────────────────────────────
  const keys = useMemo(() => Object.keys(localConfig).sort(), [localConfig]);
  const groups = useMemo(() => buildGroups(keys), [keys]);

  // Filter groups by search
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    const term = searchTerm.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        keys: g.keys.filter((k) => k.toLowerCase().includes(term)),
      }))
      .filter((g) => g.keys.length > 0);
  }, [groups, searchTerm]);

  // ── Change tracking ──────────────────────────────────────────
  const changedKeys = useMemo(() => {
    const changed = new Set<string>();
    for (const key of keys) {
      if (JSON.stringify(localConfig[key]) !== JSON.stringify(config[key])) {
        changed.add(key);
      }
    }
    return changed;
  }, [localConfig, config, keys]);

  const hasChanges = changedKeys.size > 0;

  // ── Handlers ─────────────────────────────────────────────────
  const handleLocalChange = (key: string, value: boolean | number | string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetKey = (key: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleResetGroup = (groupKeys: string[]) => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const key of groupKeys) {
        delete next[key];
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (changedKeys.size === 0) {
      toast.info('No changes to save');
      return;
    }

    setIsSaving(true);
    try {
      const changes: Record<string, unknown> = {};
      for (const key of changedKeys) {
        changes[key] = edits[key] ?? localConfig[key];
      }
      await updateConfig(changes);
      setEdits({}); // Clear edits after save
      toast.success(`${changedKeys.size} parameter${changedKeys.size !== 1 ? 's' : ''} saved`);
    } catch (err) {
      toast.error(
        `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(localConfig, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ddlj-config.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Config exported');
  };

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  // ── Preset handlers ──────────────────────────────────────────
  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      toast.error('Please enter a preset name');
      return;
    }
    const newPreset: StrategyPreset = {
      name,
      config: { ...localConfig },
      createdAt: new Date().toISOString(),
    };
    const updated = [...presets, newPreset];
    savePresets(updated);
    setPresets(updated);
    setPresetName('');
    setPresetDialogOpen(false);
    toast.success(`Preset "${name}" saved`);
  };

  const handleLoadPreset = (preset: StrategyPreset) => {
    // Set edits to the delta between current config and preset
    const newEdits: Record<string, unknown> = {};
    for (const key of Object.keys(preset.config)) {
      if (JSON.stringify(preset.config[key]) !== JSON.stringify(config[key])) {
        newEdits[key] = preset.config[key];
      }
    }
    setEdits(newEdits);
    toast.success(`Preset "${preset.name}" loaded (unsaved)`);
  };

  const handleDeletePreset = (name: string) => {
    const updated = presets.filter((p) => p.name !== name);
    savePresets(updated);
    setPresets(updated);
    toast.success(`Preset "${name}" deleted`);
  };

  // ── Render Parameter Editor ──────────────────────────────────
  const renderParam = (key: string) => {
    const rawValue = localConfig[key];
    const valueType = guessValueType(rawValue);
    const parsedValue = parseValue(rawValue);
    const isChanged = changedKeys.has(key);

    return (
      <div
        key={key}
        className={cn(
          'space-y-1.5 rounded-lg border p-3',
          isChanged
            ? 'border-primary/40 bg-primary/5'
            : 'border-border/50 bg-secondary/30'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-mono font-semibold leading-tight">
            {key}
          </Label>
          {isChanged && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 shrink-0 gap-0.5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => handleResetKey(key)}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>

        {valueType === 'boolean' ? (
          <div className="flex items-center justify-between">
            <Switch
              checked={!!parsedValue}
              onCheckedChange={(checked) => handleLocalChange(key, checked)}
            />
            <span
              className={cn(
                'text-xs font-mono',
                parsedValue ? 'text-emerald-400' : 'text-muted-foreground'
              )}
            >
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
  };

  // ── Render Group ─────────────────────────────────────────────
  const renderGroup = (group: ConfigGroup) => {
    const isCollapsed =
      collapsedGroups[group.title] ?? group.defaultCollapsed ?? false;
    const groupChangedKeys = group.keys.filter((k) => changedKeys.has(k));

    const content = (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {group.keys.map(renderParam)}
      </div>
    );

    // All groups use Collapsible
    return (
      <Collapsible
        key={group.title}
        open={!isCollapsed}
        onOpenChange={() => toggleGroup(group.title)}
      >
        <Card className="bg-card/60 border-border">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer pb-2 transition-colors hover:bg-secondary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{group.icon}</span>
                  <CardTitle className="text-sm font-medium">
                    {group.title}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    {group.keys.length}
                  </Badge>
                  {groupChangedKeys.length > 0 && (
                    <Badge variant="default" className="text-[9px] h-4 px-1.5 bg-primary/80">
                      {groupChangedKeys.length} changed
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {groupChangedKeys.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResetGroup(group.keys);
                      }}
                    >
                      <RotateCcw className="size-3" /> Reset section
                    </Button>
                  )}
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>{content}</CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  // ── Main Render ──────────────────────────────────────────────
  return (
    <div className="page-enter space-y-4 max-w-4xl">
      {/* ── Header Card ──────────────────────────────────────────── */}
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="size-5 text-muted-foreground" />
                Strategy Configuration
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {keys.length} parameter{keys.length !== 1 ? 's' : ''} — edit and save to apply
                {changedKeys.size > 0 && (
                  <span className="ml-1 text-primary font-medium">
                    ({changedKeys.size} unsaved)
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Preset Dialog */}
              <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" /> Presets
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Strategy Presets</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    {/* Save new preset */}
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Preset name..."
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        className="h-8 text-xs"
                        onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                      />
                      <Button size="sm" onClick={handleSavePreset} className="gap-1.5 text-xs shrink-0">
                        <Bookmark className="size-3.5" /> Save
                      </Button>
                    </div>

                    {/* Existing presets */}
                    {presets.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No saved presets yet. Save your current config as a preset.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {presets.map((preset) => (
                          <div
                            key={preset.name}
                            className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{preset.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(preset.createdAt).toLocaleDateString('en-IN')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleLoadPreset(preset)}
                              >
                                Load
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-400 hover:text-red-300"
                                onClick={() => handleDeletePreset(preset.name)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={cn(
                  'gap-1.5 text-xs',
                  hasChanges && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                )}
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save Changes
                {changedKeys.size > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 min-w-4 px-1 text-[9px]"
                  >
                    {changedKeys.size}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search parameters... (e.g., EMA, risk, VIX)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Config Groups ────────────────────────────────────────── */}
      {filteredGroups.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Settings className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p>No parameters match your search</p>
        </div>
      ) : (
        filteredGroups.map(renderGroup)
      )}
    </div>
  );
}
