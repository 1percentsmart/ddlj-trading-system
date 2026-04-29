'use client';

/**
 * DDLJ Trading Journal Page
 * ===========================
 * Pre/post trade rationale, emotional state tracking,
 * pattern analytics, and journal entry management.
 */

import { useState } from 'react';
import { cn, formatCurrency, pnlColor, formatDate, formatTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Trophy,
  AlertTriangle,
  Brain,
  Clock,
  Tag,
  MessageSquareText,
  Activity,
} from 'lucide-react';
import {
  mockJournalEntries,
  mockJournalAnalytics,
  type JournalEntry,
  type EmotionalState,
} from '@/lib/mock-data';

// ── Emotion Color Map ──────────────────────────────────────────────

const emotionConfig: Record<EmotionalState, {
  label: string;
  badgeClass: string;
  dotClass: string;
}> = {
  confident:   { label: 'Confident',   badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',   dotClass: 'bg-emerald-400' },
  patient:     { label: 'Patient',     badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',           dotClass: 'bg-blue-400' },
  disciplined: { label: 'Disciplined',  badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',  dotClass: 'bg-emerald-400' },
  calm:        { label: 'Calm',        badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',              dotClass: 'bg-sky-400' },
  anxious:     { label: 'Anxious',     badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',        dotClass: 'bg-amber-400' },
  fomo:        { label: 'FOMO',        badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30',     dotClass: 'bg-orange-400' },
  revenge:     { label: 'Revenge',     badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',             dotClass: 'bg-red-400' },
  excited:     { label: 'Excited',     badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',    dotClass: 'bg-purple-400' },
};

// ── Helpers ────────────────────────────────────────────────────────

function emotionBadge(state: EmotionalState) {
  const cfg = emotionConfig[state];
  return (
    <Badge className={cn('text-[9px] px-1.5 py-0 h-4 border gap-1', cfg.badgeClass)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dotClass)} />
      {cfg.label}
    </Badge>
  );
}

function directionBadge(direction: 'LONG' | 'SHORT') {
  if (direction === 'LONG') {
    return (
      <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        LONG
      </Badge>
    );
  }
  return (
    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-red-500/15 text-red-400 border border-red-500/30">
      SHORT
    </Badge>
  );
}

function formatShortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

// ── Journal Entry Card ─────────────────────────────────────────────

function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  const [expanded, setExpanded] = useState(false);

  const isWin = entry.pnl !== null && entry.pnl > 0;
  const isLoss = entry.pnl !== null && entry.pnl < 0;

  const borderClass = isWin
    ? 'border-l-2 border-l-emerald-500/60'
    : isLoss
      ? 'border-l-2 border-l-red-500/60'
      : 'border-l-2 border-l-zinc-500/30';

  const RATIONALE_MAX = 100;

  const truncatedRationale =
    entry.pre_trade_rationale.length > RATIONALE_MAX && !expanded
      ? entry.pre_trade_rationale.slice(0, RATIONALE_MAX) + '...'
      : entry.pre_trade_rationale;

  const truncatedReview =
    entry.post_trade_review && entry.post_trade_review.length > RATIONALE_MAX && !expanded
      ? entry.post_trade_review!.slice(0, RATIONALE_MAX) + '...'
      : entry.post_trade_review;

  const hasLongContent =
    entry.pre_trade_rationale.length > RATIONALE_MAX ||
    (entry.post_trade_review !== null && entry.post_trade_review.length > RATIONALE_MAX);

  return (
    <div
      className={cn(
        'rounded-lg border bg-secondary/30 border-border/50 p-4 transition-colors',
        borderClass
      )}
    >
      {/* ── Header Row ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="font-mono text-xs text-muted-foreground">{entry.trade_id}</span>
          <span className="font-medium text-sm">{entry.symbol}</span>
          {directionBadge(entry.direction)}
          {emotionBadge(entry.emotional_state)}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {entry.pnl !== null && (
            <div className="flex items-center gap-1.5">
              {isWin ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : isLoss ? (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              ) : null}
              <span
                className={cn(
                  'font-mono font-semibold text-sm tabular-nums',
                  pnlColor(entry.pnl)
                )}
              >
                {entry.pnl >= 0 ? '+' : ''}
                {formatCurrency(entry.pnl)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Pre-trade Rationale ── */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <MessageSquareText className="h-3 w-3" />
          <span className="font-medium uppercase tracking-wide">Pre-Trade Rationale</span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">{truncatedRationale}</p>
      </div>

      {/* ── Post-trade Review (if available) ── */}
      {entry.post_trade_review && (
        <div className="mt-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <MessageSquareText className="h-3 w-3" />
            <span className="font-medium uppercase tracking-wide">Post-Trade Review</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">{truncatedReview}</p>
        </div>
      )}

      {/* ── Tags + Times + Expand ── */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {entry.tags.map(tag => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[8px] px-1.5 py-0 h-3.5 font-mono"
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Entry/Exit times */}
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <div className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              <span>{formatShortDate(entry.entry_time)} {formatShortTime(entry.entry_time)}</span>
            </div>
            {entry.exit_time && (
              <>
                <span className="text-border">→</span>
                <span>{formatShortDate(entry.exit_time)} {formatShortTime(entry.exit_time)}</span>
              </>
            )}
          </div>

          {/* Expand/collapse button */}
          {hasLongContent && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-zinc-200"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" /> Less</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> More</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ── Mobile times row ── */}
      <div className="sm:hidden mt-2 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
        <Clock className="h-2.5 w-2.5" />
        <span>{formatShortDate(entry.entry_time)} {formatShortTime(entry.entry_time)}</span>
        {entry.exit_time && (
          <>
            <span className="text-border">→</span>
            <span>{formatShortDate(entry.exit_time)} {formatShortTime(entry.exit_time)}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function JournalPage() {
  const analytics = mockJournalAnalytics;
  const entries = mockJournalEntries;

  const totalEntries = entries.length;
  const winCount = entries.filter(e => e.pnl !== null && e.pnl > 0).length;
  const lossCount = entries.filter(e => e.pnl !== null && e.pnl < 0).length;

  return (
    <div className="space-y-4 p-4 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Trading Journal</h1>
          <p className="text-xs text-muted-foreground">
            Log pre/post trade rationale, emotional state, and review your trading patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono gap-1">
            <Activity className="h-3 w-3" />
            {totalEntries} entries
          </Badge>
          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {winCount}W
          </Badge>
          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-red-500/15 text-red-400 border border-red-500/30">
            {lossCount}L
          </Badge>
        </div>
      </div>

      {/* ── Analytics Summary Card ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Pattern Analytics</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Best & Worst Patterns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Trophy className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">
                  Best Pattern
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">{analytics.best_pattern}</p>
            </div>
            <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-[10px] font-medium text-red-400 uppercase tracking-wide">
                  Worst Pattern
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">{analytics.worst_pattern}</p>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Emotion Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Tag className="h-3 w-3" />
              <span className="font-medium uppercase tracking-wide">Emotional State Breakdown</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.entries(analytics.by_emotion) as [EmotionalState, { count: number; win_rate: number; avg_pnl: number }][]).map(
                ([emotion, data]) => {
                  const cfg = emotionConfig[emotion];
                  return (
                    <div
                      key={emotion}
                      className={cn(
                        'rounded-lg border p-2.5 space-y-1',
                        cfg.badgeClass
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium capitalize">{cfg.label}</span>
                        <span className="font-mono text-[10px] tabular-nums">{data.count}x</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] opacity-70">Win Rate</span>
                        <span className="font-mono text-[10px] tabular-nums font-semibold">
                          {data.win_rate.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] opacity-70">Avg P&L</span>
                        <span
                          className={cn(
                            'font-mono text-[10px] tabular-nums font-semibold',
                            data.avg_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          )}
                        >
                          {data.avg_pnl >= 0 ? '+' : ''}₹{Math.abs(data.avg_pnl).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Journal Entries ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">Journal Entries</CardTitle>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {entries.length} entries
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar space-y-2">
            {entries.map(entry => (
              <JournalEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
          {entries.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              No journal entries yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 flex-wrap text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded bg-emerald-500/60" /> Winning trade
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded bg-red-500/60" /> Losing trade
        </span>
      </div>

      {/* ── Footer Note ── */}
      <div className="text-[10px] text-muted-foreground text-center pb-2">
        Journal entries and analytics based on mock data for demonstration. Live journaling requires engine connection.
        &middot; DDLJ Trading System v9
      </div>
    </div>
  );
}
