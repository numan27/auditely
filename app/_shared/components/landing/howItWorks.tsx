// app/_shared/components/landing/howItWorks.tsx

// "02 · How it works": a city's businesses to a first email, in three steps, each
// over a small picture of that step. Takes the agency steps' place (agencySteps.tsx).

import type { ReactNode } from 'react';
import { ScoreRing } from '@/app/_shared/components/landing/scoreRing';
import { eyebrowClasses, headingClasses, sectionClasses, wrapClasses } from '@/app/_shared/components/landing/landingStyles';
import type { LandingSample } from '@/app/_shared/lib/demo/landingDemo';

const pictureClasses =
  'flex h-[132px] flex-col justify-center gap-2.5 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4';
const pill = 'rounded-full px-2.5 py-1 text-xs font-semibold';
const box =
  'block h-[38px] min-w-0 flex-1 truncate rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] leading-[36px] text-[var(--color-text-primary)]';

function Step({ n, title, text, picture }: { n: number; title: string; text: string; picture: ReactNode }) {
  return (
    <li className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className={pictureClasses} aria-hidden>
        {picture}
      </div>
      <p className="mt-6 font-mono text-[13px] text-[var(--color-primary-600)]">Step {n}</p>
      <h3 className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-[var(--color-text-primary)]">{title}</h3>
      <p className="mt-2 text-base leading-normal text-[var(--color-text-secondary)]">{text}</p>
    </li>
  );
}

interface HowItWorksProps {
  search: { niche: string; location: string };
  total: number;
  sample: LandingSample;
}

export function HowItWorks({ search, total, sample }: HowItWorksProps) {
  // Four of the sample's scores, good to poor
  const rings = sample.scores.slice(0, 4);
  return (
    <section id="how" className={`scroll-mt-[72px] bg-[var(--color-surface)] ${sectionClasses}`}>
      <div className={wrapClasses}>
        <p className={eyebrowClasses}>02 · How it works</p>
        <h2 className={headingClasses}>From a city to a first email, in three steps.</h2>
        <ol className="mt-12 grid gap-5 min-[961px]:grid-cols-3">
          <Step
            n={1}
            title="Search a trade and a city"
            text="Every business Google Maps lists, with its rating, reviews and website."
            picture={
              <>
                <div className="flex gap-2">
                  <span className={box}>{search.niche}</span>
                  <span className={box}>{search.location}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`${pill} bg-[var(--color-primary-600)]/10 text-[var(--color-primary-600)]`}>{total} found</span>
                  <span className={`${pill} border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]`}>
                    ratings and reviews
                  </span>
                </div>
              </>
            }
          />
          <Step
            n={2}
            title="Audit every website"
            text="Seven checks on each site, scored and explained, with the weakest sites first."
            picture={
              <div className="flex items-center justify-center gap-3">
                {rings.map((s) => (
                  <ScoreRing key={s.label} score={s.score} size={50} />
                ))}
              </div>
            }
          />
          <Step
            n={3}
            title="Send each one its report"
            text="A PDF and a first email for every business, under your own name and logo on Pro and Agency."
            picture={
              <>
                <p className="truncate text-[13px] text-[var(--color-text-secondary)]">
                  Subject <strong className="text-[var(--color-text-primary)]">{sample.email.subject}</strong>
                </p>
                <span className="block h-2 w-[94%] rounded-full bg-[var(--color-border)]" />
                <span className="block h-2 w-4/5 rounded-full bg-[var(--color-border)]" />
                <div className="mt-1 flex gap-1.5">
                  <span className={`${pill} border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]`}>report.pdf</span>
                  <span className={`${pill} bg-[var(--color-primary-600)] text-[var(--color-on-primary)]`}>Send</span>
                </div>
              </>
            }
          />
        </ol>
      </div>
    </section>
  );
}
