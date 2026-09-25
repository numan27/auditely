import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { compareNap, extractNapSignals, type SiteNapSignals } from '@/app/_shared/lib/audit/analyzers/nap';
import type { BusinessEntity } from '@/app/_shared/lib/audit/analyzers/structuredData';

const google = { name: 'Smile Dental', address: '123 Main St, Springfield, IL 62701, USA', phone: '(555) 123-4567' };

const entity = (over: Partial<BusinessEntity> = {}): BusinessEntity => ({
  types: ['Dentist'],
  name: 'Smile Dental',
  address: '123 Main Street, Springfield, IL, 62701',
  telephone: '+1-555-123-4567',
  hasHours: false,
  hasGeo: false,
  hasSameAs: false,
  sameAs: [],
  ...over,
});

const signals = (over: Partial<SiteNapSignals> = {}): SiteNapSignals => ({
  entity: entity(),
  siteName: 'Smile Dental',
  telLinks: [],
  text: '',
  ...over,
});

describe('compareNap', () => {
  it('matches all three fields from the schema entity', () => {
    expect(compareNap(google, signals())).toMatchObject({ name: 'match', address: 'match', phone: 'match' });
  });

  it('flags a phone mismatch and reports the site value', () => {
    const result = compareNap(google, signals({ entity: entity({ telephone: '555-999-0000' }) }));
    expect(result.phone).toBe('mismatch');
    expect(result.site.phones).toEqual(['5559990000']);
  });

  it('matches phones from tel: links and visible text with +1 and extensions', () => {
    const fromLink = compareNap(google, signals({ entity: null, telLinks: ['%2B15551234567'] }));
    expect(fromLink.phone).toBe('match');
    const fromText = compareNap(google, signals({ entity: null, text: 'Call us at 555.123.4567 ext. 2 today' }));
    expect(fromText.phone).toBe('match');
  });

  it('uses visible text for the address when the schema has none', () => {
    const result = compareNap(google, signals({ entity: null, text: 'Visit us: 123 Main St, Springfield IL 62701' }));
    expect(result.address).toBe('match');
  });

  it('flags a schema address that disagrees with Google', () => {
    const result = compareNap(google, signals({ entity: entity({ address: '900 Oak Ave, Springfield, IL, 62704' }) }));
    expect(result.address).toBe('mismatch');
  });

  it('matches on visible text when the schema address is incomplete', () => {
    const result = compareNap(
      google,
      signals({ entity: entity({ address: '123 Main St, Springfield' }), text: 'Find us at 123 Main St, Springfield, IL 62701' })
    );
    expect(result.address).toBe('match');
  });

  it('reports missing when the site shows nothing', () => {
    expect(compareNap(google, signals({ entity: null, siteName: null, text: 'Welcome!' }))).toMatchObject({
      name: 'missing',
      address: 'missing',
      phone: 'missing',
    });
  });

  it('returns n/a for fields Google does not have', () => {
    const result = compareNap({ name: 'Smile Dental', address: 'Springfield, IL, USA', phone: null }, signals());
    expect(result).toMatchObject({ name: 'match', address: 'n/a', phone: 'n/a' });
  });

  it('returns n/a when the Google address lacks a ZIP or street number', () => {
    expect(compareNap({ ...google, address: '123 Main St, Springfield, IL' }, signals()).address).toBe('n/a');
    expect(compareNap({ ...google, address: 'Springfield, IL 62701' }, signals()).address).toBe('n/a');
  });
});

describe('extractNapSignals', () => {
  it('falls back to og:site_name, then <title>, and collects tel: links', () => {
    const $ = cheerio.load(
      '<head><title>Home | Smile Dental</title></head><body><a href="tel:+15551234567">Call</a></body>'
    );
    const s = extractNapSignals($, null, 'Call');
    expect(s.siteName).toBe('Home | Smile Dental');
    expect(s.telLinks).toEqual(['+15551234567']);

    const withOg = cheerio.load('<head><meta property="og:site_name" content="Smile Dental"><title>Home</title></head>');
    expect(extractNapSignals(withOg, null, '').siteName).toBe('Smile Dental');
  });

  it('decodes URL-encoded tel: links', () => {
    const encoded = cheerio.load('<body><a href="tel:+1%20555%20123%204567">Call</a></body>');
    expect(extractNapSignals(encoded, null, '').telLinks).toEqual(['+1 555 123 4567']);
  });
});
