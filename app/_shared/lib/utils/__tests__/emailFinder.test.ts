import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findEmail } from '@/app/_shared/lib/utils/emailFinder';

describe('findEmail with prefetched homepage HTML', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('uses the given HTML instead of fetching the homepage', async () => {
    const email = await findEmail('https://smiledental.com/', {
      homepageHtml: '<a href="mailto:hello@smiledental.com">Email us</a>',
    });
    expect(email).toBe('hello@smiledental.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still scrapes the contact pages when the homepage has no email', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === 'https://smiledental.com/contact'
        ? new Response('<p>office@smiledental.com</p>', { status: 200 })
        : new Response('', { status: 404 })
    );
    const email = await findEmail('https://smiledental.com/', { homepageHtml: '<p>No email here</p>' });
    expect(email).toBe('office@smiledental.com');
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain('https://smiledental.com/');
  });

  it("follows the site's own links when the usual pages have no email", async () => {
    const homepageHtml = `
      <a href="/our-doctors">Doctors</a>
      <a href="https://www.smiledental.com/privacy-policy">Privacy</a>
      <a href="https://facebook.com/smiledental">Facebook</a>
      <a href="/brochure.pdf">Brochure</a>`;
    fetchMock.mockImplementation(async (url: string) =>
      url === 'https://www.smiledental.com/privacy-policy'
        ? new Response('<p>Questions? office@smiledental.com</p>', { status: 200 })
        : new Response('', { status: 404 })
    );
    expect(await findEmail('https://smiledental.com/', { homepageHtml })).toBe('office@smiledental.com');
    const fetched = fetchMock.mock.calls.map(([url]) => url as string);
    expect(fetched).toContain('https://smiledental.com/our-doctors');
    expect(fetched.some((url) => url.includes('facebook.com') || url.endsWith('.pdf'))).toBe(false);
  });

  it("skips WordPress's technical links and follows only real page links", async () => {
    const homepageHtml = `
      <link rel="alternate" type="application/rss+xml" href="https://smiledental.com/feed/">
      <link rel="https://api.w.org/" href="https://smiledental.com/wp-json/">
      <a href="/comments/feed/">Comments feed</a>
      <a href="/xmlrpc.php?rsd">RSD</a>
      <a href="/our-office/">Our office</a>`;
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    await findEmail('https://smiledental.com/', { homepageHtml });
    const fetched = fetchMock.mock.calls.map(([url]) => url as string);
    expect(fetched).toContain('https://smiledental.com/our-office/');
    expect(fetched.some((url) => /feed|wp-json|xmlrpc/.test(url))).toBe(false);
  });

  it('reads careers and jobs pages last', async () => {
    const homepageHtml = '<a href="/careers/">Careers</a><a href="/services/">Services</a><a href="/meet-our-team/">Team</a>';
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    await findEmail('https://smiledental.com/', { homepageHtml });
    const extra = fetchMock.mock.calls.map(([url]) => url as string).filter((url) => /careers|services|meet-our-team/.test(url));
    expect(extra).toEqual([
      'https://smiledental.com/meet-our-team/',
      'https://smiledental.com/services/',
      'https://smiledental.com/careers/',
    ]);
  });

  it('skips HR and recruiting addresses, which are not sales contacts', async () => {
    const html = (emails: string) => emails.split(',').map((e) => `<a href="mailto:${e}">x</a>`).join('');
    expect(await findEmail('https://smiledental.com/', { homepageHtml: html('contacthr@smiledental.com,info@smiledental.com') })).toBe(
      'info@smiledental.com'
    );
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    for (const hr of ['hr@smiledental.com', 'voe@smiledental.com', 'careers@smiledental.com', 'jobs.dallas@smiledental.com', 'recruiting@smiledental.com']) {
      expect(await findEmail('https://smiledental.com/', { homepageHtml: html(hr) })).toBeNull();
    }
  });

  it('keeps names that merely contain the letters "hr"', async () => {
    const homepageHtml = '<a href="mailto:christine.hradek@smiledental.com">x</a>';
    expect(await findEmail('https://smiledental.com/', { homepageHtml })).toBe('christine.hradek@smiledental.com');
  });

  it('reads at most 8 extra pages, contact-like ones first', async () => {
    const links =
      Array.from({ length: 20 }, (_, i) => `<a href="/page-${i}">p</a>`).join('') + '<a href="/new-patients">New patients</a>';
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    await findEmail('https://smiledental.com/', { homepageHtml: links });
    const extra = fetchMock.mock.calls.map(([url]) => url as string).filter((url) => /page-|new-patients/.test(url));
    expect(extra).toHaveLength(8);
    expect(extra[0]).toBe('https://smiledental.com/new-patients');
  });
});
