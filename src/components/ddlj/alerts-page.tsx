'use client';

/**
 * DDLJ Alerts & Notifications Page
 * ==================================
 * Alert rules, notification history, Telegram integration,
 * and active risk alerts — all in one page.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Bell,
  BellRing,
  History,
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  MessageSquare,
  Smartphone,
  ShieldAlert,
  Clock,
  ExternalLink,
  Zap,
  Activity,
} from 'lucide-react';
import {
  mockAlertConfigs,
  mockAlertHistory,
  mockTelegramConfig,
  mockRiskAlerts,
  type AlertConfig,
  type AlertHistoryEntry,
  type TelegramConfig,
  type RiskAlert,
} from '@/lib/mock-data';
import { toast } from 'sonner';

// ── Helpers ────────────────────────────────────────────────────────

function alertTypeBadge(type: AlertConfig['type']) {
  const map: Record<AlertConfig['type'], { label: string; className: string }> = {
    price: { label: 'PRICE', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    vix:   { label: 'VIX',   className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
    trade: { label: 'TRADE', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    risk:  { label: 'RISK',  className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  };
  const { label, className } = map[type];
  return <Badge className={cn('text-[9px] px-1.5 py-0 h-4 border', className)}>{label}</Badge>;
}

function channelBadge(channel: 'telegram' | 'in_app') {
  if (channel === 'telegram') {
    return (
      <Badge className="gap-1 text-[9px] px-1.5 py-0 h-4 bg-sky-500/15 text-sky-400 border-sky-500/30 border">
        <Send className="h-2.5 w-2.5" /> Telegram
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 text-[9px] px-1.5 py-0 h-4 bg-zinc-500/15 text-zinc-300 border-zinc-500/30 border">
      <Smartphone className="h-2.5 w-2.5" /> In-App
    </Badge>
  );
}

function severityIcon(severity: RiskAlert['severity']) {
  switch (severity) {
    case 'critical':
      return <AlertOctagon className="h-4 w-4 text-red-400 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />;
    case 'info':
      return <Info className="h-4 w-4 text-sky-400 flex-shrink-0" />;
  }
}

function severityBadge(severity: RiskAlert['severity']) {
  const map: Record<string, { label: string; className: string }> = {
    critical: { label: 'CRITICAL', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
    warning:  { label: 'WARNING',  className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    info:     { label: 'INFO',     className: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  };
  const { label, className } = map[severity];
  return <Badge className={cn('text-[9px] px-1.5 py-0 h-4 border', className)}>{label}</Badge>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

// ── Main Component ─────────────────────────────────────────────────

export function AlertsPage() {
  // Local state for toggling alert configs
  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>(mockAlertConfigs);
  // Local state for acknowledging risk alerts and history entries
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>(mockRiskAlerts);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>(mockAlertHistory);
  // Telegram test state
  const [telegramConfig] = useState<TelegramConfig>(mockTelegramConfig);
  const [isTesting, setIsTesting] = useState(false);

  const unacknowledgedCount = riskAlerts.filter(a => !a.acknowledged).length;
  const unackHistoryCount = alertHistory.filter(h => !h.acknowledged).length;

  const handleToggleAlert = (id: string) => {
    setAlertConfigs(prev =>
      prev.map(c => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleAcknowledgeRisk = (id: string) => {
    setRiskAlerts(prev =>
      prev.map(a => (a.id === id ? { ...a, acknowledged: true } : a))
    );
    toast.success('Alert acknowledged');
  };

  const handleAcknowledgeHistory = (id: string) => {
    setAlertHistory(prev =>
      prev.map(h => (h.id === id ? { ...h, acknowledged: true } : h))
    );
    toast.success('Notification acknowledged');
  };

  const handleTestTelegram = async () => {
    setIsTesting(true);
    // Simulate a test notification
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsTesting(false);
    toast.success('Test notification sent to Telegram!');
  };

  return (
    <div className="space-y-4 p-4 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <BellRing className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Alerts & Notifications</h1>
          <p className="text-xs text-muted-foreground">
            Configure alert rules, view history, and manage Telegram integration
          </p>
        </div>
        {unacknowledgedCount > 0 && (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertTriangle className="h-3 w-3" /> {unacknowledgedCount} unacknowledged
          </Badge>
        )}
      </div>

      {/* ── Main Tabs ── */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules" className="gap-1.5 text-xs">
            <Bell className="h-3.5 w-3.5" /> Alert Rules
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> History
            {unackHistoryCount > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
                {unackHistoryCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════════
            ALERT RULES TAB
            ════════════════════════════════════════════════════════════ */}
        <TabsContent value="rules" className="space-y-4">
          {/* ── Alert Config Cards ── */}
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-medium">Alert Rules</CardTitle>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {alertConfigs.filter(c => c.enabled).length}/{alertConfigs.length} active
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alertConfigs.map(config => (
                  <div
                    key={config.id}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      config.enabled
                        ? 'bg-secondary/30 border-border/50'
                        : 'bg-secondary/10 border-border/25 opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: info */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{config.name}</span>
                          {alertTypeBadge(config.type)}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="font-mono">Condition: <span className="text-zinc-300">{config.condition}</span></span>
                          <span className="text-border">|</span>
                          <span className="font-mono">Threshold: <span className="text-zinc-300">{config.threshold}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {config.channels.map(ch => (
                            <span key={ch}>{channelBadge(ch)}</span>
                          ))}
                        </div>
                      </div>
                      {/* Right: toggle */}
                      <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                        <span className={cn(
                          'text-[9px] font-medium',
                          config.enabled ? 'text-emerald-400' : 'text-muted-foreground'
                        )}>
                          {config.enabled ? 'ON' : 'OFF'}
                        </span>
                        <Switch
                          checked={config.enabled}
                          onCheckedChange={() => handleToggleAlert(config.id)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Telegram Integration + Active Risk Alerts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Telegram Integration */}
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-sky-400" />
                    <CardTitle className="text-sm font-medium">Telegram Integration</CardTitle>
                  </div>
                  <Badge
                    className={cn(
                      'text-[9px] px-1.5 py-0 h-4 border',
                      telegramConfig.enabled
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/15 text-red-400 border-red-500/30'
                    )}
                  >
                    {telegramConfig.enabled ? 'CONNECTED' : 'DISABLED'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-secondary/30 border border-border/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground">Bot Token</div>
                    <div className="font-mono text-xs text-zinc-300">{telegramConfig.bot_token}</div>
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground">Chat ID</div>
                    <div className="font-mono text-xs text-zinc-300">{telegramConfig.chat_id}</div>
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground">Status</div>
                    <Badge
                      className={cn(
                        'text-[9px] px-1.5 py-0 h-4 border',
                        telegramConfig.enabled
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                      )}
                    >
                      {telegramConfig.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>

                {/* Last test info */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {telegramConfig.last_test ? (
                      <span>
                        Last test: {formatDate(telegramConfig.last_test)} {formatTime(telegramConfig.last_test)}
                      </span>
                    ) : (
                      <span>No test sent yet</span>
                    )}
                  </div>
                  {telegramConfig.last_test && (
                    <div className="flex items-center gap-1">
                      {telegramConfig.last_test_success ? (
                        <><CheckCircle2 className="h-3 w-3 text-emerald-400" /> <span className="text-emerald-400">Success</span></>
                      ) : (
                        <><AlertTriangle className="h-3 w-3 text-red-400" /> <span className="text-red-400">Failed</span></>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 h-8 text-xs"
                  onClick={handleTestTelegram}
                  disabled={isTesting || !telegramConfig.enabled}
                >
                  {isTesting ? (
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {isTesting ? 'Sending...' : 'Send Test Notification'}
                </Button>
              </CardContent>
            </Card>

            {/* Active Risk Alerts */}
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    <CardTitle className="text-sm font-medium">Active Risk Alerts</CardTitle>
                  </div>
                  {unacknowledgedCount > 0 && (
                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                      {unacknowledgedCount} NEW
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-2">
                  {riskAlerts.map(alert => (
                    <div
                      key={alert.id}
                      className={cn(
                        'rounded-lg border p-2.5 transition-colors',
                        !alert.acknowledged
                          ? 'bg-secondary/40 border-border/60'
                          : 'bg-secondary/15 border-border/25 opacity-60'
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">{severityIcon(alert.severity)}</div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {severityBadge(alert.severity)}
                            {alertTypeBadge(alert.type)}
                          </div>
                          <div className={cn(
                            'text-xs leading-relaxed',
                            !alert.acknowledged ? 'text-zinc-200' : 'text-muted-foreground'
                          )}>
                            {alert.message}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-[9px] text-muted-foreground font-mono">
                              {formatDate(alert.time)} {formatTime(alert.time)}
                            </div>
                            {!alert.acknowledged && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 text-[9px] px-1.5 gap-1 text-emerald-400 hover:text-emerald-300"
                                onClick={() => handleAcknowledgeRisk(alert.id)}
                              >
                                <CheckCircle2 className="h-3 w-3" /> Ack
                              </Button>
                            )}
                            {alert.acknowledged && (
                              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Acked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {riskAlerts.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-6">
                    No active risk alerts
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════
            HISTORY TAB
            ════════════════════════════════════════════════════════════ */}
        <TabsContent value="history" className="space-y-4">
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-medium">Alert History</CardTitle>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {unackHistoryCount > 0 && (
                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                      {unackHistoryCount} unacknowledged
                    </Badge>
                  )}
                  <span className="font-mono">{alertHistory.length} entries</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[520px] overflow-y-auto custom-scrollbar space-y-2">
                {alertHistory.map(entry => (
                  <div
                    key={entry.id}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      !entry.acknowledged
                        ? getHistorySeverityBg(entry.type)
                        : 'bg-secondary/10 border-border/25 opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: entry info */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{entry.alert_name}</span>
                          {alertTypeBadge(entry.type)}
                          {channelBadge(entry.channel)}
                          {!entry.acknowledged && (
                            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-400 border-amber-500/30 border">
                              NEW
                            </Badge>
                          )}
                        </div>
                        <div className={cn(
                          'text-xs leading-relaxed',
                          !entry.acknowledged ? 'text-zinc-300' : 'text-muted-foreground'
                        )}>
                          {entry.message}
                        </div>
                      </div>
                      {/* Right: time + action */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="text-[10px] text-muted-foreground font-mono tabular-nums whitespace-nowrap">
                          {formatDate(entry.time)} {formatTime(entry.time)}
                        </div>
                        {!entry.acknowledged && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[9px] px-2 gap-1 text-emerald-400 hover:text-emerald-300"
                            onClick={() => handleAcknowledgeHistory(entry.id)}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Acknowledge
                          </Button>
                        )}
                        {entry.acknowledged && (
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Acked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {alertHistory.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No alert history yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* History Legend */}
          <div className="flex items-center gap-4 flex-wrap text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/40" /> Risk alert
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" /> Trade alert
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500/40" /> VIX alert
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/40" /> Price alert
            </span>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Footer Note ── */}
      <div className="text-[10px] text-muted-foreground text-center pb-2">
        Alert rules and history based on mock data for demonstration. Live alerts require engine connection.
        &middot; DDLJ Trading System v9
      </div>
    </div>
  );
}

// ── Utility: severity-based left-border for history entries ──

function getHistorySeverityBg(type: AlertHistoryEntry['type']): string {
  switch (type) {
    case 'risk':
      return 'bg-red-500/5 border-red-500/20 border-l-2 border-l-red-500/50';
    case 'trade':
      return 'bg-emerald-500/5 border-emerald-500/20 border-l-2 border-l-emerald-500/50';
    case 'vix':
      return 'bg-purple-500/5 border-purple-500/20 border-l-2 border-l-purple-500/50';
    case 'price':
      return 'bg-amber-500/5 border-amber-500/20 border-l-2 border-l-amber-500/50';
    default:
      return 'bg-secondary/30 border-border/50';
  }
}
