'use client';

/**
 * DDLJ Trading System — Main Dashboard Page
 * ============================================
 * Single-page application with sidebar navigation and content views.
 * Everything is rendered in one page with tab-based navigation.
 */

import { useDDLJStore } from '@/lib/store';
import { DDLJSidebar } from '@/components/ddlj/sidebar';
import { DDLJTopBar } from '@/components/ddlj/topbar';
import { DashboardPage } from '@/components/ddlj/dashboard-page';
import { EnginePage } from '@/components/ddlj/engine-page';
import { TradesPage } from '@/components/ddlj/trades-page';
import { ConfigPage } from '@/components/ddlj/config-page';
import { BacktestPage } from '@/components/ddlj/backtest-page';
import { TokenPage } from '@/components/ddlj/token-page';
import { HealthPage } from '@/components/ddlj/health-page';

export default function Home() {
  const { activePage } = useDDLJStore();

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />;
      case 'engine': return <EnginePage />;
      case 'trades': return <TradesPage />;
      case 'config': return <ConfigPage />;
      case 'backtest': return <BacktestPage />;
      case 'token': return <TokenPage />;
      case 'health': return <HealthPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <DDLJSidebar />

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Top Bar ── */}
        <DDLJTopBar />

        {/* ── Page Content ── */}
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
