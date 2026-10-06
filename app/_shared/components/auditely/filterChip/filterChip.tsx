// app/_shared/components/auditely/filterChip/filterChip.tsx

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  active: boolean;
  label: string;
  /** How many leads match with this filter on */
  count?: number;
  /** Shown after the count (the arrow of a chip that opens a menu) */
  trailing?: ReactNode;
}

/** One pill in the results filter row: a tick while it's on, its label and, when given, its match count */
export function FilterChip({ active, label, count, trailing, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-600)]/10 text-[var(--color-primary-600)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]'
      }`}
      {...props}
    >
      {active && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {label}
      {count !== undefined && <span className={`tabular-nums ${active ? '' : 'text-[var(--color-text-tertiary)]'}`}>{count}</span>}
      {trailing}
    </button>
  );
}
