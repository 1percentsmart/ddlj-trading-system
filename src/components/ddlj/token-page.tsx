'use client';

/**
 * DDLJ Token Management — Simplified
 * =====================================
 * Token status, login URL from API, real token exchange.
 */

import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  KeyRound,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  RefreshCw,
  LogIn,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useRef } from 'react';
import { tokenApi } from '@/lib/api';

export function TokenPage() {
  const {
    engineStatus,
    tokenStatus,
    loginUrl,
    fetchTokenStatus,
    fetchLoginUrl,
    exchangeToken,
    fetchStatus,
  } = useDDLJStore();

  const [requestToken, setRequestToken] = useState('');
  const [isExchanging, setIsExchanging] = useState(false);
  const [copied, setCopied] = useState(false);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState('');
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [totalDuration] = useState(24 * 3600 * 1000); // 24h

  useEffect(() => {
    fetchTokenStatus();
    fetchLoginUrl();
  }, [fetchTokenStatus, fetchLoginUrl]);

  // Token expiry countdown — backend doesn't expose expires_at in status,
  // so we'll show the token validity state
  useEffect(() => {
    // We don't have expires_at from the API, so no countdown timer
    // If backend adds it later, we can restore this
  }, []);

  const handleOpenLogin = () => {
    const url = loginUrl || 'https://kite.trade/connect/login';
    window.open(url, '_blank');
  };

  const handleCopyUrl = () => {
    const url = loginUrl || 'https://kite.trade/connect/login';
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Login URL copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExchange = async () => {
    if (!requestToken.trim()) {
      toast.error('Please enter a request token');
      return;
    }
    setIsExchanging(true);
    try {
      const result = await exchangeToken(requestToken);
      await fetchStatus();
      toast.success(`Token exchanged! Connected as ${result.user}`);
      setRequestToken('');
    } catch (err) {
      toast.error(`Token exchange failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExchanging(false);
    }
  };

  const isValid = engineStatus.token.valid || (tokenStatus?.valid ?? false);
  const userName = engineStatus.token.user || tokenStatus?.user || null;

  // Circular countdown (placeholder — shows N/A since backend doesn't provide expiry)
  const countdownRadius = 52;
  const countdownCircumference = 2 * Math.PI * countdownRadius;
  const countdownOffset = 0; // No data for countdown

  return (
    <div className="space-y-4 p-4 max-w-2xl">
      {/* ── Token Status ── */}
      <Card className={cn('bg-card/60 border', isValid ? 'border-emerald-500/20' : 'border-red-500/20')}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                isValid ? 'bg-emerald-500/20' : 'bg-red-500/20'
              )}>
                <KeyRound className={cn('h-5 w-5', isValid ? 'text-emerald-400' : 'text-red-400')} />
              </div>
              <div>
                <CardTitle className="text-lg">Kite API Token</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Zerodha Kite Connect authentication</p>
              </div>
            </div>
            <Badge variant={isValid ? 'default' : 'destructive'} className="text-xs gap-1">
              {isValid ? (
                <><CheckCircle2 className="h-3 w-3" /> Valid</>
              ) : (
                <><AlertTriangle className="h-3 w-3" /> {engineStatus.token.stored ? 'Expired' : 'Not Set'}</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            {/* Circular Indicator */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={countdownRadius} fill="none" stroke="var(--secondary)" strokeWidth="5" />
                <circle
                  cx="60" cy="60" r={countdownRadius} fill="none"
                  stroke={isValid ? '#22c55e' : '#ef4444'}
                  strokeWidth="5"
                  strokeDasharray={isValid ? countdownCircumference : 0}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Clock className={cn('h-4 w-4 mb-0.5', isValid ? 'text-emerald-400' : 'text-red-400')} />
                <span className={cn('text-sm font-bold font-mono', isValid ? 'text-emerald-400' : 'text-red-400')}>
                  {isValid ? 'ACTIVE' : 'N/A'}
                </span>
                <span className="text-[9px] text-muted-foreground">token</span>
              </div>
            </div>

            {/* Status Details */}
            <div className="flex-1 space-y-3">
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Account
                </div>
                <div className="font-mono text-sm mt-1">{userName || 'Not connected'}</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="text-xs text-muted-foreground">Session</div>
                <div className="font-mono text-sm mt-1">
                  {isValid ? 'Authenticated' : 'Not authenticated'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── How to Get Token ── */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Get a New Token</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Kite tokens expire daily. Follow these steps each trading morning.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Open Login */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
            <div className="flex-1">
              <p className="text-sm font-medium">Open the Kite Login URL</p>
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-1.5 text-xs">
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy URL
                </Button>
                <Button size="sm" onClick={handleOpenLogin} className="gap-1.5 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" /> Open Login Page
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Step 2: Authorize */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
            <div>
              <p className="text-sm font-medium">Login to Zerodha</p>
              <p className="text-xs text-muted-foreground mt-0.5">Enter your credentials to authorize the app.</p>
            </div>
          </div>

          <Separator />

          {/* Step 3: Copy token and exchange */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
            <div className="flex-1">
              <p className="text-sm font-medium">Paste and exchange the request_token</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                After login, copy the <code className="font-mono text-primary">request_token</code> from the redirect URL.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Paste request_token here..."
                  value={requestToken}
                  onChange={(e) => setRequestToken(e.target.value)}
                  className="font-mono text-sm h-9"
                />
                <Button
                  onClick={handleExchange}
                  disabled={isExchanging || !requestToken.trim()}
                  className="gap-2 flex-shrink-0 h-9"
                >
                  {isExchanging ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Exchanging...</>
                  ) : (
                    <><LogIn className="h-4 w-4" /> Exchange</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Important Notes ── */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-sm">
              <p className="font-medium text-amber-400">Daily Token Refresh Required</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Kite access tokens expire at midnight IST every day</li>
                <li>You must perform this login flow each trading morning before 9:15 AM</li>
                <li>If the token expires during trading, the engine will pause</li>
                <li>The request_token is single-use and valid for only a few minutes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
