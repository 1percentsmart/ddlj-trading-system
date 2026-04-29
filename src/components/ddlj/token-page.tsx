'use client';

/**
 * DDLJ Token Management Page
 * ============================
 * Circular SVG token indicator, 3-step token exchange guide,
 * daily refresh warning card. Fetches tokenStatus + loginUrl on mount.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDDLJStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Constants ────────────────────────────────────────────────────

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ── Main Component ───────────────────────────────────────────────

export default function TokenPage() {
  const {
    engineStatus,
    tokenStatus,
    loginUrl,
    fetchTokenStatus,
    fetchLoginUrl,
    fetchStatus,
    exchangeToken,
  } = useDDLJStore();

  const [requestToken, setRequestToken] = useState('');
  const [isExchanging, setIsExchanging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // ── Fetch token status and login URL on mount ───────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await Promise.allSettled([fetchTokenStatus(), fetchLoginUrl()]);
      } catch {
        // handled by store
      } finally {
        if (!cancelled) setInitialLoad(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchTokenStatus, fetchLoginUrl]);

  // ── Derived state ───────────────────────────────────────────
  const isValid = engineStatus.token.valid || (tokenStatus?.valid ?? false);
  const userName = engineStatus.token.user || tokenStatus?.user || null;

  // ── Handlers ────────────────────────────────────────────────
  const handleOpenLogin = useCallback(() => {
    const url = loginUrl || 'https://kite.trade/connect/login';
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [loginUrl]);

  const handleCopyUrl = useCallback(() => {
    const url = loginUrl || 'https://kite.trade/connect/login';
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        toast.success('Login URL copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        toast.error('Failed to copy URL');
      }
    );
  }, [loginUrl]);

  const handleExchange = useCallback(async () => {
    const trimmed = requestToken.trim();
    if (!trimmed) {
      toast.error('Please enter a request token');
      return;
    }
    setIsExchanging(true);
    try {
      const result = await exchangeToken(trimmed);
      await fetchStatus();
      toast.success(`Token exchanged! Connected as ${result.user}`);
      setRequestToken('');
    } catch (err) {
      toast.error(
        `Token exchange failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsExchanging(false);
    }
  }, [requestToken, exchangeToken, fetchStatus]);

  // ── SVG ring dash values ────────────────────────────────────
  const ringOffset = isValid ? 0 : RING_CIRCUMFERENCE;
  const ringStroke = isValid ? '#22c55e' : '#ef4444';

  return (
    <div className="page-enter space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Token Management</h1>
        <Badge
          variant="outline"
          className={cn(
            'gap-1.5 border-0 self-start',
            isValid
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          )}
        >
          {isValid ? (
            <>
              <CheckCircle2 className="size-3" /> Authenticated
            </>
          ) : (
            <>
              <AlertTriangle className="size-3" /> Not Authenticated
            </>
          )}
        </Badge>
      </div>

      {/* ── Token Status Card ───────────────────────────────────── */}
      <Card
        className={cn(
          'border',
          isValid ? 'border-emerald-500/20' : 'border-red-500/20'
        )}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'size-10 rounded-xl flex items-center justify-center',
                isValid ? 'bg-emerald-500/20' : 'bg-red-500/20'
              )}
            >
              <KeyRound
                className={cn(
                  'size-5',
                  isValid ? 'text-emerald-400' : 'text-red-400'
                )}
              />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">
                Kite API Token
              </CardTitle>
              <CardDescription className="mt-0.5">
                Zerodha Kite Connect authentication
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {/* Circular SVG Indicator */}
            <div className="relative size-28 flex-shrink-0 mx-auto sm:mx-0">
              <svg
                className="size-28 -rotate-90"
                viewBox="0 0 120 120"
                aria-hidden="true"
              >
                {/* Background ring */}
                <circle
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth="6"
                />
                {/* Foreground ring — full if valid, empty if not */}
                <circle
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  fill="none"
                  stroke={ringStroke}
                  strokeWidth="6"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Clock
                  className={cn(
                    'size-4 mb-0.5',
                    isValid ? 'text-emerald-400' : 'text-red-400'
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-bold font-mono',
                    isValid ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {isValid ? 'ACTIVE' : 'N/A'}
                </span>
                <span className="text-[9px] text-muted-foreground">token</span>
              </div>
            </div>

            {/* Status Details */}
            <div className="flex-1 space-y-3 w-full">
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Shield className="size-3" /> Account
                </div>
                <div className="font-mono text-sm">
                  {userName || 'Not connected'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="text-xs text-muted-foreground mb-1">
                  Session
                </div>
                <div className="font-mono text-sm">
                  {isValid ? 'Authenticated' : 'Not authenticated'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Get New Token Card ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Get a New Token</CardTitle>
          <CardDescription>
            Kite tokens expire daily. Follow these steps each trading morning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Step 1: Open Login URL */}
          <div className="flex items-start gap-3">
            <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
              1
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Open the Kite Login URL</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visit the login page to begin authorization.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="gap-1.5 text-xs"
                  disabled={initialLoad}
                >
                  {copied ? (
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? 'Copied!' : 'Copy URL'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleOpenLogin}
                  className="gap-1.5 text-xs"
                  disabled={initialLoad}
                >
                  <ExternalLink className="size-3.5" /> Open Login Page
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Step 2: Login to Zerodha */}
          <div className="flex items-start gap-3">
            <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
              2
            </div>
            <div>
              <p className="text-sm font-medium">Login to Zerodha</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter your credentials and PIN to authorize the DDLJ app.
              </p>
            </div>
          </div>

          <Separator />

          {/* Step 3: Paste request_token and exchange */}
          <div className="flex items-start gap-3">
            <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
              3
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Paste and exchange the request_token
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2.5">
                After login, copy the{' '}
                <code className="font-mono text-primary bg-primary/10 px-1 py-0.5 rounded text-[11px]">
                  request_token
                </code>{' '}
                from the redirect URL.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Paste request_token here..."
                  value={requestToken}
                  onChange={(e) => setRequestToken(e.target.value)}
                  className="font-mono text-sm h-9"
                  disabled={isExchanging}
                />
                <Button
                  onClick={handleExchange}
                  disabled={isExchanging || !requestToken.trim()}
                  className="gap-2 flex-shrink-0 h-9"
                >
                  {isExchanging ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" /> Exchanging...
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" /> Exchange
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Warning Card ────────────────────────────────────────── */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-sm">
              <p className="font-medium text-amber-400">
                Daily Token Refresh Required
              </p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>
                  Kite access tokens expire at midnight IST every day
                </li>
                <li>
                  You must perform this login flow each trading morning
                  before 9:15 AM
                </li>
                <li>
                  If the token expires during trading, the engine will
                  pause automatically
                </li>
                <li>
                  The request_token is single-use and valid for only a
                  few minutes
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
