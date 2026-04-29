'use client';

/**
 * DDLJ Backtest Page — Real API Integration
 * =============================================
 * Triggers backtest on the backend and shows results.
 */

import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

interface BacktestConfig {
  label: string;
  net_pnl: number;
  net_pnl_pct: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  max_dd_pct: number;
  sharpe_approx: number;
  avg_trade: number;
}

export function BacktestPage() {
  const { engineStatus, isConnected } = useDDLJStore();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<Record<string, BacktestConfig> | null>(null);
  const [btStatus, setBtStatus] = useState<string>('idle');

  const tokenValid = engineStatus.token?.valid ?? false;

  // Check for existing backtest results on mount
  useEffect(() => {
    checkBacktestStatus();
  }, []);

  const checkBacktestStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/backtest/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'completed' && data.last_results) {
          setBtStatus('completed');
          // Combine method_a and method_b results
          const combined: Record<string, BacktestConfig> = {};
          const methodA = data.last_results.method_a_top || {};
          const methodB = data.last_results.method_b_top || {};
          Object.entries(methodA).forEach(([k, v]: [string, any]) => { combined[`${k} (A)`] = v; });
          Object.entries(methodB).forEach(([k, v]: [string, any]) => { combined[`${k} (B)`] = v; });
          if (Object.keys(combined).length > 0) {
            setResults(combined);
          }
        }
      }
    } catch {
      // Silently ignore — backtest status endpoint may not exist yet
    }
  };

  const handleRunBacktest = async () => {
    if (!tokenValid) {
      toast.error('Kite token is not valid. Please exchange a fresh token first.');
      return;
    }

    setIsRunning(true);
    setBtStatus('running');
    toast.info('Backtest started! This takes 2-5 minutes. Check backend logs for progress.');

    try {
      const res = await fetch(`${API_BASE}/backtest/run`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      const data = await res.json();

      if (data.status === 'error') {
        toast.error(data.message);
        setBtStatus('error');
      } else {
        toast.success(data.message || 'Backtest started in background');
        // Poll for completion every 30 seconds
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${API_BASE}/backtest/status`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.status === 'completed') {
                clearInterval(pollInterval);
                setIsRunning(false);
                setBtStatus('completed');
                toast.success('Backtest completed!');
                checkBacktestStatus();
              }
            }
          } catch {
            // Continue polling
          }
        }, 30000);
      }
    } catch (err) {
      toast.error(`Failed to start backtest: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setBtStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  const sortedResults = results
    ? Object.entries(results).sort((a, b) => b[1].net_pnl - a[1].net_pnl)
    : [];

  return (
    <div className="space-y-4 p-4 max-w-4xl">
      {/* ── Run Backtest Card ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Backtest Engine</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Run DDLJ strategy on historical data (Nov 2025 – Apr 2026)
                </p>
              </div>
            </div>
            <Badge variant={tokenValid ? 'default' : 'destructive'} className="text-xs gap-1">
              {tokenValid ? (
                <><CheckCircle2 className="h-3 w-3" /> Token Valid</>
              ) : (
                <><AlertTriangle className="h-3 w-3" /> Token Required</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The backtest runs the DDLJ v9 strategy with all bug fixes across BankNifty and Nifty
            using 15m/60m and 15m/15m timeframe combinations. It tests both compounding (Method A)
            and monthly batch (Method B) position sizing approaches.
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleRunBacktest}
              disabled={isRunning || !tokenValid || !isConnected}
              className="gap-2"
            >
              {isRunning ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
              ) : (
                <><Play className="h-4 w-4" /> Run Backtest</>
              )}
            </Button>
            {!tokenValid && (
              <p className="text-xs text-amber-400">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Exchange a Kite token first (Token page)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Results ── */}
      {sortedResults.length > 0 && (
        <Card className="bg-card/60 border-border">
          <CardHeader>
            <CardTitle className="text-lg">Backtest Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Config</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Net P&L</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">P&L %</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Win Rate</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Profit Factor</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Trades</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Max DD %</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sharpe</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map(([label, r]) => (
                    <tr key={label} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-2 px-3 font-mono text-xs">{label}</td>
                      <td className={cn('py-2 px-3 text-right font-mono', r.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {r.net_pnl >= 0 ? '+' : ''}₹{r.net_pnl?.toLocaleString()}
                      </td>
                      <td className={cn('py-2 px-3 text-right font-mono', (r.net_pnl_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {r.net_pnl_pct?.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{r.win_rate?.toFixed(0)}%</td>
                      <td className="py-2 px-3 text-right font-mono">{r.profit_factor?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono">{r.total_trades}</td>
                      <td className="py-2 px-3 text-right font-mono text-amber-400">{r.max_dd_pct?.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono">{r.sharpe_approx?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── No Results ── */}
      {btStatus === 'idle' && !results && (
        <Card className="bg-card/60 border-border">
          <CardContent className="py-8 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-1">No Backtest Results Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Click "Run Backtest" above to test the DDLJ strategy on 6 months of historical data.
              You need a valid Kite token to fetch the data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
