// app/_shared/components/auditely/expiredSearch/expiredSearch.tsx

// A saved search over 30 days old. Google's terms keep its place details that
// long, so the leads are hidden until the search runs again, which refreshes
// them: each business Google still lists keeps its row, and so its audit.

import { Button } from '@/app/_shared/components/ui/button/button';

const COUNTS = 'It counts as one of your searches.';

interface ExpiredSearchProps {
  /** How many leads the search had */
  count: number;
  onRefresh: () => void;
}

export function ExpiredSearch({ count, onRefresh }: ExpiredSearchProps) {
  const businesses = `${count} ${count === 1 ? 'business' : 'businesses'}`;
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-[var(--color-border-hover)] px-6 py-12 text-center">
      <p className="font-medium text-[var(--color-text-primary)]">This search is over 30 days old</p>
      <p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-[var(--color-text-tertiary)]">
        {count > 0
          ? `Google's details for its ${businesses} are kept for 30 days, so they're hidden. Refresh the search to see them again: each business Google still lists keeps its audit. ${COUNTS}`
          : `It found no businesses then. Refresh the search to look again. ${COUNTS}`}
      </p>
      <Button type="button" size="sm" className="mt-5" onClick={onRefresh}>
        Refresh this search
      </Button>
    </div>
  );
}
