// app/_shared/components/landing/landingStyles.ts

// The landing page's shared class names. A plain module: a server component
// importing a string from a 'use client' file gets a client reference instead.

/** The page's column: 1120px wide, with the mockup's 40px sides (16px on phones) */
export const wrapClasses = 'mx-auto max-w-[1120px] px-4 min-[601px]:px-10';

/** The white card the reports, the picture and the plans sit on */
export const cardClasses =
  'rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(17,23,38,.04),0_14px_36px_-16px_rgba(17,23,38,.14)]';
