'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Trade } from '@/lib/api';

interface PnlChartProps {
  trades: Trade[];
}

export function PnlChart({ trades }: PnlChartProps) {
  const data = useMemo(() => {
    if (!trades || trades.length < 2) return [];

    const sorted = [...trades].sort(
      (a, b) => new Date(a.exit_time).valueOf() - new Date(b.exit_time).valueOf()
    );

    let runningPnl = 0;
    return sorted.map((trade) => {
      runningPnl += Number(trade.net || 0);
      return {
        time: new Date(trade.exit_time).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        pnl: Number(runningPnl.toFixed(2)),
      };
    });
  }, [trades]);

  if (data.length === 0) return null;

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Equity Curve</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={42} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`₹${Number(value).toLocaleString('en-IN')}`, 'P&L']}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#pnlFill)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default PnlChart;
