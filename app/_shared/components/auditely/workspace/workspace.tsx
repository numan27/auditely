// app/_shared/components/auditely/workspace/workspace.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';
import { DemoBanner } from '@/app/_shared/components/auditely/demoBanner/demoBanner';
import { DemoVideoThumb } from '@/app/_shared/components/auditely/demoVideoThumb/demoVideoThumb';
import { LeadSearchForm } from '@/app/_shared/components/auditely/leadSearchForm/leadSearchForm';
import { LeadResults } from '@/app/_shared/components/auditely/leadResults/leadResults';
import { ModeTabs, panelId, tabId, type WorkspaceMode } from '@/app/_shared/components/auditely/modeTabs/modeTabs';
import { RecentSearches } from '@/app/_shared/components/auditely/recentSearches/recentSearches';
import { RemoveSitesModal } from '@/app/_shared/components/auditely/removeSitesModal/removeSitesModal';
import { ResultsSkeleton } from '@/app/_shared/components/auditely/resultsSkeleton/resultsSkeleton';
import { SearchRadar } from '@/app/_shared/components/auditely/searchRadar/searchRadar';
import { UrlAuditPanel } from '@/app/_shared/components/auditely/urlAuditPanel/urlAuditPanel';
import { AuditRequestsPanel } from '@/app/_shared/components/auditely/auditRequestsPanel/auditRequestsPanel';
import { useAccount } from '@/app/_shared/lib/hooks/useAccount';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { useLeadSearch } from '@/app/_shared/lib/hooks/useLeadSearch';
import { useWorkspaceNavigate } from '@/app/_shared/lib/hooks/useWorkspaceNavigate';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { parseWorkspacePath, requestPath, searchPath, workspacePath, type WorkspaceView } from '@/app/_shared/lib/utils/workspacePath';

const INTRO: Record<WorkspaceMode, string> = {
  leads: 'Search local businesses, audit their websites and get a ready-to-send outreach email for each one.',
  audit: 'Paste any website to check its speed, SEO, mobile experience, SSL and AI-search readiness.',
  requests: 'Free audits requested on devartventures.com, audited on arrival. Reply to each within one business day.',
};

// Where a tab opens the first time it's clicked
const TAB_HOME: Record<WorkspaceMode, WorkspaceView> = {
  leads: { mode: 'leads', searchId: null },
  audit: { mode: 'audit' },
  requests: { mode: 'requests', requestId: null },
};

/**
 * The home page: "Find leads", "Audit a website" and "Requests". The address
 * says which tab is open, and which saved search or request it shows
 * (workspacePath.ts), so a refresh or a shared link opens the same view.
 * The public demo renders it inside DemoProvider, at one address: its tabs
 * are kept here instead.
 */
export function Workspace() {
  const demo = useDemo();
  const account = useAccount();
  const pathname = usePathname();
  const navigate = useWorkspaceNavigate();
  const [demoMode, setDemoMode] = useState<WorkspaceMode>('leads');
  const parsed = demo ? null : parseWorkspacePath(pathname);
  // Requests are the owner's: anyone else who opens a request's link lands on Find leads, and Requests never mounts
  const hidden = parsed?.mode === 'requests' && !account?.isOwner;
  const view: WorkspaceView = demo ? TAB_HOME[demoMode] : hidden ? TAB_HOME.leads : (parsed ?? TAB_HOME.leads);
  const { mode } = view;

  // The audit and requests tabs load their lists the first time they're opened, then stay mounted
  const [opened, setOpened] = useState<ReadonlySet<WorkspaceMode>>(() => new Set([mode]));
  if (!opened.has(mode)) setOpened(new Set(opened).add(mode));

  // Each tab reopens where it was left: the search on screen, the request open
  const lastPath = useRef<Partial<Record<WorkspaceMode, string>>>({});
  useEffect(() => {
    if (!demo && !hidden) lastPath.current[mode] = pathname;
  }, [demo, hidden, mode, pathname]);

  // The search the leads show, or are opening: a search just run is already on screen when the address catches up
  const shownSearch = useRef<string | null>(null);
  const onSearched = useCallback(
    (searchId: string) => {
      shownSearch.current = searchId;
      navigate(searchPath(searchId));
    },
    [navigate]
  );
  const leads = useLeadSearch({ onSearched });
  const { openSaved, reset } = leads;

  // The address names a search (a refresh, Saved searches, back and forward): open it, or go back to the form
  const wantedSearch = demo || view.mode !== 'leads' ? undefined : view.searchId;
  useEffect(() => {
    if (wantedSearch === undefined || wantedSearch === shownSearch.current) return;
    shownSearch.current = wantedSearch;
    if (wantedSearch) void openSaved(wantedSearch);
    else reset();
  }, [wantedSearch, openSaved, reset]);

  // Old links to a saved search (/?load={id}) open it at its own address
  useEffect(() => {
    const load = new URLSearchParams(window.location.search).get('load');
    if (!demo && load && pathname === ROUTES.HOME) navigate(searchPath(load), { replace: true });
  }, [demo, pathname, navigate]);

  const changeMode = (next: WorkspaceMode) => {
    if (demo) return setDemoMode(next);
    if (next !== mode) navigate(lastPath.current[next] ?? workspacePath(TAB_HOME[next]));
  };

  // Opening a request's card names it in the address, without a new history entry for each card
  const openRequest = useCallback(
    (requestId: string | null) => navigate(requestId ? requestPath(requestId) : ROUTES.REQUESTS, { replace: true }),
    [navigate]
  );

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
            leads.pending ? (
              <SearchRadar niche={leads.pending.niche} location={leads.pending.location} />
            ) : (
              <ResultsSkeleton label="Finding businesses" />
            )
          ) : !leads.hasSearched ? (
            !leads.error && <RecentSearches onOpen={(searchId) => navigate(searchPath(searchId))} />
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
              onRemove={leads.canRemove ? leads.askRemove : undefined}
            />
          )}

          {leads.removal && (
            <RemoveSitesModal
              sites={leads.removal.sites}
              removing={leads.removal.busy}
              error={leads.removal.error}
              onConfirm={leads.confirmRemove}
              onClose={leads.cancelRemove}
              fromSearch
            />
          )}
        </div>

        <div id={panelId('audit')} role="tabpanel" aria-labelledby={tabId('audit')} hidden={mode !== 'audit'} className="mt-3">
          {opened.has('audit') && <UrlAuditPanel />}
        </div>

        <div id={panelId('requests')} role="tabpanel" aria-labelledby={tabId('requests')} hidden={mode !== 'requests'} className="mt-3">
          {opened.has('requests') && (
            <AuditRequestsPanel openId={view.mode === 'requests' ? view.requestId : null} onOpenChange={openRequest} />
          )}
        </div>
      </main>
    </div>
  );
}
