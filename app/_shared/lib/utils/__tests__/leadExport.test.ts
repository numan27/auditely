import { describe, it, expect } from 'vitest';
import { exportFileName, leadTable, toDelimited, toHtmlTable } from '@/app/_shared/lib/utils/leadExport';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

const business = (overrides: Partial<BusinessWithData> = {}): BusinessWithData => ({
  id: 'b1',
  search_id: 's1',
  name: 'Washington Center for Dentistry',
  address: '1430 K St NW, Washington, DC 20005, USA',
  website: 'https://washdent.com',
  phone: '(202) 517-8035',
  email: 'hello@washdent.com',
  contact_page: 'https://washdent.com/contact',
  socials: { facebook: 'https://facebook.com/washdent' },
  contacts_checked_at: null,
  email_lookup_at: null,
  rating: null,
  review_count: null,
  created_at: '2026-09-01T00:00:00Z',
  ...overrides,
});

const column = (table: string[][], header: string) => {
  const i = table[0].indexOf(header);
  return table.slice(1).map((row) => row[i]);
};

describe('leadTable', () => {
  it('writes a header row and one row per business', () => {
    const table = leadTable([business(), business({ id: 'b2', name: 'Other' })]);
    expect(table).toHaveLength(3);
    expect(table[0].slice(0, 4)).toEqual(['Name', 'Email', 'Phone', 'Website']);
    expect(column(table, 'Name')).toEqual(['Washington Center for Dentistry', 'Other']);
  });

  it("includes the business's Google rating and review count", () => {
    const table = leadTable([business({ rating: 4.6, review_count: 123 }), business({ rating: null, review_count: 0 })]);
    expect(column(table, 'Google rating')).toEqual(['4.6', '']);
    expect(column(table, 'Google reviews')).toEqual(['123', '0']);
  });

  it('includes the lead capture score, blank before it existed', () => {
    const audited = (lead_score?: number | null) =>
      business({
        audit: {
          id: 'a1', business_id: 'b1', performance_score: 98, seo_score: 100, mobile_score: 35,
          ssl_valid: true, geo_score: null, aeo_score: 45, checks: {}, engine_version: 2, raw_json: {},
          created_at: '2026-09-28T10:00:00Z', lead_score,
        },
      });
    expect(column(leadTable([audited(65), audited(undefined)]), 'Lead capture')).toEqual(['65', '']);
  });

  it('leaves audit columns blank for unaudited businesses', () => {
    const table = leadTable([business({ email: null })]);
    expect(column(table, 'Email')).toEqual(['']);
    expect(column(table, 'Performance')).toEqual(['']);
    expect(column(table, 'SSL')).toEqual(['']);
  });

  it('includes scores and the AI report once audited', () => {
    const table = leadTable([
      business({
        audit: {
          id: 'a1', business_id: 'b1', performance_score: 98, seo_score: 100, mobile_score: 35,
          ssl_valid: true, geo_score: null, aeo_score: 45, checks: {}, engine_version: 2, raw_json: {},
          created_at: '2026-09-28T10:00:00Z',
        },
        ai_report: { id: 'r1', audit_id: 'a1', summary: 'Slow on mobile.', improvements: [], cold_email: 'Hi,\nQuick note.', created_at: '' },
      }),
    ]);
    expect(column(table, 'Performance')).toEqual(['98']);
    expect(column(table, 'GEO')).toEqual(['']);
    expect(column(table, 'SSL')).toEqual(['Yes']);
    expect(column(table, 'Audited on')).toEqual(['2026-09-28']);
    expect(column(table, 'Cold email')).toEqual(['Hi,\nQuick note.']);
  });

  it('neutralises cells a spreadsheet would run as a formula, but not phone numbers', () => {
    const table = leadTable([business({ name: '=HYPERLINK("http://x")', phone: '+1 (202) 517-8035', address: '@evil' })]);
    expect(column(table, 'Name')).toEqual(['\'=HYPERLINK("http://x")']);
    expect(column(table, 'Address')).toEqual(["'@evil"]);
    expect(column(table, 'Phone')).toEqual(['+1 (202) 517-8035']);
  });
});

describe('toDelimited', () => {
  it('quotes cells containing the delimiter, quotes or line breaks', () => {
    const table = [['a', 'b, c'], ['say "hi"', 'line\nbreak']];
    expect(toDelimited(table, ',')).toBe('a,"b, c"\r\n"say ""hi""","line\nbreak"');
  });

  it('only quotes tabs for TSV, not commas', () => {
    expect(toDelimited([['b, c', 'x\ty']], '\t')).toBe('b, c\t"x\ty"');
  });
});

describe('toHtmlTable', () => {
  it('escapes HTML and keeps line breaks inside a cell', () => {
    const html = toHtmlTable([['Name'], ['<b>A&B</b>\nnext']]);
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>&lt;b&gt;A&amp;B&lt;/b&gt;<br>next</td>');
  });
});

describe('exportFileName', () => {
  const date = new Date(2026, 8, 29);

  it('names the file after the search and the date', () => {
    expect(exportFileName({ niche: 'Dentists', location: 'Washington, DC' }, date)).toBe(
      'auditely-dentists-washington-dc-2026-09-29.csv'
    );
  });

  it('falls back to a generic name without a query', () => {
    expect(exportFileName(null, date)).toBe('auditely-leads-2026-09-29.csv');
  });
});
