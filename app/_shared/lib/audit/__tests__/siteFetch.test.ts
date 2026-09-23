import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSite } from '@/app/_shared/lib/audit/siteFetch';

// Response.url can't be set via the constructor; define it to simulate redirects
function page(body: string, url: string, init: ResponseInit = {}): Response {
  const res = new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
  Object.defineProperty(res, 'url', { value: url });
  return res;
}

describe('fetchSite', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('follows redirects and reads robots.txt from the final origin', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'http://acme.com/home?utm_source=gmb') return page('<html><title>Acme</title></html>', 'https://www.acme.com/home');
      if (url === 'https://www.acme.com/robots.txt') {
        return new Response('User-agent: *\nDisallow:', { status: 200, headers: { 'content-type': 'text/plain' } });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const site = await fetchSite('http://acme.com/home?utm_source=gmb');
    expect(site.ok).toBe(true);
    expect(site.finalUrl).toBe('https://www.acme.com/home');
    expect(site.html).toContain('<title>Acme</title>');
    expect(site.robots).toEqual({ status: 200, body: 'User-agent: *\nDisallow:' });
  });

  it('records a missing robots.txt', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/robots.txt') ? new Response('nope', { status: 404 }) : page('<p>hi</p>', 'https://acme.com/')
    );
    expect((await fetchSite('https://acme.com/')).robots).toEqual({ status: 404, body: null });
  });

  it('reports bot blocking without fetching robots.txt', async () => {
    fetchMock.mockResolvedValue(page('Forbidden', 'https://acme.com/', { status: 403 }));
    const site = await fetchSite('https://acme.com/');
    expect(site).toMatchObject({ ok: false, status: 403, reason: 'Blocked (403)', html: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects non-HTML content', async () => {
    fetchMock.mockResolvedValue(page('%PDF-1.4', 'https://acme.com/menu.pdf', { headers: { 'content-type': 'application/pdf' } }));
    expect(await fetchSite('https://acme.com/menu.pdf')).toMatchObject({ ok: false, reason: 'Not an HTML page' });
  });

  it('caps the HTML at 2 MB', async () => {
    const big = 'a'.repeat(3 * 1024 * 1024);
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/robots.txt') ? new Response('', { status: 404 }) : page(big, 'https://acme.com/')
    );
    const site = await fetchSite('https://acme.com/');
    expect(site.html?.length).toBe(2 * 1024 * 1024);
  });

  it('reports unreachable sites', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await fetchSite('https://acme.com/')).toMatchObject({ ok: false, reason: 'Site unreachable' });
  });

  it('rejects invalid URLs without fetching', async () => {
    expect(await fetchSite('not a url')).toMatchObject({ ok: false, reason: 'Invalid website URL' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
