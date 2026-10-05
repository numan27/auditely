// app/_shared/components/auditely/workspace/workspace.tsx

'use client';

import { useState } from 'react';
import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';
import { DemoBanner } from '@/app/_shared/components/auditely/demoBanner/demoBanner';
import { DemoVideoThumb } from '@/app/_shared/components/auditely/demoVideoThumb/demoVideoThumb';
import { LeadSearchForm } from '@/app/_shared/components/auditely/leadSearchForm/leadSearchForm';
import { LeadResults } from '@/app/_shared/components/auditely/leadResults/leadResults';
import { ModeTabs, panelId, tabId, type WorkspaceMode } from '@/app/_shared/components/auditely/modeTabs/modeTabs';
import { RecentSearches } from '@/app/_shared/components/auditely/recentSearches/recentSearches';
import { ResultsSkeleton } from '@/app/_shared/components/auditely/resultsSkeleton/resultsSkeleton';
import { UrlAuditPanel } from '@/app/_shared/components/auditely/urlAuditPanel/urlAuditPanel';
import { useLeadSearch } from '@/app/_shared/lib/hooks/useLeadSearch';

const INTRO: Record<WorkspaceMode, string> = {
  leads: 'Search local businesses, audit their websites and get a ready-to-send outreach email for each one.',
  audit: 'Paste any website to check its speed, SEO, mobile experience, SSL and AI-search readiness.',
};

/** The home page: "Find leads" and "Audit a website". The public demo renders it inside DemoProvider. */
export function Workspace() {
  const [mode, setMode] = useState<WorkspaceMode>('leads');
  // The audit tab loads its list the first time it's opened, then stays mounted
  const [auditOpened, setAuditOpened] = useState(false);
  const leads = useLeadSearch();

  const changeMode = (next: WorkspaceMode) => {
    setMode(next);
    if (next === 'audit') setAuditOpened(true);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppHeader />
      <DemoBanner />

      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <section className="flex flex-col gap-6 pb-7 pt-10 sm:pt-16 lg:flex-row lg:items-end lg:gap-10">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--color-text-primary)] sm:text-[3.25rem]">
              Find your next client
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--color-text-secondary)]">{INTRO[mode]}</p>
          </div>
          <DemoVideoThumb />
        </section>

        <ModeTabs value={mode} onChange={changeMode} />

        <div id={panelId('leads')} role="tabpanel" aria-labelledby={tabId('leads')} hidden={mode !== 'leads'} className="mt-3">
          <LeadSearchForm onSearch={leads.search} isLoading={leads.isSearching} />
          {leads.error && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {leads.error}
            </p>
          )}

          {leads.isSearching ? (
            <ResultsSkeleton label="Finding businesses" />
          ) : !leads.hasSearched ? (
            !leads.error && <RecentSearches onOpen={leads.openSaved} />
          ) : leads.businesses.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-[var(--color-border-hover)] px-6 py-12 text-center">
              <p className="font-medium text-[var(--color-text-primary)]">No businesses found</p>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
                Try a broader business type, or a nearby larger city.
              </p>
            </div>
          ) : (
            <LeadResults
              key={leads.runKey}
              businesses={leads.businesses}
              query={leads.query}
              discovery={leads.discovery}
              onUpdate={leads.updateBusiness}
            />
          )}
        </div>

        <div id={panelId('audit')} role="tabpanel" aria-labelledby={tabId('audit')} hidden={mode !== 'audit'} className="mt-3">
          {auditOpened && <UrlAuditPanel />}
        </div>
      </main>
    </div>
  );
}
