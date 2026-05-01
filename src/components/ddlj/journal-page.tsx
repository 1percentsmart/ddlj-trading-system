'use client';

/**
 * DDLJ Trading System — Trading Journal Page
 * ================================================
 * Trade journal with notes, tags, and review capabilities.
 */

import { useState, useMemo } from 'react';
import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatCurrency, pnlColor, formatDateTime } from '@/lib/utils';
import {
  BookOpen, Plus, Search, Star, Tag, MessageSquare,
  TrendingUp, TrendingDown, Filter, Calendar,
} from 'lucide-react';

interface JournalEntry {
  id: string;
  tradeDate: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  pnl: number;
  tags: string[];
  notes: string;
  rating: number; // 1-5 stars
}

export default function JournalPage() {
  const { trades } = useDDLJStore();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newTags, setNewTags] = useState('');
  const [selectedRating, setSelectedRating] = useState(3);

  // Auto-create journal entries from trades
  const tradeEntries: JournalEntry[] = useMemo(() => {
    return trades.map((t, i) => ({
      id: `trade-${i}`,
      tradeDate: t.entry_time,
      symbol: t.symbol,
      direction: t.direction as 'LONG' | 'SHORT',
      pnl: t.net,
      tags: [t.exit_reason, t.direction],
      notes: '',
      rating: t.net > 0 ? 4 : t.net === 0 ? 3 : 2,
    }));
  }, [trades]);

  const allEntries = [...entries, ...tradeEntries].sort((a, b) =>
    new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime()
  );

  const totalPnl = allEntries.reduce((s, e) => s + e.pnl, 0);
  const avgRating = allEntries.length > 0
    ? allEntries.reduce((s, e) => s + e.rating, 0) / allEntries.length
    : 0;

  const addManualEntry = () => {
    if (!newNote.trim()) return;
    setEntries(prev => [{
      id: `manual-${Date.now()}`,
      tradeDate: new Date().toISOString(),
      symbol: 'Manual',
      direction: 'LONG' as const,
      pnl: 0,
      tags: newTags ? newTags.split(',').map(t => t.trim()) : ['manual'],
      notes: newNote,
      rating: selectedRating,
    }, ...prev]);
    setNewNote('');
    setNewTags('');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trading Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review trades, add notes, and track your trading psychology
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <BookOpen className="h-3 w-3" />
            {allEntries.length} entries
          </Badge>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Total Entries</p>
            <p className="text-lg font-bold">{allEntries.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Total P&L</p>
            <p className={cn('text-lg font-bold', pnlColor(totalPnl))}>{formatCurrency(totalPnl)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Avg Rating</p>
            <p className="text-lg font-bold flex items-center gap-1">
              {avgRating.toFixed(1)} <Star className="h-4 w-4 text-amber-400" />
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Manual Notes</p>
            <p className="text-lg font-bold">{entries.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Note */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Journal Note
          </CardTitle>
          <CardDescription>Record observations, market conditions, or lessons learned</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="What did you learn or observe today?"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Input
              placeholder="Tags (comma separated)..."
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="flex-1"
            />
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setSelectedRating(star)}>
                  <Star className={cn(
                    'h-4 w-4 cursor-pointer',
                    star <= selectedRating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'
                  )} />
                </button>
              ))}
            </div>
            <Button size="sm" onClick={addManualEntry} disabled={!newNote.trim()}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Journal Entries */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Journal Entries</CardTitle>
          <CardDescription>All trade and manual entries</CardDescription>
        </CardHeader>
        <CardContent>
          {allEntries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="font-medium">No journal entries yet</p>
              <p className="text-sm">Entries will appear as trades are executed or you add manual notes</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {allEntries.map((entry, i) => (
                <div key={entry.id} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-semibold border-0',
                            entry.direction === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                          )}
                        >
                          {entry.direction}
                        </Badge>
                        <span className="text-sm font-medium">{entry.symbol}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.tradeDate ? formatDateTime(entry.tradeDate) : '—'}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground">{entry.notes}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        {entry.tags.map((tag, j) => (
                          <Badge key={j} variant="outline" className="text-[9px] px-1 py-0">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('font-semibold font-mono text-sm', pnlColor(entry.pnl))}>
                        {entry.pnl !== 0 ? formatCurrency(entry.pnl) : '—'}
                      </p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} className={cn(
                            'h-3 w-3',
                            star <= entry.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'
                          )} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
