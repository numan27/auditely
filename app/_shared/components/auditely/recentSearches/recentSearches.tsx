// app/_shared/components/auditely/recentSearches/recentSearches.tsx

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRightIcon } from '@/app/_shared/components/ui/icons/icons';
import { API_ROUTES, ROUTES } from '@/app/_shared/lib/config/routes';
import { searchTitle } from '@/app/_shared/lib/utils/searchLabel';

interface SavedSearch {
  id: string;
  niche: string;
  location: string;
  business_count: number;
}

const SHOWN = 6;

/** Before the first search: reopen a recent one in a click */
export function RecentSearches({ onOpen }: { onOpen: (searchId: string) => void }) {
  const [searches, setSearches] = useState<SavedSearch[] | null>(null);

  useEffect(() => {
    fetch(API_ROUTES.SEARCHES)
      .then((res) => res.json())
      .then((data) => setSearches(data.searches ?? []))
      .catch(() => setSearches([]));
  }, []);

  if (searches === null) return null;

  if (searches.length === 0) {
    return (
      <p className="mt-10 max-w-lg text-sm leading-relaxed text-[var(--color-text-tertiary)]">
        Enter a business type and a city. You&apos;ll get every local business we can find, with its contact details,
        and can audit each website in one click.
      </p>
    );
  }

  return (
    <section className="mt-12" aria-labelledby="recent-searches">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="recent-searches" className="text-sm font-semibold text-[var(--color-text-primary)]">
          Recent searches
        </h2>
        {searches.length > SHOWN && (
          <Link href={ROUTES.SEARCHES} className="text-sm font-medium text-[var(--color-primary-600)] hover:underline">
            See all {searches.length}
          </Link>
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {searches.slice(0, SHOWN).map((search) => (
          <li key={search.id}>
            <button
              type="button"
              onClick={() => onOpen(search.id)}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--color-border-hover)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">
                  {searchTitle(search)}
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">{search.business_count} businesses</span>
              </span>
              <ChevronRightIcon
                size={16}
                className="shrink-0 text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
