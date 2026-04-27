'use client';

/**
 * DDLJ Alerts & Notifications Page (Enhanced)
 * ==============================================
 * Alert scheduling, priority levels, test alert, bulk toggle,
 * search/filter by text, type, and priority.
 */

import { useState, useMemo } from 'react';
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
import { Bell, Send, Plus, CheckCircle2, AlertTriangle, MessageSquare, Settings2, Clock, Zap, FlaskConical, ToggleLeft, ToggleRight, Search, Filter, Info } from 'lucide-react';
import { toast } from 'sonner';

type AlertPriority = 'critical' | 'high' | 'medium' | 'low';

interface EnhancedAlertConfig extends AlertConfig {
  priority?: AlertPriority;
  marketHoursOnly?: boolean;
}

export function AlertsPage() {
  const [alertConfigs, setAlertConfigs] = useState<EnhancedAlertConfig[]>(
    mockAlertConfigs.map((ac, i) => ({
      ...ac,
      priority: (['critical', 'high', 'medium', 'low'][i % 4]) as AlertPriority,
      marketHoursOnly: i % 2 === 0,
    }))
  );
  const [telegramConfig, setTelegramConfig] = useState(mockTelegramConfig);
  const [isTestSending, setIsTestSending] = useState(false);
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const [testingAlert, setTestingAlert] = useState<string | null>(null);
  const [newAlertName, setNewAlertName] = useState('');
  const [newAlertType, setNewAlertType] = useState<string>('price');
  const [newAlertChannel, setNewAlertChannel] = useState<string>('both');
  const [newAlertPriority, setNewAlertPriority] = useState<string>('medium');
  const [newAlertSchedule, setNewAlertSchedule] = useState<string>('market_hours');
  const [newAlertCondition, setNewAlertCondition] = useState<string>('above');
  const [newAlertThreshold, setNewAlertThreshold] = useState('');

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');

  const toggleAlert = (id: string) => {
    setAlertConfigs(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    toast.success('Alert rule updated');
  };

  const bulkToggle = (enabled: boolean) => {
    setAlertConfigs(prev => prev.map(a => ({ ...a, enabled })));
    toast.success(`All alerts ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleTestTelegram = () => {
    setIsTestSending(true);
    setTimeout(() => {
      setTelegramConfig(prev => ({ ...prev, last_test: new Date().toISOString(), last_test_success: true }));
      setIsTestSending(false);
      toast.success('Test message sent to Telegram!');
    }, 1500);
  };

  const handleTestAlert = (id: string) => {
    setTestingAlert(id);
    setTimeout(() => {
      setTestingAlert(null);
      toast.success('Test alert triggered successfully!');
    }, 1000);
  };

  const priorityConfig: Record<AlertPriority, { label: string; color: string; bgColor: string; borderColor: string }> = {
    critical: { label: 'Critical', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/20' },
    high: { label: 'High', color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/20' },
    medium: { label: 'Medium', color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/20' },
    low: { label: 'Low', color: 'text-zinc-400', bgColor: 'bg-zinc-500/20', borderColor: 'border-zinc-500/20' },
  };

  const enabledCount = alertConfigs.filter(a => a.enabled).length;

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alertConfigs.filter(alert => {
      const matchesSearch = searchQuery === '' ||
        alert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.threshold.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || alert.type === filterType;
      const matchesPriority = filterPriority === 'all' || alert.priority === filterPriority;
      const matchesEnabled = filterEnabled === 'all' ||
        (filterEnabled === 'enabled' && alert.enabled) ||
        (filterEnabled === 'disabled' && !alert.enabled);
      return matchesSearch && matchesType && matchesPriority && matchesEnabled;
    });
  }, [alertConfigs, searchQuery, filterType, filterPriority, filterEnabled]);

  // Filtered history
  const [historySearch, setHistorySearch] = useState('');
  const filteredHistory = useMemo(() => {
    if (!historySearch) return mockAlertHistory;
    return mockAlertHistory.filter(h =>
      h.alert_name.toLowerCase().includes(historySearch.toLowerCase()) ||
      h.message.toLowerCase().includes(historySearch.toLowerCase())
    );
  }, [historySearch]);

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
      {/* Header */}
      <Card className="bg-card/80 border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Alerts & Notifications</CardTitle>
              <CardDescription>Configure alert rules, Telegram notifications, and view alert history</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => bulkToggle(true)} disabled={enabledCount === alertConfigs.length}>
                <ToggleRight className="h-3.5 w-3.5" /> Enable All
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => bulkToggle(false)} disabled={enabledCount === 0}>
                <ToggleLeft className="h-3.5 w-3.5" /> Disable All
              </Button>
              <Dialog open={newAlertOpen} onOpenChange={setNewAlertOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> New Alert Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Alert Rule</DialogTitle>
                    <DialogDescription>Define a new alert condition and notification channel</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Alert Name</Label>
                      <Input placeholder="e.g., Nifty Above 25000" className="h-9 text-sm" value={newAlertName} onChange={(e) => setNewAlertName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Alert Type</Label>
                        <Select value={newAlertType} onValueChange={setNewAlertType}>
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
                        <Select value={newAlertChannel} onValueChange={setNewAlertChannel}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="telegram">Telegram Only</SelectItem>
                            <SelectItem value="in_app">In-App Only</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Priority</Label>
                        <Select value={newAlertPriority} onValueChange={setNewAlertPriority}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Schedule</Label>
                        <Select value={newAlertSchedule} onValueChange={setNewAlertSchedule}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="always">Always</SelectItem>
                            <SelectItem value="market_hours">Market Hours Only</SelectItem>
                            <SelectItem value="outside_hours">Outside Market Hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Condition</Label>
                      <Select value={newAlertCondition} onValueChange={setNewAlertCondition}>
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
                      <Input type="number" placeholder="e.g., 25000" className="h-9 text-sm font-mono" value={newAlertThreshold} onChange={(e) => setNewAlertThreshold(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewAlertOpen(false)}>Cancel</Button>
                    <Button onClick={() => {
                      if (!newAlertName.trim()) {
                        toast.error('Please enter an alert name');
                        return;
                      }
                      const channels: ('telegram' | 'in_app')[] = newAlertChannel === 'telegram' ? ['telegram'] : newAlertChannel === 'in_app' ? ['in_app'] : ['telegram', 'in_app'];
                      const conditionMap: Record<string, string> = { above: 'price > threshold', below: 'price < threshold', crosses: 'price crosses threshold', vix_high: 'vix > threshold', on_trade: 'on_trade_entry', daily_loss: 'daily_loss > threshold' };
                      setAlertConfigs(prev => [...prev, {
                        id: `AC${Date.now()}`,
                        name: newAlertName.trim(),
                        type: newAlertType as 'price' | 'vix' | 'trade' | 'risk',
                        condition: conditionMap[newAlertCondition] || 'price > threshold',
                        threshold: newAlertThreshold || 'Any',
                        channels,
                        enabled: true,
                        priority: newAlertPriority as AlertPriority,
                        marketHoursOnly: newAlertSchedule === 'market_hours',
                      }]);
                      toast.success('Alert rule created');
                      setNewAlertOpen(false);
                      setNewAlertName('');
                      setNewAlertThreshold('');
                    }}>Create Rule</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Priority Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {(['critical', 'high', 'medium', 'low'] as AlertPriority[]).map((priority) => {
          const pCfg = priorityConfig[priority];
          const count = alertConfigs.filter(a => a.priority === priority).length;
          const enabledP = alertConfigs.filter(a => a.priority === priority && a.enabled).length;
          return (
            <Card key={priority} className={cn('bg-card/80 border', pCfg.borderColor)}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', pCfg.bgColor)}>
                  {priority === 'critical' ? <AlertTriangle className={cn('h-4 w-4', pCfg.color)} /> :
                   priority === 'high' ? <Zap className={cn('h-4 w-4', pCfg.color)} /> :
                   priority === 'medium' ? <Bell className={cn('h-4 w-4', pCfg.color)} /> :
                   <Info className={cn('h-4 w-4', pCfg.color)} />}
                </div>
                <div>
                  <div className={cn('text-sm font-semibold', pCfg.color)}>{pCfg.label}</div>
                  <div className="text-xs text-muted-foreground">{enabledP}/{count} active</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="rules" className="gap-1.5 text-xs"><Settings2 className="h-3.5 w-3.5" /> Alert Rules ({enabledCount}/{alertConfigs.length})</TabsTrigger>
          <TabsTrigger value="telegram" className="gap-1.5 text-xs"><MessageSquare className="h-3.5 w-3.5" /> Telegram</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" /> History</TabsTrigger>
        </TabsList>

        {/* Alert Rules */}
        <TabsContent value="rules">
          {/* Search and Filter Bar */}
          <Card className="bg-card/80 border-border mb-4">
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search alerts by name, condition, threshold..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-xs pl-8"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-8 text-[10px] w-24"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="vix">VIX</SelectItem>
                      <SelectItem value="trade">Trade</SelectItem>
                      <SelectItem value="risk">Risk</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="h-8 text-[10px] w-28"><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterEnabled} onValueChange={setFilterEnabled}>
                    <SelectTrigger className="h-8 text-[10px] w-24"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(searchQuery || filterType !== 'all' || filterPriority !== 'all' || filterEnabled !== 'all') && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>Showing {filteredAlerts.length} of {alertConfigs.length} rules</span>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                    setFilterPriority('all');
                    setFilterEnabled('all');
                  }}>Clear filters</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            {filteredAlerts.length === 0 ? (
              <Card className="bg-card/80 border-border">
                <CardContent className="p-8 text-center">
                  <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No alert rules match your filters</p>
                  <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                    setFilterPriority('all');
                    setFilterEnabled('all');
                  }}>Clear all filters</Button>
                </CardContent>
              </Card>
            ) : (
              filteredAlerts.map((alert) => {
                const priority = alert.priority || 'medium';
                const pConfig = priorityConfig[priority];
                return (
                  <Card key={alert.id} className={cn('bg-card/80 border', alert.enabled ? `border-border ${pConfig.borderColor}` : 'border-border/50 opacity-60')}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                            alert.type === 'price' ? 'bg-blue-500/20 text-blue-400' :
                            alert.type === 'vix' ? 'bg-amber-500/20 text-amber-400' :
                            alert.type === 'trade' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-red-500/20 text-red-400'
                          )}>
                            <Bell className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{alert.name}</span>
                              <Badge className={cn('text-[9px]', pConfig.bgColor, pConfig.color, 'hover:' + pConfig.bgColor)}>
                                {pConfig.label}
                              </Badge>
                              {alert.marketHoursOnly && (
                                <Badge variant="outline" className="text-[8px] gap-0.5">
                                  <Clock className="h-2.5 w-2.5" /> Mkt Hrs
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {alert.condition} | Threshold: {alert.threshold}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                          <div className="hidden sm:flex items-center gap-1">
                            {alert.channels.map((ch) => (
                              <Badge key={ch} variant="outline" className="text-[8px] px-1 h-4">
                                {ch === 'telegram' ? 'TG' : 'APP'}
                              </Badge>
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[9px] gap-1"
                            disabled={!alert.enabled || testingAlert === alert.id}
                            onClick={() => handleTestAlert(alert.id)}
                          >
                            <FlaskConical className={cn('h-3 w-3', testingAlert === alert.id && 'animate-spin')} />
                            {testingAlert === alert.id ? 'Testing...' : 'Test'}
                          </Button>
                          <Switch checked={alert.enabled} onCheckedChange={() => toggleAlert(alert.id)} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
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
                    <Input value={telegramConfig.bot_token} onChange={(e) => setTelegramConfig(prev => ({ ...prev, bot_token: e.target.value }))} className="h-9 text-sm font-mono" type="password" placeholder="Enter your Telegram bot token" />
                    <p className="text-[10px] text-muted-foreground">Get this from @BotFather on Telegram. Create a new bot with /newbot command.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Chat ID</Label>
                    <Input value={telegramConfig.chat_id} onChange={(e) => setTelegramConfig(prev => ({ ...prev, chat_id: e.target.value }))} className="h-9 text-sm font-mono" placeholder="Enter your Telegram chat ID" />
                    <p className="text-[10px] text-muted-foreground">Forward a message from your group to @userinfobot to get the chat ID.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
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
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium">Alert History</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search history..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="h-7 text-xs pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px] sm:h-[500px]">
                <div className="space-y-1.5">
                  {filteredHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No history matching search</div>
                  ) : (
                    filteredHistory.map((entry) => (
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
                            {!entry.acknowledged && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{entry.message}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className="text-[8px] px-1 h-4">{entry.channel === 'telegram' ? 'TG' : 'APP'}</Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(entry.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
