import { describe, it, expect } from 'vitest';
import {
  buildPdfProps,
  formatScore,
  formatSsl,
  scoreTone,
  siteBlocked,
  siteNotice,
  sortFindings,
  topLighthouseIssues,
  type AuditLike,
} from '@/app/_shared/lib/audit/reportData';
import type { AuditChecks, Finding } from '@/app/_shared/lib/audit/types';
import { resolveBrand } from '@/app/_shared/lib/brand/brandRules';
import type { PdfContact } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { STATS } from '@/app/_shared/lib/audit/impactLibrary';
import { impactFor } from '@/app/_shared/lib/audit/impact';

const rawJson = {
  mobile: {
    keyAudits: {
      lcp: { score: 0.1, title: 'Largest Contentful Paint', displayValue: '12.8 s' },
      cls: { score: 0.5, title: 'Cumulative Layout Shift' },
      https: { score: 1, title: 'Uses HTTPS' },
      odd: { score: null, title: 'Informative' },
    },
  },
};

const f = (id: string, status: Finding['status']): Finding => ({ id, status, label: id });

const checks: Partial<AuditChecks> = {
  geo: { findings: [f('geo.a', 'pass'), f('geo.b', 'fail')], schemaTypes: [], nap: { name: 'match', address: 'match', phone: 'match', site: { name: null, address: null, phones: [] } } },
  aeo: { findings: [f('aeo.a', 'fail'), f('aeo.b', 'warn'), f('aeo.c', 'fail')], h1Count: 1, h2Count: 0, questionHeadings: 0, hasFaqSchema: false },
};

const audit: AuditLike = {
  created_at: '2026-09-23T12:00:00Z',
  performance_score: 42,
  seo_score: null,
  mobile_score: 38,
  ssl_valid: null,
  geo_score: 25,
  aeo_score: 40,
  raw_json: rawJson,
  checks,
  engine_version: 2,
};

// v1 rows stored 0 / false for SEO and SSL it never measured
const v1Audit: AuditLike = { ...audit, engine_version: 1, seo_score: 0, ssl_valid: false };

describe('formatting', () => {
  it('renders unmeasured values as "not measured"', () => {
    expect(formatScore(42)).toBe('42/100');
    expect(formatScore(null)).toBe('not measured');
    expect(formatSsl(true)).toBe('valid');
    expect(formatSsl(false)).toBe('invalid or missing');
    expect(formatSsl(null)).toBe('not measured');
  });

  it('maps scores to tones', () => {
    expect([scoreTone(85), scoreTone(60), scoreTone(10), scoreTone(null)]).toEqual(['good', 'ok', 'poor', 'none']);
  });
});

describe('issue selection', () => {
  it('lists failing Lighthouse audits worst-first', () => {
    expect(topLighthouseIssues(rawJson, 4)).toEqual([
      { title: 'Largest Contentful Paint', displayValue: '12.8 s' },
      { title: 'Cumulative Layout Shift' },
    ]);
    expect(topLighthouseIssues({ mobile: null }, 4)).toEqual([]);
  });

  it('sorts findings fail → warn → pass', () => {
    expect(sortFindings([f('a', 'pass'), f('b', 'warn'), f('c', 'fail')]).map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('siteBlocked', () => {
  const site = (reason?: string) => ({ ok: false, finalUrl: null, status: 403, ...(reason ? { reason } : {}) });

  it('is true when bot protection turned the audit away and nothing was read', () => {
    expect(siteBlocked({ site: site('Blocked (403)') })).toBe(true);
    expect(siteBlocked({ site: site('Blocked (bot challenge)') })).toBe(true);
  });

  it('is false for a site that answered with something else, or that was read', () => {
    expect(siteBlocked({ site: site('Site timed out') })).toBe(false);
    expect(siteBlocked({ site: site() })).toBe(false);
    expect(siteBlocked(null)).toBe(false);
    const geo = { findings: [], schemaTypes: [] } as unknown as NonNullable<Parameters<typeof siteBlocked>[0]>['geo'];
    expect(siteBlocked({ site: site('Blocked (403)'), geo })).toBe(false);
  });
});

describe('siteNotice', () => {
  const after = "so GEO, AEO and lead capture couldn't be checked. Performance, SEO, mobile and SSL come from Google and aren't affected.";

  it('explains bot blocking in plain words, for new and old audits', () => {
    for (const reason of ['Blocked (403)', 'Blocked (bot challenge)']) {
      expect(siteNotice(reason)).toEqual({ title: 'This website blocked our checks', body: `It turns away automated visitors, ${after}` });
    }
  });

  it('says plainly why a site that didn’t answer couldn’t be read', () => {
    expect(siteNotice('Site timed out').body).toBe(`It took too long to answer, ${after}`);
    expect(siteNotice('Site unreachable').body).toBe(`It didn't respond, ${after}`);
    expect(siteNotice('HTTP 500').body).toBe(`Its home page answered with an error (500), ${after}`);
    expect(siteNotice('Site timed out').title).toBe("We couldn't read this website");
  });

  it('passes other reasons through', () => {
    expect(siteNotice('Not an HTML page').body).toBe(`The site check said: Not an HTML page, ${after}`);
  });
});

// The owner's brand with a given contact: what the PDF had before profiles
const ownerBrand = (contact: PdfContact | null) => ({
  ...resolveBrand({ profile: null, isOwner: true, plan: 'owner' }, contact ?? undefined),
  contact,
});

describe('buildPdfProps', () => {
  const contact = ownerBrand({ name: null, phone: null, email: 'contact@devartventures.com', bookingUrl: null });
  const business = { name: 'Smile Dental', website: null, address: '123 Main St', phone: null };
  const noReport = { summary: '', improvements: [] };

  // Google's details are blanked after 30 days (placeDataErase.ts): a report link sent before still reads
  it("names a business whose details were blanked by its website, or as the reader's own", () => {
    expect(buildPdfProps(audit, { ...business, name: '', website: 'https://www.smile.com/home' }, noReport, contact).businessName).toBe('smile.com');
    expect(buildPdfProps(audit, { name: '', website: null, address: '', phone: null }, noReport, contact).businessName).toBe('Your business');
  });

  it('passes nulls through and drops non-string improvements', () => {
    const props = buildPdfProps(audit, business, { summary: 'Slow site.', improvements: ['Compress images', 42] }, contact);
    expect(props).toMatchObject({
      businessName: 'Smile Dental',
      website: '',
      auditDate: 'September 23, 2026',
      performanceScore: 42,
      seoScore: null,
      sslValid: null,
      geoScore: 25,
      aeoScore: 40,
      improvements: ['Compress images'],
    });
    // The fixture's checks aren't in the library: shown by their own labels
    expect(props.problems.map((p) => p.problem)).toEqual(['geo.b', 'aeo.a', 'aeo.c']);
  });

  it('drops SEO and SSL from an outdated v1 audit', () => {
    const props = buildPdfProps(v1Audit, business, noReport, contact);
    expect(props).toMatchObject({ seoScore: null, sslValid: null, performanceScore: 42 });
  });

  it('replaces characters the built-in PDF font cannot draw', () => {
    // gpt-oss writes narrow no-break spaces and non-breaking hyphens; Helvetica
    // renders them as "/" and nothing
    const props = buildPdfProps(
      audit,
      { ...business, name: 'Smile\u00a0Dental', address: '123\u202fMain St' },
      {
        summary: 'First Contentful Paint of 7.7\u202fseconds on non\u2011descriptive links.',
        improvements: ['Add JSON\u2011LD schema', 'Save 2,235\u2009KiB'],
      },
      contact
    );
    expect(props.summary).toBe('First Contentful Paint of 7.7 seconds on non-descriptive links.');
    expect(props.improvements).toEqual(['Add JSON-LD schema', 'Save 2,235 KiB']);
    expect(props.businessName).toBe('Smile Dental');
    expect(props.address).toBe('123 Main St');
  });

  it('lists GEO and AEO problems, failures first, without passes', () => {
    const props = buildPdfProps(audit, business, noReport, contact);
    expect(props.geoFindings).toEqual([{ status: 'fail', label: 'geo.b' }]);
    // aeo.b is a warning the library doesn't treat as a problem
    expect(props.aeoFindings.map((finding) => [finding.status, finding.label])).toEqual([
      ['fail', 'aeo.a'],
      ['fail', 'aeo.c'],
    ]);
  });

  it('keeps finding details and makes their text drawable', () => {
    const withDetail: AuditLike = {
      ...audit,
      checks: {
        ...checks,
        aeo: {
          ...checks.aeo!,
          findings: [{ id: 'aeo.levels', status: 'fail', label: 'Heading levels skip (e.g. H1 \u2192 H3)', detail: 'Site\u202fshows: 1' }],
        },
      },
    };
    const props = buildPdfProps(withDetail, business, noReport, contact);
    expect(props.aeoFindings).toEqual([{ status: 'fail', label: 'Heading levels skip (e.g. H1 -> H3)', detail: 'Site shows: 1' }]);
  });

  it('tells the top 4 problems in owner language, with what was measured and each statistic sourced', () => {
    const story: AuditLike = {
      ...audit,
      raw_json: { mobile: { categories: {}, keyAudits: {}, field: { lcpMs: 4100, scope: 'page' } }, desktop: null },
      checks: {
        lead: {
          findings: [
            { id: 'lead.form', status: 'fail', label: 'x' },
            { id: 'lead.clickToCall', status: 'fail', label: 'x' },
            { id: 'lead.brokenLinks', status: 'fail', label: 'x', detail: '/book-now' },
            { id: 'lead.contactPage', status: 'fail', label: 'x' },
          ],
          pages: [],
          links: { checked: 3, broken: [] },
        },
      },
    };
    const props = buildPdfProps(story, business, noReport, contact);
    expect(props.problems).toHaveLength(4);
    expect(props.problems[0]).toEqual({ problem: impactFor('lead.form', 'fail')?.problem, cost: impactFor('lead.form', 'fail')?.cost });
    expect(props.problems[2]).toMatchObject({ evidence: '/book-now' });
    // Each statistic carries its source, right beside the claim
    expect(props.problems[1].stat).toBe(`${STATS.nearbyVisit.text} (${STATS.nearbyVisit.source})`);
  });

  it('shows plain labels in the GEO, AEO and lead capture blocks', () => {
    const plain: AuditLike = {
      ...audit,
      checks: { ...checks, lead: { findings: [{ id: 'lead.form', status: 'warn', label: 'Only an email link' }], pages: [], links: { checked: 0, broken: [] } } },
    };
    const props = buildPdfProps(plain, business, noReport, contact);
    expect(props.leadFindings[0].label).toBe(impactFor('lead.form', 'warn')?.problem);
    expect(props.geoFindings[0].label).toBe('geo.b');
  });

  it("leaves couldn't-check results and listing gaps out of the PDF's sections", () => {
    const unknowns: AuditLike = {
      ...audit,
      checks: {
        geo: { ...checks.geo!, findings: [{ id: 'geo.nap.phone', status: 'warn', label: 'Business listing has no phone number' }] },
        lead: {
          findings: [
            { id: 'lead.formUnchecked', status: 'warn', label: "Couldn't check the contact page for a form" },
            { id: 'lead.brokenLinks', status: 'warn', label: "Couldn't check the site's links" },
            { id: 'lead.booking', status: 'warn', label: 'No online booking' },
          ],
          pages: [],
          links: { checked: 0, broken: [] },
        },
      },
    };
    const props = buildPdfProps(unknowns, business, noReport, contact);
    expect(props.geoFindings).toEqual([]);
    expect(props.leadFindings.map((finding) => finding.label)).toEqual([impactFor('lead.booking', 'warn')?.problem]);
  });

  it('still builds the report for an outdated audit with no checks', () => {
    const props = buildPdfProps({ ...v1Audit, checks: {}, raw_json: {} }, business, noReport, contact);
    expect(props.problems).toEqual([]);
  });

  it('passes the report contact through', () => {
    const withBooking = { ...contact.contact!, name: 'Numan', bookingUrl: 'https://cal.com/numan' };
    expect(buildPdfProps(audit, business, noReport, ownerBrand(withBooking)).contact).toEqual(withBooking);
  });

  it('builds a report without a contact, for the public demo', () => {
    expect(buildPdfProps(audit, business, noReport, ownerBrand(null)).contact).toBeNull();
  });
});

describe('lead capture in the report', () => {
  // Same PDF arguments as the buildPdfProps tests (declared inside that block)
  const contact = ownerBrand({ name: null, phone: null, email: 'contact@devartventures.com', bookingUrl: null });
  const business = { name: 'Smile Dental', website: null, address: '123 Main St', phone: null };
  const noReport = { summary: '', improvements: [] };
  const leadChecks: Partial<AuditChecks> = {
    ...checks,
    lead: {
      findings: [f('lead.form', 'fail'), f('lead.booking', 'warn'), f('lead.clickToCall', 'pass')],
      pages: [],
      links: { checked: 0, broken: [] },
    },
  };
  const withLead: AuditLike = { ...audit, lead_score: 30, checks: leadChecks };

  it('passes the lead capture score and its problems to the PDF', () => {
    const props = buildPdfProps(withLead, business, noReport, contact);
    expect(props.leadScore).toBe(30);
    expect(props.leadFindings).toEqual([
      { status: 'fail', label: impactFor('lead.form', 'fail')?.problem },
      { status: 'warn', label: impactFor('lead.booking', 'warn')?.problem },
    ]);
    expect(buildPdfProps(audit, business, noReport, contact)).toMatchObject({ leadScore: null, leadFindings: [] });
  });
});
