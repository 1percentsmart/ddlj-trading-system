'use client';

/**
 * DDLJ Token Management Page (Enhanced)
 * =======================================
 * Circular countdown, notification bell, auto-redirect flow,
 * login history table.
 */

import { useDDLJStore } from '@/lib/store';
import { cn, formatDuration, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Users,
  Bell,
  BellRing,
  ArrowRight,
  History,
  Globe,
  Monitor,
  Fingerprint,
  ChevronRight,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useRef } from 'react';

interface AccountInfo {
  id: string;
  name: string;
  broker: string;
  userId: string;
  active: boolean;
  tokenValid: boolean;
  expiresAt: string | null;
}

interface LoginHistoryEntry {
  id: string;
  timestamp: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  status: 'success' | 'failed';
}

export function TokenPage() {
  const { engineStatus, updateEngineStatus } = useDDLJStore();
  const [requestToken, setRequestToken] = useState('');
  const [isExchanging, setIsExchanging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoRedirect, setAutoRedirect] = useState(false);
  const [notifyBeforeExpiry, setNotifyBeforeExpiry] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState('acc1');

  // Multi-account mock
  const [accounts] = useState<AccountInfo[]>([
    { id: 'acc1', name: 'Primary Trading', broker: 'Zerodha', userId: 'SGS123', active: true, tokenValid: true, expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString() },
    { id: 'acc2', name: 'Paper Trading', broker: 'Zerodha', userId: 'SGS456', active: false, tokenValid: false, expiresAt: null },
    { id: 'acc3', name: 'Scalping Account', broker: 'Zerodha', userId: 'SGS789', active: false, tokenValid: true, expiresAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString() },
  ]);

  // Login history (mock - last 5 logins)
  const [loginHistory] = useState<LoginHistoryEntry[]>([
    { id: 'LH001', timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), device: 'Desktop', browser: 'Chrome 124', ip: '103.xxx.xxx.42', location: 'Mumbai, IN', status: 'success' },
    { id: 'LH002', timestamp: new Date(Date.now() - 26 * 3600 * 1000).toISOString(), device: 'Desktop', browser: 'Chrome 124', ip: '103.xxx.xxx.42', location: 'Mumbai, IN', status: 'success' },
    { id: 'LH003', timestamp: new Date(Date.now() - 50 * 3600 * 1000).toISOString(), device: 'Laptop', browser: 'Firefox 125', ip: '103.xxx.xxx.42', location: 'Mumbai, IN', status: 'success' },
    { id: 'LH004', timestamp: new Date(Date.now() - 74 * 3600 * 1000).toISOString(), device: 'Desktop', browser: 'Chrome 123', ip: '103.xxx.xxx.15', location: 'Pune, IN', status: 'failed' },
    { id: 'LH005', timestamp: new Date(Date.now() - 98 * 3600 * 1000).toISOString(), device: 'Desktop', browser: 'Chrome 123', ip: '103.xxx.xxx.42', location: 'Mumbai, IN', status: 'success' },
  ]);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState('');
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [totalDuration, setTotalDuration] = useState(24 * 3600 * 1000); // 24h
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [isLessThanOneHour, setIsLessThanOneHour] = useState(false);
  const expiryNotifiedRef = useRef(false);
  const oneHourNotifiedRef = useRef(false);

  useEffect(() => {
    const activeAccount = accounts.find(a => a.id === selectedAccount);
    const expiresAt = activeAccount?.expiresAt || engineStatus.token.expires_at;
    if (!expiresAt) return;
    const timer = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        setTimeLeftMs(0);
        return;
      }
      setTimeLeftMs(diff);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);

      // Expiring soon notification (< 30 min)
      if (diff < 30 * 60000 && diff > 0 && !expiryNotifiedRef.current && notifyBeforeExpiry) {
        expiryNotifiedRef.current = true;
        setIsExpiringSoon(true);
        toast.warning('Token expiring soon! Less than 30 minutes remaining.', { duration: 10000 });
      }

      // Less than 1 hour notification
      if (diff < 60 * 60000 && diff > 0 && !oneHourNotifiedRef.current) {
        oneHourNotifiedRef.current = true;
        setIsLessThanOneHour(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [engineStatus.token.expires_at, selectedAccount, accounts, notifyBeforeExpiry]);

  // Circular countdown calculations
  const countdownRadius = 58;
  const countdownCircumference = 2 * Math.PI * countdownRadius;
  const countdownProgress = totalDuration > 0 ? timeLeftMs / totalDuration : 0;
  const countdownOffset = countdownCircumference - (countdownProgress * countdownCircumference);
  const countdownColor = timeLeftMs < 3600000 ? '#ef4444' : timeLeftMs < 3 * 3600000 ? '#f59e0b' : '#22c55e';

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
      expiryNotifiedRef.current = false;
      oneHourNotifiedRef.current = false;
      setIsExpiringSoon(false);
      setIsLessThanOneHour(false);
      toast.success('Token exchanged successfully! API connection established.');
    }, 1500);
  };

  const currentAccount = accounts.find(a => a.id === selectedAccount);

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 max-w-3xl">
      {/* ── Token Status with Circular Countdown ── */}
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
                <CardTitle className="text-lg flex items-center gap-2">
                  Kite API Token
                  {isLessThanOneHour && engineStatus.token.valid && (
                    <div className="relative">
                      <BellRing className="h-4 w-4 text-amber-400 animate-bounce" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    </div>
                  )}
                </CardTitle>
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
          {/* Expiring Soon Notification */}
          {isExpiringSoon && engineStatus.token.valid && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <BellRing className="h-4 w-4 text-amber-400 flex-shrink-0 animate-bounce" />
              <div className="text-xs">
                <span className="font-medium text-amber-400">Token expiring soon!</span>
                <p className="text-muted-foreground mt-0.5">Less than 30 minutes remaining. Refresh now to avoid engine interruption.</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1 flex-shrink-0" onClick={() => window.open(loginUrl, '_blank')}>
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            </div>
          )}

          {/* Less than 1 hour notification */}
          {isLessThanOneHour && !isExpiringSoon && engineStatus.token.valid && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <Bell className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                Token expires in less than 1 hour. Consider refreshing soon.
              </div>
            </div>
          )}

          {/* Circular Countdown + Account Info */}
          <div className="flex items-center gap-6">
            {/* Circular Countdown */}
            <div className="relative w-36 h-36 flex-shrink-0">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={countdownRadius} fill="none" stroke="var(--secondary)" strokeWidth="6" />
                <circle
                  cx="70" cy="70" r={countdownRadius} fill="none"
                  stroke={countdownColor}
                  strokeWidth="6"
                  strokeDasharray={countdownCircumference}
                  strokeDashoffset={countdownOffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Clock className={cn('h-4 w-4 mb-0.5', timeLeftMs < 3600000 ? 'text-red-400' : timeLeftMs < 3 * 3600000 ? 'text-amber-400' : 'text-emerald-400')} />
                <span className={cn('text-lg font-bold font-mono tabular-nums', timeLeft === 'Expired' ? 'text-red-400' : timeLeftMs < 3600000 ? 'text-red-400' : timeLeftMs < 3 * 3600000 ? 'text-amber-400' : 'text-emerald-400')}>
                  {timeLeft || 'N/A'}
                </span>
                <span className="text-[9px] text-muted-foreground">remaining</span>
              </div>
            </div>

            {/* Account Details */}
            <div className="flex-1 space-y-3">
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Account
                </div>
                <div className="font-mono text-sm mt-1">{engineStatus.token.user_name || 'Not connected'}</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Fingerprint className="h-3 w-3" /> Session
                </div>
                <div className="font-mono text-sm mt-1">
                  {engineStatus.token.valid ? 'Authenticated' : 'Not authenticated'}
                </div>
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
            </div>
          )}

          {/* Auto-redirect + Notification toggles */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={autoRedirect} onCheckedChange={setAutoRedirect} />
              <Label className="text-xs">Auto-redirect after login</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={notifyBeforeExpiry} onCheckedChange={setNotifyBeforeExpiry} />
              <Label className="text-xs">Expiry warning (30min)</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Auto-redirect Flow Description ── */}
      {autoRedirect && (
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-emerald-400 text-sm">Auto-redirect After Login</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <Badge variant="outline" className="text-[9px] gap-1"><LogIn className="h-2.5 w-2.5" /> Open Login</Badge>
                  <ChevronRight className="h-3 w-3" />
                  <Badge variant="outline" className="text-[9px] gap-1"><KeyRound className="h-2.5 w-2.5" /> Authorize</Badge>
                  <ChevronRight className="h-3 w-3" />
                  <Badge variant="outline" className="text-[9px] gap-1"><Shield className="h-2.5 w-2.5" /> Get Token</Badge>
                  <ChevronRight className="h-3 w-3" />
                  <Badge variant="outline" className="text-[9px] gap-1"><RefreshCw className="h-2.5 w-2.5" /> Auto-Exchange</Badge>
                  <ChevronRight className="h-3 w-3" />
                  <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[9px] gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Connected</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  When enabled, after you authorize on Kite, the request_token from the redirect URL will be automatically captured and exchanged. No manual paste needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Multi-Account Support ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" /> Account Management
          </CardTitle>
          <CardDescription className="text-xs">Switch between trading accounts or add new ones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedAccount === account.id ? 'bg-primary/5 border-primary/30' : 'bg-secondary/30 border-border hover:bg-secondary/50'
                )}
                onClick={() => {
                  setSelectedAccount(account.id);
                  expiryNotifiedRef.current = false;
                  oneHourNotifiedRef.current = false;
                  toast.info(`Switched to ${account.name}`);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                    account.active ? 'bg-emerald-500/20' : 'bg-zinc-500/20'
                  )}>
                    <Users className={cn('h-4 w-4', account.active ? 'text-emerald-400' : 'text-zinc-400')} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{account.name}</span>
                      {account.active && <Badge variant="default" className="text-[8px]">ACTIVE</Badge>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {account.broker} • {account.userId}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={account.tokenValid ? 'outline' : 'destructive'} className="text-[9px] gap-0.5">
                    {account.tokenValid ? (
                      <><CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> Valid</>
                    ) : (
                      <><AlertTriangle className="h-2.5 w-2.5" /> No Token</>
                    )}
                  </Badge>
                  <ArrowRight className={cn('h-4 w-4', selectedAccount === account.id ? 'text-primary' : 'text-muted-foreground')} />
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => toast.info('Add account feature coming soon')}>
            <Users className="h-3.5 w-3.5" /> Add New Account
          </Button>
        </CardContent>
      </Card>

      {/* ── Recent Login History ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" /> Recent Login History
          </CardTitle>
          <CardDescription className="text-xs">Last 5 login attempts for this account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {loginHistory.map((entry) => (
              <div key={entry.id} className={cn(
                'flex items-center justify-between p-3 rounded-lg border',
                entry.status === 'success' ? 'bg-secondary/20 border-border/50' : 'bg-red-500/5 border-red-500/10'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                    entry.status === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                  )}>
                    {entry.status === 'success' ?
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" /> :
                      <XCircle className="h-4 w-4 text-red-400" />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{entry.device}</span>
                      <Badge variant="outline" className="text-[8px] h-4">{entry.browser}</Badge>
                      <Badge variant={entry.status === 'success' ? 'outline' : 'destructive'} className="text-[8px] h-4">
                        {entry.status === 'success' ? 'Success' : 'Failed'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-0.5"><Monitor className="h-2.5 w-2.5" /> {entry.ip}</span>
                      <span>•</span>
                      <span>{entry.location}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── How to Get Token ── */}
      <Card className="bg-card/80 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">How to Get a New Token</CardTitle>
          <CardDescription className="text-xs">Kite tokens expire daily. Follow these steps each morning before trading.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
            <div className="flex-1">
              <p className="text-sm font-medium">Open the Kite Login URL</p>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-secondary px-2 py-1 rounded font-mono break-all">{loginUrl}</code>
                <Button variant="outline" size="sm" onClick={handleCopyUrl} className="flex-shrink-0">
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => window.open(loginUrl, '_blank')}>
                <ExternalLink className="h-3.5 w-3.5" /> Open Login Page
              </Button>
            </div>
          </div>
          <Separator className="bg-border" />
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
            <div><p className="text-sm font-medium">Login to Zerodha</p><p className="text-xs text-muted-foreground mt-0.5">Enter your credentials to authorize the app.</p></div>
          </div>
          <Separator className="bg-border" />
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
            <div>
              <p className="text-sm font-medium">Copy the request_token from the redirect URL</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                After login, copy the <span className="font-mono font-semibold">request_token</span> value from the redirect URL.
              </p>
            </div>
          </div>
          <Separator className="bg-border" />
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
            <div className="flex-1">
              <p className="text-sm font-medium">Paste and exchange the token below</p>
              <div className="flex items-center gap-2 mt-2">
                <Input placeholder="Paste request_token here..." value={requestToken} onChange={(e) => setRequestToken(e.target.value)} className="font-mono text-sm" />
                <Button onClick={handleExchange} disabled={isExchanging || !requestToken.trim()} className="gap-2 flex-shrink-0">
                  {isExchanging ? <><RefreshCw className="h-4 w-4 animate-spin" /> Exchanging...</> : <><LogIn className="h-4 w-4" /> Exchange</>}
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
                <li>Your API secret is stored securely in environment variables</li>
                <li>The request_token is single-use and valid for only a few minutes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
