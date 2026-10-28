// app/_shared/components/auditely/usageMeter/usageMeter.tsx

'use client';

import Link from 'next/link';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { useUsage } from '@/app/_shared/lib/hooks/useUsage';
import { meterLabel } from '@/app/_shared/lib/usage/usageCopy';

/** The header's note of the allowance closest to running out; a link to the plans. Hidden on phones */
export function UsageMeter() {
  const usage = useUsage();
  const label = usage?.summary ? meterLabel(usage.summary) : null;
  if (!label) return null;

  return (
    <Link
      href={ROUTES.PLANS}
      aria-label={label.text}
      className={`hidden whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)] md:inline-flex ${
        label.empty
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      {label.text}
    </Link>
  );
}
