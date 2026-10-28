// Google's terms for its place data shown without a map: the Google Maps logo
// near the businesses, once per list, the light or dark version to suit the
// theme, and (recommended) a word on how Google treats fake reviews.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GoogleMapsAttribution } from '@/app/_shared/components/auditely/googleMapsAttribution/googleMapsAttribution';
import { LeadResults } from '@/app/_shared/components/auditely/leadResults/leadResults';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

const lead = (name: string): BusinessWithData => ({
  id: `id-${name}`,
  search_id: 'search',
  name,
  address: '1 Main St, Austin, TX',
  website: `https://${name}`,
  phone: null,
  email: null,
  contact_page: null,
  socials: {},
  contacts_checked_at: null,
  email_lookup_at: null,
  rating: 4.6,
  review_count: 120,
  created_at: '2026-10-01T00:00:00Z',
});

describe('GoogleMapsAttribution', () => {
  const html = renderToStaticMarkup(createElement(GoogleMapsAttribution));
  const logos = [...html.matchAll(/<img[^>]*>/g)].map(([tag]) => tag);

  it("shows Google's own Maps logo, the grey one on light and the white one on dark", () => {
    expect(logos).toHaveLength(2);
    expect(logos[0]).toContain('src="/brand/google-maps-logo-gray.svg"');
    expect(logos[0]).toContain('dark:hidden');
    expect(logos[1]).toContain('src="/brand/google-maps-logo-white.svg"');
    expect(logos[1]).toContain('dark:block');
    for (const logo of logos) {
      expect(logo).toContain('alt="Google Maps"');
      // Google asks for 16 to 19 pixels high, its shape unchanged
      expect(logo).toContain('height="18"');
      expect(logo).toContain('width="98"');
    }
  });

  it('says how Google treats fake reviews, with its policy a click away', () => {
    expect(text(html)).toContain("Ratings aren't verified by Google, which removes fake reviews when it finds them. Learn more");
    expect(html).toMatch(/<a[^>]*href="https:\/\/support\.google\.com\/contributionpolicy\/answer\/7422880"/);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe('LeadResults', () => {
  it('carries the Google Maps notice once, above the businesses', () => {
    const html = renderToStaticMarkup(
      createElement(LeadResults, {
        businesses: [lead('a.com'), lead('b.com')],
        query: { niche: 'dentists', location: 'Austin, TX' },
        discovery: { done: 2, total: 2 },
        onUpdate: () => {},
      })
    );
    expect(html.match(/src="\/brand\/google-maps-logo-gray\.svg"/g)).toHaveLength(1);
    expect(html.indexOf('google-maps-logo-gray.svg')).toBeLessThan(html.indexOf('a.com'));
  });
});
