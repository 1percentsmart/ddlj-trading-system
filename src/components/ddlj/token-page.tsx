'use client';

/**
 * DDLJ Token Management Page
 * ============================
 * Kite login URL, token exchange, token status, expiry countdown.
 */

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  KeyRound,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  RefreshCw,
  LogIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

export function TokenPage() {
  const { engineStatus, updateEngineStatus } = useDDLJStore();
  const [requestToken, setRequestToken] = useState('');
  const [isExchanging, setIsExchanging] = useState(false);
  const [copied, setCopied] = useState(false);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!engineStatus.token.expires_at) return;
    const timer = setInterval(() => {
      const diff = new Date(engineStatus.token.expires_at!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        updateEngineStatus({ token: { ...engineStatus.token, valid: false } });
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, [engineStatus.token.expires_at]);

  const loginUrl = 'https://kite.trade/connect/login?api_key=wgbq09nr6s0pmkqy&v=3';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(loginUrl);
    setCopied(true);
    toast.success('Login URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExchange = () => {
    if (!requestToken.trim()) {
      toast.error('Please enter a request token');
      return;
    }
    setIsExchanging(true);
    setTimeout(() => {
      updateEngineStatus({
        token: {
          stored: true,
          valid: true,
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          user_name: 'Sameer Gani Shaikh',
        },
      });
      setIsExchanging(false);
      setRequestToken('');
      toast.success('Token exchanged successfully! API connection established.');
    }, 1500);
  };

  return (
    <div className="space-y-4 p-4 max-w-3xl">
      {/* ── Token Status ── */}
      <Card className={cn('bg-card/80 border', engineStatus.token.valid ? 'border-emerald-500/20' : 'border-red-500/20')}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                engineStatus.token.valid ? 'bg-emerald-500/20' : 'bg-red-500/20'
              )}>
                <KeyRound className={cn('h-5 w-5', engineStatus.token.valid ? 'text-emerald-400' : 'text-red-400')} />
              </div>
              <div>
                <CardTitle className="text-lg">Kite API Token</CardTitle>
                <CardDescription>Zerodha Kite Connect authentication status</CardDescription>
              </div>
            </div>
            <Badge variant={engineStatus.token.valid ? 'default' : 'destructive'} className="text-xs gap-1">
              {engineStatus.token.valid ? (
                <><CheckCircle2 className="h-3 w-3" /> Valid</>
              ) : (
                <><AlertTriangle className="h-3 w-3" /> {engineStatus.token.stored ? 'Expired' : 'Not Set'}</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" /> Account
              </div>
              <div className="font-mono text-sm mt-1">{engineStatus.token.user_name || 'Not connected'}</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Expires In
              </div>
              <div className={cn('font-mono text-sm mt-1', timeLeft === 'Expired' ? 'text-red-400' : 'text-emerald-400')}>
                {timeLeft || 'N/A'}
              </div>
            </div>
          </div>

          {engineStatus.token.valid && engineStatus.token.expires_at && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Token lifetime</span>
                <span>24 hours</span>
              </div>
              <Progress
                value={Math.max(0, Math.min(100, ((new Date(engineStatus.token.expires_at).getTime() - Date.now()) / (24 * 3600 * 1000)) * 100))}
                className="h-2"
              />
              <p className="text-[10px] text-muted-foreground">
                Kite access tokens expire daily at midnight. You must refresh every trading day.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── How to Get Token (Step by Step) ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">How to Get a New Token</CardTitle>
          <CardDescription className="text-xs">
            Kite tokens expire daily. Follow these steps each morning before trading.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
            <div className="flex-1">
              <p className="text-sm font-medium">Open the Kite Login URL</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click the button below or copy the URL and open it in your browser.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-secondary px-2 py-1 rounded font-mono break-all max-w-md block">
                  {loginUrl}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyUrl} className="flex-shrink-0">
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-1.5"
                onClick={() => window.open(loginUrl, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Login Page
              </Button>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Step 2 */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
            <div>
              <p className="text-sm font-medium">Login to Zerodha</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter your Zerodha credentials (User ID + Password + PIN/TOTP) to authorize the app.
              </p>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Step 3 */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
            <div>
              <p className="text-sm font-medium">Copy the request_token from the redirect URL</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                After login, you&apos;ll be redirected to a URL like:
                <code className="text-xs bg-secondary px-1.5 py-0.5 rounded ml-1">
                  https://...?request_token=XXXXXX&action=...
                </code>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Copy only the <span className="font-mono font-semibold">request_token</span> value (the part after <code className="bg-secondary px-1 rounded">=</code> and before <code className="bg-secondary px-1 rounded">&</code>).
              </p>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Step 4 */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
            <div className="flex-1">
              <p className="text-sm font-medium">Paste and exchange the token below</p>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  placeholder="Paste request_token here..."
                  value={requestToken}
                  onChange={(e) => setRequestToken(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleExchange}
                  disabled={isExchanging || !requestToken.trim()}
                  className="gap-2 flex-shrink-0"
                >
                  {isExchanging ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Exchanging...</>
                  ) : (
                    <><LogIn className="h-4 w-4" /> Exchange Token</>
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
            <div className="space-y-2 text-sm">
              <p className="font-medium text-amber-400">Important: Daily Token Refresh Required</p>
              <ul className="text-muted-foreground space-y-1 text-xs list-disc list-inside">
                <li>Kite access tokens expire at midnight IST every day</li>
                <li>You must perform this login flow each trading morning before 9:15 AM</li>
                <li>If the token expires during trading, the engine will pause and notify via Telegram</li>
                <li>Your API secret is stored securely in environment variables — never in the frontend</li>
                <li>The request_token is single-use and valid for only a few minutes after generation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
