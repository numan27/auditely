'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';
import { Button } from '@/app/_shared/components/ui/button/button';
import { ChevronRightIcon, SearchIcon } from '@/app/_shared/components/ui/icons/icons';
import { LoadFailed } from '@/app/_shared/components/auditely/loadFailed/loadFailed';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { loadSavedSearches, type SavedSearch } from '@/app/_shared/lib/utils/savedSearches';
import { searchCount, searchTitle } from '@/app/_shared/lib/utils/searchLabel';
import { searchPath } from '@/app/_shared/lib/utils/workspacePath';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

function ListSkeleton() {
  return (
    <div className="divide-y divide-[var(--color-border)]" role="status">
      <span className="sr-only">Loading saved searches</span>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
          <div className="h-9 w-9 rounded-lg bg-[var(--color-bg-tertiary)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-60 max-w-full rounded bg-[var(--color-bg-tertiary)]" />
            <div className="h-3 w-24 rounded bg-[var(--color-bg-tertiary)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchesPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Why the list didn't load: shown with Try again, never as "No saved searches yet"
  const [error, setError] = useState<string | null>(null);

  // Try again loads the list afresh
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    loadSavedSearches().then((result) => {
      if (result.ok) setSearches(result.searches);
      else setError(result.error);
      setIsLoading(false);
    });
  }, [attempt]);

  const retry = () => {
    setIsLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Saved searches
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--color-text-secondary)]">
          Every search keeps its businesses, contacts and audits. Open one to pick up where you left off.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {isLoading ? (
            <ListSkeleton />
          ) : error ? (
            <LoadFailed title="Your saved searches didn't load" message={error} onRetry={retry} />
          ) : searches.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-medium text-[var(--color-text-primary)]">No saved searches yet</p>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Your searches appear here after you run them.</p>
              <div className="mt-5">
                <Button variant="primary" size="sm" onClick={() => router.push(ROUTES.HOME)}>
                  Find leads
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {searches.map((search) => (
                <li key={search.id}>
                  <button
                    type="button"
                    onClick={() => router.push(searchPath(search.id))}
                    className="group flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-tertiary)]">
                      <SearchIcon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[var(--color-text-primary)]">{searchTitle(search)}</span>
                      <span className="text-sm text-[var(--color-text-tertiary)]">{searchCount(search)}</span>
                    </span>
                    <span className="hidden text-sm tabular-nums text-[var(--color-text-tertiary)] sm:block">
                      {formatDate(search.created_at)}
                    </span>
                    <ChevronRightIcon
                      size={16}
                      className="shrink-0 text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
