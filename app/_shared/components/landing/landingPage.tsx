// app/_shared/components/landing/landingPage.tsx

// What a signed-out visitor sees at / once sign-ups are open: try the free audit
// beside a moving sample, a real search from the demo, how it works, the report
// you send, the prices, questions, and one last way in. Built to the approved
// mockup (the landing canvas, Version 2). The demo's rows are trimmed here, on the
// server: no email address or phone number reaches the browser.

import { LandingHeader } from '@/app/_shared/components/landing/landingHeader';
import { LandingFooter } from '@/app/_shared/components/landing/landingFooter';
import { FreeAuditHero } from '@/app/_shared/components/landing/freeAuditHero';
import { ProofStrip } from '@/app/_shared/components/landing/proofStrip';
import { DemoSection } from '@/app/_shared/components/landing/demoSection';
import { HowItWorks } from '@/app/_shared/components/landing/howItWorks';
import { ReportShowcase } from '@/app/_shared/components/landing/reportShowcase';
import { LandingFaq } from '@/app/_shared/components/landing/landingFaq';
import { ClosingBand } from '@/app/_shared/components/landing/closingBand';
import { eyebrowClasses, headingClasses, sectionClasses, subClasses, wrapClasses } from '@/app/_shared/components/landing/landingStyles';
// The first landing page's sections, kept for now: the report and the demo sections took their places
// import { SampleReport } from '@/app/_shared/components/landing/sampleReport';
// import { AgencySteps } from '@/app/_shared/components/landing/agencySteps';
import { PricingTable } from '@/app/_shared/components/landing/pricingTable';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { landingLeads, landingSample, searchLabel } from '@/app/_shared/lib/demo/landingDemo';
import type { Walkthrough } from '@/app/_shared/lib/demo/walkthrough';

interface LandingPageProps {
  freeAuditOn: boolean;
  /** The recorded walkthrough, when there is one: the hero links to it and the demo section plays it */
  video: Walkthrough | null;
  /** False during the beta: the paid plans show their prices but can't be bought */
  checkoutOpen: boolean;
}

export function LandingPage({ freeAuditOn, video, checkoutOpen }: LandingPageProps) {
  const sample = landingSample(demoData);
  const leads = landingLeads(demoData);
  const search = searchLabel(demoData.query);
  return (
    <div className="bg-[var(--color-surface)]">
      <LandingHeader />
      <main>
        <FreeAuditHero enabled={freeAuditOn} sample={sample} video={!!video} />
        <ProofStrip />
        <DemoSection leads={leads} search={search} video={video} />
        <HowItWorks search={search} total={leads.length} sample={sample} />
        <ReportShowcase sample={sample} />

        <section id="pricing" className={`scroll-mt-[72px] bg-[var(--color-surface)] ${sectionClasses}`}>
          <div className={wrapClasses}>
            <p className={eyebrowClasses}>04 · Pricing</p>
            <h2 className={headingClasses}>Start free. Upgrade when you need more.</h2>
            <p className={subClasses}>One new client pays for a year of Pro.</p>
            <PricingTable checkoutOpen={checkoutOpen} />
          </div>
        </section>

        <LandingFaq checkoutOpen={checkoutOpen} />
        <ClosingBand enabled={freeAuditOn} />
      </main>
      <LandingFooter />
    </div>
  );
}
