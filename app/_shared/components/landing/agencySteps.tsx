// app/_shared/components/landing/agencySteps.tsx

// For agencies: what Auditely does for a whole city, in three steps, beside a
// picture of the demo's results list.

import Image from 'next/image';
import Link from 'next/link';
import { landingImages } from '@/app/_shared/assets/images';
import { cardClasses } from '@/app/_shared/components/landing/landingStyles';
import { ROUTES } from '@/app/_shared/lib/config/routes';

const STEPS = [
  {
    title: 'Search a business type and a city',
    text: 'Every local business we can find, with its rating, reviews and website.',
  },
  {
    title: 'Audit every website',
    text: 'Seven scores for each site, and the problems worth calling about.',
  },
  {
    title: 'Send each one its report',
    text: 'A plain-English PDF and a first email, under your own name and logo on Pro and Agency.',
  },
];

const ALT = "Auditely's results for cosmetic dentists in Houston, TX";
// The picture fills its column up to 960px, then about half the page
const SIZES = '(max-width: 960px) 100vw, 600px';

export function AgencySteps() {
  return (
    <div className="grid items-center gap-16 min-[961px]:grid-cols-[1fr_1.15fr]">
      <div>
        <h2 className="font-display text-[34px] font-bold leading-[1.08] tracking-tight text-[var(--color-text-primary)] min-[601px]:text-[44px]">
          Looking for clients? Audit a whole city.
        </h2>
        <p className="mt-3.5 max-w-[620px] text-lg leading-relaxed text-[var(--color-text-secondary)]">
          Auditely finds the local businesses in any trade, audits every website, and writes each one a report worth sending.
        </p>
        <ol className="mb-8 mt-10 flex flex-col gap-[26px]">
          {STEPS.map((step, i) => (
            <li key={step.title} className="grid grid-cols-[44px_1fr] gap-4">
              <span
                className="grid h-[38px] w-[38px] place-items-center rounded-full border-[1.5px] border-[var(--color-primary-600)] font-display text-[17px] font-semibold text-[var(--color-primary-600)]"
                aria-hidden
              >
                {i + 1}
              </span>
              <div>
                <strong className="mb-1 mt-1.5 block text-lg font-semibold text-[var(--color-text-primary)]">{step.title}</strong>
                <span className="text-base leading-normal text-[var(--color-text-secondary)]">{step.text}</span>
              </div>
            </li>
          ))}
        </ol>
        <Link href={ROUTES.DEMO} className="text-base font-semibold text-[var(--color-primary-600)] hover:underline">
          See a sample search
        </Link>
      </div>

      <figure className="m-0">
        <div className={`${cardClasses} overflow-hidden`}>
          <Image src={landingImages.resultsLight} alt={ALT} sizes={SIZES} className="block h-auto w-full dark:hidden" />
          <Image src={landingImages.resultsDark} alt={ALT} sizes={SIZES} className="hidden h-auto w-full dark:block" />
        </div>
        <figcaption className="mt-3 text-sm text-[var(--color-text-tertiary)]">Business data from Google Maps</figcaption>
      </figure>
    </div>
  );
}
