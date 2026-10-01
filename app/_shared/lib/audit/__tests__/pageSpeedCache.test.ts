import { describe, it, expect, vi } from 'vitest';
import { withPageSpeedCache, type CachedPageSpeed, type PageSpeedStore } from '@/app/_shared/lib/audit/pageSpeedCache';
import { memoryPageSpeedStore as memoryStore } from '@/app/_shared/lib/audit/__tests__/memoryPageSpeedStore';
import type { PageSpeedResult, runPageSpeed } from '@/app/_shared/lib/audit/pageSpeed';
import type { LighthouseSummary } from '@/app/_shared/lib/audit/types';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const summary = (perf: number): LighthouseSummary => ({
  categories: { performance: { score: perf, title: 'Performance' } },
  keyAudits: { 'largest-contentful-paint': { score: 0.3, title: 'Largest Contentful Paint', displayValue: '4.2 s' } },
});
const fresh: PageSpeedResult = { ok: true, summary: summary(0.9), isOnHttps: true };
const entry = (fetchedAt: string, over: Partial<CachedPageSpeed> = {}): CachedPageSpeed => ({
  summary: summary(0.4),
  isOnHttps: false,
  engineVersion: 2,
  fetchedAt,
  ...over,
});

const runOk = () => vi.fn<typeof runPageSpeed>(async () => fresh);

describe('withPageSpeedCache', () => {
  it("reuses another listing's result under 30 days old without running PageSpeed", async () => {
    const { store } = memoryStore({ 'smiledental.com|mobile': entry(daysAgo(10)) });
    const run = runOk();
    const result = await withPageSpeedCache(run, store, { now: () => NOW })('http://www.smiledental.com/', 'mobile', 0);

    expect(run).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, summary: summary(0.4), isOnHttps: false, measuredAt: daysAgo(10) });
  });

  it('runs PageSpeed again once the stored result is over 30 days old, and stores the new one', async () => {
    const { store, rows } = memoryStore({ 'smiledental.com|mobile': entry(daysAgo(31)) });
    const run = runOk();
    const result = await withPageSpeedCache(run, store, { now: () => NOW })('https://smiledental.com', 'mobile', 0);

    expect(run).toHaveBeenCalledWith('https://smiledental.com', 'mobile', 0);
    expect(result).toEqual(fresh);
    expect(rows.get('smiledental.com|mobile')).toEqual({
      summary: summary(0.9),
      isOnHttps: true,
      engineVersion: 2,
      fetchedAt: new Date(NOW).toISOString(),
    });
  });

  it('keeps mobile and desktop results apart', async () => {
    const { store } = memoryStore({ 'smiledental.com|mobile': entry(daysAgo(1)) });
    const run = runOk();
    await withPageSpeedCache(run, store, { now: () => NOW })('https://smiledental.com', 'desktop', 0);
    expect(run).toHaveBeenCalledOnce();
  });

  it('runs PageSpeed on a Re-audit even when a fresh result is stored, and replaces it', async () => {
    const { store, rows } = memoryStore({ 'smiledental.com|mobile': entry(daysAgo(1)) });
    const run = runOk();
    const result = await withPageSpeedCache(run, store, { refresh: true, now: () => NOW })('https://smiledental.com', 'mobile', 0);

    expect(run).toHaveBeenCalledOnce();
    expect(result).toEqual(fresh);
    expect(rows.get('smiledental.com|mobile')?.fetchedAt).toBe(new Date(NOW).toISOString());
  });

  it('never stores a failed PageSpeed run', async () => {
    const { store, rows } = memoryStore();
    const run = vi.fn(async (): Promise<PageSpeedResult> => ({ ok: false, reason: 'FAILED_DOCUMENT_REQUEST' }));
    const result = await withPageSpeedCache(run, store, { now: () => NOW })('https://smiledental.com', 'mobile', 0);

    expect(result).toEqual({ ok: false, reason: 'FAILED_DOCUMENT_REQUEST' });
    expect(rows.size).toBe(0);
  });

  it('ignores results stored by an older audit engine', async () => {
    const { store } = memoryStore({ 'smiledental.com|mobile': entry(daysAgo(1), { engineVersion: 1 }) });
    const run = runOk();
    expect(await withPageSpeedCache(run, store, { now: () => NOW })('https://smiledental.com', 'mobile', 0)).toEqual(fresh);
    expect(run).toHaveBeenCalledOnce();
  });

  it("still audits when the cache can't be read or written", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken: PageSpeedStore = {
      get: async () => {
        throw new Error('relation "pagespeed_cache" does not exist');
      },
      put: async () => {
        throw new Error('relation "pagespeed_cache" does not exist');
      },
    };
    const run = runOk();
    expect(await withPageSpeedCache(run, broken, { now: () => NOW })('https://smiledental.com', 'mobile', 0)).toEqual(fresh);
    expect(run).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
});
