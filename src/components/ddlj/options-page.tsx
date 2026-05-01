'use client';

/**
 * DDLJ Trading System — Options Chain Page
 * =============================================
 * Options chain view with strike prices, premiums,
 * Greeks, and option trading information.
 */

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn, formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, BarChart3, Activity, Info } from 'lucide-react';

export default function OptionsPage() {
  const { trades, positions, isConnected } = useDDLJStore();

  const optionsTrades = trades.filter(t => t.mode === 'options' || t.option_type);
  const optionsPositions = positions.filter(p => p.option_type);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Options Chain</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View options trading data, strikes, and premiums from live market
        </p>
      </div>

      {/* Connection Warning */}
      {!isConnected && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-300">
              <Info className="h-4 w-4" />
              <p className="text-sm">Backend is offline. Options chain requires a live connection to the Kite API.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="positions">Open Positions</TabsTrigger>
          <TabsTrigger value="history">Options History</TabsTrigger>
          <TabsTrigger value="info">How It Works</TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Open Option Positions</CardTitle>
              <CardDescription>Currently held options positions with strike and premium info</CardDescription>
            </CardHeader>
            <CardContent>
              {optionsPositions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="font-medium">No open option positions</p>
                  <p className="text-sm">Positions will appear here when the engine enters options trades</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Symbol</TableHead>
                      <TableHead className="text-xs">Direction</TableHead>
                      <TableHead className="text-xs">Strike</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-right">Qty</TableHead>
                      <TableHead className="text-xs text-right">Entry Premium</TableHead>
                      <TableHead className="text-xs text-right">Current Premium</TableHead>
                      <TableHead className="text-xs text-right">Unrealized P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {optionsPositions.map((p, i) => (
                      <TableRow key={i} className="text-xs">
                        <TableCell className="font-medium">{p.symbol}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[10px]', p.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400')}>
                            {p.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{p.option_strike ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {p.option_type ?? '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right font-mono">—</TableCell>
                        <TableCell className="text-right font-mono">
                          {p.current_premium ? formatCurrency(p.current_premium) : '—'}
                        </TableCell>
                        <TableCell className={cn('text-right font-mono', p.unrealized_pnl && p.unrealized_pnl > 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {p.unrealized_pnl ? formatCurrency(p.unrealized_pnl) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Options Trade History</CardTitle>
              <CardDescription>Completed options trades with entry/exit premiums</CardDescription>
            </CardHeader>
            <CardContent>
              {optionsTrades.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="font-medium">No options trades yet</p>
                  <p className="text-sm">Run the engine or backtest to generate options trade data</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Symbol</TableHead>
                        <TableHead className="text-xs">Direction</TableHead>
                        <TableHead className="text-xs">Strike</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs text-right">Entry Premium</TableHead>
                        <TableHead className="text-xs text-right">Exit Premium</TableHead>
                        <TableHead className="text-xs text-right">Net P&L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {optionsTrades.map((t, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="font-medium">{t.symbol}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px]', t.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400')}>
                              {t.direction}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{t.option_strike ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{t.option_type ?? '—'}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {t.option_entry_premium ? formatCurrency(t.option_entry_premium) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {t.option_exit_premium ? formatCurrency(t.option_exit_premium) : '—'}
                          </TableCell>
                          <TableCell className={cn('text-right font-semibold font-mono', t.net > 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {formatCurrency(t.net)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">How Options Trading Works in DDLJ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The DDLJ trading system uses an <strong className="text-foreground">Options Mimicry Engine</strong> that
                generates signals based on the underlying index (BankNifty/Nifty) futures, then translates those
                signals into options trades. Here is how the process works:
              </p>
              <div className="space-y-2">
                <p><strong className="text-foreground">1. Signal Generation:</strong> The EMA crossover signal engine analyzes candle data on the entry timeframe (5m, 15m) to identify potential trade entries. The bias engine confirms the directional bias on the higher timeframe (60m).</p>
                <p><strong className="text-foreground">2. Strike Selection:</strong> Based on the moneyness setting (ATM, ITM, Deep ITM), the system selects the appropriate option strike price. ITM options have higher delta and move more like the underlying, while ATM options are cheaper but riskier.</p>
                <p><strong className="text-foreground">3. Premium Estimation:</strong> Using Black-Scholes pricing with India VIX for implied volatility, the system estimates entry and exit premiums for each trade. Spread costs are applied based on the configured spread regime.</p>
                <p><strong className="text-foreground">4. Risk Management:</strong> Each trade has a defined stop-loss and target based on the signal ATR. Position sizing uses the daily risk percentage and max lots settings to control exposure.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
