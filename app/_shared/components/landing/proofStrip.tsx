// app/_shared/components/landing/proofStrip.tsx

// The line under the hero: where Auditely's data comes from and what it adds.

import type { ReactNode } from 'react';
import { GaugeIcon, MapPinIcon } from '@/app/_shared/components/ui/icons/icons';
import { wrapClasses } from '@/app/_shared/components/landing/landingStyles';

const icon = (path: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);

const ITEMS: { icon: ReactNode; text: string }[] = [
  { icon: <MapPinIcon size={18} />, text: 'Businesses from Google Maps' },
  { icon: <GaugeIcon size={18} />, text: 'Scores from Google PageSpeed Insights' },
  { icon: icon(<path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 19l-5-3.2L7 19l1.4-6.2L4 9l5.8-.7z" />), text: 'GEO and AEO checks for AI search' },
  {
    icon: icon(
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    text: 'Your logo on reports, on Pro and Agency',
  },
];

export function ProofStrip() {
  return (
    <section aria-label="What Auditely checks" className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
      <ul
        className={`${wrapClasses} grid gap-x-8 gap-y-3 py-[22px] text-[15px] leading-snug text-[var(--color-text-secondary)] min-[641px]:grid-cols-2 min-[1061px]:grid-cols-4`}
      >
        {ITEMS.map((item) => (
          <li key={item.text} className="flex items-start gap-2.5">
            <span className="mt-px flex-none text-[var(--color-primary-600)]">{item.icon}</span>
            {item.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
