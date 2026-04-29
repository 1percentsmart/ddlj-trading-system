"use client";

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClass?: string;
}

export function SummaryCard({ title, value, sub, valueClass }: SummaryCardProps) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/70 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </div>
        <div className={cn('mt-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl', valueClass)}>
          {value}
        </div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export default SummaryCard;
