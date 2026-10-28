// app/_shared/components/auditely/searchRadar/searchRadar.tsx

'use client';

// What a search looks like while Google Maps is read: a radar sweeping round the
// city, businesses blinking on as it passes, and a line saying what's happening.
// The pins are a picture, not a count: nothing here claims how many were found.

import { useEffect, useState } from 'react';
import { SearchIcon } from '@/app/_shared/components/ui/icons/icons';
import styles from './searchRadar.module.scss';

/** Where the pins sit on the map, as percentages across and down */
const PINS: readonly [number, number][] = [
  [22, 30], [46, 20], [70, 26], [90, 40], [83, 64], [62, 76], [36, 72], [14, 58], [28, 47], [74, 50],
];
/** The map is about this many times wider than tall: each pin's angle is measured on it */
const RATIO = 2.6;
/** One turn of the sweep, as in the stylesheet */
const TURN_S = 3.6;
// A Places search takes a few seconds: each step shows for about two
const STEP_MS = 1800;

/** When the sweep reaches a pin: its angle clockwise from the top, as a share of a turn */
export function pinDelay(x: number, y: number): string {
  const degrees = ((Math.atan2((x - 50) * RATIO, 50 - y) * 180) / Math.PI + 360) % 360;
  return `${((degrees / 360) * TURN_S).toFixed(2)}s`;
}

/** The lines the search goes through, the last one staying until the results come */
export function searchSteps(niche?: string, location?: string): string[] {
  return [
    niche?.trim() && location?.trim() ? `Looking for ${niche.trim().toLowerCase()} in ${location.trim()}` : 'Looking for businesses',
    'Reading each Google Maps listing',
    'Collecting websites, phone numbers and ratings',
    'Putting the list together',
  ];
}

const Pin = () => (
  <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden>
    <path d="M11 27s9-8.6 9-15.5A9 9 0 0 0 2 11.5C2 18.4 11 27 11 27Z" fill="currentColor" />
    <circle cx="11" cy="11.5" r="3.4" fill="#fff" />
  </svg>
);

const Bar = ({ className }: { className: string }) => <div className={`rounded-md bg-[var(--color-bg-tertiary)] ${className}`} />;

export function SearchRadar({ niche, location }: { niche?: string; location?: string }) {
  const steps = searchSteps(niche, location);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setStep((n) => Math.min(n + 1, steps.length - 1)), STEP_MS);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="mt-10" role="status" aria-live="polite">
      <span className="sr-only">Finding businesses</span>
      <div
        className={`${styles.map} h-56 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] sm:h-64`}
        aria-hidden
      >
        <span className={styles.sweep} />
        {[0, 1, 2].map((i) => (
          <span key={i} className={styles.ring} style={{ animationDelay: `${(i * TURN_S) / 3}s` }} />
        ))}
        {PINS.map(([x, y]) => (
          <span key={`${x}-${y}`} className={styles.pin} style={{ left: `${x}%`, top: `${y}%`, animationDelay: pinDelay(x, y) }}>
            <Pin />
          </span>
        ))}
        <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--color-primary-600)] text-white shadow-[0_6px_24px_rgba(47,79,224,.35)]">
          <SearchIcon size={18} />
        </span>
      </div>
      <p key={step} className={`${styles.line} mt-4 text-sm font-medium text-[var(--color-text-primary)]`} aria-hidden>
        {steps[step]}…
      </p>
      <div className="mt-6 space-y-4" aria-hidden>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex animate-pulse items-start justify-between gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 motion-reduce:animate-none"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className="min-w-0 flex-1 space-y-3">
              <Bar className="h-5 w-56 max-w-full" />
              <Bar className="h-3.5 w-80 max-w-full" />
            </div>
            <Bar className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
