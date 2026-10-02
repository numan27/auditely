import { describe, it, expect } from 'vitest';
import { buildLeadPayload, industryFor, type LeadInput } from '@/app/_shared/lib/crm/leadPayload';
import type { AiReport, Audit } from '@/app/_shared/lib/types/auditely';

const audit = (over: Partial<Audit> = {}): Audit => ({
  id: 'a1', business_id: 'b1', created_at: '2026-10-01T09:00:00Z', engine_version: 2,
  performance_score: 61, seo_score: 83, mobile_score: 34, ssl_valid: true, geo_score: 40, aeo_score: null, lead_score: 45,
  raw_json: {},
  checks: { lead: { findings: [{ id: 'lead.form', status: 'fail', label: 'x' }], pages: [], links: { checked: 0, broken: [] } } },
  ...over,
});
const report: AiReport = {
  id: 'r1', audit_id: 'a1', created_at: '2026-10-01T09:05:00Z', improvements: [],
  summary: 'Visitors have no easy way to write to you.',
  cold_email: 'Subject: Quick note\n\nHi there,\nYour site has no contact form.',
};
const input = (over: Partial<LeadInput> = {}): LeadInput => ({
  business: { name: 'Smile Dental', address: '123 Main St, Springfield, IL', website: 'https://www.smiledental.com/', phone: '(555) 123-4567', email: 'office@smiledental.com', rating: 4.6, review_count: 123 },
  niche: 'dentists',
  audit: audit(),
  report,
  reportUrl: 'https://auditely.app/report/a1.sig',
  ...over,
});

describe('industryFor', () => {
  it.each([
    ['dentists', 'MEDICAL_PRACTICE', 'Health'],
    ['vet clinic', 'VETERINARY', 'Health'],
    ['private schools', 'EDUCATION_MANAGEMENT', 'Education'],
    ['personal injury lawyer', 'LAW_PRACTICE', 'Legal'],
    ['roofing contractors', 'CONSTRUCTION', 'Home services'],
    ['lawn care', null, 'Other'],
    ['website audits', null, 'Other'],
    ['animal clinic', 'VETERINARY', 'Health'],
    ['pet clinic', 'VETERINARY', 'Health'],
    ['veteran owned plumbing', 'CONSTRUCTION', 'Home services'],
    ['lawn doctor', null, 'Other'],
    ['computer doctor', null, 'Other'],
    ['phone repair clinic', null, 'Other'],
    ['beauty clinic', 'HEALTH_WELLNESS_AND_FITNESS', 'Fitness & beauty'],
    ['electricians', 'CONSTRUCTION', 'Home services'],
    ['electric vehicle charging', null, 'Other'],
    ['internet cafe', null, 'Other'],
  ])('maps "%s"', (niche, industry, group) => {
    expect(industryFor(niche)).toEqual({ industry, group });
  });

  it('has no industry without a niche', () => {
    expect(industryFor(null)).toEqual({ industry: null, group: 'Other' });
  });
});

describe('buildLeadPayload', () => {
  it('describes the company, its contact, and the stage for new records only', () => {
    const lead = buildLeadPayload(input());
    expect(lead.domain).toBe('smiledental.com');
    expect(lead.company).toEqual({
      name: 'Smile Dental',
      domain: 'smiledental.com',
      website: 'https://www.smiledental.com/',
      phone: '(555) 123-4567',
      email: 'office@smiledental.com',
      address: '123 Main St, Springfield, IL',
      industry: 'MEDICAL_PRACTICE',
    });
    expect(lead.contact).toEqual({
      email: 'office@smiledental.com',
      properties: { email: 'office@smiledental.com', phone: '(555) 123-4567', website: 'https://www.smiledental.com/', company: 'Smile Dental' },
    });
    expect(lead.onCreate).toEqual({ company: { lifecyclestage: 'lead' }, contact: { lifecyclestage: 'lead', hs_lead_status: 'NEW' } });
  });

  it.each([
    ['a Facebook page', 'https://www.facebook.com/SmileDental'],
    ['a Linktree', 'https://linktr.ee/smiledental'],
    ['a Google Sites page', 'https://sites.google.com/view/smiledental'],
    ['a page on a franchise site', 'https://www.statefarm.com/agent/us/il/springfield/john-doe'],
  ])("doesn't match by domain when the website is %s", (_name, website) => {
    const lead = buildLeadPayload(input({ business: { ...input().business, website } }));
    expect(lead.domain).toBeNull();
    expect(lead.company).not.toHaveProperty('domain');
    expect(lead.company.website).toBe(website);
  });

  it('leaves out what is unknown: no email, no phone, no industry', () => {
    const lead = buildLeadPayload(input({ niche: 'lawn care', business: { ...input().business, email: null, phone: null } }));
    expect(lead.contact).toBeNull();
    expect(lead.company).not.toHaveProperty('phone');
    expect(lead.company).not.toHaveProperty('email');
    expect(lead.company).not.toHaveProperty('industry');
  });

  it('writes the note: tag, scores, rating, problems, summary, email draft and report link', () => {
    const { noteHtml } = buildLeadPayload(input());
    expect(noteHtml).toContain('Auditely audit lead — Health');
    expect(noteHtml).toContain('Performance 61 · Mobile 34 · SEO 83 · SSL valid · GEO 40 · AEO — · Lead capture 45');
    expect(noteHtml).toContain('Google rating 4.6 from 123 reviews');
    expect(noteHtml).toContain('<li>We found no contact form or email link on your site</li>');
    expect(noteHtml).toContain('Visitors have no easy way to write to you.');
    expect(noteHtml).toContain('Subject: Quick note<br><br>Hi there,<br>Your site has no contact form.');
    expect(noteHtml).toContain('<a href="https://auditely.app/report/a1.sig">PDF report</a>');
  });

  it('shows text from websites and the AI as text, never as markup', () => {
    const { noteHtml } = buildLeadPayload(
      input({ report: { ...report, summary: '<img src=x onerror="alert(1)"> & more' } })
    );
    expect(noteHtml).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; more');
    expect(noteHtml).not.toContain('<img');
  });

  it("doesn't trust SEO and SSL from an outdated audit", () => {
    const { noteHtml } = buildLeadPayload(input({ audit: audit({ engine_version: 1, seo_score: 0, ssl_valid: false }) }));
    expect(noteHtml).toContain('SEO — · SSL —');
  });
});
