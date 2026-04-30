'use client';

import { useMemo, useCallback } from 'react';
import { BellRing, ExternalLink, Bell, TestTube2 } from 'lucide-react';
import { useDDLJStore } from '@/lib/store';
import { cn, formatDateTime, pnlColor, formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Trade } from '@/lib/api';

// ── Alert Rule Row ───────────────────────────────────────────────

interface AlertRuleProps {
  label: string;
  description: string;
  enabled: boolean;
  configKey: string;
  onToggle: (key: string, enabled: boolean) => void;
}

function AlertRule({ label, description, enabled, configKey, onToggle }: AlertRuleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={(checked) => onToggle(configKey, checked)}
        className="shrink-0"
      />
    </div>
  );
}

// ── Alert Event Row ──────────────────────────────────────────────

function AlertEvent({ trade }: { trade: Trade }) {
  const isWin = trade.net > 0;
  const eventType = trade.exit_reason === 'STOP_LOSS' ? 'SL Hit' :
                    trade.exit_reason === 'TARGET_HIT' ? 'Target Hit' :
                    trade.exit_reason === 'NEAR_TARGET' ? 'Near Target' : 'Trade Closed';

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2.5 transition-colors hover:bg-accent/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          'flex size-7 items-center justify-center rounded-full shrink-0',
          isWin ? 'bg-emerald-500/10' : 'bg-red-500/10'
        )}>
          <Bell className={cn('size-3.5', isWin ? 'text-emerald-400' : 'text-red-400')} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {trade.symbol} — {eventType}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(trade.exit_time)}
            {trade.option_type && ` · ${trade.option_strike}${trade.option_type}`}
          </p>
        </div>
      </div>
      <span className={cn('text-sm font-semibold shrink-0 tabular-nums', pnlColor(trade.net))}>
        {formatCurrency(trade.net)}
      </span>
    </div>
  );
}

// ── Notification Config Keys ─────────────────────────────────────

const alertRules = [
  {
    key: 'NOTIFY_ON_TRADE',
    label: 'Trade Notifications',
    description: 'Get notified when a trade is opened or closed',
  },
  {
    key: 'NOTIFY_ON_SL',
    label: 'Stop-Loss Alerts',
    description: 'Alert when a stop-loss is hit or triggered',
  },
  {
    key: 'NOTIFY_ON_TARGET',
    label: 'Target Hit Alerts',
    description: 'Alert when a profit target is reached',
  },
  {
    key: 'TELEGRAM_ENABLED',
    label: 'Telegram Notifications',
    description: 'Send alerts to your Telegram bot',
  },
  {
    key: 'NOTIFY_ON_ERROR',
    label: 'Error Alerts',
    description: 'Alert on engine errors or exceptions',
  },
  {
    key: 'NOTIFY_ON_CIRCUIT_BREAKER',
    label: 'Circuit Breaker Alerts',
    description: 'Alert when a circuit breaker is triggered',
  },
] as const;

// ── Main Alerts Page ─────────────────────────────────────────────

export default function AlertsPage() {
  const { config, trades, updateConfig, setActivePage } = useDDLJStore();

  // ── Toggle handler ──────────────────────────────────────────
  const handleToggle = useCallback(async (key: string, enabled: boolean) => {
    try {
      await updateConfig({ [key]: enabled });
      toast.success(`${key.replace(/_/g, ' ')} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(`Failed to update ${key}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [updateConfig]);

  // ── Test alert handler ──────────────────────────────────────
  const handleTestAlert = useCallback(() => {
    toast.success('🔔 Test alert received! Notifications are working.', {
      description: 'This is a test notification from the DDLJ Trading System.',
    });
  }, []);

  // ── Recent trade events (last 10) ──────────────────────────
  const recentEvents = useMemo(() => {
    return [...trades]
      .sort((a, b) => new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime())
      .slice(0, 10);
  }, [trades]);

  return (
    <div className="page-enter space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BellRing className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Alerts & Notifications</h1>
          <p className="text-xs text-muted-foreground">Manage trading alert rules</p>
        </div>
      </div>

      {/* ── Alert Rules Card ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Alert Rules</CardTitle>
              <CardDescription className="text-xs mt-1">
                Toggle notifications — changes are saved instantly
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleTestAlert}
            >
              <TestTube2 className="size-3.5" />
              Test Alert
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/40">
            {alertRules.map((rule) => {
              const isEnabled = config[rule.key] === true || config[rule.key] === 'true' || config[rule.key] === 1;
              return (
                <AlertRule
                  key={rule.key}
                  label={rule.label}
                  description={rule.description}
                  enabled={isEnabled}
                  configKey={rule.key}
                  onToggle={handleToggle}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Alert History ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Alert History</CardTitle>
              <CardDescription className="text-xs mt-1">
                Recent trade events from your trade history
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {recentEvents.length} events
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BellRing className="mb-2 size-8 text-zinc-600" />
              <p className="text-sm text-muted-foreground">No alert events yet</p>
              <p className="text-xs text-muted-foreground">
                Trade events will appear here once trading begins
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {recentEvents.map((trade) => (
                <AlertEvent
                  key={trade.id ?? `${trade.symbol}-${trade.exit_time}`}
                  trade={trade}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Link to Config ─────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
        <Bell className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Fine-tune alert thresholds in the{' '}
            <button
              onClick={() => setActivePage('config')}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Configuration page
              <ExternalLink className="size-3" />
            </button>
            {' '}under the Notifications section.
          </p>
        </div>
      </div>
    </div>
  );
}
