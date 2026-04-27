'use client';

/**
 * DDLJ Configuration Page
 * ========================
 * All 72+ strategy parameters editable with descriptions, defaults,
 * validation, and live/restart indicators.
 */

import { useDDLJStore } from '@/lib/store';
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
import {
  Settings,
  RotateCcw,
  Save,
  Info,
  Zap,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export function ConfigPage() {
  const { config, updateConfigParam, resetConfigParam, resetAllConfig } = useDDLJStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

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

  const handleSave = () => {
    toast.success(`${changedParams.length} configuration parameters saved`);
    setHasChanges(false);
  };

  const handleResetAll = () => {
    resetAllConfig();
    toast.info('All parameters reset to defaults');
    setHasChanges(false);
  };

  return (
    <div className="space-y-4 p-4">
      {/* ── Header ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Strategy Configuration</CardTitle>
              <CardDescription>
                All trading engine parameters — edit live or restart required parameters
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {changedParams.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {changedParams.length} modified
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleResetAll} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Reset All
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Save Changes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search parameters... (e.g., EMA, risk, VIX)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-emerald-400" /> Live update</span>
              <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3 text-amber-400" /> Restart needed</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Config Sections ── */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-4 pr-4">
          {Object.entries(filteredCategories).map(([category, params]) => (
            <Card key={category} className="bg-card/80 border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">{category}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{params.length} params</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {params.map((param) => (
                    <div key={param.key} className="space-y-2 p-3 rounded-lg bg-secondary/30 border border-border/50">
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
                          {JSON.stringify(param.value) !== JSON.stringify(param.default) && (
                            <Badge variant="secondary" className="text-[8px] px-1 h-3.5">modified</Badge>
                          )}
                        </div>
                        {JSON.stringify(param.value) !== JSON.stringify(param.default) && (
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
                            onCheckedChange={(checked) => {
                              updateConfigParam(param.key, checked);
                              setHasChanges(true);
                            }}
                          />
                          <span className={cn('text-xs font-mono', param.value ? 'text-emerald-400' : 'text-muted-foreground')}>
                            {param.value ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      )}

                      {param.type === 'select' && (
                        <Select
                          value={String(param.value)}
                          onValueChange={(val) => {
                            updateConfigParam(param.key, val);
                            setHasChanges(true);
                          }}
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
                                onValueChange={([val]) => {
                                  updateConfigParam(param.key, val);
                                  setHasChanges(true);
                                }}
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
                                  if (!isNaN(val)) {
                                    updateConfigParam(param.key, val);
                                    setHasChanges(true);
                                  }
                                }}
                                className="h-8 text-xs font-mono"
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
                          onChange={(e) => {
                            updateConfigParam(param.key, e.target.value);
                            setHasChanges(true);
                          }}
                          className="h-8 text-xs"
                        />
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
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
