'use client';

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function ConfigPage() {
  const { config, updateConfig } = useDDLJStore();
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({ ...config });
  const [saving, setSaving] = useState(false);

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(editConfig).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{key}</label>
                <Input
                  value={String(value)}
                  onChange={(e) => setEditConfig(prev => ({ ...prev, [key]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
