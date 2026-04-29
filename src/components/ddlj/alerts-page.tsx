'use client';

import { BellRing, Info, ExternalLink } from 'lucide-react';
import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

// ── Alert Rule Row ───────────────────────────────────────────────
interface AlertRuleProps {
  label: string;
  description: string;
  enabled: boolean;
  configKey: string;
  readOnly?: boolean;
}

function AlertRule({ label, description, enabled, readOnly = true }: AlertRuleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <Switch checked={enabled} disabled={readOnly} className="shrink-0" />
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
  const { config, setActivePage } = useDDLJStore();

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
                Notification settings from your configuration
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Config
            </Badge>
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
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Redirect Message ───────────────────────────────────── */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
        <Info className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Configure alert notifications in the{' '}
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
