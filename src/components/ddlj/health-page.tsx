'use client';

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function HealthPage() {
  const { healthStatus } = useDDLJStore();

  const statusIcon = healthStatus?.status === 'healthy' ? (
    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
  ) : healthStatus?.status === 'degraded' ? (
    <AlertTriangle className="h-6 w-6 text-amber-400" />
  ) : (
    <XCircle className="h-6 w-6 text-red-400" />
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {statusIcon}
            <div>
              <p className="font-semibold text-lg capitalize">{healthStatus?.status || 'Unknown'}</p>
              {healthStatus?.reason && <p className="text-sm text-muted-foreground">{healthStatus.reason}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Engine Running:</span>{' '}
              <Badge variant={healthStatus?.engine_running ? 'default' : 'secondary'}>
                {healthStatus?.engine_running ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Token Valid:</span>{' '}
              <Badge variant={healthStatus?.token_valid ? 'default' : 'secondary'}>
                {healthStatus?.token_valid ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
