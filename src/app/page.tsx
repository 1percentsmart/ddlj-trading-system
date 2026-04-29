'use client';

/**
 * DDLJ Trading System — Main Dashboard Page
 * ============================================
 * Single-page application with sidebar navigation, hash-based URL routing,
 * and content views. Uses LEGO-piece modular architecture.
 */

import { useEffect } from 'react';
import { useDDLJStore, type PageId } from '@/lib/store';
import { cn } from '@/lib/utils';
import { DDLJSidebar } from '@/components/ddlj/sidebar';
import { DDLJTopbar } from '@/components/ddlj/topbar';
import { ThemeInitializer } from '@/components/ddlj/theme-initializer';
import DashboardPage from '@/components/ddlj/dashboard-page';
import EnginePage from '@/components/ddlj/engine-page';
import { TradesPage } from '@/components/ddlj/trades-page';
import { ConfigPage } from '@/components/ddlj/config-page';
import BacktestPage from '@/components/ddlj/backtest-page';
import TokenPage from '@/components/ddlj/token-page';
import HealthPage from '@/components/ddlj/health-page';
import OptionsPage from '@/components/ddlj/options-page';
import RiskPage from '@/components/ddlj/risk-page';
import AlertsPage from '@/components/ddlj/alerts-page';
import JournalPage from '@/components/ddlj/journal-page';

const validPages: PageId[] = [
  'dashboard', 'engine', 'trades', 'config', 'backtest',
  'token', 'health', 'options', 'risk', 'alerts', 'journal',
];

function pageFromHash(): PageId {
  if (typeof window === 'undefined') return 'dashboard';
  const hash = window.location.hash.replace('#', '');
  if (validPages.includes(hash as PageId)) return hash as PageId;
  return 'dashboard';
}

export default function Home() {
  const { activePage, setActivePage, theme, refreshAll } = useDDLJStore();
  const sidebarOnRight = theme.sidebarPosition === 'right';

  // Hash-based URL routing
  useEffect(() => {
    // Read initial hash
    const page = pageFromHash();
    if (page !== activePage) {
      setActivePage(page);
    }

    // Listen for hash changes (browser back/forward)
    const handleHashChange = () => {
      const newPage = pageFromHash();
      if (newPage !== activePage) {
        setActivePage(newPage);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial data fetch
  useEffect(() => {
    refreshAll();
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />;
      case 'engine': return <EnginePage />;
      case 'trades': return <TradesPage />;
      case 'config': return <ConfigPage />;
      case 'backtest': return <BacktestPage />;
      case 'token': return <TokenPage />;
      case 'health': return <HealthPage />;
      case 'options': return <OptionsPage />;
      case 'risk': return <RiskPage />;
      case 'alerts': return <AlertsPage />;
      case 'journal': return <JournalPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <>
      <ThemeInitializer />
      <div className={cn('flex h-dvh overflow-hidden bg-background', theme.compactMode && 'compact')}>
        {!sidebarOnRight && <DDLJSidebar />}

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <DDLJTopbar />
          <main className="flex-1 overflow-y-auto">
            {renderPage()}
          </main>
        </div>

        {sidebarOnRight && <DDLJSidebar />}
      </div>
    </>
  );
}
