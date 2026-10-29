// app/_shared/components/auditely/brandStudio/studioLocked.tsx

// What a Free account (and every account in the beta without a paid plan)
// reads above the studio: the look in the preview is a sample, and which plans
// make it theirs. While checkout is closed there's no plan to send them to.

import Link from 'next/link';
import { ROUTES } from '@/app/_shared/lib/config/routes';

export function StudioLocked({ checkoutOpen }: { checkoutOpen: boolean }) {
  return (
    <div
      role="note"
      className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
    >
      {/* The showcase's own colours, as a small swatch of what the studio does */}
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 overflow-hidden rounded-xl">
        <span className="w-2/3 bg-[#0e7490]" />
        <span className="w-1/3 bg-[#f59e0b]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--color-text-primary)]">Brand studio comes with Pro and Agency</p>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          The preview shows a sample look. With a paid plan, your colours, logo, sections and wording go on every report and email.
          {!checkoutOpen && ' Paid plans open after the beta.'}
        </p>
      </div>
      {checkoutOpen && (
        <Link
          href={ROUTES.PLANS}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-text-primary)] px-4 text-sm font-medium text-[var(--color-bg-primary)] hover:opacity-90"
        >
          See plans
        </Link>
      )}
    </div>
  );
}
