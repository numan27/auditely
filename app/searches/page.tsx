'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { NoContentCard } from '@/app/_shared/components/ui/noContentCard/noContentCard';
import { ROUTES } from '@/app/_shared/lib/config/routes';

interface SavedSearch {
  id: string;
  niche: string;
  location: string;
  created_at: string;
  business_count: number;
}

export default function SearchesPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/searches')
      .then((res) => res.json())
      .then((data) => setSearches(data.searches ?? []))
      .catch(() => setSearches([]))
      .finally(() => setIsLoading(false));
  }, []);

  const handleLoad = (searchId: string) => {
    router.push(`${ROUTES.HOME}?load=${searchId}`);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(ROUTES.HOME)}
              className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              ← Back
            </button>
            <span className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
              Saved Searches
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-secondary)]">
            <Spinner size="md" />
            <span className="text-sm">Loading searches…</span>
          </div>
        ) : searches.length === 0 ? (
          <NoContentCard
            title="No saved searches yet"
            description="Run a search from the dashboard and it will appear here."
          />
        ) : (
          <div className="space-y-3">
            {searches.map((search) => (
              <div
                key={search.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] capitalize">
                    {search.niche} — {search.location}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {new Date(search.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    · {search.business_count} businesses
                  </p>
                </div>
                <button
                  onClick={() => handleLoad(search.id)}
                  className="shrink-0 text-sm font-medium text-[var(--color-primary-600)] hover:underline"
                >
                  Load →
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
