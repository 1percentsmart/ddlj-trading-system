'use client';

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatDuration } from '@/lib/utils';
import { Play, Square, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function EnginePage() {
  const { engineStatus, isEngineLoading, startEngine, stopEngine } = useDDLJStore();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Engine</h1>
        <div className="flex gap-2">
          <Button
            onClick={startEngine}
            disabled={engineStatus.engine_running || isEngineLoading}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isEngineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start
          </Button>
          <Button
            onClick={stopEngine}
            disabled={!engineStatus.engine_running || isEngineLoading}
            variant="destructive"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      </div>
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {engineStatus.engine_running ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            ) : (
              <XCircle className="h-6 w-6 text-red-400" />
            )}
            <div>
              <p className="font-semibold text-lg">
                {engineStatus.engine_running ? 'Engine Running' : 'Engine Stopped'}
              </p>
              {engineStatus.uptime_seconds ? (
                <p className="text-sm text-muted-foreground">Uptime: {formatDuration(engineStatus.uptime_seconds)}</p>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Initialized:</span>{' '}
              <Badge variant={engineStatus.initialized ? 'default' : 'secondary'}>{engineStatus.initialized ? 'Yes' : 'No'}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Errors:</span> {engineStatus.error_count}
            </div>
            <div>
              <span className="text-muted-foreground">Token Stored:</span>{' '}
              <Badge variant={engineStatus.token.stored ? 'default' : 'secondary'}>{engineStatus.token.stored ? 'Yes' : 'No'}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Token Valid:</span>{' '}
              <Badge variant={engineStatus.token.valid ? 'default' : 'secondary'}>{engineStatus.token.valid ? 'Yes' : 'No'}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
