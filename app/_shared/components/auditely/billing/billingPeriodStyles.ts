// app/_shared/components/auditely/billing/billingPeriodStyles.ts

// Monthly or yearly: one look for the landing page's prices and /plans. A plain
// module: a server component importing a string from a 'use client' file gets a
// client reference instead.

/** The pill the two choices sit in */
export const periodTrackClasses = 'inline-flex gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1';

/** One choice; the chosen one is filled with the page's text colour */
export const periodOptionClasses = (chosen: boolean) =>
  `inline-flex min-h-10 items-center rounded-full px-[18px] text-[15px] font-medium ${
    chosen
      ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-primary)]'
      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
  }`;
