// app/_shared/components/auditely/brandStudio/studioPanel.tsx

// What every studio tab opens with: its name and one line on what it changes.

import type { ReactNode } from 'react';

export function PanelIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">{children}</p>
    </div>
  );
}
