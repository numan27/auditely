// app/_shared/components/auditely/settingsView/settingsSection.tsx

// One part of the settings page: what it is on the left, its form on the right.

import type { ReactNode } from 'react';

export function Section({ id, title, lead, children }: { id: string; title: string; lead: ReactNode; children?: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-20 gap-6 border-t border-[var(--color-border)] py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12"
    >
      <div>
        <h2 id={`${id}-title`} className="font-display text-xl font-semibold text-[var(--color-text-primary)]">
          {title}
        </h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{lead}</div>
      </div>
      {children && <div className="max-w-xl">{children}</div>}
    </section>
  );
}
