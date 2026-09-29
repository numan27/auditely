// app/_shared/components/auditely/contactLine/contactLine.tsx

import type { ReactNode } from 'react';

/** One contact detail on a business card: a muted icon and its value */
export function ContactLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-start gap-2 text-sm text-[var(--color-text-secondary)]">
      <span className="mt-[3px] shrink-0 text-[var(--color-text-tertiary)]">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}
