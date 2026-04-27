'use client';

/**
 * DDLJ Configuration Page (Enhanced)
 * ====================================
 * All strategy parameters with:
 * - Import/Export config as JSON
 * - Config presets (Conservative, Moderate, Aggressive)
 * - Validation with inline errors
 * - "Apply & Restart" vs "Save Only"
 * - Config diff view
 * - Reset individual category
 */

import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  RotateCcw,
  Save,
  Info,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Download,
  Upload,
  Copy,
  FileJson,
  ArrowRight,
  Shield,
  Swords,
  Scale,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useRef } from 'react';
import type { ConfigPreset } from '@/lib/mock-data';

export function ConfigPage() {
  const { config, updateConfigParam, resetConfigParam, resetAllConfig, applyConfigPreset, configPresets } = useDDLJStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showDiff, setShowDiff] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group config by category
  const categories = config.reduce<Record<string, typeof config>>((acc, param) => {
    if (!acc[param.category]) acc[param.category] = [];
    acc[param.category].push(param);
    return acc;
  }, {});

  const filteredCategories = Object.entries(categories).reduce<Record<string, typeof config>>((acc, [cat, params]) => {
    const filtered = params.filter(p =>
      p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) acc[cat] = filtered;
    return acc;
  }, {});

  const changedParams = config.filter(p => JSON.stringify(p.value) !== JSON.stringify(p.default));

  // Validation
  const validateParam = (key: string, value: string | number | boolean): string | null => {
    const param = config.find(p => p.key === key);
    if (!param) return null;
    if (param.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) return 'Must be a valid number';
      if (param.min !== undefined && num < param.min) return `Minimum: ${param.min}`;
      if (param.max !== undefined && num > param.max) return `Maximum: ${param.max}`;
    }
    return null;
  };

  const handleUpdate = (key: string, value: string | number | boolean) => {
    const error = validateParam(key, value);
    setValidationErrors((prev) => {
      const next = { ...prev };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
    updateConfigParam(key, value);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Fix validation errors before saving');
      return;
    }
    toast.success(`${changedParams.length} configuration parameters saved`);
    setHasChanges(false);
  };

  const handleApplyAndRestart = () => {
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Fix validation errors before applying');
      return;
    }
    toast.success('Configuration applied — engine restarting...', {
      description: 'Changes will take effect after restart completes',
    });
    setHasChanges(false);
  };

  const handleResetAll = () => {
    resetAllConfig();
    setValidationErrors({});
    toast.info('All parameters reset to defaults');
    setHasChanges(false);
  };

  const handleResetCategory = (category: string) => {
    const catParams = config.filter(p => p.category === category);
    catParams.forEach(p => resetConfigParam(p.key));
    toast.info(`${category} reset to defaults`);
    setHasChanges(true);
  };

  // Export config as JSON
  const handleExport = () => {
    const configObj = config.reduce<Record<string, string | number | boolean>>((acc, p) => {
      acc[p.key] = p.value;
      return acc;
    }, {});
    const blob = new Blob([JSON.stringify(configObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ddlj-config.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Config exported as JSON');
  };

  // Import config from JSON
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        Object.entries(imported).forEach(([key, value]) => {
          const param = config.find(p => p.key === key);
          if (param) updateConfigParam(key, value as string | number | boolean);
        });
        setHasChanges(true);
        toast.success('Config imported successfully');
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Copy config to clipboard
  const handleCopyConfig = () => {
    const configObj = config.reduce<Record<string, string | number | boolean>>((acc, p) => {
      acc[p.key] = p.value;
      return acc;
    }, {});
    navigator.clipboard.writeText(JSON.stringify(configObj, null, 2));
    toast.success('Config copied to clipboard');
  };

  const presetIcons: Record<string, React.ReactNode> = {
    Conservative: <Shield className="h-4 w-4 text-emerald-400" />,
    Moderate: <Scale className="h-4 w-4 text-amber-400" />,
    Aggressive: <Swords className="h-4 w-4 text-red-400" />,
  };

  return (
    <div className="space-y-4 p-4">
      {/* ── Header ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Strategy Configuration</CardTitle>
              <CardDescription>
                All trading engine parameters — edit live or restart required parameters
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {changedParams.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {changedParams.length} modified
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleImport} className="gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyConfig} className="gap-1.5 text-xs">
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button variant="outline" size="sm" onClick={handleResetAll} className="gap-1.5 text-xs">
                <RotateCcw className="h-3.5 w-3.5" /> Reset All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Search parameters... (e.g., EMA, risk, VIX)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Button
              variant={showDiff ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowDiff(!showDiff)}
              className="gap-1.5 text-xs"
            >
              <FileJson className="h-3.5 w-3.5" /> Diff View
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-emerald-400" /> Live update</span>
              <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3 text-amber-400" /> Restart needed</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Config Presets ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {configPresets.map((preset) => (
          <Card key={preset.name} className="bg-card/80 border-border hover:border-primary/30 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {presetIcons[preset.name]}
                  <span className="text-sm font-semibold">{preset.name}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[10px] h-6 gap-1"
                  onClick={() => {
                    applyConfigPreset(preset);
                    setHasChanges(true);
                    toast.success(`${preset.name} preset applied`);
                  }}
                >
                  Apply
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{preset.description}</p>
              <div className="mt-2 space-y-0.5">
                {Object.entries(preset.changes).slice(0, 3).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-1 text-[10px]">
                    <span className="font-mono text-muted-foreground">{key}:</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="font-mono font-semibold">{String(value)}</span>
                  </div>
                ))}
                {Object.keys(preset.changes).length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{Object.keys(preset.changes).length - 3} more</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Diff View ── */}
      {showDiff && changedParams.length > 0 && (
        <Card className="bg-card/80 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Config Changes (vs Defaults)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {changedParams.map((param) => (
                <div key={param.key} className="flex items-center gap-3 p-2 rounded bg-secondary/20 text-xs font-mono">
                  <span className="text-muted-foreground w-36 truncate">{param.key}</span>
                  <span className="text-red-400 line-through">{String(param.default)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-emerald-400">{String(param.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Save Buttons ── */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={!hasChanges} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> Save Only
        </Button>
        <Button size="sm" onClick={handleApplyAndRestart} disabled={!hasChanges} variant="default" className="gap-1.5">
          <Zap className="h-3.5 w-3.5" /> Apply & Restart
        </Button>
        {Object.keys(validationErrors).length > 0 && (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertTriangle className="h-3 w-3" /> {Object.keys(validationErrors).length} errors
          </Badge>
        )}
      </div>

      {/* ── Config Sections ── */}
      <ScrollArea className="h-[calc(100vh-440px)]">
        <div className="space-y-4 pr-4">
          {Object.entries(filteredCategories).map(([category, params]) => (
            <Card key={category} className="bg-card/80 border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{category}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">{params.length} params</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] text-muted-foreground hover:text-foreground h-6"
                    onClick={() => handleResetCategory(category)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset Category
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {params.map((param) => {
                    const hasError = validationErrors[param.key];
                    const isModified = JSON.stringify(param.value) !== JSON.stringify(param.default);
                    return (
                      <div key={param.key} className={cn(
                        'space-y-2 p-3 rounded-lg bg-secondary/30 border',
                        hasError ? 'border-red-500/30' : 'border-border/50',
                        isModified && !hasError && 'border-primary/20'
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs font-mono font-semibold">{param.key}</Label>
                            {param.live_update ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Zap className="h-3 w-3 text-emerald-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Changes take effect immediately</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <RotateCcw className="h-3 w-3 text-amber-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Requires engine restart</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {isModified && (
                              <Badge variant="secondary" className="text-[8px] px-1 h-3.5">modified</Badge>
                            )}
                          </div>
                          {isModified && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                              onClick={() => { resetConfigParam(param.key); setHasChanges(true); }}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Reset
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{param.description}</p>

                        {/* ── Input by Type ── */}
                        {param.type === 'boolean' && (
                          <div className="flex items-center justify-between">
                            <Switch
                              checked={param.value as boolean}
                              onCheckedChange={(checked) => handleUpdate(param.key, checked)}
                            />
                            <span className={cn('text-xs font-mono', param.value ? 'text-emerald-400' : 'text-muted-foreground')}>
                              {param.value ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        )}

                        {param.type === 'select' && (
                          <Select
                            value={String(param.value)}
                            onValueChange={(val) => handleUpdate(param.key, val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {param.options?.map((opt) => (
                                <SelectItem key={opt} value={opt} className="text-xs">
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {param.type === 'number' && (
                          <div className="space-y-2">
                            {param.min !== undefined && param.max !== undefined && (param.max - param.min) <= 20 ? (
                              <>
                                <Slider
                                  value={[Number(param.value)]}
                                  min={param.min}
                                  max={param.max}
                                  step={param.step || 1}
                                  onValueChange={([val]) => handleUpdate(param.key, val)}
                                  className="py-1"
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                  <span>{param.min}</span>
                                  <span className="font-mono font-semibold text-foreground">{String(param.value)}</span>
                                  <span>{param.max}</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={String(param.value)}
                                  min={param.min}
                                  max={param.max}
                                  step={param.step || 1}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) handleUpdate(param.key, val);
                                  }}
                                  className={cn('h-8 text-xs font-mono', hasError && 'border-red-500/50')}
                                />
                                {param.default !== undefined && (
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    default: {String(param.default)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {param.type === 'string' && (
                          <Input
                            value={String(param.value)}
                            onChange={(e) => handleUpdate(param.key, e.target.value)}
                            className="h-8 text-xs"
                          />
                        )}

                        {/* Validation Error */}
                        {hasError && (
                          <div className="flex items-center gap-1 text-[10px] text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            {hasError}
                          </div>
                        )}

                        {/* Default Value Indicator */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Default: {String(param.default)}</span>
                          {param.live_update ? (
                            <span className="flex items-center gap-0.5 text-emerald-400">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Live
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-amber-400">
                              <AlertTriangle className="h-2.5 w-2.5" /> Restart
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
