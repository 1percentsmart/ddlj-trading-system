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
import { OptionsPage } from '@/components/ddlj/options-page';
import { RiskPage } from '@/components/ddlj/risk-page';
import { AlertsPage } from '@/components/ddlj/alerts-page';
import { JournalPage } from '@/components/ddlj/journal-page';
import { SpotlightSearch } from '@/components/ddlj/spotlight-search';

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
      case 'options': return <OptionsPage />;
      case 'risk': return <RiskPage />;
      case 'alerts': return <AlertsPage />;
      case 'journal': return <JournalPage />;
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

      {/* ── Spotlight Search (Cmd+K) ── */}
      <SpotlightSearch />
    </div>
  );
}
