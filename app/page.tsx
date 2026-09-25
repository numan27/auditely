'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { NoContentCard } from '@/app/_shared/components/ui/noContentCard/noContentCard';
import { LeadSearchForm } from '@/app/_shared/components/auditely/leadSearchForm/leadSearchForm';
import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import type { BusinessWithData, Audit, AiReport } from '@/app/_shared/lib/types/auditely';
import { useEmailDiscovery, type ContactsFound } from '@/app/_shared/lib/hooks/useEmailDiscovery';
import { websiteFirst } from '@/app/_shared/lib/utils/businessOrder';
import { LogoutButton } from '@/app/_shared/components/auditely/logoutButton/logoutButton';
import { ROUTES } from '@/app/_shared/lib/config/routes';

const PAGE_SIZE = 20;

// UNIQUE FKs make PostgREST embed audits / ai_reports as an object (or null), not an array
const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

export default function HomePage() {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [businesses, setBusinesses] = useState<BusinessWithData[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<{ niche: string; location: string } | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [discoveryRun, setDiscoveryRun] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Merge background-discovered emails into the list (cards re-render via prop sync).
  const mergeContacts = useCallback((found: ContactsFound[]) => {
    setBusinesses((prev) =>
      prev.map((b) => {
        const hit = found.find((f) => f.id === b.id);
        if (!hit) return b;
        return {
          ...b,
          email: hit.email ?? b.email,
          phone: hit.phone ?? b.phone,
          contact_page: hit.contact_page,
          socials: hit.socials,
        };
      })
    );
  }, []);

  // Auto-discover contacts (scrape-only) whenever a new search/result set loads.
  const discovery = useEmailDiscovery(businesses, mergeContacts, discoveryRun);

  // Only fires when navigating from Saved Searches (?load=<search_id>)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchId = params.get('load');
    if (!searchId) return;

    window.history.replaceState({}, '', ROUTES.HOME);
    setIsSearching(true);

    fetch(`/api/results?search_id=${searchId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.businesses?.length) return;
        type SavedAudit = Audit & { ai_reports?: AiReport | AiReport[] | null };
        const restored: BusinessWithData[] = data.businesses.map(
          (b: BusinessWithData & { audits?: SavedAudit | SavedAudit[] | null }) => {
            const audit = one(b.audits);
            return { ...b, audit, ai_report: one(audit?.ai_reports) };
          }
        );
        setBusinesses(websiteFirst(restored));
        setVisibleCount(PAGE_SIZE);
        setHasSearched(true);
        setDiscoveryRun((n) => n + 1);
      })
      .catch(() => {})
      .finally(() => setIsSearching(false));
  }, []);

  // Infinite scroll — reveal next page when sentinel enters viewport
  const loadMore = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + PAGE_SIZE);
      setIsLoadingMore(false);
    }, 400);
  }, [isLoadingMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasSearched]);

  const handleSearch = async (niche: string, location: string) => {
    setIsSearching(true);
    setError(null);
    setBusinesses([]);
    setHasSearched(false);
    setVisibleCount(PAGE_SIZE);

    let searchId: string | null = null;

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, location }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed');
      setBusinesses(websiteFirst(data.businesses ?? []));
      setLastQuery({ niche, location });
      setHasSearched(true);
      setDiscoveryRun((n) => n + 1);
      searchId = data.search_id ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSearching(false);
    }

    if (searchId) {
      try { localStorage.setItem('auditely_search_id', searchId); } catch { /* storage unavailable */ }
    }
  };

  const withWebsite = businesses.filter((b) => b.website).length;
  const visibleBusinesses = businesses.slice(0, visibleCount);
  const hasMore = visibleCount < businesses.length;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
            Auditely
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(ROUTES.SEARCHES)}
              className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Saved Searches
            </button>
            <LogoutButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Find your next client
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-xl">
            Discover local businesses, audit their websites automatically, and get AI-powered
            insights and outreach emails — ready to close.
          </p>
        </div>

        {/* Search and result summary stay pinned under the header while the list scrolls */}
        <div
          className={`sticky top-14 z-30 -mx-6 px-6 pt-6 pb-4 mb-6 space-y-4 bg-[var(--color-bg-primary)]/95 backdrop-blur-md ${
            hasSearched ? 'border-b border-[var(--color-border)]' : ''
          }`}
        >
          <LeadSearchForm onSearch={handleSearch} isLoading={isSearching} />

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}

          {!isSearching && hasSearched && businesses.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-[var(--color-text-secondary)]">
                Showing{' '}
                <strong className="text-[var(--color-text-primary)] font-semibold">
                  {visibleBusinesses.length}
                </strong>{' '}
                of{' '}
                <strong className="text-[var(--color-text-primary)] font-semibold">
                  {businesses.length}
                </strong>{' '}
                businesses
                {lastQuery && (
                  <span className="text-[var(--color-text-tertiary)]">
                    {' '}for{' '}
                    <span className="italic">
                      &ldquo;{lastQuery.niche}&rdquo; in {lastQuery.location}
                    </span>
                  </span>
                )}
              </span>
              {withWebsite < businesses.length && (
                <span className="text-[var(--color-text-tertiary)]">
                  {businesses.length - withWebsite} without a website
                </span>
              )}
              {discovery.total > 0 && discovery.done < discovery.total && (
                <span className="flex items-center gap-1.5 text-[var(--color-text-tertiary)]">
                  <Spinner size="sm" />
                  Finding contacts… {discovery.done}/{discovery.total}
                </span>
              )}
            </div>
          )}
        </div>

        {isSearching && (
          <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-secondary)]">
            <Spinner size="md" />
            <span className="text-sm">Fetching businesses…</span>
          </div>
        )}

        {!isSearching && hasSearched && (
          <section className="space-y-6">
            {businesses.length === 0 ? (
              <NoContentCard
                title="No businesses found"
                description="Try a different niche or location and search again."
              />
            ) : (
              <>
                <div className="space-y-5">
                  {visibleBusinesses.map((business) => (
                    <BusinessCard
                      key={business.id}
                      business={business}
                      initialAudit={business.audit}
                      initialReport={business.ai_report}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div ref={sentinelRef} className="flex justify-center py-8">
                    {isLoadingMore && <Spinner size="md" />}
                  </div>
                )}

                {!hasMore && businesses.length > PAGE_SIZE && (
                  <p className="text-center text-sm text-[var(--color-text-tertiary)] py-4">
                    All {businesses.length} businesses loaded
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
