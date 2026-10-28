// app/_shared/lib/audit/siteFetch.ts

// Fetches a business homepage once (plus robots.txt) for the HTML analyzers
// and the email finder.

import { AUDITELY_URL } from '@/app/_shared/lib/config/site';
import { lookupAll, publicHost, type HostLookup } from '@/app/_shared/lib/utils/publicAddress';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_ROBOTS_BYTES = 256 * 1024;
export const USER_AGENT = `Mozilla/5.0 (compatible; Auditely/1.0; +${AUDITELY_URL})`;

export interface RobotsFetch {
  status: number | null;
  body: string | null;
}

export interface SiteFetchResult {
  ok: boolean;
  finalUrl: string | null;
  status: number | null;
  html: string | null;
  headers: Record<string, string>;
  robots: RobotsFetch;
  reason?: string;
}

const NO_ROBOTS: RobotsFetch = { status: null, body: null };

// Bot-protection interstitials served in place of the site, often with 200/202.
// Scoring one would report the captcha page's (missing) schema, NAP and headings.
const CHALLENGE_MARKERS = /\/\.well-known\/sgcaptcha|\/cdn-cgi\/challenge-platform|_Incapsula_Resource|sucuri_cloudproxy/i;
const MAX_CHALLENGE_BYTES = 20_000;

function isBotChallenge(headers: Record<string, string>, html: string): boolean {
  if (headers['sg-captcha'] || headers['cf-mitigated'] === 'challenge') return true;
  // A real homepage is larger than a challenge stub, even if its form uses a captcha
  return html.length < MAX_CHALLENGE_BYTES && CHALLENGE_MARKERS.test(html);
}

/** A site or redirect hop that isn't on the public internet */
export class NotPublicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotPublicError';
  }
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const NOT_PUBLIC = 'it points to a private address';

/**
 * fetch that follows redirects itself, checking every hop's host is public
 * before requesting it. The response's url is the last hop.
 */
export async function publicFetch(
  url: string,
  init: RequestInit,
  lookup: HostLookup = lookupAll,
  maxRedirects = 5
): Promise<Response> {
  let target = url;
  let request: RequestInit = { ...init, redirect: 'manual' };
  for (let redirects = 0; ; redirects++) {
    const hop = new URL(target);
    if ((hop.protocol !== 'http:' && hop.protocol !== 'https:') || (await publicHost(hop.hostname, lookup)) !== 'public') {
      throw new NotPublicError(`${hop.hostname || hop.protocol} isn't a public address`);
    }
    const res = await fetch(target, request);
    const location = res.headers.get('location');
    if (!REDIRECTS.has(res.status) || !location) return res;
    await res.body?.cancel().catch(() => {});
    if (redirects >= maxRedirects) throw new Error('Too many redirects');
    target = new URL(location, hop).href;
    if (res.status === 303) request = { ...request, method: 'GET', body: undefined };
  }
}

function get(url: string): Promise<Response> {
  return publicFetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

/** Reads at most `maxBytes` of the body, then stops downloading. */
export async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const out = new Uint8Array(maxBytes);
  let length = 0;
  while (length < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const take = Math.min(value.byteLength, maxBytes - length);
    out.set(value.subarray(0, take), length);
    length += take;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder('utf-8').decode(out.subarray(0, length));
}

async function fetchRobots(origin: string): Promise<RobotsFetch> {
  try {
    const res = await get(`${origin}/robots.txt`);
    return { status: res.status, body: res.ok ? await readCapped(res, MAX_ROBOTS_BYTES) : null };
  } catch {
    return NO_ROBOTS;
  }
}

function failure(reason: string, extra: Partial<SiteFetchResult> = {}): SiteFetchResult {
  return { ok: false, finalUrl: null, status: null, html: null, headers: {}, robots: NO_ROBOTS, reason, ...extra };
}

export async function fetchSite(website: string): Promise<SiteFetchResult> {
  let start: URL;
  try {
    start = new URL(website);
  } catch {
    return failure('Invalid website URL');
  }

  let res: Response;
  try {
    res = await get(start.href);
  } catch (err) {
    if (err instanceof NotPublicError) return failure(NOT_PUBLIC);
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return failure(timedOut ? 'Site timed out' : 'Site unreachable');
  }

  const finalUrl = res.url || start.href;
  const headers = Object.fromEntries(res.headers.entries());
  const base = { finalUrl, status: res.status, headers };

  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    const blocked = res.status === 401 || res.status === 403 || res.status === 429;
    return failure(blocked ? `Blocked (${res.status})` : `HTTP ${res.status}`, base);
  }

  const contentType = headers['content-type'] ?? '';
  if (contentType && !contentType.includes('html')) {
    await res.body?.cancel().catch(() => {});
    return failure('Not an HTML page', base);
  }

  // robots.txt comes from the final origin (after redirects), read alongside the body
  try {
    const [html, robots] = await Promise.all([
      readCapped(res, MAX_HTML_BYTES),
      fetchRobots(new URL(finalUrl).origin),
    ]);
    if (isBotChallenge(headers, html)) return failure('Blocked (bot challenge)', base);
    return { ok: true, ...base, html, robots };
  } catch {
    return failure('Site timed out while loading', base);
  }
}

export interface PageFetchResult {
  ok: boolean;
  /** HTTP status; null when the page couldn't be reached */
  status: number | null;
  finalUrl: string | null;
  html: string | null;
  reason?: string;
}

/** One more page of a site (the lead-capture key pages): the homepage's rules, without robots.txt. */
export async function fetchPage(url: string): Promise<PageFetchResult> {
  let res: Response;
  try {
    res = await get(url);
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    const reason = err instanceof NotPublicError ? NOT_PUBLIC : timedOut ? 'Page timed out' : 'Page unreachable';
    return { ok: false, status: null, finalUrl: null, html: null, reason };
  }

  const finalUrl = res.url || url;
  const headers = Object.fromEntries(res.headers.entries());
  const contentType = headers['content-type'] ?? '';
  const notHtml = !!contentType && !contentType.includes('html');
  if (!res.ok || notHtml) {
    await res.body?.cancel().catch(() => {});
    return { ok: false, status: res.status, finalUrl, html: null, reason: res.ok ? 'Not an HTML page' : `HTTP ${res.status}` };
  }

  try {
    const html = await readCapped(res, MAX_HTML_BYTES);
    if (isBotChallenge(headers, html)) {
      return { ok: false, status: res.status, finalUrl, html: null, reason: 'Blocked (bot challenge)' };
    }
    return { ok: true, status: res.status, finalUrl, html };
  } catch {
    return { ok: false, status: res.status, finalUrl, html: null, reason: 'Page timed out while loading' };
  }
}
