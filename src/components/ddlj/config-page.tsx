'use client';

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Save, Loader2, RotateCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

// Keys that contain sensitive values (show masked)
const SENSITIVE_KEYS = new Set(['KITE_API_KEY', 'KITE_API_SECRET', 'AUTH_SECRET_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']);

// Keys that are boolean
function isBooleanValue(v: unknown): boolean {
  return typeof v === 'boolean' || v === 'True' || v === 'False' || v === 'true' || v === 'false';
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
}

// Keys that are numeric
function isNumericValue(v: unknown): boolean {
  if (typeof v === 'number') return true;
  if (typeof v === 'string' && v !== '' && !isNaN(Number(v)) && v !== 'True' && v !== 'False') return true;
  return false;
}

export function ConfigPage() {
  const { config, updateConfig, fetchConfig } = useDDLJStore();
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // Sync from backend config whenever it changes
  useEffect(() => {
    if (Object.keys(config).length > 0) {
      setEditConfig({ ...config });
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig(editConfig);
      toast.success('Configuration saved');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchConfig();
      toast.success('Configuration refreshed');
    } catch {
      toast.error('Failed to refresh');
    }
  };

  // Sort keys: put important ones first
  const importantKeys = ['STARTING_CAPITAL', 'DAILY_RISK_PCT', 'MAX_OPEN_POSITIONS', 'MAX_DAILY_TRADES', 'MAX_DAILY_TRADES_ENABLED', 'SL_ATR_MULTIPLIER', 'MIN_RISK_REWARD_RATIO', 'OPTION_MONEYNESS', 'DRAWDOWN_CIRCUIT_BREAKER', 'CAPITAL_FLOOR_PCT'];
  const sortedEntries = Object.entries(editConfig).sort(([a], [b]) => {
    const aIdx = importantKeys.indexOf(a);
    const bIdx = importantKeys.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
            <RotateCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-6">
          {Object.keys(editConfig).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Loading configuration from backend...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedEntries.map(([key, originalValue]) => {
                const value = editConfig[key];
                const isSensitive = SENSITIVE_KEYS.has(key);
                const isBool = isBooleanValue(originalValue);
                const isNum = !isBool && isNumericValue(originalValue);

                return (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{key}</Label>
                    {isBool ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={parseBool(value)}
                          onCheckedChange={(checked) => setEditConfig(prev => ({ ...prev, [key]: checked }))}
                        />
                        <span className="text-xs text-muted-foreground">{parseBool(value) ? 'True' : 'False'}</span>
                      </div>
                    ) : isSensitive ? (
                      <Input
                        value={String(value)}
                        onChange={(e) => setEditConfig(prev => ({ ...prev, [key]: e.target.value }))}
                        className="h-8 text-sm"
                        type="password"
                      />
                    ) : (
                      <Input
                        value={isNum && typeof value === 'number' ? value : String(value)}
                        onChange={(e) => {
                          // Preserve type: numbers stay as numbers
                          const newVal = e.target.value;
                          if (isNum && newVal !== '' && !isNaN(Number(newVal))) {
                            setEditConfig(prev => ({ ...prev, [key]: Number(newVal) }));
                          } else {
                            setEditConfig(prev => ({ ...prev, [key]: newVal }));
                          }
                        }}
                        className="h-8 text-sm"
                        type={isNum ? 'number' : 'text'}
                        step={isNum && typeof originalValue === 'number' && !Number.isInteger(originalValue) ? '0.1' : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
