// app/_shared/components/auditely/demoBanner/demoBanner.tsx

'use client';

import { useDemo } from '@/app/_shared/lib/hooks/useDemo';

/** Tells a visitor they are looking at the public demo; nothing in the real app */
export function DemoBanner() {
  const demo = useDemo();
  if (!demo) return null;

  return (
    <div role="note" className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <p className="mx-auto max-w-5xl px-4 py-2 text-sm text-[var(--color-text-secondary)] sm:px-6">
        <span className="font-medium text-[var(--color-text-primary)]">Demo:</span> a real search with contact details
        hidden. Live search and audits are switched off.
        {demo.links.videoUrl && (
          <>
            {' '}
            <a
              href={demo.links.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap font-medium text-[var(--color-primary-600)] hover:underline"
            >
              Watch the 45-second walkthrough
            </a>
          </>
        )}
      </p>
    </div>
  );
}
