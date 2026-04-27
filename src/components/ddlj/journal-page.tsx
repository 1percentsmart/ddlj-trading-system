'use client';

/**
 * DDLJ Trade Journal Page
 * =========================
 * Trade notes, emotional tracking, journal analytics.
 */

import { useState } from 'react';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { mockJournalEntries, mockJournalAnalytics, type EmotionalState, type JournalEntry } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookOpen, SmilePlus, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Brain, Tag, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { toast } from 'sonner';

const emotionEmojis: Record<EmotionalState, string> = {
  confident: '💪',
  patient: '🧘',
  disciplined: '🎯',
  calm: '😌',
  excited: '🤩',
  anxious: '😰',
  fomo: '😱',
  revenge: '😤',
};

const emotionColors: Record<EmotionalState, string> = {
  confident: 'text-emerald-400',
  patient: 'text-blue-400',
  disciplined: 'text-purple-400',
  calm: 'text-cyan-400',
  excited: 'text-amber-400',
  anxious: 'text-orange-400',
  fomo: 'text-red-400',
  revenge: 'text-red-500',
};

export function JournalPage() {
  const [entries, setEntries] = useState(mockJournalEntries);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const analytics = mockJournalAnalytics;

  const emotionChart = Object.entries(analytics.by_emotion).map(([emotion, data]) => ({
    emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
    avg_pnl: data.avg_pnl,
    win_rate: data.win_rate,
    count: data.count,
  }));

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
      {/* Header */}
      <Card className="bg-card/80 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Trade Journal</CardTitle>
              <CardDescription>Track your emotional state, rationales, and learn from every trade</CardDescription>
            </div>
            <Dialog open={newEntryOpen} onOpenChange={setNewEntryOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New Journal Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>New Journal Entry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Symbol</Label>
                      <Select defaultValue="BANKNIFTY">
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BANKNIFTY">BankNifty</SelectItem>
                          <SelectItem value="NIFTY">Nifty</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Direction</Label>
                      <Select defaultValue="LONG">
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LONG">Long</SelectItem>
                          <SelectItem value="SHORT">Short</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Emotional State</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(emotionEmojis).map(([state, emoji]) => (
                        <button key={state} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-secondary/50 border border-border text-xs hover:bg-secondary transition-colors">
                          <span>{emoji}</span>
                          <span className="capitalize">{state}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Pre-Trade Rationale</Label>
                    <Textarea placeholder="Why are you entering this trade? What's the setup?" className="text-xs min-h-[80px]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tags</Label>
                    <Input placeholder="ema-crossover, trend-following, plan-followed" className="h-9 text-xs" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewEntryOpen(false)}>Cancel</Button>
                  <Button onClick={() => { toast.success('Journal entry created'); setNewEntryOpen(false); }}>Save Entry</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="entries" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" /> Entries</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs"><Brain className="h-3.5 w-3.5" /> Analytics</TabsTrigger>
        </TabsList>

        {/* Journal Entries */}
        <TabsContent value="entries">
          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.id} className={cn('bg-card/80 border', entry.pnl && entry.pnl >= 0 ? 'border-emerald-500/10' : 'border-red-500/10')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-lg', entry.direction === 'LONG' ? 'bg-emerald-500/20' : 'bg-red-500/20')}>
                        {emotionEmojis[entry.emotional_state]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{entry.symbol}</span>
                          <Badge variant={entry.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px] gap-1">
                            {entry.direction === 'LONG' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {entry.direction}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[10px] capitalize', emotionColors[entry.emotional_state])}>
                            {entry.emotional_state}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.entry_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} | Trade #{entry.trade_id}
                        </div>
                      </div>
                    </div>
                    {entry.pnl !== null && (
                      <div className={cn('text-lg font-bold font-mono tabular-nums', pnlColor(entry.pnl))}>
                        {entry.pnl >= 0 ? '+' : ''}{formatCurrency(entry.pnl)}
                      </div>
                    )}
                  </div>

                  {entry.pre_trade_rationale && (
                    <div className="mb-2">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Pre-Trade Rationale</div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{entry.pre_trade_rationale}</p>
                    </div>
                  )}

                  {entry.post_trade_review && (
                    <div className="mb-2">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Post-Trade Review</div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{entry.post_trade_review}</p>
                    </div>
                  )}

                  {entry.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      {entry.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 h-4">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Journal Analytics */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance by Emotion */}
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average P&L by Emotional State</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={emotionChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                      <YAxis dataKey="emotion" type="category" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} width={90} />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }} formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Avg P&L']} />
                      <ReferenceLine x={0} stroke="var(--muted-foreground)" />
                      <Bar dataKey="avg_pnl" radius={[0, 4, 4, 0]} barSize={18}>
                        {emotionChart.map((entry, index) => (
                          <Cell key={index} fill={entry.avg_pnl >= 0 ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Win Rate by Emotion */}
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Win Rate by Emotional State</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={emotionChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <YAxis dataKey="emotion" type="category" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} width={90} />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }} formatter={(value: number) => [`${value}%`, 'Win Rate']} />
                      <ReferenceLine x={50} stroke="var(--muted-foreground)" strokeDasharray="5 5" />
                      <Bar dataKey="win_rate" radius={[0, 4, 4, 0]} barSize={18}>
                        {emotionChart.map((entry, index) => (
                          <Cell key={index} fill={entry.win_rate >= 50 ? '#22c55e' : entry.win_rate >= 30 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Insights */}
            <Card className="bg-emerald-500/5 border-emerald-500/20 lg:col-span-2">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-medium text-emerald-400 text-sm">Journal Insights</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Best Pattern</div>
                        <p className="text-sm mt-1">{analytics.best_pattern}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Worst Pattern</div>
                        <p className="text-sm mt-1 text-red-400">{analytics.worst_pattern}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Your win rate is highest when you trade with <span className="text-emerald-400 font-medium">confidence</span> (75%) and <span className="text-purple-400 font-medium">discipline</span> (73.3%). 
                      Revenge trading has a 0% win rate — consider implementing a cool-down period after consecutive losses.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
