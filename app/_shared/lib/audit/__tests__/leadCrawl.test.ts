import { describe, it, expect, vi } from 'vitest';
import { crawlKeyPages, keyPageLinks, linkTargets, type CrawledPage } from '@/app/_shared/lib/audit/leadCrawl';
import type { PageFetchResult } from '@/app/_shared/lib/audit/siteFetch';

// Serves `<p>{url}</p>` for every page, except the given failures
const fakeFetchPage = (failures: Record<string, number> = {}) =>
  vi.fn(async (url: string): Promise<PageFetchResult> =>
    url in failures
      ? { ok: false, status: failures[url], finalUrl: url, html: null, reason: `HTTP ${failures[url]}` }
      : { ok: true, status: 200, finalUrl: url, html: `<p>${url}</p>` }
  );

describe('crawlKeyPages', () => {
  it('fetches the key pages the homepage links to, homepage first', async () => {
    const load = fakeFetchPage({ 'https://smile.com/book': 404 });
    const pages = await crawlKeyPages('https://smile.com/', '<a href="/contact">Contact</a><a href="/book">Book</a>', load);
    expect(pages).toEqual([
      {
        url: 'https://smile.com/',
        finalUrl: 'https://smile.com/',
        kind: 'home',
        html: '<a href="/contact">Contact</a><a href="/book">Book</a>',
        status: 200,
      },
      { url: 'https://smile.com/contact', finalUrl: 'https://smile.com/contact', kind: 'contact', html: '<p>https://smile.com/contact</p>', status: 200 },
      { url: 'https://smile.com/book', finalUrl: 'https://smile.com/book', kind: 'booking', html: null, status: 404 },
    ]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('resolves key pages against the address the homepage redirected to', async () => {
    const load = fakeFetchPage();
    await crawlKeyPages('https://www.smile.com/home', '<a href="contact">Contact</a>', load);
    expect(load).toHaveBeenCalledWith('https://www.smile.com/contact');
  });
});

describe('linkTargets', () => {
  const page = (url: string, kind: CrawledPage['kind'], html: string | null): CrawledPage => ({ url, kind, html, status: 200 });

  it('lists links not fetched yet, homepage links first, once each', () => {
    const pages = [
      page('https://smile.com/', 'home', '<a href="/contact">C</a><a href="/team">T</a><a href="/">H</a>'),
      page('https://smile.com/contact', 'contact', '<a href="/team/">T</a><a href="/map">M</a>'),
      page('https://smile.com/about', 'about', null),
    ];
    expect(linkTargets(pages)).toEqual(['https://smile.com/team', 'https://smile.com/map']);
  });

  it("resolves a redirected key page's links against where it ended up", () => {
    const pages: CrawledPage[] = [
      page('https://smile.com/', 'home', '<a href="/contact">C</a>'),
      { url: 'https://smile.com/contact', finalUrl: 'https://smile.com/pages/contact.html', kind: 'contact', html: '<a href="services.html">S</a>', status: 200 },
    ];
    expect(linkTargets(pages)).toEqual(['https://smile.com/pages/services.html']);
  });

  it('checks no links on a key page that redirected to another site', () => {
    const pages: CrawledPage[] = [
      page('https://smile.com/', 'home', '<a href="/book">Book</a>'),
      { url: 'https://smile.com/book', finalUrl: 'https://www.vagaro.com/smile', kind: 'booking', html: '<a href="/login">Log in</a><a href="/pro/pricing">P</a>', status: 200 },
    ];
    expect(linkTargets(pages)).toEqual([]);
  });

  it('stops at 30 links', () => {
    const html = Array.from({ length: 40 }, (_, i) => `<a href="/p${i}">p</a>`).join('');
    expect(linkTargets([page('https://smile.com/', 'home', html)])).toHaveLength(30);
  });
});

describe('keyPageLinks', () => {
  it('counts each fetched key page as a checked link: 404 broken, 403 unknown, 200 ok', () => {
    const pages: CrawledPage[] = [
      { url: 'https://smile.com/', kind: 'home', html: '', status: 200 },
      { url: 'https://smile.com/contact', kind: 'contact', html: '', status: 200 },
      { url: 'https://smile.com/book', kind: 'booking', html: null, status: 404 },
      { url: 'https://smile.com/about', kind: 'about', html: null, status: 403 },
    ];
    expect(keyPageLinks(pages)).toEqual([
      { url: 'https://smile.com/contact', status: 'ok' },
      { url: 'https://smile.com/book', status: 'broken' },
      { url: 'https://smile.com/about', status: 'unknown' },
    ]);
  });
});
