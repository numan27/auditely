// app/_shared/components/landing/reportShowcase.tsx

// "03 · What you send": the sample's report as the prospect sees it, under the
// place for your logo, with its first email and what Pro and Agency do next.
// Takes the old "What you get back" section's place (sampleReport.tsx).

import type { ReactNode } from 'react';
import { TONE_FILL, toneOf, toneWords } from '@/app/_shared/components/landing/scoreRing';
import { cardClasses, eyebrowClasses, headingClasses, sectionClasses, subClasses, wrapClasses } from '@/app/_shared/components/landing/landingStyles';
import type { LandingSample } from '@/app/_shared/lib/demo/landingDemo';

const tick = (path: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 flex-none text-[var(--color-primary-600)]">
    {path}
  </svg>
);

const NEXT: { icon: ReactNode; text: string }[] = [
  {
    icon: tick(
      <>
        <path d="M4 6h16v12H4z" />
        <path d="M4 7l8 6 8-6" />
      </>
    ),
    text: 'Send it from your own mailbox, so replies come to you',
  },
  {
    icon: tick(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      </>
    ),
    text: 'Hand the lead and a private report link to HubSpot',
  },
  {
    icon: tick(
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M4 10h16M10 10v10" />
      </>
    ),
    text: 'Export to CSV or Google Sheets',
  },
];

/** The email's opening paragraph: the card shows how it starts */
const opening = (body: string) => body.split(/\n\s*\n/)[0]?.trim() ?? '';

export function ReportShowcase({ sample }: { sample: LandingSample }) {
  return (
    <section id="sample" className={`scroll-mt-[72px] bg-[var(--color-bg-primary)] ${sectionClasses}`}>
      <div className={wrapClasses}>
        <p className={eyebrowClasses}>03 · What you send</p>
        <h2 className={headingClasses}>A report your prospect reads in a minute.</h2>
        <p className={subClasses}>
          The real report for {sample.name}, exactly as Auditely wrote it. On Pro and Agency it goes out under your logo.
        </p>
        <div className="mt-11 grid items-start gap-5 min-[961px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <article aria-label={`Sample report for ${sample.name}`} className={`${cardClasses} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-6 py-[18px]">
              <span className="flex items-center gap-3">
                <span className="inline-grid h-10 place-items-center rounded-[10px] border-[1.5px] border-dashed border-[var(--color-border-hover)] px-3 font-mono text-xs text-[var(--color-text-secondary)]">
                  YOUR LOGO
                </span>
                <span>
                  <span className="block font-semibold text-[var(--color-text-primary)]">Your agency</span>
                  <span className="block text-[13px] text-[var(--color-text-secondary)]">you@youragency.com · Book a call</span>
                </span>
              </span>
              <span className="rounded-full bg-[var(--color-primary-50)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary-600)] dark:bg-[var(--color-primary-600)]/15 dark:text-[var(--color-primary-300)]">
                Sample report
              </span>
            </div>
            <div className="p-6">
              <p className="text-sm text-[var(--color-text-secondary)]">Website audit for</p>
              <h3 className="font-display text-[28px] font-bold leading-tight tracking-tight text-[var(--color-text-primary)]">{sample.name}</h3>
              <ul className="mt-5 grid grid-cols-2 gap-2.5 min-[601px]:grid-cols-3">
                {sample.scores.map((s) => (
                  <li key={s.label} className="rounded-[14px] border border-[var(--color-border)] p-3 min-[601px]:px-3.5">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[var(--color-text-primary)] min-[601px]:text-sm">{s.label}</span>
                      <span className="font-display text-xl font-bold tabular-nums text-[var(--color-text-primary)] min-[601px]:text-2xl">{s.score ?? '—'}</span>
                    </p>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]" aria-hidden>
                      <span className={`block h-full rounded-full ${TONE_FILL[toneOf(s.score)]}`} style={{ width: `${s.score ?? 0}%` }} />
                    </span>
                    <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{toneWords(s.score)}</p>
                  </li>
                ))}
              </ul>
              <h4 className="mt-[26px] text-base font-bold text-[var(--color-text-primary)]">The short version</h4>
              <p className="mt-1.5 text-base leading-relaxed text-[var(--color-text-primary)]">{sample.summary}</p>
              {sample.improvements.length > 0 && (
                <>
                  <h4 className="mt-[22px] text-base font-bold text-[var(--color-text-primary)]">What to fix first</h4>
                  <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-[15px] text-[var(--color-text-primary)]">
                    {sample.improvements.map((fix) => (
                      <li key={fix}>{fix}</li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          </article>
          <div className="grid gap-5">
            <div className={`${cardClasses} p-[22px]`}>
              <p className={eyebrowClasses}>The first email</p>
              <p className="mt-2.5 text-[17px] font-bold text-[var(--color-text-primary)]">{sample.email.subject}</p>
              <p className="mt-2 line-clamp-5 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{opening(sample.email.body)}</p>
            </div>
            <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-[22px]">
              <p className="text-base font-bold text-[var(--color-text-primary)]">Then, on Pro and Agency</p>
              <ul className="mt-3 grid gap-3 text-[15px] text-[var(--color-text-secondary)]">
                {NEXT.map((item) => (
                  <li key={item.text} className="flex gap-2.5">
                    {item.icon}
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
