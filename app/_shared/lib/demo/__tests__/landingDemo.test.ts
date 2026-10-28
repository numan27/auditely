// What the landing page shows of the demo: the sample search ranked as the app's
// "Weakest site first" ranks it, and the hero's sample, trimmed to what it draws.

import { describe, it, expect } from 'vitest';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { allSamples } from '@/app/_shared/lib/demo/demoSamples';
import { DEMO_SIGN_OFF } from '@/app/_shared/lib/demo/unbrand';
import { landingLeads, landingSample, searchLabel, SCORE_LABELS } from '@/app/_shared/lib/demo/landingDemo';
import { OFFER_CLOSING } from '@/app/_shared/lib/email/outreach';

const leads = landingLeads(demoData);

describe('landingLeads', () => {
  it('ranks every audited lead of the sample search, weakest site first', () => {
    expect(leads).toHaveLength(demoData.leads.length);
    expect(leads.map((l) => l.rank)).toEqual(leads.map((_, i) => i + 1));
    expect(leads[0].name).toBe('Nu Dentistry');
    expect(leads.at(-1)?.name).toBe('Dentiq Dentistry Houston');
    const averages = leads.map((l) => l.average ?? 0);
    expect(averages).toEqual([...averages].sort((a, b) => a - b));
    expect(leads[0].average).toBe(49);
  });

  it("gives each lead its six scores and names its weakest", () => {
    expect(SCORE_LABELS).toEqual(['Performance', 'SEO', 'Mobile', 'GEO', 'AEO', 'Lead capture']);
    expect(leads[0].scores).toEqual([
      { label: 'Performance', score: 79 },
      { label: 'SEO', score: 83 },
      { label: 'Mobile', score: 36 },
      { label: 'GEO', score: 0 },
      { label: 'AEO', score: 15 },
      { label: 'Lead capture', score: 80 },
    ]);
    expect(leads[0].weakest).toEqual({ label: 'GEO', score: 0 });
    expect(leads[0].host).toBe('nudentistry.com');
    expect(leads[0].rating).toBe(4.9);
    expect(leads[0].reviews).toBe(2279);
  });

  it("links each lead to its sample PDF, and sends what the AI wrote without the email's body", () => {
    const pdfs = new Set(allSamples(demoData).map((b) => `/demo/report/${b.audit!.id}`));
    for (const lead of leads) {
      expect(pdfs.has(lead.reportUrl)).toBe(true);
      expect(lead.summary).toBeTruthy();
      expect(lead.subject).toBeTruthy();
      expect(Object.keys(lead).sort()).toEqual(
        ['average', 'host', 'id', 'name', 'rank', 'rating', 'reportUrl', 'reviews', 'scores', 'subject', 'summary', 'weakest'].sort()
      );
    }
  });
});

describe('landingSample', () => {
  const sample = landingSample(demoData);

  it("is the landing page's sample report, with its first email ready to read", () => {
    expect(sample.name).toBe('Cosmetic Dentists of Houston');
    expect(sample.host).toBe('houstondental.com');
    expect(sample.place).toBe('Houston, TX');
    expect(sample.scores.map((s) => s.score)).toEqual([72, 85, 37, 75, 55, 85]);
    expect(sample.ssl).toBe(true);
    expect(sample.improvements).toHaveLength(4);
    expect(sample.email.subject).toBe('Mobile speed is costing you');
    // The AI writes "21.7 seconds" with a narrow no-break space
    expect(sample.email.body).toMatch(/^Your site loads in 21\.7\sseconds on phones/);
    // Signed by whoever sends it: the page adds "Your name", not the placeholder
    expect(sample.email.body.endsWith(OFFER_CLOSING)).toBe(true);
    expect(sample.email.body).not.toContain(DEMO_SIGN_OFF);
  });

  it('never names DevArtVentures', () => {
    expect(JSON.stringify([leads, sample])).not.toMatch(/dev\s*art\s*ventures|numan/i);
  });
});

describe('searchLabel', () => {
  it('reads the saved search as a visitor would type it', () => {
    expect(searchLabel({ niche: 'cosmetic dentist', location: 'houston, tx, usa' })).toEqual({
      niche: 'Cosmetic dentist',
      location: 'Houston, TX',
    });
    expect(searchLabel({ niche: 'plumber', location: 'san antonio, texas' })).toEqual({
      niche: 'Plumber',
      location: 'San Antonio, Texas',
    });
  });
});
