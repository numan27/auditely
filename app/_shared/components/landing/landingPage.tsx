// app/_shared/components/landing/landingPage.tsx

// What a signed-out visitor sees at / once sign-ups are open: try the free
// audit, see a real report, what agencies get, the prices, and one last way in.
// Built to the approved mockup, docs/superpowers/mockups/2026-10-31-landing.md.

import Link from 'next/link';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { LandingHeader } from '@/app/_shared/components/landing/landingHeader';
import { LandingFooter } from '@/app/_shared/components/landing/landingFooter';
import { FreeAuditHero } from '@/app/_shared/components/landing/freeAuditHero';
import { wrapClasses } from '@/app/_shared/components/landing/landingStyles';
import { SampleReport } from '@/app/_shared/components/landing/sampleReport';
import { AgencySteps } from '@/app/_shared/components/landing/agencySteps';
import { PricingTable } from '@/app/_shared/components/landing/pricingTable';
import { ROUTES } from '@/app/_shared/lib/config/routes';

const sectionClasses = 'py-[72px] min-[601px]:py-[104px]';
const headingClasses =
  'font-display text-[34px] font-bold leading-[1.08] tracking-tight text-[var(--color-text-primary)] min-[601px]:text-[44px]';
const subClasses = 'mt-3.5 max-w-[620px] text-lg leading-relaxed text-[var(--color-text-secondary)]';
const closingButton = `${buttonStyles.button} ${buttonStyles['button--primary']} min-h-12 px-6 text-base`;

export function LandingPage({ freeAuditOn }: { freeAuditOn: boolean }) {
  return (
    <div className="bg-[var(--color-surface)]">
      <LandingHeader />
      <main>
        <FreeAuditHero enabled={freeAuditOn} />

        <section id="sample" className={`scroll-mt-4 bg-[var(--color-bg-primary)] ${sectionClasses}`}>
          <div className={wrapClasses}>
            <h2 className={headingClasses}>What you get back</h2>
            <p className={subClasses}>A real audit of a cosmetic dentist in Houston, exactly as Auditely wrote it.</p>
            <div className="mt-10">
              <SampleReport />
            </div>
          </div>
        </section>

        <section className={sectionClasses}>
          <div className={wrapClasses}>
            <AgencySteps />
          </div>
        </section>

        <section id="pricing" className={`scroll-mt-4 bg-[var(--color-bg-primary)] ${sectionClasses}`}>
          <div className={wrapClasses}>
            <h2 className={headingClasses}>Pricing</h2>
            <p className={subClasses}>Start free. Upgrade when you need more.</p>
            <PricingTable />
          </div>
        </section>

        <section className={sectionClasses}>
          <div className={`${wrapClasses} flex flex-wrap items-center justify-between gap-6`}>
            <h2 className={headingClasses}>Try it on a site you know.</h2>
            {/* Free audits off: the hero has no field to go back to */}
            {freeAuditOn ? (
              <a href="#site" className={closingButton}>
                Audit a website
              </a>
            ) : (
              <Link href={ROUTES.SIGNUP} className={closingButton}>
                Sign up free
              </Link>
            )}
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
