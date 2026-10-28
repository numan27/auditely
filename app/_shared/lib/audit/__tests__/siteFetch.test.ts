import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSite, fetchPage, NotPublicError, publicFetch } from '@/app/_shared/lib/audit/siteFetch';
import type { HostLookup } from '@/app/_shared/lib/utils/publicAddress';

// No real DNS: every name is public except *.internal
vi.mock('node:dns', () => ({
  promises: {
    lookup: async (host: string) => [{ address: host.endsWith('.internal') ? '10.0.0.5' : '93.184.216.34', family: 4 }],
  },
}));

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

  it('treats a bot-challenge page as blocked, not as the site', async () => {
    // SiteGround answers 202 with a meta-refresh to its captcha
    const sg = '<html><head><meta http-equiv="refresh" content="0;/.well-known/sgcaptcha/?r=%2F"></meta></head></html>';
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/robots.txt')
        ? new Response('', { status: 404 })
        : page(sg, 'https://acme.com/', { status: 202, headers: { 'content-type': 'text/html', 'sg-captcha': 'challenge' } })
    );
    expect(await fetchSite('https://acme.com/')).toMatchObject({ ok: false, reason: 'Blocked (bot challenge)', html: null });
  });

  it('spots a Cloudflare challenge from the page alone', async () => {
    const cf = '<html><body><script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script></body></html>';
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/robots.txt') ? new Response('', { status: 404 }) : page(cf, 'https://acme.com/')
    );
    expect(await fetchSite('https://acme.com/')).toMatchObject({ ok: false, reason: 'Blocked (bot challenge)' });
  });

  it('keeps a real page that merely uses a captcha on its form', async () => {
    const real = `<html><body>${'<p>Welcome to Acme Dental.</p>'.repeat(300)}<div class="g-recaptcha"></div></body></html>`;
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/robots.txt') ? new Response('', { status: 404 }) : page(real, 'https://acme.com/')
    );
    expect((await fetchSite('https://acme.com/')).ok).toBe(true);
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

describe('fetchPage', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('returns the HTML and final address of a page, without fetching robots.txt', async () => {
    fetchMock.mockResolvedValue(page('<h1>Contact us</h1>', 'https://www.acme.com/contact/'));
    expect(await fetchPage('https://acme.com/contact')).toEqual({
      ok: true,
      status: 200,
      finalUrl: 'https://www.acme.com/contact/',
      html: '<h1>Contact us</h1>',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reports a missing page with its status', async () => {
    fetchMock.mockResolvedValue(page('Not found', 'https://acme.com/book', { status: 404 }));
    expect(await fetchPage('https://acme.com/book')).toMatchObject({ ok: false, status: 404, html: null, reason: 'HTTP 404' });
  });

  it('treats a bot-challenge page as blocked', async () => {
    fetchMock.mockResolvedValue(
      page('<script src="/cdn-cgi/challenge-platform/h/b/orchestrate/jsch/v1"></script>', 'https://acme.com/contact')
    );
    expect(await fetchPage('https://acme.com/contact')).toMatchObject({ ok: false, html: null, reason: 'Blocked (bot challenge)' });
  });

  it('reports unreachable pages', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await fetchPage('https://acme.com/contact')).toEqual({
      ok: false,
      status: null,
      finalUrl: null,
      html: null,
      reason: 'Page unreachable',
    });
  });
});

describe('publicFetch', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const lookup = (map: Record<string, string[]>): HostLookup => async (host) => {
    if (!map[host]) throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' });
    return map[host].map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  };
  const redirect = (status: number, location: string) => new Response(null, { status, headers: { location } });
  const PUBLIC = ['93.184.216.34'];

  it('never requests a redirect hop that points to a private address', async () => {
    fetchMock.mockResolvedValueOnce(redirect(302, 'http://metadata.internal/latest'));
    await expect(
      publicFetch('https://example.com/', {}, lookup({ 'example.com': PUBLIC, 'metadata.internal': ['169.254.169.254'] }))
    ).rejects.toBeInstanceOf(NotPublicError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a private address literal without requesting it', async () => {
    for (const url of ['http://127.0.0.1/', 'http://[::1]:8080/', 'http://169.254.169.254/latest']) {
      await expect(publicFetch(url, {}, lookup({}))).rejects.toBeInstanceOf(NotPublicError);
    }
    await expect(publicFetch('file:///etc/passwd', {}, lookup({}))).rejects.toBeInstanceOf(NotPublicError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('follows public redirects and returns the last hop', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === 'https://example.com/' ? redirect(301, 'https://www.example.com/') : page('<p>hi</p>', url)
    );
    const res = await publicFetch('https://example.com/', {}, lookup({ 'example.com': PUBLIC, 'www.example.com': PUBLIC }));
    expect(res.status).toBe(200);
    expect(res.url).toBe('https://www.example.com/');
    expect(fetchMock.mock.calls.map(([url, init]) => [url, (init as RequestInit).redirect])).toEqual([
      ['https://example.com/', 'manual'],
      ['https://www.example.com/', 'manual'],
    ]);
  });

  it('resolves a relative Location against the hop, and makes a 303 a GET', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === 'https://example.com/old' ? redirect(303, '/new') : page('<p>hi</p>', url)
    );
    await publicFetch('https://example.com/old', { method: 'HEAD' }, lookup({ 'example.com': PUBLIC }));
    const [, second] = fetchMock.mock.calls;
    expect(second[0]).toBe('https://example.com/new');
    expect((second[1] as RequestInit).method).toBe('GET');
  });

  it('stops after five redirects', async () => {
    let n = 0;
    fetchMock.mockImplementation(async () => redirect(302, `https://example.com/${++n}`));
    await expect(publicFetch('https://example.com/', {}, lookup({ 'example.com': PUBLIC }))).rejects.toThrow('Too many redirects');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

describe('fetchSite and fetchPage on private addresses', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('reports a site that points to a private address as not answering, without requesting it', async () => {
    expect(await fetchSite('http://intranet.internal/')).toMatchObject({ ok: false, reason: 'it points to a private address' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a homepage that redirects somewhere private the same', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://metadata.internal/' } }));
    expect(await fetchSite('https://acme.com/')).toMatchObject({ ok: false, reason: 'it points to a private address' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never reads a key page on a private address', async () => {
    expect(await fetchPage('http://admin.internal/contact')).toMatchObject({
      ok: false,
      html: null,
      reason: 'it points to a private address',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
