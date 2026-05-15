'use client';

import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { NoContentCard } from '@/app/_shared/components/ui/noContentCard/noContentCard';
import { LeadSearchForm } from '@/app/_shared/components/auditely/leadSearchForm/leadSearchForm';
import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import type { BusinessWithData, Audit, AiReport } from '@/app/_shared/lib/types/auditely';

export default function HomePage() {
  const [isSearching, setIsSearching] = useState(false);
  const [businesses, setBusinesses] = useState<BusinessWithData[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<{ niche: string; location: string } | null>(null);

  useEffect(() => {
    const savedSearchId = localStorage.getItem('auditely_search_id');
    if (!savedSearchId) return;

    setIsSearching(true);
    fetch(`/api/results?search_id=${savedSearchId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.businesses?.length) return;

        const restored: BusinessWithData[] = data.businesses.map(
          (b: BusinessWithData & { audits?: (Audit & { ai_reports?: AiReport[] })[] }) => ({
            ...b,
            audit: b.audits?.[0],
            ai_report: b.audits?.[0]?.ai_reports?.[0],
          })
        );

        setBusinesses(restored);
        setHasSearched(true);
      })
      .catch(() => {
        // silently fail — fresh start is fine
      })
      .finally(() => setIsSearching(false));
  }, []);

  const handleSearch = async (niche: string, location: string) => {
    setIsSearching(true);
    setError(null);
    setBusinesses([]);
    setHasSearched(false);

    let searchId: string | null = null;

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, location }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed');
      setBusinesses(data.businesses ?? []);
      setLastQuery({ niche, location });
      setHasSearched(true);
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

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
            Auditely
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <section className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Find your next client
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-xl">
              Discover local businesses, audit their websites automatically, and get AI-powered
              insights and outreach emails — ready to close.
            </p>
          </div>

          <LeadSearchForm onSearch={handleSearch} isLoading={isSearching} />

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}
        </section>

        {isSearching && (
          <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-secondary)]">
            <Spinner size="md" />
            <span className="text-sm">Fetching businesses…</span>
          </div>
        )}

        {!isSearching && hasSearched && (
          <section className="space-y-6">
            {businesses.length > 0 && lastQuery && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="text-[var(--color-text-secondary)]">
                  <strong className="text-[var(--color-text-primary)] font-semibold">
                    {businesses.length}
                  </strong>{' '}
                  businesses found for{' '}
                  <span className="italic">
                    &ldquo;{lastQuery.niche}&rdquo; in {lastQuery.location}
                  </span>
                </span>
                {withWebsite < businesses.length && (
                  <span className="text-[var(--color-text-tertiary)]">
                    {businesses.length - withWebsite} without a website (skipped)
                  </span>
                )}
              </div>
            )}

            {businesses.length === 0 ? (
              <NoContentCard
                title="No businesses found"
                description="Try a different niche or location and search again."
              />
            ) : (
              <div className="space-y-5">
                {businesses.map((business) => (
                  <BusinessCard
                    key={business.id}
                    business={business}
                    initialAudit={business.audit}
                    initialReport={business.ai_report}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
