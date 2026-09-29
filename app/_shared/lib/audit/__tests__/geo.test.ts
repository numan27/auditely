import { describe, it, expect } from 'vitest';
import { analyzeGeo } from '@/app/_shared/lib/audit/analyzers/geo';
import type { BusinessEntity, StructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';
import type { GeoChecks, NapResult } from '@/app/_shared/lib/audit/types';

const entity = (over: Partial<BusinessEntity> = {}): BusinessEntity => ({
  types: ['Dentist'],
  name: 'Smile Dental',
  address: '123 Main St, Springfield, IL, 62701',
  telephone: '555-123-4567',
  hasHours: true,
  hasGeo: false,
  hasSameAs: false,
  sameAs: [],
  ...over,
});

const structured = (e: BusinessEntity | null): StructuredData => ({ blocks: e ? 1 : 0, types: e?.types ?? [], entity: e });

const nap = (over: Partial<NapResult> = {}): NapResult => ({
  name: 'match',
  address: 'match',
  phone: 'match',
  site: { name: 'Smile Dental', address: null, phones: ['5551234567'] },
  ...over,
});

const finding = (checks: GeoChecks, id: string) => checks.findings.find((f) => f.id === id);

describe('analyzeGeo', () => {
  it('scores a complete, matching Dentist schema 100 with all passes', () => {
    const { score, checks } = analyzeGeo(structured(entity()), nap(), 'dentist');
    expect(score).toBe(100);
    expect(checks.findings.every((f) => f.status === 'pass')).toBe(true);
    expect(checks.schemaTypes).toEqual(['Dentist']);
  });

  it('gives partial credit and a warning for generic LocalBusiness on a dentist', () => {
    const { score, checks } = analyzeGeo(structured(entity({ types: ['LocalBusiness'] })), nap(), 'dentist');
    expect(score).toBe(90);
    expect(finding(checks, 'geo.businessType')).toMatchObject({
      status: 'warn',
      label: 'Use the more specific Dentist schema type',
    });
  });

  it('accepts any LocalBusiness type when the niche has no expected type', () => {
    expect(analyzeGeo(structured(entity({ types: ['Plumber'] })), nap(), 'plumber').score).toBe(100);
  });

  it('gives 5 points for Organization-only schema', () => {
    const { score, checks } = analyzeGeo(structured(entity({ types: ['Organization'] })), nap(), 'dentist');
    expect(score).toBe(80);
    expect(finding(checks, 'geo.businessType')?.status).toBe('warn');
  });

  it('scores 0 with no schema and nothing on the site', () => {
    const missing = nap({ name: 'missing', address: 'missing', phone: 'missing', site: { name: null, address: null, phones: [] } });
    const { score, checks } = analyzeGeo(structured(null), missing, 'dentist');
    expect(score).toBe(0);
    expect(finding(checks, 'geo.jsonld')?.status).toBe('fail');
    expect(finding(checks, 'geo.nap.phone')?.label).toBe('Phone number not found on the homepage');
  });

  it('awards NAP points but warns when the listing lacks the field', () => {
    const { score, checks } = analyzeGeo(structured(entity()), nap({ phone: 'n/a' }), 'dentist');
    expect(score).toBe(100);
    expect(finding(checks, 'geo.nap.phone')).toMatchObject({ status: 'warn', label: 'Business listing has no phone number' });
  });

  it('leaves out NAP findings when there is no listing at all (site audited by URL)', () => {
    const { score, checks } = analyzeGeo(structured(entity()), nap({ name: 'n/a', address: 'n/a', phone: 'n/a' }), null);
    expect(score).toBe(100);
    expect(checks.findings.some((f) => f.id.startsWith('geo.nap.'))).toBe(false);
  });

  it('shows the site value on a mismatch', () => {
    const { score, checks } = analyzeGeo(
      structured(entity()),
      nap({ phone: 'mismatch', site: { name: 'Smile Dental', address: null, phones: ['5559990000'] } }),
      'dentist'
    );
    expect(score).toBe(85);
    expect(finding(checks, 'geo.nap.phone')).toMatchObject({ status: 'fail', detail: 'Site shows: (555) 999-0000' });
  });
});
