// The landing page, as a signed-out visitor first sees it: one field for the
// free audit beside a moving sample, the demo's real search, how it works, the
// report you send, the prices from the same plans and feature names the app uses,
// questions, a last way in, and nothing about DevArtVentures.

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
import { FREE_PLAN_LINE, FreeAuditHero } from '@/app/_shared/components/landing/freeAuditHero';
import { DemoSection } from '@/app/_shared/components/landing/demoSection';
import { DemoWalkthrough } from '@/app/_shared/components/landing/demoWalkthrough';
import type { Walkthrough } from '@/app/_shared/lib/demo/walkthrough';
import { HowItWorks } from '@/app/_shared/components/landing/howItWorks';
import { ReportShowcase } from '@/app/_shared/components/landing/reportShowcase';
import { faqFor, LandingFaq } from '@/app/_shared/components/landing/landingFaq';
import { ClosingBand } from '@/app/_shared/components/landing/closingBand';
import { LandingHeader } from '@/app/_shared/components/landing/landingHeader';
import { SampleReport } from '@/app/_shared/components/landing/sampleReport';
import { AgencySteps } from '@/app/_shared/components/landing/agencySteps';
import { PricingTable, planHref, planPrice } from '@/app/_shared/components/landing/pricingTable';
import { PlansView } from '@/app/_shared/components/auditely/plansView/plansView';
import { PLANS } from '@/app/_shared/lib/usage/plans';
import { PLAN_FEATURES } from '@/app/_shared/lib/usage/usageCopy';
import { demoData, sampleReportData } from '@/app/_shared/lib/demo/demoData';
import { landingLeads, landingSample, searchLabel } from '@/app/_shared/lib/demo/landingDemo';
import { periodOptionClasses, periodTrackClasses } from '@/app/_shared/components/auditely/billing/billingPeriodStyles';

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

const sample = landingSample(demoData);
const leads = landingLeads(demoData);
const search = searchLabel(demoData.query);
const LOOM: Walkthrough = { kind: 'link', url: 'https://www.loom.com/share/abc123', playerUrl: 'https://www.loom.com/embed/abc123?autoplay=1' };
const YOUTUBE: Walkthrough = { kind: 'link', url: 'https://youtu.be/abc123', playerUrl: null };
const FILE: Walkthrough = {
  kind: 'file',
  src: '/media/walkthrough.mp4',
  poster: '/media/walkthrough-poster.jpg',
  chapters: [
    { at: 0, title: 'Search', detail: 'A business type and a city.' },
    { at: 27, title: 'Audit', detail: 'Six scores and the biggest issues.' },
  ],
};

const hero = (enabled: boolean, video = false) => renderToStaticMarkup(createElement(FreeAuditHero, { enabled, sample, video }));
const demo = (video: Walkthrough | null) => renderToStaticMarkup(createElement(DemoSection, { leads, search, video }));
const page = (freeAuditOn: boolean, video: Walkthrough | null = null) =>
  renderToStaticMarkup(createElement(LandingPage, { freeAuditOn, video, checkoutOpen: false }));

describe('the hero', () => {
  it('says who it is for, with one field labelled Paste a website', () => {
    const html = hero(true);
    expect(text(html)).toContain('For web designers, SEO freelancers and agencies');
    expect(html).toMatch(/<h1[^>]*>Find clients whose websites <span[^>]*>need you\.<\/span><\/h1>/);
    expect(text(html)).toContain(
      'Audit any website in about a minute. Speed, SEO, mobile, SSL and AI-search readiness, explained in plain English, with the first email written for you. Or audit a whole city at once.'
    );
    expect(count(html, /<input/g)).toBe(1);
    expect(html).toMatch(/<label[^>]*for="site"[^>]*>Paste a website<\/label>/);
    expect(html).toMatch(/<input[^>]*id="site"/);
    expect(html).toContain('placeholder="example.com"');
    expect(text(html)).toContain('Audit it free');
    expect(text(html)).toContain('Your first audit needs no sign-up');
    expect(text(html)).toContain(FREE_PLAN_LINE);
    expect(FREE_PLAN_LINE).toBe('Free plan: 2 audits and 1 search a month');
    // Drawn, not pictured, and every drawing is hidden from screen readers
    expect(html).not.toContain('<img');
    expect(count(html, /<svg/g)).toBe(count(html, /<svg[^>]*aria-hidden/g));
  });

  it('shows Auditely at work on the sample beside the headline, with a pause button', () => {
    const html = hero(true);
    expect(html).toContain(`aria-label="Auditely at work on ${sample.host}"`);
    expect(text(html)).toContain(sample.name);
    for (const tab of ['Audit', 'Summary', 'Email', 'Report']) expect(html).toMatch(new RegExp(`<button[^>]*aria-pressed="(true|false)"[^>]*>[^<]*${tab}`));
    expect(html).toContain('aria-label="Pause the animation"');
  });

  it('links to the walkthrough only when there is one', () => {
    expect(hero(true, true)).toMatch(/<a[^>]*href="#demo-video"[^>]*>[\s\S]*?Watch the 1-minute demo<\/a>/);
    expect(text(hero(true, false))).not.toContain('Watch the 1-minute demo');
  });

  it('says Sign up to audit a website when free audits are off', () => {
    const html = hero(false);
    expect(text(html)).toContain('Sign up to audit a website.');
    expect(linkTo(html, 'Sign up free')).toContain('href="/signup"');
    expect(html).not.toContain('<input');
    expect(text(html)).toContain(FREE_PLAN_LINE);
    expect(text(html)).toContain('No card needed');
    expect(text(html)).not.toContain('Your first audit needs no sign-up');
    // The headline still says what Auditely does, and the sample still plays
    expect(text(html)).toContain('Find clients whose websites need you.');
    expect(html).toContain(`aria-label="Auditely at work on ${sample.host}"`);
  });
});

describe('the demo section', () => {
  const rows = (html: string) => html.match(/<button[^>]*aria-controls="demo-lead"[^>]*>/g) ?? [];

  it("shows the demo's search, every lead, weakest site first", () => {
    const html = demo(null);
    expect(html).toContain('id="demo"');
    expect(text(html)).toContain('A real search, start to finish.');
    expect(text(html)).toContain(`A search for “cosmetic dentist” in Houston, TX: ${leads.length} businesses found`);
    expect(rows(html)).toHaveLength(leads.length);
    expect(html.indexOf(leads[0].name)).toBeLessThan(html.indexOf(leads.at(-1)!.name));
    expect(linkTo(html, 'Open the full demo')).toContain('href="/demo"');
    expect(html).toMatch(/<figcaption[^>]*>Business data from Google Maps<\/figcaption>/);
  });

  it('opens on the weakest lead: its scores, what Auditely wrote, its first email and its PDF', () => {
    const html = demo(null);
    const pressed = rows(html).filter((row) => row.includes('aria-pressed="true"'));
    expect(pressed).toHaveLength(1);
    expect(rows(html)[0]).toContain('aria-pressed="true"');
    const detail = html.slice(html.indexOf('id="demo-lead"'));
    expect(text(detail)).toContain(`#1 of ${leads.length}, weakest first`);
    expect(text(detail)).toContain(leads[0].name);
    expect(text(detail)).toContain(leads[0].summary);
    expect(text(detail)).toContain(`First email: ${leads[0].subject}`);
    expect(linkTo(detail, 'Download the report')).toContain(`href="${leads[0].reportUrl}"`);
  });

  it('sends the browser only what it shows: no email address or phone number', () => {
    expect(Object.keys(leads[0]).sort()).toEqual(
      ['average', 'host', 'id', 'name', 'rank', 'rating', 'reportUrl', 'reviews', 'scores', 'subject', 'summary', 'weakest'].sort()
    );
    expect(demo(null)).not.toContain('mailto:');
    expect(demo(null)).not.toContain('tel:');
  });

  it('adds a walkthrough tab only when there is a walkthrough, and opens on it', () => {
    expect(demo(null)).not.toContain('Walkthrough');
    expect(demo(null)).not.toContain('id="demo-video"');
    const html = demo(LOOM);
    expect(html).toContain('id="demo-video"');
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?Walkthrough · 1 min<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>[\s\S]*?Sample search<\/button>/);
    // The walkthrough shows first; the search waits for its tab, and Loom's player for a press
    expect(rows(html)).toHaveLength(0);
    expect(html).not.toContain('<iframe');
  });

  it('plays the recorded walkthrough muted on a loop, with sound and pause buttons', () => {
    const html = demo(FILE);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?Walkthrough · 1 min<\/button>/);
    const video = html.match(/<video[^>]*>/)?.[0] ?? '';
    expect(video).toContain('src="/media/walkthrough.mp4"');
    expect(video).toContain('poster="/media/walkthrough-poster.jpg"');
    for (const flag of ['muted', 'loop', 'playsInline']) expect(video).toMatch(new RegExp(`\\s${flag}=""`, 'i'));
    // It starts once it scrolls into view, so the page never downloads it up front
    expect(video).toContain('preload="none"');
    expect(video).not.toMatch(/\sautoplay/i);
    expect(html).toMatch(/<button[^>]*aria-label="Turn sound on"/);
    expect(html).toMatch(/<button[^>]*aria-label="Play the walkthrough"/);
    expect(rows(html)).toHaveLength(0);
  });

  it("lists the walkthrough's chapters, each a jump to where it starts", () => {
    const html = demo(FILE);
    expect(html.match(/<button[^>]*data-chapter="\d+"/g)).toHaveLength(2);
    expect(text(html)).toContain('0:00 Search A business type and a city.');
    expect(text(html)).toContain('0:27 Audit Six scores and the biggest issues.');
  });
});

describe('the walkthrough', () => {
  it("loads Loom's player only once the visitor presses play", () => {
    const html = renderToStaticMarkup(createElement(DemoWalkthrough, { video: LOOM }));
    expect(html).toMatch(/<button[^>]*aria-label="Play the walkthrough"/);
    expect(text(html)).toContain('Auditely in a minute');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('loom.com');
  });

  it('opens any other link in a new tab', () => {
    const html = renderToStaticMarkup(createElement(DemoWalkthrough, { video: YOUTUBE }));
    expect(html).toMatch(/<a[^>]*href="https:\/\/youtu\.be\/abc123"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(text(html)).toContain('Opens in a new tab');
  });
});

describe('how it works', () => {
  it('runs from a search to an audit to a report, over the sample search', () => {
    const html = renderToStaticMarkup(createElement(HowItWorks, { search, total: leads.length, sample }));
    expect(html).toContain('id="how"');
    expect(text(html)).toContain('From a city to a first email, in three steps.');
    for (const step of ['Search a trade and a city', 'Audit every website', 'Send each one its report']) expect(text(html)).toContain(step);
    expect(text(html)).toContain(`Cosmetic dentist Houston, TX ${leads.length} found`);
    expect(text(html)).toContain(sample.email.subject);
  });
});

describe('what you send', () => {
  const html = renderToStaticMarkup(createElement(ReportShowcase, { sample }));

  it("shows the sample's report under the place for your logo", () => {
    expect(html).toContain('id="sample"');
    expect(text(html)).toContain('A report your prospect reads in a minute.');
    expect(text(html)).toContain('YOUR LOGO');
    expect(text(html)).toContain(`Website audit for ${sample.name}`);
    expect(text(html)).toContain('Performance 72 Needs work SEO 85 Good Mobile 37 Poor GEO 75 Needs work AEO 55 Needs work Lead capture 85 Good');
    expect(text(html)).toContain(sample.summary);
    for (const fix of sample.improvements) expect(text(html)).toContain(fix);
  });

  it('shows how its first email starts, unsigned, and what Pro and Agency do next', () => {
    expect(text(html)).toContain(`The first email ${sample.email.subject} Your site loads in 21.7`);
    expect(html).not.toContain('[Your name]');
    expect(text(html)).toContain('Then, on Pro and Agency');
    for (const line of ['Send it from your own mailbox, so replies come to you', 'Hand the lead and a private report link to HubSpot', 'Export to CSV or Google Sheets']) {
      expect(text(html)).toContain(line);
    }
  });
});

describe('questions', () => {
  it('folds five answers away, the first one open', () => {
    const html = renderToStaticMarkup(createElement(LandingFaq, { checkoutOpen: true }));
    const faq = faqFor(true);
    expect(html).toContain('id="faq"');
    expect(count(html, /<details/g)).toBe(5);
    expect(count(html, /<details[^>]*open=""/g)).toBe(1);
    expect(html.indexOf('open=""')).toBeLessThan(html.indexOf(faq[1].question));
    for (const { question, answer } of faq) {
      expect(text(html)).toContain(question);
      expect(text(html)).toContain(answer);
    }
  });

  // Google sign-in is hidden for now (googleSignIn.ts): the answers offer only what works
  it('asks only for an email to sign up', () => {
    for (const open of [true, false]) {
      expect(faqFor(open).map((q) => q.answer).join(' ')).not.toContain('Google account');
    }
    expect(faqFor(true).find((q) => q.question === 'Do I need a card to start?')?.answer).toBe('No. The Free plan needs only an email address.');
  });

  it('answers for the beta while nothing can be bought: branding after it, no cancelling, and where to send feedback', () => {
    const html = renderToStaticMarkup(createElement(LandingFaq, { checkoutOpen: false }));
    const answers = Object.fromEntries(faqFor(false).map((q) => [q.question, q.answer]));
    expect(count(html, /<details/g)).toBe(5);
    expect(answers['Will the reports carry my brand?']).toBe(
      'On Pro and Agency, which open after the beta, your name, logo, contact details and booking link go on every report. On Free, reports carry Auditely’s name.'
    );
    expect(answers['Does Auditely send the emails?']).toBe(
      'It writes a first email for each business, and you copy it and send it yourself. Sending from your own mailbox comes with Pro and Agency, which open after the beta.'
    );
    expect(answers['Do I need a card to start?']).toBe('No. Auditely is free during the beta, and you sign up with just an email address.');
    expect(answers['Can I cancel any time?']).toBeUndefined();
    expect(answers['What does the beta mean?']).toBe(
      "Auditely is new, so you're among its first users. During the beta there's only the Free plan, and Pro and Agency open when it ends. Tell us what works and what doesn't with the Feedback button in the app."
    );
  });
});

describe('the closing band', () => {
  it('hands its website to the hero when free audits are on', () => {
    const html = renderToStaticMarkup(createElement(ClosingBand, { enabled: true }));
    expect(html).toMatch(/<label[^>]*for="closing-site"[^>]*>Website to audit<\/label>/);
    expect(html).toMatch(/<input[^>]*id="closing-site"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Audit it free<\/button>/);
    expect(text(html)).toContain('Your first audit is free, with no sign-up.');
  });

  it('offers sign-up when they are off', () => {
    const html = renderToStaticMarkup(createElement(ClosingBand, { enabled: false }));
    expect(html).not.toContain('<input');
    expect(linkTo(html, 'Sign up free')).toContain('href="/signup"');
    expect(text(html)).toContain(`${FREE_PLAN_LINE}. No card needed.`);
  });
});

describe('the header', () => {
  it("links to the page's sections, sign-in and sign-up", () => {
    const html = renderToStaticMarkup(createElement(LandingHeader));
    expect(html).toMatch(/<header[^>]*class="sticky top-0/);
    expect(linkTo(html, 'Demo')).toContain('href="/#demo"');
    expect(linkTo(html, 'How it works')).toContain('href="/#how"');
    expect(linkTo(html, 'Pricing')).toContain('href="/#pricing"');
    expect(linkTo(html, 'Sign in')).toContain('href="/login"');
    expect(linkTo(html, 'Start free')).toContain('href="/signup"');
  });

  // At 375px they used to break onto two lines each
  it('keeps Sign in and Start free on one line on a phone', () => {
    const html = renderToStaticMarkup(createElement(LandingHeader));
    expect(linkTo(html, 'Sign in')).toMatch(/class="[^"]*whitespace-nowrap/);
    expect(linkTo(html, 'Start free')).toMatch(/class="[^"]*whitespace-nowrap/);
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

  // A narrow phone wrapped "85 / 100" onto two lines
  it("keeps each checklist group's score on one line", () => {
    const scores = html.match(/<span class="[^"]*">\d+ \/ 100<\/span>/g) ?? [];
    expect(scores.length).toBeGreaterThan(0);
    for (const score of scores) expect(score).toContain('whitespace-nowrap');
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
  const html = renderToStaticMarkup(createElement(PricingTable, { checkoutOpen: true }));
  const beta = renderToStaticMarkup(createElement(PricingTable, { checkoutOpen: false }));

  it('shows the prices during the beta, with the paid plans opening when it ends', () => {
    expect(text(beta)).toContain('$24 a month');
    expect(text(beta)).toContain('$59 a month');
    expect(count(beta, /Opens after the beta/g)).toBe(2);
    expect(beta).not.toContain('Choose Pro');
    expect(beta).not.toContain('Choose Agency');
    expect(beta).not.toContain('callbackUrl');
    expect(linkTo(beta, 'Start free')).toContain('href="/signup"');
    expect(text(beta)).toContain(
      'Auditely is in beta, so Pro and Agency open when it ends. Prices are in US dollars, before sales tax. Yearly: Pro is $240 and Agency is $590.'
    );
    expect(text(beta)).not.toContain('Cancel any time');
  });

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
    for (const line of ['1 search a month', '2 audits a month', '250 audits a month', '1,000 audits a month', '400 email lookups a month']) {
      expect(text(html)).toContain(line);
    }
    // Free has no email lookups, so it doesn't list them
    expect(text(html)).not.toMatch(/(^|\s)0 email lookups/);
  });

  it('offers monthly or yearly, two months free', () => {
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Monthly<\/button>/);
    expect(text(html)).toContain('Yearly two months free');
    // The same pill as /plans
    expect(html).toContain(periodTrackClasses);
    expect(html).toContain(`class="${periodOptionClasses(true)}"`);
  });

  it('starts every plan at sign-up, and a paid one on the plans page after', () => {
    expect(linkTo(html, 'Start free')).toContain('href="/signup"');
    expect(linkTo(html, 'Choose Pro')).toContain('href="/signup?callbackUrl=%2Fplans"');
    expect(linkTo(html, 'Choose Agency')).toContain('href="/signup?callbackUrl=%2Fplans"');
  });

  it('carries a yearly choice through sign-up to the plans page', () => {
    expect(planHref(PLANS.pro, 'year')).toBe(`/signup?callbackUrl=${encodeURIComponent('/plans?billing=yearly')}`);
    expect(planHref(PLANS.agency, 'month')).toBe('/signup?callbackUrl=%2Fplans');
    expect(planHref(PLANS.free, 'year')).toBe('/signup');
  });

  it('uses the same feature labels as the plans page', () => {
    const plans = renderToStaticMarkup(
      createElement(PlansView, {
        summary: null,
        billing: { ready: false, open: true, canBuy: true, subscription: null, interval: 'month', justSubscribed: false },
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
  it('runs from the hero to the demo, how it works, the report, pricing, questions and a last way in', () => {
    const html = page(true);
    const order = [
      'Find clients whose websites',
      'aria-label="What Auditely checks"',
      'id="demo"',
      'id="how"',
      'id="sample"',
      'id="pricing"',
      'id="faq"',
      'Try it on a site you know.',
      '© ',
    ].map((needle) => html.indexOf(needle));
    expect(order.every((at) => at > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(text(html)).toContain('04 · Pricing Start free. Upgrade when you need more. One new client pays for a year of Pro.');
  });

  it('has two fields for the free audit when it is on, and none when it is off', () => {
    expect(count(page(true), /<input/g)).toBe(2);
    const html = page(false);
    expect(html).not.toContain('<input');
    expect(text(html)).toContain('Sign up to audit a website.');
    const closing = html.slice(html.indexOf('Try it on a site you know.'));
    expect(linkTo(closing, 'Sign up free')).toContain('href="/signup"');
  });

  it('links the hero to the walkthrough only when there is one', () => {
    expect(page(true)).not.toContain('#demo-video');
    expect(page(true, LOOM)).toContain('href="#demo-video"');
    expect(page(true, LOOM)).toContain('id="demo-video"');
    expect(page(true, FILE)).toContain('href="#demo-video"');
    expect(page(true, FILE)).toContain('<video');
  });

  it('never mentions DevArtVentures or signs as its owner', () => {
    for (const on of [true, false]) {
      for (const video of [null, LOOM, FILE]) expect(page(on, video).match(/dev\s*art\s*ventures|numan/gi) ?? []).toEqual([]);
    }
  });
});
