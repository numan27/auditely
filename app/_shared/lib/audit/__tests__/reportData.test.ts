import { describe, it, expect } from 'vitest';
import {
  auditFacts,
  buildPdfProps,
  failingFindings,
  formatScore,
  formatSsl,
  scoreTone,
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

describe('buildPdfProps', () => {
  it('passes nulls through and drops non-string improvements', () => {
    const props = buildPdfProps(
      audit,
      { name: 'Smile Dental', website: null, address: '123 Main St', phone: null },
      { summary: 'Slow site.', improvements: ['Compress images', 42] }
    );
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
    const props = buildPdfProps(
      v1Audit,
      { name: 'Smile Dental', website: null, address: '123 Main St', phone: null },
      { summary: 'Slow site.', improvements: [] }
    );
    expect(props).toMatchObject({ seoScore: null, sslValid: null, performanceScore: 42 });
  });
});
