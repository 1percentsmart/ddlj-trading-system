'use client';

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency, pnlColor, formatDateTime } from '@/lib/utils';

export function TradesPage() {
  const { trades } = useDDLJStore();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Trade History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {trades.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No trades yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Exit</TableHead>
                  <TableHead>Net P&L</TableHead>
                  <TableHead>Exit Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{t.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', t.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400')}>
                        {t.direction}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(t.entry)}</TableCell>
                    <TableCell>{formatCurrency(t.exit)}</TableCell>
                    <TableCell className={cn('font-mono', pnlColor(t.net))}>{formatCurrency(t.net)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{t.exit_reason}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
