'use client';

import { useDDLJStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Key, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function TokenPage() {
  const { tokenStatus, loginUrl, exchangeToken } = useDDLJStore();
  const [requestToken, setRequestToken] = useState('');
  const [exchanging, setExchanging] = useState(false);

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
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Kite Access Token</CardTitle>
          <CardDescription>Manage your Zerodha Kite API access token</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          {loginUrl && (
            <a href={loginUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Get Request Token
              </Button>
            </a>
          )}
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
    </div>
  );
}
