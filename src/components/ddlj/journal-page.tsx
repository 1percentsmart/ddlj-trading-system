'use client';

/**
 * DDLJ Trade Journal Page (Enhanced)
 * =====================================
 * Screenshot upload (drag & drop + thumbnail), review summary,
 * specific trading rules checklist, discipline streak counter.
 */

import { useState, useCallback } from 'react';
import { cn, formatCurrency, pnlColor } from '@/lib/utils';
import { mockJournalEntries, mockJournalAnalytics, type EmotionalState, type JournalEntry } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { BookOpen, SmilePlus, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Brain, Tag, Plus, Upload, Camera, CheckSquare, Flame, Calendar, Award, ImageIcon, X, GripVertical } from 'lucide-react';
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

// The 4 specific trading rules checklist items as requested
const tradingRules = [
  { id: 'r1', label: 'Trend confirmed?', description: 'Market bias direction verified on higher timeframe' },
  { id: 'r2', label: 'Risk defined?', description: 'Stop loss and position size calculated before entry' },
  { id: 'r3', label: 'Setup matches plan?', description: 'Entry signal aligns with your trading strategy' },
  { id: 'r4', label: 'Not trading on emotion?', description: 'No FOMO, revenge, or impulsive decisions' },
];

export function JournalPage() {
  const [entries, setEntries] = useState(mockJournalEntries);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const analytics = mockJournalAnalytics;
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [screenshotFile, setScreenshotFile] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [newEntrySymbol, setNewEntrySymbol] = useState('BANKNIFTY');
  const [newEntryDirection, setNewEntryDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [newEntryEmotion, setNewEntryEmotion] = useState<EmotionalState>('confident');
  const [newEntryRationale, setNewEntryRationale] = useState('');
  const [newEntryTags, setNewEntryTags] = useState('');

  // Discipline streak: consecutive trades from the end where all 4 rules were checked
  // Using mock data — we simulate that recent trades had rules checked
  const [tradeRuleHistory] = useState<Record<string, boolean[]>>({
    T001: [true, true, true, true],
    T002: [true, true, true, true],
    T003: [true, true, false, false], // FOMO trade — rules broken
    T004: [true, true, true, true],
    T007: [false, false, false, false], // Revenge trade — all broken
    T005: [true, true, true, true],
    T006: [true, true, true, true],
    T008: [true, true, true, true],
  });

  // Calculate discipline streak from most recent trade backward
  const disciplineStreak = (() => {
    const tradeIds = [...entries].reverse().map(e => e.trade_id);
    let streak = 0;
    for (const tid of tradeIds) {
      const rules = tradeRuleHistory[tid];
      if (rules && rules.every(r => r)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  })();

  // Total disciplined trades
  const totalDisciplinedTrades = Object.values(tradeRuleHistory).filter(rules => rules.every(r => r)).length;
  const totalTradesWithRules = Object.keys(tradeRuleHistory).length;
  const disciplineRate = totalTradesWithRules > 0 ? Math.round((totalDisciplinedTrades / totalTradesWithRules) * 100) : 0;

  const emotionChart = Object.entries(analytics.by_emotion).map(([emotion, data]) => ({
    emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
    avg_pnl: data.avg_pnl,
    win_rate: data.win_rate,
    count: data.count,
  }));

  // Weekly review summary (enhanced)
  const winningTrades = entries.filter(e => e.pnl !== null && e.pnl > 0);
  const losingTrades = entries.filter(e => e.pnl !== null && e.pnl < 0);
  const winRate = entries.length > 0 ? Math.round((winningTrades.length / entries.filter(e => e.pnl !== null).length) * 100) : 0;

  const weeklySummary = {
    totalTrades: entries.length,
    netPnl: entries.reduce((sum, e) => sum + (e.pnl || 0), 0),
    winRate,
    bestTrade: entries.reduce((best, e) => (e.pnl && e.pnl > (best?.pnl || 0)) ? e : best, entries[0]),
    worstTrade: entries.reduce((worst, e) => (e.pnl && e.pnl < (worst?.pnl || 0)) ? e : worst, entries[0]),
    mostCommonEmotion: 'disciplined' as EmotionalState,
    rulesFollowed: totalDisciplinedTrades,
    rulesBroken: totalTradesWithRules - totalDisciplinedTrades,
    recommendation: 'Continue focusing on disciplined entries. Avoid revenge trading after losses — implement a 15-minute cool-down period.',
  };

  const allRulesChecked = tradingRules.every(r => checkedRules[r.id]);
  const checkedCount = Object.values(checkedRules).filter(Boolean).length;

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      setScreenshotFile(files[0].name);
      // Create a mock preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        setScreenshotPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(files[0]);
      toast.success('Screenshot uploaded successfully');
    } else {
      toast.error('Please drop an image file (PNG, JPG)');
    }
  }, []);

  const handleFileSelect = useCallback(() => {
    // Simulate file selection with mock data
    setScreenshotFile('chart_screenshot_2026-04-27.png');
    setScreenshotPreview('mock-screenshot');
    toast.info('Screenshot uploaded (demo)');
  }, []);

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
              <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Journal Entry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Symbol</Label>
                      <Select value={newEntrySymbol} onValueChange={setNewEntrySymbol}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BANKNIFTY">BankNifty</SelectItem>
                          <SelectItem value="NIFTY">Nifty</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Direction</Label>
                      <Select value={newEntryDirection} onValueChange={(v) => setNewEntryDirection(v as 'LONG' | 'SHORT')}>
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
                        <button key={state} className={cn('flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs hover:bg-secondary transition-colors',
                          newEntryEmotion === state ? 'bg-primary/10 border-primary/30' : 'bg-secondary/50 border-border'
                        )} onClick={() => setNewEntryEmotion(state as EmotionalState)}>
                          <span>{emoji}</span>
                          <span className="capitalize">{state}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Pre-Trade Rationale</Label>
                    <Textarea placeholder="Why are you entering this trade? What's the setup?" className="text-xs min-h-[80px]" value={newEntryRationale} onChange={(e) => setNewEntryRationale(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tags</Label>
                    <Input placeholder="ema-crossover, trend-following, plan-followed" className="h-9 text-xs" value={newEntryTags} onChange={(e) => setNewEntryTags(e.target.value)} />
                  </div>

                  {/* Screenshot Upload - Drag & Drop with Thumbnail */}
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1.5"><Camera className="h-3 w-3" /> Trade Screenshot</Label>
                    <div
                      className={cn(
                        'border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer',
                        isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30',
                        screenshotFile ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                      )}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={handleFileSelect}
                    >
                      {screenshotFile ? (
                        <div className="space-y-2">
                          {screenshotPreview && screenshotPreview !== 'mock-screenshot' ? (
                            <div className="relative inline-block">
                              <img src={screenshotPreview} alt="Trade chart screenshot preview" className="max-h-32 rounded-lg border border-border" />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setScreenshotFile(null);
                                  setScreenshotPreview(null);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 h-12 rounded-lg bg-secondary/50 border border-border flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-1.5">
                                  <CheckSquare className="h-4 w-4 text-emerald-400" />
                                  <span className="text-sm text-emerald-400">{screenshotFile}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Screenshot attached</p>
                              </div>
                            </div>
                          )}
                          <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => {
                            e.stopPropagation();
                            setScreenshotFile(null);
                            setScreenshotPreview(null);
                          }}>Remove</Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground">
                            {isDragging ? 'Drop image here' : 'Drag & drop chart screenshot or click to upload'}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Trading Rules Checklist (4 specific items) */}
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1.5"><CheckSquare className="h-3 w-3" /> Pre-Trade Checklist</Label>
                    <div className="space-y-2 p-3 rounded-lg bg-secondary/30 border border-border">
                      {tradingRules.map((rule, i) => (
                        <div key={rule.id} className={cn(
                          'flex items-start gap-2 p-2 rounded-lg transition-colors',
                          checkedRules[rule.id] ? 'bg-emerald-500/5' : ''
                        )}>
                          <Checkbox
                            id={rule.id}
                            checked={checkedRules[rule.id] || false}
                            onCheckedChange={(checked) => setCheckedRules(prev => ({ ...prev, [rule.id]: !!checked }))}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <label htmlFor={rule.id} className="text-sm font-medium cursor-pointer">{rule.label}</label>
                            <p className="text-[10px] text-muted-foreground">{rule.description}</p>
                          </div>
                          {checkedRules[rule.id] && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[8px]">✓</Badge>
                          )}
                        </div>
                      ))}
                      <Separator className="my-2" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{checkedCount}/{tradingRules.length} rules checked</span>
                        {allRulesChecked ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[9px] gap-1">
                            <CheckSquare className="h-3 w-3" /> All Clear — Ready to Trade!
                          </Badge>
                        ) : (
                          <span className="text-amber-400 text-[10px]">Complete all rules before trading</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewEntryOpen(false)}>Cancel</Button>
                  <Button onClick={() => {
                    if (!newEntryRationale.trim()) {
                      toast.error('Please enter a pre-trade rationale');
                      return;
                    }
                    const newEntry: JournalEntry = {
                      id: `J${String(entries.length + 1).padStart(3, '0')}`,
                      trade_id: `T${String(entries.length + 1).padStart(3, '0')}`,
                      symbol: newEntrySymbol,
                      direction: newEntryDirection,
                      entry_time: new Date().toISOString(),
                      exit_time: null,
                      pre_trade_rationale: newEntryRationale.trim(),
                      post_trade_review: null,
                      emotional_state: newEntryEmotion,
                      tags: newEntryTags.split(',').map(t => t.trim()).filter(Boolean),
                      pnl: null,
                      screenshot_url: screenshotFile,
                    };
                    setEntries(prev => [newEntry, ...prev]);
                    toast.success('Journal entry created');
                    setNewEntryOpen(false);
                    setNewEntryRationale('');
                    setNewEntryTags('');
                    setScreenshotFile(null);
                    setScreenshotPreview(null);
                  }}>Save Entry</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Discipline Streak + Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <Card className="bg-card/80 border-emerald-500/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Flame className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Discipline Streak</div>
              <div className="text-2xl font-bold font-mono text-emerald-400">{disciplineStreak}</div>
              <div className="text-[9px] text-muted-foreground">consecutive trades</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Total Entries</div>
              <div className="text-lg font-bold font-mono">{entries.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Award className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Discipline Rate</div>
              <div className="text-lg font-bold font-mono text-amber-400">{disciplineRate}%</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Win Rate</div>
              <div className="text-lg font-bold font-mono">{winRate}%</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <SmilePlus className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Best Emotion</div>
              <div className="text-sm font-bold text-emerald-400">Disciplined</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discipline Progress */}
      <Card className="bg-card/80 border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium">Rules Compliance</span>
            </div>
            <span className="text-xs text-muted-foreground">{totalDisciplinedTrades}/{totalTradesWithRules} trades followed all rules</span>
          </div>
          <Progress value={disciplineRate} className="h-2" />
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
            <span>0%</span>
            <span className={cn('font-medium', disciplineRate >= 70 ? 'text-emerald-400' : disciplineRate >= 40 ? 'text-amber-400' : 'text-red-400')}>
              {disciplineRate >= 70 ? 'Excellent discipline!' : disciplineRate >= 40 ? 'Room for improvement' : 'Needs attention'}
            </span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="entries" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" /> Entries</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs"><Brain className="h-3.5 w-3.5" /> Analytics</TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" /> Review</TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5 text-xs"><CheckSquare className="h-3.5 w-3.5" /> Checklist</TabsTrigger>
        </TabsList>

        {/* Journal Entries */}
        <TabsContent value="entries">
          <div className="space-y-3">
            {entries.map((entry) => {
              const ruleHistory = tradeRuleHistory[entry.trade_id];
              const allRulesFollowed = ruleHistory ? ruleHistory.every(r => r) : null;
              return (
                <Card key={entry.id} className={cn('bg-card/80 border', entry.pnl && entry.pnl >= 0 ? 'border-emerald-500/10' : 'border-red-500/10')}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-lg', entry.direction === 'LONG' ? 'bg-emerald-500/20' : 'bg-red-500/20')}>
                          {emotionEmojis[entry.emotional_state]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{entry.symbol}</span>
                            <Badge variant={entry.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px] gap-1">
                              {entry.direction === 'LONG' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {entry.direction}
                            </Badge>
                            <Badge variant="outline" className={cn('text-[10px] capitalize', emotionColors[entry.emotional_state])}>
                              {entry.emotional_state}
                            </Badge>
                            {allRulesFollowed !== null && (
                              <Badge className={cn('text-[9px]', allRulesFollowed ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/20 text-red-400 hover:bg-red-500/20')}>
                                {allRulesFollowed ? '✓ All Rules' : '✗ Rules Broken'}
                              </Badge>
                            )}
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

                    <div className="flex items-center gap-3 flex-wrap mt-2">
                      {entry.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          {entry.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 h-4">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      {entry.screenshot_url && (
                        <Badge variant="outline" className="text-[9px] gap-1"><Camera className="h-2.5 w-2.5" /> Screenshot</Badge>
                      )}
                    </div>

                    {/* Show rule checklist for this trade */}
                    {ruleHistory && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-3">
                          {tradingRules.map((rule, i) => (
                            <div key={rule.id} className={cn(
                              'w-2 h-2 rounded-full',
                              ruleHistory[i] ? 'bg-emerald-400' : 'bg-red-400'
                            )} title={`${rule.label}: ${ruleHistory[i] ? 'Checked' : 'Unchecked'}`} />
                          ))}
                          <span className="text-[10px] text-muted-foreground">
                            {ruleHistory.filter(Boolean).length}/{tradingRules.length} rules
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Journal Analytics */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average P&L by Emotional State</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 sm:h-64">
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

            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Win Rate by Emotional State</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 sm:h-64">
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

        {/* Weekly/Monthly Review (Enhanced) */}
        <TabsContent value="review">
          <div className="space-y-4">
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Weekly Review Summary
                </CardTitle>
                <CardDescription className="text-xs">Period: Apr 21 – Apr 27, 2026</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border text-center">
                    <div className="text-[10px] text-muted-foreground">Total Trades</div>
                    <div className="text-xl font-bold font-mono">{weeklySummary.totalTrades}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border text-center">
                    <div className="text-[10px] text-muted-foreground">Win Rate</div>
                    <div className={cn('text-xl font-bold font-mono', weeklySummary.winRate >= 50 ? 'text-emerald-400' : 'text-red-400')}>{weeklySummary.winRate}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border text-center">
                    <div className="text-[10px] text-muted-foreground">Net P&L</div>
                    <div className={cn('text-xl font-bold font-mono', pnlColor(weeklySummary.netPnl))}>{formatCurrency(weeklySummary.netPnl)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border text-center">
                    <div className="text-[10px] text-muted-foreground">Rules Compliance</div>
                    <div className="text-xl font-bold font-mono text-emerald-400">{disciplineRate}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border text-center">
                    <div className="text-[10px] text-muted-foreground">Rules Followed</div>
                    <div className="text-lg font-bold font-mono text-emerald-400">{weeklySummary.rulesFollowed}/{totalTradesWithRules}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border text-center">
                    <div className="text-[10px] text-muted-foreground">Rules Broken</div>
                    <div className="text-lg font-bold font-mono text-red-400">{weeklySummary.rulesBroken}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                    <div className="text-[10px] text-muted-foreground">Best Trade</div>
                    <div className="text-lg font-bold font-mono text-emerald-400">
                      {weeklySummary.bestTrade?.pnl ? `+${formatCurrency(weeklySummary.bestTrade.pnl)}` : 'N/A'}
                    </div>
                    <div className="text-[9px] text-muted-foreground">{weeklySummary.bestTrade?.symbol} #{weeklySummary.bestTrade?.trade_id}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-center">
                    <div className="text-[10px] text-muted-foreground">Worst Trade</div>
                    <div className="text-lg font-bold font-mono text-red-400">
                      {weeklySummary.worstTrade?.pnl ? formatCurrency(weeklySummary.worstTrade.pnl) : 'N/A'}
                    </div>
                    <div className="text-[9px] text-muted-foreground">{weeklySummary.worstTrade?.symbol} #{weeklySummary.worstTrade?.trade_id}</div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Most Common Emotional State</div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{emotionEmojis[weeklySummary.mostCommonEmotion]}</span>
                      <span className="text-sm font-medium capitalize text-emerald-400">{weeklySummary.mostCommonEmotion}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Recommendation</div>
                    <p className="text-sm text-foreground/90">{weeklySummary.recommendation}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <div className="text-[10px] text-muted-foreground">Best Performing Emotion</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg">{emotionEmojis['disciplined']}</span>
                        <span className="text-sm font-medium capitalize text-emerald-400">Disciplined</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <div className="text-[10px] text-muted-foreground">Worst Performing Emotion</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg">{emotionEmojis['revenge']}</span>
                        <span className="text-sm font-medium capitalize text-red-400">Revenge</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trading Rules Checklist */}
        <TabsContent value="checklist">
          <Card className="bg-card/80 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckSquare className="h-4 w-4" /> Trading Rules Checklist
              </CardTitle>
              <CardDescription className="text-xs">Check off each rule before entering a trade to maintain discipline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tradingRules.map((rule, i) => (
                  <div key={rule.id} className={cn(
                    'flex items-start gap-3 p-4 rounded-lg border transition-colors',
                    checkedRules[rule.id] ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-secondary/30 border-border'
                  )}>
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                      checkedRules[rule.id] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-secondary text-muted-foreground'
                    )}>
                      {checkedRules[rule.id] ? '✓' : i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`checklist-${rule.id}`}
                          checked={checkedRules[rule.id] || false}
                          onCheckedChange={(checked) => setCheckedRules(prev => ({ ...prev, [rule.id]: !!checked }))}
                        />
                        <label htmlFor={`checklist-${rule.id}`} className="text-sm font-medium cursor-pointer">{rule.label}</label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-7">{rule.description}</p>
                    </div>
                    {checkedRules[rule.id] && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[9px]">Passed</Badge>
                    )}
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{checkedCount}/{tradingRules.length} rules checked</span>
                  <div className="w-24">
                    <Progress value={(checkedCount / tradingRules.length) * 100} className="h-2" />
                  </div>
                </div>
                {allRulesChecked ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 gap-1">
                    <CheckSquare className="h-3 w-3" /> All Clear — Ready to Trade!
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                    const all: Record<string, boolean> = {};
                    tradingRules.forEach(r => all[r.id] = true);
                    setCheckedRules(all);
                    toast.success('All rules checked!');
                  }}>
                    Check All
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
