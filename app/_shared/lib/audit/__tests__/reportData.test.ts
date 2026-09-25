import { describe, it, expect } from 'vitest';
import {
  auditFacts,
  buildPdfProps,
  failingFindings,
  formatScore,
  formatSsl,
  scoreTone,
  siteReasonText,
  sortFindings,
  topLighthouseIssues,
  type AuditLike,
} from '@/app/_shared/lib/audit/reportData';
import type { AuditChecks, Finding } from '@/app/_shared/lib/audit/types';

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

  it('picks failing GEO then AEO findings', () => {
    expect(failingFindings(checks, 2).map((x) => x.id)).toEqual(['geo.b', 'aeo.a']);
    expect(failingFindings({}, 3)).toEqual([]);
  });

  it('sorts findings fail → warn → pass', () => {
    expect(sortFindings([f('a', 'pass'), f('b', 'warn'), f('c', 'fail')]).map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('auditFacts', () => {
  it('builds the prompt facts with GEO/AEO and "not measured"', () => {
    const { scores, issues } = auditFacts(audit);
    expect(scores).toContain('SEO Score: not measured');
    expect(scores).toContain('SSL Certificate: not measured');
    expect(scores).toContain('GEO Score (visibility in AI search engines): 25/100');
    expect(issues.split('\n')).toEqual([
      '- Largest Contentful Paint (12.8 s)',
      '- Cumulative Layout Shift',
      '- geo.b',
      '- aeo.a',
      '- aeo.c',
    ]);
  });

  it('treats SEO and SSL from an outdated v1 audit as not measured', () => {
    const { scores } = auditFacts(v1Audit);
    expect(scores).toContain('SEO Score: not measured');
    expect(scores).toContain('SSL Certificate: not measured');
    expect(scores).toContain('Performance Score: 42/100');
  });
});

describe('siteReasonText', () => {
  it('explains bot blocking in plain words, for new and old audits', () => {
    for (const reason of ['Blocked (403)', 'Blocked (bot challenge)']) {
      expect(siteReasonText(reason)).toBe(
        "This website blocks automated visitors, so GEO and AEO couldn't be checked. The PageSpeed scores come from Google and aren't affected."
      );
    }
  });

  it('passes other reasons through', () => {
    expect(siteReasonText('Site timed out')).toBe("Couldn't read site: Site timed out");
  });
});

describe('buildPdfProps', () => {
  const contact = { name: null, phone: null, email: 'contact@devartventures.com', bookingUrl: null };
  const business = { name: 'Smile Dental', website: null, address: '123 Main St', phone: null };
  const noReport = { summary: '', improvements: [] };

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
    expect(props.topIssues).toHaveLength(2);
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
    expect(props.aeoFindings.map((finding) => [finding.status, finding.label])).toEqual([
      ['fail', 'aeo.a'],
      ['fail', 'aeo.c'],
      ['warn', 'aeo.b'],
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

  it('passes the report contact through', () => {
    const withBooking = { ...contact, name: 'Numan', bookingUrl: 'https://cal.com/numan' };
    expect(buildPdfProps(audit, business, noReport, withBooking).contact).toEqual(withBooking);
  });
});
