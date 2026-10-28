// app/_shared/components/landing/landingStyles.ts

// The landing page's shared class names and anchors. A plain module: a server
// component importing a string from a 'use client' file gets a client reference instead.

/** The page's column: 1200px wide, with 40px sides (16px on phones) */
export const wrapClasses = 'mx-auto max-w-[1200px] px-4 min-[601px]:px-10';

/** The white card the reports, the demo and the plans sit on */
export const cardClasses =
  'rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(17,23,38,.05),0_24px_60px_-28px_rgba(17,23,38,.28)] dark:shadow-[0_1px_2px_rgba(0,0,0,.3),0_24px_60px_-28px_rgba(0,0,0,.7)]';

/** A section's room above and below */
export const sectionClasses = 'py-[72px] min-[601px]:py-28';

/** "01 · Live demo" over a section's heading */
export const eyebrowClasses = 'font-mono text-[13px] font-medium tracking-wide text-[var(--color-primary-600)]';

export const headingClasses =
  'mt-3 font-display text-[34px] font-bold leading-[1.05] tracking-tight text-[var(--color-text-primary)] min-[601px]:text-[48px]';

export const subClasses = 'mt-4 max-w-[640px] text-lg leading-relaxed text-[var(--color-text-secondary)]';

/** The anchor that opens the demo section on its walkthrough: the hero's "Watch the demo" link */
export const WALKTHROUGH_HASH = '#demo-video';
