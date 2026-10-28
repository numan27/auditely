// The image a shared link to Auditely shows: the landing page's headline beside
// the demo sample's six real scores, named by its search, never by the business.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ShareImage, { alt, contentType, size } from '@/app/opengraph-image';
import { ShareCard } from '@/app/_shared/components/seo/shareCard';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { landingSample, searchLabel } from '@/app/_shared/lib/demo/landingDemo';
import { SHARE_IMAGE_ALT } from '@/app/_shared/lib/seo/shareCopy';

const sample = landingSample(demoData);
const search = searchLabel(demoData.query);
const card = renderToStaticMarkup(createElement(ShareCard, { search, scores: sample.scores, site: 'auditely.vercel.app' }));
const text = card.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the share image', () => {
  // Without the network the image still renders, in the default face
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is a 1200 by 630 PNG with words for people who can’t see it', () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe('image/png');
    expect(alt).toBe(SHARE_IMAGE_ALT);
  });

  it('renders a PNG', async () => {
    const response = await ShareImage();
    const head = new Uint8Array(await response.arrayBuffer()).slice(0, 8);
    expect(Array.from(head)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }, 30_000);

  it("carries the landing page's headline and lead", () => {
    expect(text).toContain('Find clients whose websites need you.');
    expect(text).toContain('Audit any website in about a minute, with the first email written for you.');
  });

  it("shows the sample's six scores under its search, not its name", () => {
    expect(text).toContain('Sample audit');
    expect(text).toContain(`${search.niche} ${search.location}`);
    for (const { label, score } of sample.scores) {
      expect(text).toContain(label);
      expect(text).toContain(String(score ?? '—'));
    }
    expect(text).not.toContain(sample.name);
    expect(text).not.toContain(sample.host);
  });

  it('ends with the address to visit', () => {
    expect(text).toContain('auditely.vercel.app');
  });
});
