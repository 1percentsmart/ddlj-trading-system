'use client';

/**
 * DDLJ Trading System — Alerts Page
 * ======================================
 * Alert configuration with trade notifications,
 * risk alerts, and system alerts.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Bell, BellOff, MessageSquare, AlertTriangle, TrendingUp,
  TrendingDown, Shield, Zap, Smartphone, Mail, Settings,
} from 'lucide-react';

interface AlertConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  category: 'trades' | 'risk' | 'system';
}

const defaultAlerts: AlertConfig[] = [
  { id: 'trade_entry', label: 'Trade Entry', description: 'Notify when a new trade is entered', icon: TrendingUp, enabled: true, category: 'trades' },
  { id: 'trade_exit', label: 'Trade Exit', description: 'Notify when a trade is closed (SL, Target, EOD)', icon: TrendingDown, enabled: true, category: 'trades' },
  { id: 'daily_summary', label: 'Daily Summary', description: 'End-of-day P&L summary', icon: Bell, enabled: true, category: 'trades' },
  { id: 'drawdown_alert', label: 'Drawdown Alert', description: 'Alert when drawdown exceeds threshold', icon: AlertTriangle, enabled: true, category: 'risk' },
  { id: 'max_trades', label: 'Max Trades Reached', description: 'Alert when daily trade limit is reached', icon: Shield, enabled: true, category: 'risk' },
  { id: 'circuit_breaker', label: 'Circuit Breaker', description: 'Alert when circuit breaker is triggered', icon: Zap, enabled: true, category: 'risk' },
  { id: 'token_expiry', label: 'Token Expiry', description: 'Alert when Kite token is about to expire', icon: Smartphone, enabled: true, category: 'system' },
  { id: 'engine_start', label: 'Engine Start', description: 'Notify when trading engine starts', icon: Settings, enabled: false, category: 'system' },
  { id: 'engine_stop', label: 'Engine Stop', description: 'Notify when trading engine stops', icon: BellOff, enabled: false, category: 'system' },
];

// ── AlertSection Component (declared OUTSIDE render to avoid React warning) ──
function AlertSection({ title, description, items, onToggle }: {
  title: string;
  description: string;
  items: AlertConfig[];
  onToggle: (id: string) => void;
}) {
  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((alert, i) => {
          const Icon = alert.icon;
          return (
            <div key={alert.id}>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-1.5 rounded-lg',
                    alert.enabled ? 'bg-emerald-500/10' : 'bg-muted/50'
                  )}>
                    <Icon className={cn('h-4 w-4', alert.enabled ? 'text-emerald-400' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{alert.label}</p>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                  </div>
                </div>
                <Switch
                  checked={alert.enabled}
                  onCheckedChange={() => onToggle(alert.id)}
                />
              </div>
              {i < items.length - 1 && <Separator />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertConfig[]>(defaultAlerts);
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const tradeAlerts = alerts.filter(a => a.category === 'trades');
  const riskAlerts = alerts.filter(a => a.category === 'risk');
  const systemAlerts = alerts.filter(a => a.category === 'system');

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure trade notifications, risk alerts, and system notifications
        </p>
      </div>

      {/* Delivery Channel */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Delivery Channel
          </CardTitle>
          <CardDescription>Configure where alerts are sent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Telegram Notifications</p>
                  <p className="text-xs text-muted-foreground">Send alerts to your Telegram chat</p>
                </div>
              </div>
              <Switch checked={telegramEnabled} onCheckedChange={setTelegramEnabled} />
            </div>
            {telegramEnabled && (
              <div className="ml-7 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Bot Token</label>
                  <Input
                    type="password"
                    placeholder="Enter Telegram bot token..."
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Chat ID</label>
                  <Input
                    placeholder="Enter your Telegram chat ID..."
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="h-8 text-sm mt-1"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alert Categories */}
      <AlertSection
        title="Trade Alerts"
        description="Notifications about trade entries, exits, and daily performance"
        items={tradeAlerts}
        onToggle={toggleAlert}
      />
      <AlertSection
        title="Risk Alerts"
        description="Warnings about drawdown, position limits, and circuit breakers"
        items={riskAlerts}
        onToggle={toggleAlert}
      />
      <AlertSection
        title="System Alerts"
        description="Engine status, token expiry, and system notifications"
        items={systemAlerts}
        onToggle={toggleAlert}
      />
    </div>
  );
}
