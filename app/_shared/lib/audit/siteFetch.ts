// app/_shared/lib/audit/siteFetch.ts

// Fetches a business homepage once (plus robots.txt) for the HTML analyzers
// and the email finder.

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_ROBOTS_BYTES = 256 * 1024;
const USER_AGENT = 'Mozilla/5.0 (compatible; Auditely/1.0; +https://devartventures.com)';

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

function get(url: string): Promise<Response> {
  return fetch(url, {
    redirect: 'follow',
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
