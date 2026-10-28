// app/_shared/components/auditely/pageLoader/pageLoader.tsx

// The screen shown while a page loads: Auditely's mark as a gauge taking a reading
// (its needle sweeping the dial), rings going out behind it as on the search's
// radar, and a bar sliding under the name. It fades in after a beat, so a quick
// page change doesn't flash it, and holds still as the plain mark for anyone who
// asked for less motion.

import styles from './pageLoader.module.scss';

export function PageLoader() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)]">
      <span className="sr-only">Loading Auditely</span>
      <div aria-hidden className={`${styles.loader} flex flex-col items-center gap-5`}>
        <div className={styles.stage}>
          <span className={styles.ring} />
          <span className={`${styles.ring} ${styles.ringLate}`} />
          <svg width="64" height="64" viewBox="0 0 24 24" className={styles.mark}>
            <rect width="24" height="24" rx="7" fill="var(--color-primary-600)" />
            <path
              d="M6.5 16a5.5 5.5 0 1 1 11 0"
              fill="none"
              stroke="var(--color-on-primary)"
              strokeOpacity="0.35"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              className={styles.reading}
              d="M6.5 16a5.5 5.5 0 1 1 11 0"
              pathLength={1}
              fill="none"
              stroke="var(--color-on-primary)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path className={styles.needle} d="M12 16l3.2-4.2" stroke="var(--color-on-primary)" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1.25" fill="var(--color-on-primary)" />
          </svg>
        </div>
        <div className="flex flex-col items-center gap-3">
          <span className="font-display text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">Auditely</span>
          <span className={styles.track}>
            <span className={styles.bar} />
          </span>
        </div>
      </div>
    </div>
  );
}
