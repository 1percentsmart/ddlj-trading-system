'use client';

/**
 * DDLJ Coming Soon Page
 * =======================
 * Placeholder for features not yet available in the backend API.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface ComingSoonPageProps {
  title: string;
  description?: string;
}

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="bg-card/80 border-border max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center py-12 px-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
            <Construction className="h-8 w-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {description || 'This feature is under development. Check back soon for updates.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
