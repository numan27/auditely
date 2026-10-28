// The Terms and the Privacy Policy: every section they need, in order, in plain
// words, with the operator's details from legal.ts and nothing about DevArtVentures.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TermsContent } from '@/app/_shared/components/legal/termsContent';
import { PrivacyContent } from '@/app/_shared/components/legal/privacyContent';
import { LandingFooter } from '@/app/_shared/components/landing/landingFooter';
import TermsPage, { metadata as termsMetadata } from '@/app/(pages)/(legal)/terms/page';
import PrivacyPage, { metadata as privacyMetadata } from '@/app/(pages)/(legal)/privacy/page';
import { LEGAL, legalReady } from '@/app/_shared/lib/config/legal';

const render = (component: () => React.ReactNode) => renderToStaticMarkup(createElement(component));
// What a reader sees: the markup's text, entities decoded
const text = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const headings = (html: string) => [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => text(m[1]).trim());

const terms = render(TermsContent);
const privacy = render(PrivacyContent);

describe('signing in', () => {
  it('names every way to sign in, the password among them', () => {
    expect(text(terms)).toContain(
      'You sign in with a link we email you, with Google, or with a password you set in Settings. Anyone who can open that email account can sign in as you, so keep it and your password safe.'
    );
    expect(text(privacy)).toContain(
      'how you sign in (an emailed link, Google, or a password you set, which Supabase keeps only as a one-way hash)'
    );
  });
});

describe('the Terms', () => {
  it('covers every section the Terms need, in order', () => {
    expect(headings(terms)).toEqual([
      'Who we are',
      'Your account',
      'Plans, billing and cancelling',
      'Fair use and limits',
      'Your outreach',
      'Business data from Google Maps',
      'Audits and summaries are estimates',
      'Your content',
      'What you may not do',
      'Ending your account',
      'Disclaimers and limits of liability',
      'Governing law',
      'Changes to these terms',
      'Contact',
    ]);
  });

  it('makes users responsible for their outreach and keeps the opt-out line', () => {
    const page = text(terms);
    expect(page).toContain('You are responsible for every email you send');
    expect(page).toContain('CAN-SPAM');
    expect(page).toMatch(/opt-out line/);
    expect(page).toMatch(/your own mailbox/);
  });

  it('says where business data comes from', () => {
    const page = text(terms);
    expect(page).toContain('Google Maps');
    expect(page).toContain('30 days');
    expect(page).toMatch(/scrape/);
  });

  it('names the operator and contact from legal.ts', () => {
    for (const page of [text(terms), text(privacy)]) {
      expect(page).toContain(LEGAL.operator);
      expect(page).toContain(LEGAL.contactEmail);
      expect(page).toContain(LEGAL.mailingAddress);
      expect(page).toContain(LEGAL.effectiveDate);
    }
    expect(text(terms)).toContain(LEGAL.governingState);
  });
});

describe('the Privacy Policy', () => {
  it('covers every section a privacy policy needs, in order', () => {
    expect(headings(privacy)).toEqual([
      'What we collect',
      'How we use it',
      'Who we share it with',
      'How long we keep it',
      'Your rights',
      'Cookies',
      'Security',
      'Children',
      'Changes',
      'Contact',
    ]);
  });

  it('says visits are counted by Vercel Web Analytics, without cookies or private addresses', () => {
    const page = text(privacy);
    expect(page).toContain('Vercel Web Analytics');
    expect(page).toMatch(/counts visits without cookies/);
    expect(page).toMatch(/Report links aren.t counted, and other private addresses are counted without the part that identifies them/);
    expect(page).toContain('Vercel: hosting, visit counts, and the bot check on the free audit.');
  });

  it('says what free-audit visitors leave behind, and that the address itself is never stored', () => {
    const page = text(privacy);
    expect(page).toMatch(/salted hash of your network address/);
    expect(page).toMatch(/never the address itself/);
    expect(page).toContain('up to 90 days');
  });

  it("gives California visitors their rights and says Auditely doesn't sell data", () => {
    const page = text(privacy);
    expect(page).toContain('California');
    expect(page).toContain('CCPA');
    expect(page).toContain("We don't sell your personal information or share it for advertising.");
    for (const provider of ['Supabase', 'Vercel', 'Stripe', 'Google', 'Groq', 'Hunter', 'Tomba', 'Snov', 'Apollo', 'Verifalia', 'Resend', 'HubSpot']) {
      expect(page, provider).toContain(provider);
    }
    expect(page).toMatch(/under 13/);
  });
});

describe('legal pages', () => {
  it('never mentions DevArtVentures', () => {
    for (const html of [render(TermsPage), render(PrivacyPage), render(LandingFooter)]) {
      expect(html).not.toMatch(/dev\s*art/i);
    }
  });

  // Unlinked for now: the sign-up line still links to them, so they stay up
  it('keeps both pages out of search results for now', () => {
    expect(termsMetadata).toMatchObject({ title: 'Terms', robots: { index: false, follow: true } });
    expect(privacyMetadata).toMatchObject({ title: 'Privacy Policy', robots: { index: false, follow: true } });
  });

  it('leaves Terms and Privacy out of the footer, and links Contact to the contact page', () => {
    const footer = render(LandingFooter);
    expect(footer).toMatch(/<a[^>]*href="\/contact"[^>]*>\s*Contact\s*<\/a>/);
    expect(footer).not.toContain('href="/terms"');
    expect(footer).not.toContain('href="/privacy"');
    expect(footer).not.toContain('mailto:');
  });

  it('is not ready while a placeholder is left', () => {
    expect(legalReady({ ...LEGAL, operator: '[LEGAL NAME]' })).toBe(false);
    expect(
      legalReady({
        operator: 'Example LLC',
        contactEmail: 'hello@example.com',
        mailingAddress: '1 Main St, Austin, TX 78701',
        governingState: 'Texas',
        effectiveDate: 'November 1, 2026',
      })
    ).toBe(true);
  });
});
