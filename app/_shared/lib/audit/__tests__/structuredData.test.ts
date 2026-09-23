import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { parseStructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';

const ld = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const page = (...blocks: string[]) => cheerio.load(`<html><head>${blocks.join('')}</head><body></body></html>`);

describe('parseStructuredData', () => {
  it('reads a business entity with address, phone and hours', () => {
    const $ = page(
      ld({
        '@context': 'https://schema.org',
        '@type': 'Dentist',
        name: 'Smile Dental',
        telephone: '+1 555-123-4567',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '123 Main St',
          addressLocality: 'Springfield',
          addressRegion: 'IL',
          postalCode: '62701',
        },
        openingHours: 'Mo-Fr 09:00-17:00',
      })
    );
    const sd = parseStructuredData($, 'Smile Dental');
    expect(sd.blocks).toBe(1);
    expect(sd.types).toEqual(expect.arrayContaining(['Dentist', 'PostalAddress']));
    expect(sd.entity).toMatchObject({
      types: ['Dentist'],
      name: 'Smile Dental',
      telephone: '+1 555-123-4567',
      address: '123 Main St, Springfield, IL, 62701',
      hasHours: true,
      hasGeo: false,
    });
  });

  it('handles @type arrays and a multi-location @graph, preferring the Google name', () => {
    const $ = page(
      ld({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Smile Group' },
          { '@type': ['Dentist', 'LocalBusiness'], name: 'Smile Dental Downtown', telephone: '555-000-0000' },
          { '@type': ['Dentist', 'LocalBusiness'], name: 'Smile Dental Uptown', telephone: '555-111-1111' },
        ],
      })
    );
    const sd = parseStructuredData($, 'Smile Dental Uptown');
    expect(sd.entity?.name).toBe('Smile Dental Uptown');
    expect(sd.entity?.types).toEqual(['Dentist', 'LocalBusiness']);
  });

  it('breaks a name tie with the Google phone number', () => {
    const $ = page(
      ld({
        '@graph': [
          { '@type': 'Dentist', name: 'Smile Dental', telephone: '555-000-0000' },
          { '@type': 'Dentist', name: 'Smile Dental', telephone: '555-123-4567' },
        ],
      })
    );
    expect(parseStructuredData($, 'Smile Dental', '(555) 123-4567').entity?.telephone).toBe('555-123-4567');
  });

  it('skips invalid JSON-LD blocks and falls back to an Organization', () => {
    const $ = page('<script type="application/ld+json">{ bad json</script>', ld({ '@type': 'Organization', name: 'Acme' }));
    const sd = parseStructuredData($, 'Acme');
    expect(sd.blocks).toBe(1);
    expect(sd.entity?.types).toEqual(['Organization']);
  });

  it('strips schema.org URL prefixes and CDATA wrappers', () => {
    const $ = page(
      `<script type="application/ld+json">/* <![CDATA[ */${JSON.stringify({ '@type': 'http://schema.org/Dentist', name: 'Smile' })}/* ]]> */</script>`
    );
    expect(parseStructuredData($, null).entity?.types).toEqual(['Dentist']);
  });

  it('returns no entity when only page-level types exist', () => {
    const sd = parseStructuredData(page(ld({ '@type': 'WebSite', name: 'Acme' })), 'Acme');
    expect(sd.entity).toBeNull();
    expect(sd.types).toEqual(['WebSite']);
  });

  it('reports zero blocks for pages without JSON-LD', () => {
    expect(parseStructuredData(page(), null)).toEqual({ blocks: 0, types: [], entity: null });
  });
});
