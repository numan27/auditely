// The landing page, as a signed-out visitor first sees it: one field for the
// free audit, a real sample report, the agency steps and the prices, built from
// the same plans and feature names the app uses, and nothing about DevArtVentures.

import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';

// Next hands an imported picture to next/image with its size; vitest hands over only a path
vi.mock('@/app/_shared/assets/images/landing/resultsLight.png', () => ({
  default: { src: '/resultsLight.png', width: 1440, height: 1240 },
}));
vi.mock('@/app/_shared/assets/images/landing/resultsDark.png', () => ({
  default: { src: '/resultsDark.png', width: 1440, height: 1240 },
}));
import { renderToStaticMarkup } from 'react-dom/server';
import { LandingPage } from '@/app/_shared/components/landing/landingPage';
import { FreeAuditHero } from '@/app/_shared/components/landing/freeAuditHero';
import { SampleReport } from '@/app/_shared/components/landing/sampleReport';
import { AgencySteps } from '@/app/_shared/components/landing/agencySteps';
import { PricingTable, planPrice } from '@/app/_shared/components/landing/pricingTable';
import { PlansView } from '@/app/_shared/components/auditely/plansView/plansView';
import { PLANS } from '@/app/_shared/lib/usage/plans';
import { PLAN_FEATURES } from '@/app/_shared/lib/usage/usageCopy';
import { sampleReportData } from '@/app/_shared/lib/demo/demoData';

// What a reader sees: the markup's text, entities decoded
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const count = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].length;
/** The opening tag of the link that reads `label` */
const linkTo = (html: string, label: string) => html.match(new RegExp(`<a[^>]*>\\s*${label}\\s*</a>`))?.[0] ?? '';

const hero = (enabled: boolean) => renderToStaticMarkup(createElement(FreeAuditHero, { enabled }));
const page = (freeAuditOn: boolean) => renderToStaticMarkup(createElement(LandingPage, { freeAuditOn }));

describe('the hero', () => {
  it('has one field, labelled Paste a website, and no illustration', () => {
    const html = hero(true);
    expect(text(html)).toContain('Audit any website in about a minute.');
    expect(text(html)).toContain(
      'Speed, SEO, mobile, SSL and AI-search readiness, scored and explained in plain English. Your first audit is free, with no sign-up.'
    );
    expect(count(html, /<input/g)).toBe(1);
    expect(html).toMatch(/<label[^>]*for="site"[^>]*>Paste a website<\/label>/);
    expect(html).toMatch(/<input[^>]*id="site"/);
    expect(html).toContain('placeholder="example.com"');
    expect(text(html)).toContain('Audit it');
    expect(text(html)).toContain(
      `One free audit per visitor. Sign up free to keep it, and run ${PLANS.free.limits.audit} audits a month.`
    );
    // Icons only: no pictures, and every drawing is hidden from screen readers
    expect(html).not.toContain('<img');
    expect(count(html, /<svg/g)).toBe(count(html, /<svg[^>]*aria-hidden/g));
  });

  it('says Sign up to audit a website when free audits are off', () => {
    const html = hero(false);
    expect(text(html)).toContain('Sign up to audit a website.');
    expect(linkTo(html, 'Sign up free')).toContain('href="/signup"');
    expect(html).not.toContain('<input');
    // The headline and lead still say what Auditely does
    expect(text(html)).toContain('Audit any website in about a minute.');
  });
});

describe('the sample report', () => {
  const html = renderToStaticMarkup(createElement(SampleReport));

  it("shows the sample report's seven scores and its plain-English summary", () => {
    expect(text(html)).toContain('Cosmetic Dentists of Houston');
    expect(text(html)).toContain('Sample report');
    expect(text(html)).toContain('72 Performance 85 SEO 37 Mobile Valid SSL 75 GEO 55 AEO 85 Lead capture');
    expect(text(html)).toContain('In plain English');
    expect(text(html)).toContain(sampleReportData().report.summary);
    expect(sampleReportData().report.summary).toContain('the site doesn’t clearly explain that you are a cosmetic dentist');
    expect(text(html)).toContain('What to fix first');
    expect(text(html)).toContain('Add an online booking or appointment-request button.');
  });

  it('leads to the search it came from', () => {
    expect(linkTo(html, 'See the sample search this came from')).toContain('href="/demo"');
    expect(html).toContain('href="https://www.houstondental.com/"');
    expect(text(html)).toContain('houstondental.com');
  });

  it('sends the sample without its outreach email', () => {
    expect(Object.keys(sampleReportData().report).sort()).toEqual(['improvements', 'summary']);
    expect(sampleReportData().audit).not.toHaveProperty('id');
    expect(sampleReportData().audit).not.toHaveProperty('business_id');
  });
});

describe('for agencies', () => {
  const html = renderToStaticMarkup(createElement(AgencySteps));

  it('links See a sample search to the demo, under the Google Maps notice', () => {
    expect(text(html)).toContain('Looking for clients? Audit a whole city.');
    for (const step of ['Search a business type and a city', 'Audit every website', 'Send each one its report']) {
      expect(text(html)).toContain(step);
    }
    expect(linkTo(html, 'See a sample search')).toContain('href="/demo"');
    expect(html).toMatch(/<figcaption[^>]*>Business data from Google Maps<\/figcaption>/);
    expect(count(html, /alt="Auditely&#x27;s results for cosmetic dentists in Houston, TX"/g)).toBe(2);
  });
});

describe('pricing', () => {
  const html = renderToStaticMarkup(createElement(PricingTable));

  it('prices each plan from PLANS', () => {
    expect(planPrice(PLANS.pro, 'month')).toEqual({ amount: `$${PLANS.pro.monthlyPrice}`, per: 'a month' });
    expect(planPrice(PLANS.agency, 'month')).toEqual({ amount: '$59', per: 'a month' });
    expect(planPrice(PLANS.pro, 'year')).toEqual({ amount: `$${PLANS.pro.yearlyPrice}`, per: 'a year' });
    expect(planPrice(PLANS.agency, 'year')).toEqual({ amount: '$590', per: 'a year' });
    expect(planPrice(PLANS.free, 'year')).toEqual({ amount: '$0', per: null });

    expect(text(html)).toContain('$0');
    expect(text(html)).toContain('$24 a month');
    expect(text(html)).toContain('$59 a month');
    expect(text(html)).toContain(
      'Prices are in US dollars, before sales tax. Yearly: Pro is $240 and Agency is $590. Cancel any time from Settings.'
    );
    for (const line of ['1 search a month', '5 audits a month', '250 audits a month', '1,000 audits a month', '400 email lookups a month']) {
      expect(text(html)).toContain(line);
    }
    // Free has no email lookups, so it doesn't list them
    expect(text(html)).not.toMatch(/(^|\s)0 email lookups/);
  });

  it('offers monthly or yearly, two months free', () => {
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Monthly<\/button>/);
    expect(text(html)).toContain('Yearly two months free');
  });

  it('starts every plan at sign-up, and a paid one on the plans page after', () => {
    expect(linkTo(html, 'Start free')).toContain('href="/signup"');
    expect(linkTo(html, 'Choose Pro')).toContain('href="/signup?callbackUrl=%2Fplans"');
    expect(linkTo(html, 'Choose Agency')).toContain('href="/signup?callbackUrl=%2Fplans"');
  });

  it('uses the same feature labels as the plans page', () => {
    const plans = renderToStaticMarkup(
      createElement(PlansView, {
        summary: null,
        billing: { ready: false, canBuy: true, subscription: null, interval: 'month', justSubscribed: false },
      })
    );
    expect(PLAN_FEATURES.map((f) => f.label)).toContain('Audit a whole search at once');
    for (const { label } of PLAN_FEATURES) {
      expect(text(html)).toContain(label);
      expect(text(plans)).toContain(label);
    }
  });
});

describe('LandingPage', () => {
  it('runs from the free audit to the sample, the agency steps, pricing and a last way in', () => {
    const html = page(true);
    const at = (needle: string) => html.indexOf(needle);
    expect(at('Audit any website in about a minute.')).toBeGreaterThan(-1);
    expect(at('id="sample"')).toBeGreaterThan(at('Audit any website in about a minute.'));
    expect(at('Looking for clients?')).toBeGreaterThan(at('id="sample"'));
    expect(at('id="pricing"')).toBeGreaterThan(at('Looking for clients?'));
    expect(at('Try it on a site you know.')).toBeGreaterThan(at('id="pricing"'));
    expect(linkTo(html, 'Audit a website')).toContain('href="#site"');
    expect(at('© ')).toBeGreaterThan(at('Try it on a site you know.'));
  });

  it('sends the closing button to sign-up when free audits are off', () => {
    const html = page(false);
    expect(linkTo(html, 'Audit a website')).toBe('');
    expect(text(html)).toContain('Sign up to audit a website.');
    const closing = html.slice(html.indexOf('Try it on a site you know.'));
    expect(linkTo(closing, 'Sign up free')).toContain('href="/signup"');
  });

  it('never mentions DevArtVentures', () => {
    for (const on of [true, false]) expect(page(on)).not.toMatch(/dev\s*art\s*ventures/i);
  });
});
