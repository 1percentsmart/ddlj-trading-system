'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function JournalPage() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Trading Journal</h1>
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-6 text-center text-muted-foreground">
          Journal entries coming soon.
        </CardContent>
      </Card>
    </div>
  );
}
