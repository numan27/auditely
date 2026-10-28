import type { ReactNode } from 'react';
import { LEGAL } from '@/app/_shared/lib/config/legal';

// The Terms' and Privacy's type: a title with its date, then short sections

export function LegalTitle({ children }: { children: ReactNode }) {
  return (
    <header className="mb-10">
      <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">{children}</h1>
      <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">Effective {LEGAL.effectiveDate}</p>
    </header>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 space-y-4 text-[16px] leading-7 text-[var(--color-text-secondary)] [&_a]:text-[var(--color-primary-600)] [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_strong]:text-[var(--color-text-primary)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">{title}</h2>
      {children}
    </section>
  );
}

/** "Write to us" with the operator's details, for both pages' Contact section */
export function LegalContact({ about }: { about: string }) {
  return (
    <p>
      Questions about {about}: email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>, or write to{' '}
      {LEGAL.operator}, {LEGAL.mailingAddress}.
    </p>
  );
}
