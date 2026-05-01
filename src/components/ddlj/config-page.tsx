'use client';

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

function coerceConfigValue(original: unknown, value: string): unknown {
  if (typeof original === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : original;
  }
  if (typeof original === 'boolean') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return original;
  }
  if (original === null || original === undefined) {
    return value;
  }
  return value;
}

export function ConfigPage() {
  const { config, updateConfig } = useDDLJStore();
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditConfig({ ...config });
  }, [config]);

  const handleSave = async () => {
    const typedUpdates = Object.fromEntries(
      Object.entries(editConfig).map(([key, value]) => [
        key,
        typeof value === 'string' ? coerceConfigValue(config[key], value) : value,
      ]),
    );

    setSaving(true);
    try {
      await updateConfig(typedUpdates);
      toast.success('Configuration saved');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-6">
          {Object.keys(editConfig).length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Configuration has not loaded yet. Refresh backend status if this stays empty.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(editConfig).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{key}</label>
                  <Input
                    value={String(value ?? '')}
                    onChange={(e) => setEditConfig(prev => ({ ...prev, [key]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground/70">
                    Type: {typeof config[key]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
