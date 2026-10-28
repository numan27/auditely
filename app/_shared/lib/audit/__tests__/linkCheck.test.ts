import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkLinks } from '@/app/_shared/lib/audit/linkCheck';

// No real DNS: every name is public except *.internal
vi.mock('node:dns', () => ({
  promises: {
    lookup: async (host: string) => [{ address: host.endsWith('.internal') ? '10.0.0.5' : '93.184.216.34', family: 4 }],
  },
}));

describe('checkLinks', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  // Answers by path (200 when not listed); `onGet` overrides the answer to GET requests
  function site(answers: Record<string, number | Error>, onGet: Record<string, number> = {}) {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      const answer = init.method === 'GET' && path in onGet ? onGet[path] : (answers[path] ?? 200);
      if (answer instanceof Error) throw answer;
      return new Response('x', { status: answer });
    });
  }

  it('reports missing pages (404, 410) as broken and working ones as ok', async () => {
    site({ '/gone': 404, '/removed': 410 });
    expect(await checkLinks(['https://a.com/gone', 'https://a.com/removed', 'https://a.com/fine'])).toEqual([
      { url: 'https://a.com/gone', status: 'broken' },
      { url: 'https://a.com/removed', status: 'broken' },
      { url: 'https://a.com/fine', status: 'ok' },
    ]);
  });

  it('never calls a blocked, failing or slow link broken', async () => {
    const timeout = Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' });
    site({ '/blocked': 403, '/busy': 429, '/error': 500, '/slow': timeout });
    const results = await checkLinks(['/blocked', '/busy', '/error', '/slow'].map((p) => `https://a.com${p}`));
    expect(results.map((r) => r.status)).toEqual(['unknown', 'unknown', 'unknown', 'unknown']);
  });

  it('confirms a failed HEAD request with GET before judging the link', async () => {
    // Some servers refuse HEAD (405) or answer it wrongly (404) while the page works
    site({ '/no-head': 405, '/bad-head': 404, '/fine': 200 }, { '/no-head': 200, '/bad-head': 200 });
    const results = await checkLinks(['https://a.com/no-head', 'https://a.com/bad-head', 'https://a.com/fine']);
    expect(results.map((r) => r.status)).toEqual(['ok', 'ok', 'ok']);
    const methods = fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method).sort();
    expect(methods).toEqual(['GET', 'GET', 'HEAD', 'HEAD', 'HEAD']);
  });

  it('checks at most 30 links, 8 at a time', async () => {
    let inFlight = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return new Response('x', { status: 200 });
    });
    const results = await checkLinks(Array.from({ length: 40 }, (_, i) => `https://a.com/page-${i}`));
    expect(results).toHaveLength(30);
    expect(fetchMock).toHaveBeenCalledTimes(30);
    expect(peak).toBe(8);
  });

  it('reads a link that redirects somewhere private as unknown, not broken', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://metadata.internal/' } }));
    expect(await checkLinks(['https://a.com/out', 'http://10.0.0.1/admin'])).toEqual([
      { url: 'https://a.com/out', status: 'unknown' },
      { url: 'http://10.0.0.1/admin', status: 'unknown' },
    ]);
    // Only a.com/out's first hop is ever requested
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
