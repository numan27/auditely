import { withRetry, RetryableError } from '@/app/_shared/lib/audit/retry';
import type { KeyAudit, LighthouseSummary } from '@/app/_shared/lib/audit/types';

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
// Without explicit categories PSI only runs Performance (no SEO, no is-on-https)
const PSI_CATEGORIES = ['performance', 'seo', 'best-practices', 'accessibility'];
const ATTEMPT_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;

const KEY_AUDIT_IDS = [
  'redirects', 'bootup-time', 'cache-insight', 'unminified-css',
  'unminified-javascript', 'render-blocking-resources', 'uses-optimized-images',
  'uses-webp-images', 'uses-responsive-images', 'offscreen-images',
  'uses-text-compression', 'time-to-first-byte', 'interactive',
  'speed-index', 'first-contentful-paint', 'largest-contentful-paint',
  'total-blocking-time', 'cumulative-layout-shift', 'long-tasks',
  'dom-size-insight', 'unsized-images', 'is-on-https',
  'meta-description', 'document-title', 'link-text', 'image-alt',
  'robots-txt', 'canonical',
];

export type PageSpeedStrategy = 'mobile' | 'desktop';

export type PageSpeedResult =
  // measuredAt: set when the result was reused from an earlier test (see pageSpeedCache.ts)
  | { ok: true; summary: LighthouseSummary; isOnHttps: boolean | null; measuredAt?: string }
  | { ok: false; reason: string };

interface LighthouseResult {
  categories?: Record<string, { score: number | null; title: string }>;
  audits?: Record<string, KeyAudit>;
  runtimeError?: { code?: string };
}

// Failures that retrying won't fix (bad URL, page won't load, daily quota)
class PermanentError extends Error {}

export function trimLighthouseData(lr: LighthouseResult): LighthouseSummary {
  const categories: LighthouseSummary['categories'] = {};
  for (const [key, cat] of Object.entries(lr.categories ?? {})) {
    categories[key] = { score: typeof cat.score === 'number' ? cat.score : null, title: cat.title };
  }

  const keyAudits: LighthouseSummary['keyAudits'] = {};
  for (const id of KEY_AUDIT_IDS) {
    const a = lr.audits?.[id];
    if (a) {
      keyAudits[id] = { score: a.score, title: a.title, ...(a.displayValue && { displayValue: a.displayValue }) };
    }
  }
  return { categories, keyAudits };
}

/** 0–100 score for a Lighthouse category, or null when it wasn't measured. */
export function categoryScore(summary: LighthouseSummary | null, key: string): number | null {
  const score = summary?.categories[key]?.score;
  return typeof score === 'number' ? Math.round(score * 100) : null;
}

async function requestOnce(url: string, deadline: number): Promise<{ lighthouseResult?: LighthouseResult }> {
  const timeout = Math.max(1, Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now()));
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    throw new RetryableError(timedOut ? 'PageSpeed timed out' : 'PageSpeed network error');
  }

  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;

  const message: string = data?.error?.message ?? '';
  const lighthouseCode = message.match(/Lighthouse returned error: ([A-Z_]+)/)?.[1];
  if (lighthouseCode) throw new PermanentError(lighthouseCode);
  if (res.status === 429 && /quota exceeded/i.test(message) && /per day/i.test(message)) {
    throw new PermanentError('Daily PageSpeed quota exceeded');
  }
  if (res.status === 429 || res.status >= 500) {
    const retryAfterSec = Number(res.headers.get('retry-after'));
    throw new RetryableError(`PageSpeed HTTP ${res.status}`, retryAfterSec > 0 ? retryAfterSec * 1000 : undefined);
  }
  throw new PermanentError(`PageSpeed HTTP ${res.status}`);
}

export async function runPageSpeed(
  website: string,
  strategy: PageSpeedStrategy,
  deadline: number
): Promise<PageSpeedResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) return { ok: false, reason: 'GOOGLE_PAGESPEED_API_KEY is not configured' };

  const params = new URLSearchParams({ url: website, strategy, key: apiKey });
  for (const category of PSI_CATEGORIES) params.append('category', category);
  const url = `${PSI_ENDPOINT}?${params}`;

  try {
    const data = await withRetry(() => requestOnce(url, deadline), {
      attempts: MAX_ATTEMPTS,
      baseDelayMs: BASE_DELAY_MS,
      deadline,
    });
    const lr = data.lighthouseResult;
    if (!lr) return { ok: false, reason: 'PageSpeed returned no Lighthouse data' };

    const runtimeCode = lr.runtimeError?.code;
    if (runtimeCode && runtimeCode !== 'NO_ERROR') return { ok: false, reason: runtimeCode };

    const httpsScore = lr.audits?.['is-on-https']?.score;
    return {
      ok: true,
      summary: trimLighthouseData(lr),
      isOnHttps: typeof httpsScore === 'number' ? httpsScore === 1 : null,
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'PageSpeed failed' };
  }
}
