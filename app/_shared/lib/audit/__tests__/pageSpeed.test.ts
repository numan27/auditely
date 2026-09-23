import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPageSpeed, categoryScore } from '@/app/_shared/lib/audit/pageSpeed';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const lighthouse = (overrides: Record<string, unknown> = {}) => ({
  lighthouseResult: {
    categories: {
      performance: { score: 0.42, title: 'Performance' },
      seo: { score: 0.71, title: 'SEO' },
    },
    audits: {
      'is-on-https': { score: 1, title: 'Uses HTTPS' },
      'largest-contentful-paint': { score: 0.1, title: 'Largest Contentful Paint', displayValue: '12.8 s' },
    },
    ...overrides,
  },
});

describe('runPageSpeed', () => {
  const fetchMock = vi.fn();
  const deadline = 240_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GOOGLE_PAGESPEED_API_KEY', 'test-key');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it('requests all four categories for the given strategy', async () => {
    fetchMock.mockResolvedValue(json(lighthouse()));
    await runPageSpeed('https://acme.com/', 'mobile', deadline);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.getAll('category')).toEqual(['performance', 'seo', 'best-practices', 'accessibility']);
    expect(url.searchParams.get('strategy')).toBe('mobile');
    expect(url.searchParams.get('url')).toBe('https://acme.com/');
  });

  it('returns the trimmed summary and the HTTPS result', async () => {
    fetchMock.mockResolvedValue(json(lighthouse()));
    const result = await runPageSpeed('https://acme.com/', 'mobile', deadline);
    if (!result.ok) throw new Error('expected ok');
    expect(categoryScore(result.summary, 'performance')).toBe(42);
    expect(result.isOnHttps).toBe(true);
    expect(result.summary.keyAudits['largest-contentful-paint'].displayValue).toBe('12.8 s');
  });

  it('keeps a null category score as null instead of 0', async () => {
    fetchMock.mockResolvedValue(
      json(lighthouse({ categories: { performance: { score: 0.5, title: 'Performance' }, seo: { score: null, title: 'SEO' } } }))
    );
    const result = await runPageSpeed('https://acme.com/', 'mobile', deadline);
    if (!result.ok) throw new Error('expected ok');
    expect(categoryScore(result.summary, 'seo')).toBeNull();
    expect(categoryScore(result.summary, 'accessibility')).toBeNull();
  });

  it('does not retry a Lighthouse page-load error', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 400, message: 'Lighthouse returned error: FAILED_DOCUMENT_REQUEST. Lighthouse was unable to reliably load the page.' } }, 400)
    );
    expect(await runPageSpeed('https://down.example/', 'mobile', deadline)).toEqual({
      ok: false,
      reason: 'FAILED_DOCUMENT_REQUEST',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the daily quota is exhausted', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 429, message: "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'" } }, 429)
    );
    expect(await runPageSpeed('https://acme.com/', 'mobile', deadline)).toEqual({
      ok: false,
      reason: 'Daily PageSpeed quota exceeded',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 503 and succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: { code: 503, message: 'Backend Error' } }, 503))
      .mockResolvedValueOnce(json(lighthouse()));
    const promise = runPageSpeed('https://acme.com/', 'desktop', deadline);
    await vi.advanceTimersByTimeAsync(3000);
    expect((await promise).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a Lighthouse runtimeError inside a 200 response', async () => {
    fetchMock.mockResolvedValue(json(lighthouse({ runtimeError: { code: 'NO_FCP' } })));
    expect(await runPageSpeed('https://acme.com/', 'mobile', deadline)).toEqual({ ok: false, reason: 'NO_FCP' });
  });

  it('fails fast without an API key', async () => {
    vi.stubEnv('GOOGLE_PAGESPEED_API_KEY', '');
    expect(await runPageSpeed('https://acme.com/', 'mobile', deadline)).toEqual({
      ok: false,
      reason: 'GOOGLE_PAGESPEED_API_KEY is not configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
