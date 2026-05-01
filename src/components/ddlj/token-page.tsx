'use client';

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Key, ExternalLink, CheckCircle2, XCircle, Info, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function TokenPage() {
  const { tokenStatus, loginUrl, exchangeToken, fetchLoginUrl } = useDDLJStore();
  const [requestToken, setRequestToken] = useState('');
  const [exchanging, setExchanging] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);

  const handleGetRequestToken = async () => {
    setLoadingUrl(true);
    try {
      await fetchLoginUrl();
    } catch {
      toast.error('Failed to generate login URL');
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleExchange = async () => {
    if (!requestToken.trim()) return;
    setExchanging(true);
    try {
      await exchangeToken(requestToken.trim());
      toast.success('Token exchanged successfully');
      setRequestToken('');
    } catch {
      toast.error('Token exchange failed');
    } finally {
      setExchanging(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Token Management</h1>

      {/* Token Status Card */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Kite Access Token</CardTitle>
          <CardDescription>Manage your Zerodha Kite API access token</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-3">
            {tokenStatus?.valid ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
            <span className="text-sm">
              Token Status: <Badge variant={tokenStatus?.valid ? 'default' : 'secondary'}>{tokenStatus?.valid ? 'Valid' : tokenStatus?.stored ? 'Expired' : 'Not Set'}</Badge>
            </span>
          </div>

          {/* Get Request Token Link */}
          {loginUrl ? (
            <a href={loginUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2" disabled={loadingUrl}>
                <ExternalLink className="h-4 w-4" />
                Get Request Token
              </Button>
            </a>
          ) : (
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleGetRequestToken}
              disabled={loadingUrl}
            >
              {loadingUrl ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Generate Login URL
            </Button>
          )}

          {/* Manual token exchange */}
          <div className="flex gap-2">
            <Input
              placeholder="Paste request token here..."
              value={requestToken}
              onChange={(e) => setRequestToken(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleExchange} disabled={exchanging || !requestToken.trim()}>
              <Key className="h-4 w-4 mr-2" />
              Exchange
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            How to Get a Request Token
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Click <strong>Get Request Token</strong> above to open the Zerodha Kite login page</li>
            <li>Log in with your Zerodha credentials and approve the API access request</li>
            <li>After approval, copy the <code className="px-1 py-0.5 bg-muted rounded text-xs">request_token</code> from the redirect URL</li>
            <li>Paste the request token in the input field above and click <strong>Exchange</strong></li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            Note: Access tokens are valid for one trading day and must be refreshed daily.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
