'use client';

/**
 * DDLJ Alerts & Notifications Page
 * ==================================
 * Configure alert rules, Telegram settings, and view alert history.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { mockAlertConfigs, mockAlertHistory, mockTelegramConfig, type AlertConfig, type TelegramConfig } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bell, Send, Plus, ToggleLeft, CheckCircle2, AlertTriangle, Wifi, WifiOff, MessageSquare, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

export function AlertsPage() {
  const [alertConfigs, setAlertConfigs] = useState(mockAlertConfigs);
  const [telegramConfig, setTelegramConfig] = useState(mockTelegramConfig);
  const [isTestSending, setIsTestSending] = useState(false);
  const [newAlertOpen, setNewAlertOpen] = useState(false);

  const toggleAlert = (id: string) => {
    setAlertConfigs(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    toast.success('Alert rule updated');
  };

  const handleTestTelegram = () => {
    setIsTestSending(true);
    setTimeout(() => {
      setTelegramConfig(prev => ({ ...prev, last_test: new Date().toISOString(), last_test_success: true }));
      setIsTestSending(false);
      toast.success('Test message sent to Telegram!');
    }, 1500);
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <Card className="bg-card/80 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Alerts & Notifications</CardTitle>
              <CardDescription>Configure alert rules, Telegram notifications, and view alert history</CardDescription>
            </div>
            <Dialog open={newAlertOpen} onOpenChange={setNewAlertOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New Alert Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Alert Rule</DialogTitle>
                  <DialogDescription>Define a new alert condition and notification channel</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Alert Name</Label>
                    <Input placeholder="e.g., Nifty Above 25000" className="h-9 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Alert Type</Label>
                      <Select defaultValue="price">
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="price">Price Alert</SelectItem>
                          <SelectItem value="vix">VIX Alert</SelectItem>
                          <SelectItem value="trade">Trade Alert</SelectItem>
                          <SelectItem value="risk">Risk Alert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Channel</Label>
                      <Select defaultValue="both">
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="telegram">Telegram Only</SelectItem>
                          <SelectItem value="in_app">In-App Only</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Condition</Label>
                    <Select defaultValue="above">
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above">Price above threshold</SelectItem>
                        <SelectItem value="below">Price below threshold</SelectItem>
                        <SelectItem value="crosses">Price crosses threshold</SelectItem>
                        <SelectItem value="vix_high">VIX above threshold</SelectItem>
                        <SelectItem value="on_trade">On every trade</SelectItem>
                        <SelectItem value="daily_loss">Daily loss exceeds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Threshold Value</Label>
                    <Input type="number" placeholder="e.g., 25000" className="h-9 text-sm font-mono" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewAlertOpen(false)}>Cancel</Button>
                  <Button onClick={() => { toast.success('Alert rule created'); setNewAlertOpen(false); }}>Create Rule</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="rules" className="gap-1.5 text-xs"><Settings2 className="h-3.5 w-3.5" /> Alert Rules</TabsTrigger>
          <TabsTrigger value="telegram" className="gap-1.5 text-xs"><MessageSquare className="h-3.5 w-3.5" /> Telegram</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" /> History</TabsTrigger>
        </TabsList>

        {/* Alert Rules */}
        <TabsContent value="rules">
          <div className="space-y-2">
            {alertConfigs.map((alert) => (
              <Card key={alert.id} className={cn('bg-card/80 border', alert.enabled ? 'border-border' : 'border-border/50 opacity-60')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                        alert.type === 'price' ? 'bg-blue-500/20 text-blue-400' :
                        alert.type === 'vix' ? 'bg-amber-500/20 text-amber-400' :
                        alert.type === 'trade' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-red-500/20 text-red-400'
                      )}>
                        <Bell className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{alert.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {alert.condition} | Threshold: {alert.threshold}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {alert.channels.map((ch) => (
                          <Badge key={ch} variant="outline" className="text-[8px] px-1 h-4">
                            {ch === 'telegram' ? 'TG' : 'APP'}
                          </Badge>
                        ))}
                      </div>
                      <Badge variant={alert.type === 'price' ? 'outline' : alert.type === 'vix' ? 'secondary' : alert.type === 'trade' ? 'default' : 'destructive'} className="text-[9px]">
                        {alert.type}
                      </Badge>
                      <Switch checked={alert.enabled} onCheckedChange={() => toggleAlert(alert.id)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Telegram Configuration */}
        <TabsContent value="telegram">
          <div className="max-w-2xl space-y-4">
            <Card className={cn('bg-card/80 border', telegramConfig.enabled ? 'border-emerald-500/20' : 'border-border')}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', telegramConfig.enabled ? 'bg-emerald-500/20' : 'bg-zinc-500/20')}>
                      <MessageSquare className={cn('h-5 w-5', telegramConfig.enabled ? 'text-emerald-400' : 'text-zinc-400')} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">Telegram Bot Configuration</CardTitle>
                      <CardDescription className="text-xs">Configure your Telegram bot for trade alerts and notifications</CardDescription>
                    </div>
                  </div>
                  <Badge variant={telegramConfig.enabled ? 'default' : 'secondary'} className="text-xs">
                    {telegramConfig.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Enable Telegram Notifications</Label>
                  <Switch
                    checked={telegramConfig.enabled}
                    onCheckedChange={(checked) => {
                      setTelegramConfig(prev => ({ ...prev, enabled: checked }));
                      toast.success(checked ? 'Telegram notifications enabled' : 'Telegram notifications disabled');
                    }}
                  />
                </div>
                <Separator className="bg-border" />
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Bot Token</Label>
                    <Input
                      value={telegramConfig.bot_token}
                      onChange={(e) => setTelegramConfig(prev => ({ ...prev, bot_token: e.target.value }))}
                      className="h-9 text-sm font-mono"
                      type="password"
                      placeholder="Enter your Telegram bot token"
                    />
                    <p className="text-[10px] text-muted-foreground">Get this from @BotFather on Telegram. Create a new bot with /newbot command.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Chat ID</Label>
                    <Input
                      value={telegramConfig.chat_id}
                      onChange={(e) => setTelegramConfig(prev => ({ ...prev, chat_id: e.target.value }))}
                      className="h-9 text-sm font-mono"
                      placeholder="Enter your Telegram chat ID"
                    />
                    <p className="text-[10px] text-muted-foreground">Forward a message from your group to @userinfobot to get the chat ID.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleTestTelegram} disabled={isTestSending || !telegramConfig.enabled} className="gap-2">
                    {isTestSending ? <><Send className="h-3.5 w-3.5 animate-pulse" /> Sending...</> : <><Send className="h-3.5 w-3.5" /> Send Test Message</>}
                  </Button>
                  <Button variant="outline" onClick={() => toast.success('Telegram settings saved')}>Save Settings</Button>
                  {telegramConfig.last_test && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {telegramConfig.last_test_success ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3 text-red-400" />}
                      Last test: {telegramConfig.last_test_success ? 'Success' : 'Failed'}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Setup Guide */}
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-amber-400">How to Set Up Telegram Notifications</p>
                    <ol className="text-muted-foreground space-y-1 text-xs list-decimal list-inside">
                      <li>Open Telegram and search for @BotFather</li>
                      <li>Send /newbot and follow instructions to create a bot</li>
                      <li>Copy the bot token and paste it above</li>
                      <li>Create a group/channel and add your bot as admin</li>
                      <li>Send a message in the group, then forward it to @userinfobot to get the chat ID</li>
                      <li>Paste the chat ID above and click Send Test Message</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alert History */}
        <TabsContent value="history">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Alert History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {mockAlertHistory.map((entry) => (
                    <div key={entry.id} className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border',
                      !entry.acknowledged ? 'bg-secondary/50 border-border' : 'bg-transparent border-border/30',
                    )}>
                      <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                        entry.type === 'trade' ? 'bg-emerald-500/20 text-emerald-400' :
                        entry.type === 'risk' ? 'bg-red-500/20 text-red-400' :
                        entry.type === 'vix' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      )}>
                        {entry.type === 'trade' ? <Send className="h-3.5 w-3.5" /> :
                         entry.type === 'risk' ? <AlertTriangle className="h-3.5 w-3.5" /> :
                         <Bell className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{entry.alert_name}</span>
                          {!entry.acknowledged && <span className="w-1.5 h-1.5 rounded-full bg-red-400 pulse-dot" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{entry.message}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-[8px] px-1 h-4">{entry.channel === 'telegram' ? 'TG' : 'APP'}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(entry.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
