# Lead Capture Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every audit gets a Lead capture score (0–100) and pass / warn / fail checklist, built from the homepage and up to 4 key pages it links to.

**Architecture:** After the homepage fetch, `runAudit` fetches up to 4 key pages (contact, booking, services, about) and checks up to 30 same-site links, all while PageSpeed runs. A pure analyzer turns the pages and link results into the score and findings. The key pages are handed to the email finder so nothing is downloaded twice. The score is stored in a new `audits.lead_score` column and shown on the card, in the PDF, in the AI prompt and in the CSV.

**Tech Stack:** Next.js 16 route handlers, TypeScript 5, cheerio 1.2, vitest 5, Supabase (Postgres), @react-pdf/renderer.

**Spec:** `docs/superpowers/specs/2026-09-30-lead-capture-design.md`

## Global Constraints

- Imports of shared code use `@/app/_shared/...`; never relative `../` paths.
- Files stay under 300 lines; file and folder names are camelCase.
- A metric that wasn't measured is `null` ("—"), never `0`.
- Finding ids are stable: `lead.clickToCall`, `lead.form`, `lead.booking`, `lead.contactPage`, `lead.brokenLinks`, `lead.whatsapp`.
- `CURRENT_ENGINE_VERSION` stays `2`; old audits show "—" for Lead capture.
- Polite fetching: the existing Auditely user agent, ≤ 4 key pages (10 s, 2 MB each), ≤ 30 link checks (5 s each, 8 at a time).
- A link is only "broken" on 404 / 410; 403, 429, 5xx and timeouts are "unknown".
- No new npm dependencies.
- **Git:** work on the `staging` branch. Do not commit until the user says so (their global rule); the final task asks. Never push.
- Test commands: one file `npx vitest run <path>`; everything `npm test`; types `npx tsc --noEmit`; lint `npm run lint`; build `npm run build`.

## Review Focus

1. **Links written in other forms** (relative, `//host/path`, `www.` vs bare host, trailing `#section`) must count as the same page — else pages are fetched and checked twice. Pinned in Task 2 (`sameSiteLinks` dedupe test).
2. **A homepage that redirected** (`http://site.com` → `https://www.site.com/home`) must resolve key-page links against the final address. Pinned in Task 2 (`pickKeyPages`) and Task 5 (`crawlKeyPages`).
3. **Servers that refuse or mis-answer `HEAD`** (405, or 404 on HEAD while GET works) must never be reported broken to a prospect. Pinned in Task 3.
4. **Newsletter and search forms with two fields** (Squarespace's name + email newsletter) must not count as a contact form. Pinned in Task 4.
5. **Stub `tel:` links** (`tel:`, `tel:911`) must not count as tap-to-call. Pinned in Task 4.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/_shared/lib/audit/siteFetch.ts` | modify | + `fetchPage(url)`, export `USER_AGENT` |
| `app/_shared/lib/audit/siteLinks.ts` | create | Same-site link extraction, `pageKey`, `pickKeyPages`, `BOOKING_WORDS` |
| `app/_shared/lib/audit/linkCheck.ts` | create | `checkLinks(urls)`, `linkStatus(status)` |
| `app/_shared/lib/audit/analyzers/leadCapture.ts` | create | Pure analyzer: pages + link results → score + checks |
| `app/_shared/lib/audit/leadCrawl.ts` | create | `crawlKeyPages`, `linkTargets`, `keyPageLinks` |
| `app/_shared/lib/audit/types.ts` | modify | `KeyPageKind`, `LeadPageKind`, `LeadChecks`, `AuditChecks.lead`, `AuditRow.lead_score` |
| `app/_shared/lib/audit/runAudit.ts` | modify | Wire crawl, link checks, analyzer, email pages |
| `app/_shared/lib/utils/emailFinder.ts` | modify | Use `siteLinks`; accept `pages` |
| `app/api/audit/route.ts` | modify | Pass key pages to `findEmail` |
| `app/_shared/lib/audit/reportData.ts` | modify | Lead line + findings in AI facts; PDF props |
| `app/_shared/components/auditely/pdfDocument/*` | modify | "Leads" tile, definition, Lead capture section |
| `app/_shared/lib/types/auditely.ts` | modify | `Audit.lead_score` |
| `app/_shared/components/auditely/auditScores/auditScores.tsx` | modify | 7th tile |
| `app/_shared/components/auditely/auditChecklist/auditChecklist.tsx` | modify | Lead capture group |
| `app/_shared/components/auditely/businessCard/businessCard.tsx` | modify | "Leads" pill |
| `app/_shared/lib/utils/leadView.ts`, `leadExport.ts` | modify | Average + CSV column |
| `docs/migrations/2026-09-30-lead-capture.sql`, `docs/supabase-schema.sql` | create / modify | `audits.lead_score` |

---

### Task 1: `fetchPage` — fetch one more page of a site

**Files:**
- Modify: `app/_shared/lib/audit/siteFetch.ts`
- Test: `app/_shared/lib/audit/__tests__/siteFetch.test.ts`

**Interfaces:**
- Consumes: existing `get`, `readCapped`, `isBotChallenge`, `MAX_HTML_BYTES` in `siteFetch.ts`.
- Produces:
  ```ts
  export const USER_AGENT: string;
  export interface PageFetchResult { ok: boolean; status: number | null; finalUrl: string | null; html: string | null; reason?: string }
  export function fetchPage(url: string): Promise<PageFetchResult>;
  ```

- [ ] **Step 1: Write the failing tests**

In `siteFetch.test.ts`, change the import to `import { fetchSite, fetchPage } from '@/app/_shared/lib/audit/siteFetch';` and append:

```ts
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/siteFetch.test.ts`
Expected: the 4 new tests FAIL (`fetchPage is not a function`); the existing ones pass.

- [ ] **Step 3: Implement**

In `siteFetch.ts`, export the user agent (change `const USER_AGENT` to `export const USER_AGENT`) and append:

```ts
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
    return { ok: false, status: null, finalUrl: null, html: null, reason: timedOut ? 'Page timed out' : 'Page unreachable' };
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
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/siteFetch.test.ts`
Expected: all PASS.

---

### Task 2: `siteLinks.ts` — same-site links and key pages (email finder uses it too)

**Files:**
- Create: `app/_shared/lib/audit/siteLinks.ts`
- Modify: `app/_shared/lib/audit/types.ts`, `app/_shared/lib/utils/emailFinder.ts`
- Test: `app/_shared/lib/audit/__tests__/siteLinks.test.ts` (new); `app/_shared/lib/utils/__tests__/emailFinder.test.ts` (existing, must stay green)

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type KeyPageKind = 'contact' | 'booking' | 'services' | 'about';
  export type LeadPageKind = 'home' | KeyPageKind;
  ```
- Produces (siteLinks.ts):
  ```ts
  export interface SiteLink { url: string; text: string }
  export interface KeyPage { url: string; kind: KeyPageKind }
  export const BOOKING_WORDS: RegExp;
  export const pageKey: (url: string) => string;
  export function sameSiteLinks(html: string, pageUrl: string): SiteLink[];
  export function pickKeyPages(html: string, pageUrl: string): KeyPage[];
  ```

- [ ] **Step 1: Write the failing tests**

Create `app/_shared/lib/audit/__tests__/siteLinks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickKeyPages, sameSiteLinks } from '@/app/_shared/lib/audit/siteLinks';

describe('sameSiteLinks', () => {
  it("keeps the site's own page links with their text, once each", () => {
    const html = `
      <a href="/contact">Contact <b>us</b></a>
      <a href="https://www.smiledental.com/contact/">Contact again</a>
      <a href="services#implants">Implants</a>
      <a href="//smiledental.com/about">About</a>
      <a href="https://facebook.com/smiledental">Facebook</a>
      <a href="mailto:hi@smiledental.com">Email</a>
      <a href="tel:5551234567">Call</a>
      <a href="#top">Top</a>
      <a href="/brochure.pdf">Brochure</a>
      <a href="/wp-json/">API</a>`;
    expect(sameSiteLinks(html, 'https://smiledental.com/')).toEqual([
      { url: 'https://smiledental.com/contact', text: 'Contact us' },
      { url: 'https://smiledental.com/services', text: 'Implants' },
      { url: 'https://smiledental.com/about', text: 'About' },
    ]);
  });
});

describe('pickKeyPages', () => {
  const home = 'https://smiledental.com/';

  it('picks the first contact, booking, services and about page, by address or link text', () => {
    const html = `
      <a href="/">Home</a>
      <a href="/our-team">Meet the team</a>
      <a href="/dental-services">Services</a>
      <a href="/request">Request an Appointment</a>
      <a href="/about-us">About</a>
      <a href="/get-in-touch">Get in touch</a>
      <a href="/contact">Contact</a>
      <a href="/services/implants">Implants</a>`;
    expect(pickKeyPages(html, home)).toEqual([
      { url: 'https://smiledental.com/get-in-touch', kind: 'contact' },
      { url: 'https://smiledental.com/request', kind: 'booking' },
      { url: 'https://smiledental.com/dental-services', kind: 'services' },
      { url: 'https://smiledental.com/about-us', kind: 'about' },
    ]);
  });

  it("doesn't take a Facebook link for booking, or the homepage for a key page", () => {
    const html =
      '<a href="https://smiledental.com">Home</a><a href="/facebook-reviews">Facebook reviews</a><a href="/book-online">Book online</a>';
    expect(pickKeyPages(html, home)).toEqual([{ url: 'https://smiledental.com/book-online', kind: 'booking' }]);
  });

  it('resolves links against the address the homepage redirected to', () => {
    const html = '<a href="contact">Contact</a><a href="https://smiledental.com/about">About</a>';
    expect(pickKeyPages(html, 'https://www.smiledental.com/home')).toEqual([
      { url: 'https://www.smiledental.com/contact', kind: 'contact' },
      { url: 'https://smiledental.com/about', kind: 'about' },
    ]);
  });

  it('returns nothing when the homepage links to no key page', () => {
    expect(pickKeyPages('<p>Welcome</p>', home)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/siteLinks.test.ts`
Expected: FAIL — `Cannot find package '@/app/_shared/lib/audit/siteLinks'`.

- [ ] **Step 3: Add the page-kind types**

In `app/_shared/lib/audit/types.ts`, after the `FindingStatus` type:

```ts
/** Key pages the lead-capture checks read, besides the homepage */
export type KeyPageKind = 'contact' | 'booking' | 'services' | 'about';
export type LeadPageKind = 'home' | KeyPageKind;
```

- [ ] **Step 4: Implement `siteLinks.ts`**

```ts
// app/_shared/lib/audit/siteLinks.ts

// A site's own page links, read from one of its pages: they pick the key pages
// the lead-capture checks read, the links those checks test, and the extra
// pages the email finder tries.

import * as cheerio from 'cheerio';
import type { KeyPageKind } from '@/app/_shared/lib/audit/types';

export interface SiteLink {
  url: string;
  /** The link's visible text, whitespace collapsed */
  text: string;
}

export interface KeyPage {
  url: string;
  kind: KeyPageKind;
}

const NOT_A_PAGE = /\.(pdf|jpe?g|png|gif|svg|webp|ico|css|js|zip|docx?|xlsx?|mp[34])$/i;
// Machine endpoints (mostly WordPress) that would eat the page budget
const TECHNICAL_PATH = /\/(feed|wp-json|wp-admin|wp-login\.php|xmlrpc\.php|cdn-cgi|cart|checkout)(\/|$)/i;

/** Booking words; `\bbook` so "facebook" doesn't count */
export const BOOKING_WORDS = /\bbook|appointment|schedul|reserv/i;

// Matched on the link's path and text, in this order; the first link of each kind wins
const KEY_PAGE_RULES: [KeyPageKind, RegExp][] = [
  ['contact', /contact|get[\s-]in[\s-]touch|reach[\s-]us/i],
  ['booking', BOOKING_WORDS],
  ['services', /service|treatment|what[\s-]we[\s-]do|practice[\s-]area|program/i],
  ['about', /about|our[\s-]story|who[\s-]we[\s-]are/i],
];

/** Same page regardless of scheme, "www." or a trailing slash */
export const pageKey = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();

const siteHost = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, '');

/** The page's <a> links to its own site, in page order, once each; files and technical endpoints skipped. */
export function sameSiteLinks(html: string, pageUrl: string): SiteLink[] {
  const base = new URL(pageUrl);
  const host = siteHost(base);
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const links: SiteLink[] = [];

  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') ?? '').trim();
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript|sms):/i.test(href)) return;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      return;
    }
    url.hash = '';
    if (!url.protocol.startsWith('http') || siteHost(url) !== host) return;
    if (NOT_A_PAGE.test(url.pathname) || TECHNICAL_PATH.test(url.pathname)) return;
    const key = pageKey(url.href);
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ url: url.href, text: $(a).text().replace(/\s+/g, ' ').trim() });
  });
  return links;
}

/** Up to 4 key pages the homepage links to: its first contact, booking, services and about link. */
export function pickKeyPages(html: string, pageUrl: string): KeyPage[] {
  // The homepage itself, at its own address or at the site root (e.g. reached at /home)
  const homeKeys = new Set([pageKey(pageUrl), pageKey(new URL(pageUrl).origin)]);
  const links = sameSiteLinks(html, pageUrl).filter((link) => !homeKeys.has(pageKey(link.url)));
  const chosen = new Set<string>();
  const pages: KeyPage[] = [];
  for (const [kind, pattern] of KEY_PAGE_RULES) {
    const link = links.find((l) => !chosen.has(l.url) && pattern.test(`${new URL(l.url).pathname} ${l.text}`));
    if (link) {
      chosen.add(link.url);
      pages.push({ url: link.url, kind });
    }
  }
  return pages;
}
```


- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/siteLinks.test.ts`
Expected: all PASS.

- [ ] **Step 6: Switch the email finder to the shared helpers (refactor, behavior unchanged)**

In `app/_shared/lib/utils/emailFinder.ts`:
1. Delete the `NOT_A_PAGE`, `TECHNICAL_PATH` and `pageKey` definitions.
2. Add `import { pageKey, sameSiteLinks } from '@/app/_shared/lib/audit/siteLinks';`
3. Replace the whole `siteLinks` function with:

```ts
/** The site's own page links from its homepage, likely contact/about/team pages first, careers last. */
function extraPageLinks(html: string, website: string, alreadyRead: Set<string>): string[] {
  const links = sameSiteLinks(html, website)
    .map((link) => link.url)
    .filter((url) => !alreadyRead.has(pageKey(url)));
  // Stable sort: likely pages first, then the rest in page order, careers pages last
  const rank = (link: string) => (HR_PAGE.test(link) ? 2 : LIKELY_EMAIL_PAGE.test(link) ? 0 : 1);
  return links.sort((a, b) => rank(a) - rank(b));
}
```

4. In `scrapeWebsite`, change `siteLinks(homepage, website, alreadyRead)` to `extraPageLinks(homepage, website, alreadyRead)`.

- [ ] **Step 7: Run the email finder tests (must still pass unchanged)**

Run: `npx vitest run app/_shared/lib/utils/__tests__/emailFinder.test.ts app/_shared/lib/utils/__tests__/contactDiscovery.test.ts`
Expected: all PASS.

---

### Task 3: `linkCheck.ts` — does each link lead anywhere?

**Files:**
- Create: `app/_shared/lib/audit/linkCheck.ts`
- Test: `app/_shared/lib/audit/__tests__/linkCheck.test.ts`

**Interfaces:**
- Consumes: `USER_AGENT` from `siteFetch.ts` (Task 1).
- Produces:
  ```ts
  export type LinkStatus = 'ok' | 'broken' | 'unknown';
  export interface LinkResult { url: string; status: LinkStatus }
  export const MAX_LINKS = 30;
  export function linkStatus(httpStatus: number | null): LinkStatus;
  export function checkLinks(urls: string[]): Promise<LinkResult[]>;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkLinks } from '@/app/_shared/lib/audit/linkCheck';

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
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/linkCheck.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// app/_shared/lib/audit/linkCheck.ts

// Tests whether a site's own links lead anywhere. Only a clear "page not found"
// (404 / 410) is broken; blocked, failing or slow links are unknown, so a
// prospect is never told that a working link is broken.

import { USER_AGENT } from '@/app/_shared/lib/audit/siteFetch';

export type LinkStatus = 'ok' | 'broken' | 'unknown';

export interface LinkResult {
  url: string;
  status: LinkStatus;
}

export const MAX_LINKS = 30;
const LINK_TIMEOUT_MS = 5_000;
const CONCURRENCY = 8;

/** An HTTP status (null = no answer) as a link result */
export function linkStatus(httpStatus: number | null): LinkStatus {
  if (httpStatus === 404 || httpStatus === 410) return 'broken';
  if (httpStatus !== null && httpStatus >= 200 && httpStatus < 400) return 'ok';
  return 'unknown';
}

async function requestStatus(url: string, method: 'HEAD' | 'GET'): Promise<number> {
  const res = await fetch(url, {
    method,
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
  });
  await res.body?.cancel().catch(() => {});
  return res.status;
}

async function checkLink(url: string): Promise<LinkResult> {
  try {
    if (linkStatus(await requestStatus(url, 'HEAD')) === 'ok') return { url, status: 'ok' };
    // Some servers refuse HEAD or answer it wrongly: only GET decides a failure
    return { url, status: linkStatus(await requestStatus(url, 'GET')) };
  } catch {
    return { url, status: 'unknown' };
  }
}

/** Checks the first 30 links, 8 at a time; results keep the input order. Never throws. */
export async function checkLinks(urls: string[]): Promise<LinkResult[]> {
  const queue = urls.slice(0, MAX_LINKS);
  const results: LinkResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const i = next++;
      results[i] = await checkLink(queue[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return results;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/linkCheck.test.ts`
Expected: all PASS.

---

### Task 4: `leadCapture.ts` — the analyzer and its rubric

**Files:**
- Create: `app/_shared/lib/audit/analyzers/leadCapture.ts`
- Modify: `app/_shared/lib/audit/types.ts`
- Test: `app/_shared/lib/audit/__tests__/leadCapture.test.ts`

**Interfaces:**
- Consumes: `BOOKING_WORDS`, `sameSiteLinks` (Task 2); `LinkResult` (Task 3); `LeadPageKind` (Task 2).
- Produces (types.ts):
  ```ts
  export interface LeadChecks {
    findings: Finding[];
    pages: { url: string; kind: LeadPageKind; ok: boolean }[];
    links: { checked: number; broken: string[] };
  }
  // AuditChecks gains:  lead?: LeadChecks | null;
  ```
- Produces (leadCapture.ts):
  ```ts
  export interface LeadPage { url: string; kind: LeadPageKind; html: string | null }
  export function analyzeLeadCapture(pages: LeadPage[], links: LinkResult[]): { score: number; checks: LeadChecks };
  ```
  `pages[0]` is the homepage.

- [ ] **Step 1: Add the types**

In `types.ts`, after `AeoChecks`:

```ts
export interface LeadChecks {
  findings: Finding[];
  /** The homepage and the key pages read; ok = the page loaded */
  pages: { url: string; kind: LeadPageKind; ok: boolean }[];
  /** Links whose status is known, and the broken ones */
  links: { checked: number; broken: string[] };
}
```

and in `AuditChecks`, after `aeo`:

```ts
  /** Absent on audits made before lead capture; null when not measured */
  lead?: LeadChecks | null;
```

- [ ] **Step 2: Write the failing tests**

Create `app/_shared/lib/audit/__tests__/leadCapture.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analyzeLeadCapture, type LeadPage } from '@/app/_shared/lib/audit/analyzers/leadCapture';
import type { LinkResult } from '@/app/_shared/lib/audit/linkCheck';
import type { LeadPageKind } from '@/app/_shared/lib/audit/types';

const SITE = 'https://smiledental.com';
const home = (html: string): LeadPage => ({ url: `${SITE}/`, kind: 'home', html });
const keyPage = (kind: LeadPageKind, html: string | null): LeadPage => ({ url: `${SITE}/${kind}`, kind, html });
const link = (path: string, status: LinkResult['status'] = 'ok'): LinkResult => ({ url: `${SITE}${path}`, status });

const run = (pages: LeadPage[], links: LinkResult[] = [link('/x')]) => analyzeLeadCapture(pages, links);
const finding = (result: ReturnType<typeof analyzeLeadCapture>, id: string) =>
  result.checks.findings.find((f) => f.id === id);

const CONTACT_FORM =
  '<form action="/send"><input name="name"><input type="email" name="email"><textarea name="message"></textarea></form>';

describe('analyzeLeadCapture', () => {
  it('gives 100 to a site with every way to reach it', () => {
    const result = run(
      [
        home(`<a href="tel:+15551234567">(555) 123-4567</a><a href="/contact">Contact</a>
              <a href="https://calendly.com/smiledental">Book online</a>`),
        keyPage('contact', CONTACT_FORM),
      ],
      [link('/contact'), link('/about')]
    );
    expect(result.score).toBe(100);
    expect(result.checks.findings.map((f) => [f.id, f.status])).toEqual([
      ['lead.clickToCall', 'pass'],
      ['lead.form', 'pass'],
      ['lead.booking', 'pass'],
      ['lead.contactPage', 'pass'],
      ['lead.brokenLinks', 'pass'],
    ]);
    expect(finding(result, 'lead.form')?.label).toBe('Contact form on the contact page');
    expect(finding(result, 'lead.booking')?.detail).toBe('calendly.com');
    expect(finding(result, 'lead.brokenLinks')?.label).toBe('No broken links (2 checked)');
  });

  it('adds up partial points: phone elsewhere 10, email link 10, contact page 10, unchecked links 20', () => {
    const result = run(
      [home('<a href="mailto:office@smiledental.com">Email us</a><a href="/contact">Contact</a>'), keyPage('contact', '<a href="tel:5551234567">Call</a>')],
      [link('/a', 'unknown')]
    );
    expect(result.score).toBe(50);
    expect(finding(result, 'lead.clickToCall')).toMatchObject({ status: 'warn', detail: 'Only on the contact page' });
    expect(finding(result, 'lead.form')).toMatchObject({ status: 'warn', label: 'Only an email link — no contact form found' });
    expect(finding(result, 'lead.booking')?.status).toBe('warn');
    expect(finding(result, 'lead.brokenLinks')).toMatchObject({ status: 'warn', label: "Couldn't check the site's links" });
  });

  it('gives 0 to a page with no way to reach the business and a broken link', () => {
    const result = run([home('<p>Welcome</p>')], [link('/old', 'broken')]);
    expect(result.score).toBe(0);
    expect(finding(result, 'lead.form')?.label).toBe('No contact form or email link found on the pages we checked');
  });

  it('ignores tel: links too short to be a phone number', () => {
    const result = run([home('<a href="tel:">Call</a><a href="tel:911">Emergency</a>')]);
    expect(finding(result, 'lead.clickToCall')?.status).toBe('fail');
  });

  it("doesn't count search boxes, newsletter sign-ups or logins as contact forms", () => {
    const result = run([
      home(`
        <form role="search"><input name="s"></form>
        <form action="/search"><input name="q"><select name="in"><option>All</option></select></form>
        <form class="newsletter-form"><input name="fname"><input type="email" name="email"></form>
        <form id="login"><input name="user"><input type="password" name="pass"></form>
        <form><input type="email" name="email"></form>`),
    ]);
    expect(finding(result, 'lead.form')?.status).toBe('fail');
  });

  it('counts a form of several fields without a message box', () => {
    const result = run([home('<form><input name="name"><input type="tel" name="phone"><input type="hidden" name="t"></form>')]);
    expect(finding(result, 'lead.form')).toMatchObject({ status: 'pass', label: 'Contact form on the homepage' });
  });

  it.each([
    ['a Jotform embed', '<iframe src="https://form.jotform.com/231234567890"></iframe>'],
    ['a HubSpot form script', '<script src="//js.hsforms.net/forms/embed/v2.js"></script>'],
    ['a Google Form link', '<a href="https://docs.google.com/forms/d/e/abc/viewform">Enquire</a>'],
    ['a Squarespace form block', '<div class="sqs-block website-component-block sqs-block-form form-block"></div>'],
  ])('counts %s as a contact form', (_name, html) => {
    expect(finding(run([home(html)]), 'lead.form')?.status).toBe('pass');
  });

  it.each([
    ['a Zocdoc widget', '<iframe src="https://www.zocdoc.com/widget/abc"></iframe>', 'zocdoc.com'],
    ['Square Appointments', '<a href="https://squareup.com/appointments/book/abc/start">Book</a>', 'squareup.com'],
    ['a booking link on the site', '<a href="/request-appointment">Request an appointment</a>', '/request-appointment'],
  ])('finds %s as online booking', (_name, html, detail) => {
    expect(finding(run([home(html)]), 'lead.booking')).toMatchObject({ status: 'pass', detail });
  });

  it('only warns when there is no online booking — a Facebook link is not one', () => {
    const result = run([home('<a href="https://facebook.com/smiledental">Facebook</a>')]);
    expect(finding(result, 'lead.booking')).toMatchObject({ status: 'warn', label: 'No online booking — visitors can only call or email' });
  });

  it('passes the contact page check for a linked contact page, even one that failed to load', () => {
    const result = run([home('<a href="/contact">Contact</a>'), keyPage('contact', null)]);
    expect(finding(result, 'lead.contactPage')).toMatchObject({ status: 'pass', label: 'Contact page linked from the homepage' });
  });

  it('passes the contact page check for a form right on the homepage', () => {
    const result = run([home(CONTACT_FORM)]);
    expect(finding(result, 'lead.contactPage')).toMatchObject({ status: 'pass', label: 'Contact form right on the homepage' });
  });

  it('fails the contact page check when there is neither', () => {
    expect(finding(run([home('<p>Hi</p>')]), 'lead.contactPage')?.status).toBe('fail');
  });

  it('lists up to 3 broken links', () => {
    const result = run([home('')], ['/a', '/b', '/c?x=1', '/d'].map((p) => link(p, 'broken')).concat(link('/ok')));
    expect(finding(result, 'lead.brokenLinks')).toMatchObject({
      status: 'fail',
      label: '4 broken links — visitors land on a "page not found"',
      detail: '/a, /b, /c?x=1',
    });
    expect(result.checks.links).toEqual({
      checked: 5,
      broken: ['/a', '/b', '/c?x=1', '/d'].map((p) => `${SITE}${p}`),
    });
  });

  it('mentions WhatsApp only when the site links to it', () => {
    expect(finding(run([home('<a href="https://wa.me/15551234567">WhatsApp</a>')]), 'lead.whatsapp')?.status).toBe('pass');
    expect(finding(run([home('<p>Hi</p>')]), 'lead.whatsapp')).toBeUndefined();
  });

  it('records which pages were read', () => {
    const result = run([home('<p>Hi</p>'), keyPage('contact', null), keyPage('about', '<p>About</p>')]);
    expect(result.checks.pages).toEqual([
      { url: `${SITE}/`, kind: 'home', ok: true },
      { url: `${SITE}/contact`, kind: 'contact', ok: false },
      { url: `${SITE}/about`, kind: 'about', ok: true },
    ]);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/leadCapture.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// app/_shared/lib/audit/analyzers/leadCapture.ts

// Lead capture: can a visitor call, message or book from the homepage and the
// key pages it links to? Pure — runAudit fetches the pages and link results.
// Rubric: docs/superpowers/specs/2026-09-30-lead-capture-design.md

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { BOOKING_WORDS, sameSiteLinks } from '@/app/_shared/lib/audit/siteLinks';
import type { LinkResult } from '@/app/_shared/lib/audit/linkCheck';
import type { Finding, LeadChecks, LeadPageKind } from '@/app/_shared/lib/audit/types';

export interface LeadPage {
  url: string;
  kind: LeadPageKind;
  /** null when the page couldn't be loaded */
  html: string | null;
}

interface ParsedPage {
  kind: LeadPageKind;
  url: URL;
  html: string;
  $: CheerioAPI;
}

const PAGE_NAMES: Record<LeadPageKind, string> = {
  home: 'homepage',
  contact: 'contact page',
  booking: 'booking page',
  services: 'services page',
  about: 'about page',
};

const MIN_PHONE_DIGITS = 7;
// Fields a visitor types into (an <input> without a type is text)
const FILLABLE_TYPES = new Set(['text', 'email', 'tel', 'number', 'date', 'url']);
// Forms that collect something other than an enquiry
const NOT_AN_ENQUIRY = /newsletter|subscribe|mailchimp|search|login/i;
// Squarespace draws its form block with JavaScript: only this wrapper is in the HTML
const BUILDER_FORM = '.sqs-block-form';

const FORM_TOOL_HOST =
  /(^|\.)(jotform\.(com|us)|typeform\.com|hsforms\.(net|com)|forms\.gle|formstack\.com|cognitoforms\.com|wufoo\.com|123formbuilder\.com|paperform\.co|tally\.so|formsite\.com|formspree\.io|zohopublic\.com)$/i;
const BOOKING_TOOL_HOST =
  /(^|\.)(calendly\.com|zocdoc\.com|nexhealth\.com|localmed\.com|acuityscheduling\.com|as\.me|setmore\.com|vagaro\.com|mindbodyonline\.com|janeapp\.com|schedulicity\.com|booksy\.com|fresha\.com|housecallpro\.com|opentable\.com|resy\.com|exploretock\.com|doctible\.com|flexbook\.me)$/i;
const WHATSAPP_HOST = /^(wa\.me|api\.whatsapp\.com)$/i;

const isFormTool = (u: URL) =>
  FORM_TOOL_HOST.test(u.hostname) || (u.hostname === 'docs.google.com' && u.pathname.startsWith('/forms'));
const isBookingTool = (u: URL) =>
  BOOKING_TOOL_HOST.test(u.hostname) || (/(^|\.)squareup\.com$/i.test(u.hostname) && u.pathname.includes('/appointments'));

const displayPath = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};

/** Every address the page links to or embeds: links, iframes, scripts, form actions */
function referencedUrls({ $, url }: ParsedPage): URL[] {
  return $('a[href], iframe[src], script[src], form[action]')
    .toArray()
    .flatMap((el) => {
      const raw = ($(el).attr('href') ?? $(el).attr('src') ?? $(el).attr('action') ?? '').trim();
      try {
        const u = new URL(raw, url);
        return u.protocol.startsWith('http') ? [u] : [];
      } catch {
        return [];
      }
    });
}

function hasTapToCall({ $ }: ParsedPage): boolean {
  return $('a[href^="tel:" i]')
    .toArray()
    .some((a) => ($(a).attr('href') ?? '').replace(/\D/g, '').length >= MIN_PHONE_DIGITS);
}

function hasEnquiryForm({ $ }: ParsedPage): boolean {
  return $('form')
    .toArray()
    .some((form) => {
      const $form = $(form);
      const naming = ['class', 'id', 'name', 'action'].map((attr) => $form.attr(attr) ?? '').join(' ');
      if ($form.attr('role') === 'search' || NOT_AN_ENQUIRY.test(naming)) return false;
      if ($form.find('input[type="password" i]').length > 0) return false;
      if ($form.find('textarea').length > 0) return true;
      const fillable = $form
        .find('input, select')
        .toArray()
        .filter((field) => field.tagName === 'select' || FILLABLE_TYPES.has(($(field).attr('type') ?? 'text').toLowerCase()));
      return fillable.length >= 2;
    });
}

const hasContactForm = (page: ParsedPage) =>
  hasEnquiryForm(page) || page.$(BUILDER_FORM).length > 0 || referencedUrls(page).some(isFormTool);

const hasEmailLink = ({ $ }: ParsedPage) => $('a[href^="mailto:" i]').length > 0;

const hasWhatsApp = (page: ParsedPage) => referencedUrls(page).some((u) => WHATSAPP_HOST.test(u.hostname));

/** A booking tool's host, or the path of a booking link on the site; null when neither */
function bookingEvidence(pages: ParsedPage[]): string | null {
  for (const page of pages) {
    const tool = referencedUrls(page).find(isBookingTool);
    if (tool) return tool.hostname.replace(/^www\./, '');
  }
  for (const page of pages) {
    const link = sameSiteLinks(page.html, page.url.href).find((l) => BOOKING_WORDS.test(`${new URL(l.url).pathname} ${l.text}`));
    if (link) return displayPath(link.url);
  }
  return null;
}

export function analyzeLeadCapture(pages: LeadPage[], links: LinkResult[]): { score: number; checks: LeadChecks } {
  const loaded: ParsedPage[] = pages.flatMap((p) =>
    p.html === null ? [] : [{ kind: p.kind, url: new URL(p.url), html: p.html, $: cheerio.load(p.html) }]
  );
  const findings: Finding[] = [];
  let score = 0;
  const add = (points: number, finding: Finding) => {
    score += points;
    findings.push(finding);
  };

  // 1. Tap-to-call (25)
  const callPage = loaded.find(hasTapToCall);
  if (callPage?.kind === 'home') {
    add(25, { id: 'lead.clickToCall', status: 'pass', label: 'Tap-to-call phone link on the homepage' });
  } else if (callPage) {
    add(10, {
      id: 'lead.clickToCall',
      status: 'warn',
      label: "Phone number isn't tap-to-call on the homepage",
      detail: `Only on the ${PAGE_NAMES[callPage.kind]}`,
    });
  } else {
    add(0, { id: 'lead.clickToCall', status: 'fail', label: 'No tap-to-call phone link — mobile visitors have to copy the number' });
  }

  // 2. Contact form (30)
  const formPage = loaded.find(hasContactForm);
  if (formPage) {
    add(30, { id: 'lead.form', status: 'pass', label: `Contact form on the ${PAGE_NAMES[formPage.kind]}` });
  } else if (loaded.some(hasEmailLink)) {
    add(10, { id: 'lead.form', status: 'warn', label: 'Only an email link — no contact form found' });
  } else {
    add(0, { id: 'lead.form', status: 'fail', label: 'No contact form or email link found on the pages we checked' });
  }

  // 3. Online booking (15) — a warning at worst: not every business books online
  const booking = bookingEvidence(loaded);
  if (booking) {
    add(15, { id: 'lead.booking', status: 'pass', label: 'Online booking or appointment request', detail: booking });
  } else {
    add(0, { id: 'lead.booking', status: 'warn', label: 'No online booking — visitors can only call or email' });
  }

  // 4. Contact page (10): linked from the homepage, or a form right on it
  if (pages.some((p) => p.kind === 'contact')) {
    add(10, { id: 'lead.contactPage', status: 'pass', label: 'Contact page linked from the homepage' });
  } else if (formPage?.kind === 'home') {
    add(10, { id: 'lead.contactPage', status: 'pass', label: 'Contact form right on the homepage' });
  } else {
    add(0, { id: 'lead.contactPage', status: 'fail', label: 'No contact page linked from the homepage' });
  }

  // 5. Broken links (20). When nothing could be checked the site keeps the points.
  const broken = links.filter((l) => l.status === 'broken').map((l) => l.url);
  const checked = links.filter((l) => l.status !== 'unknown').length;
  if (broken.length > 0) {
    add(0, {
      id: 'lead.brokenLinks',
      status: 'fail',
      label: `${broken.length} broken link${broken.length === 1 ? '' : 's'} — visitors land on a "page not found"`,
      detail: broken.slice(0, 3).map(displayPath).join(', '),
    });
  } else if (checked > 0) {
    add(20, { id: 'lead.brokenLinks', status: 'pass', label: `No broken links (${checked} checked)` });
  } else {
    add(20, { id: 'lead.brokenLinks', status: 'warn', label: "Couldn't check the site's links" });
  }

  // 6. WhatsApp: mentioned only when found (rare for US businesses)
  if (loaded.some(hasWhatsApp)) findings.push({ id: 'lead.whatsapp', status: 'pass', label: 'WhatsApp chat link' });

  return {
    score,
    checks: {
      findings,
      pages: pages.map((p) => ({ url: p.url, kind: p.kind, ok: p.html !== null })),
      links: { checked, broken },
    },
  };
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/leadCapture.test.ts`
Expected: all PASS. (cheerio 1.2 supports the case-insensitive `[attr^="…" i]` selectors used here — verified 2026-09-30.)

---

### Task 5: `leadCrawl.ts` — fetch the key pages, list the links to test

**Files:**
- Create: `app/_shared/lib/audit/leadCrawl.ts`
- Test: `app/_shared/lib/audit/__tests__/leadCrawl.test.ts`

**Interfaces:**
- Consumes: `pickKeyPages`, `sameSiteLinks`, `pageKey` (Task 2); `fetchPage`, `PageFetchResult` (Task 1); `linkStatus`, `MAX_LINKS`, `LinkResult` (Task 3); `LeadPage` (Task 4).
- Produces:
  ```ts
  export interface CrawledPage extends LeadPage { status: number | null }
  export function crawlKeyPages(homeUrl: string, homeHtml: string, load: typeof fetchPage): Promise<CrawledPage[]>; // [home, ...key pages]
  export function linkTargets(pages: CrawledPage[]): string[];   // ≤ 30, homepage links first
  export function keyPageLinks(pages: CrawledPage[]): LinkResult[];
  ```

- [ ] **Step 1: Write the failing tests**

```ts
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
      { url: 'https://smile.com/', kind: 'home', html: '<a href="/contact">Contact</a><a href="/book">Book</a>', status: 200 },
      { url: 'https://smile.com/contact', kind: 'contact', html: '<p>https://smile.com/contact</p>', status: 200 },
      { url: 'https://smile.com/book', kind: 'booking', html: null, status: 404 },
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

  it('stops at 30 links', () => {
    const html = Array.from({ length: 40 }, (_, i) => `<a href="/p${i}">p</a>`).join('');
    expect(linkTargets([page('https://smile.com/', 'home', html)])).toHaveLength(30);
  });
});

describe('keyPageLinks', () => {
  it("counts each fetched key page as a checked link: 404 broken, 403 unknown, 200 ok", () => {
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/leadCrawl.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// app/_shared/lib/audit/leadCrawl.ts

// Fetches the key pages the lead-capture checks read and lists the links to
// test. The key pages are also handed to the email finder, so no page is
// downloaded twice.

import { pageKey, pickKeyPages, sameSiteLinks } from '@/app/_shared/lib/audit/siteLinks';
import { linkStatus, MAX_LINKS, type LinkResult } from '@/app/_shared/lib/audit/linkCheck';
import type { fetchPage } from '@/app/_shared/lib/audit/siteFetch';
import type { LeadPage } from '@/app/_shared/lib/audit/analyzers/leadCapture';

export interface CrawledPage extends LeadPage {
  /** HTTP status; null when the page couldn't be reached */
  status: number | null;
}

/** The homepage, then up to 4 key pages it links to, fetched in parallel. */
export async function crawlKeyPages(homeUrl: string, homeHtml: string, load: typeof fetchPage): Promise<CrawledPage[]> {
  const keyPages = await Promise.all(
    pickKeyPages(homeHtml, homeUrl).map(async ({ url, kind }): Promise<CrawledPage> => {
      const page = await load(url);
      return { url, kind, html: page.ok ? page.html : null, status: page.status };
    })
  );
  return [{ url: homeUrl, kind: 'home', html: homeHtml, status: 200 }, ...keyPages];
}

/** Same-site links on the loaded pages that weren't fetched already, homepage links first; at most 30. */
export function linkTargets(pages: CrawledPage[]): string[] {
  const seen = new Set(pages.map((p) => pageKey(p.url)));
  const targets: string[] = [];
  for (const page of pages) {
    if (page.html === null) continue;
    for (const { url } of sameSiteLinks(page.html, page.url)) {
      if (seen.has(pageKey(url))) continue;
      seen.add(pageKey(url));
      targets.push(url);
    }
  }
  return targets.slice(0, MAX_LINKS);
}

/** Key pages were requested already: their status counts as a link check. */
export function keyPageLinks(pages: CrawledPage[]): LinkResult[] {
  return pages.filter((p) => p.kind !== 'home').map((p) => ({ url: p.url, status: linkStatus(p.status) }));
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/leadCrawl.test.ts`
Expected: all PASS.

---

### Task 6: Email finder reads the pages it's given

**Files:**
- Modify: `app/_shared/lib/utils/emailFinder.ts`
- Test: `app/_shared/lib/utils/__tests__/emailFinder.test.ts`

**Interfaces:**
- Produces: `findEmail(website: string, opts?: { apiFallback?: boolean; homepageHtml?: string | null; pages?: { url: string; html: string }[] }): Promise<string | null>`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('findEmail with prefetched homepage HTML', …)` block:

```ts
  it('searches pages the audit already downloaded, without fetching them again', async () => {
    const email = await findEmail('https://smiledental.com/', {
      homepageHtml: '<p>No email here</p>',
      pages: [{ url: 'https://smiledental.com/contact-us', html: '<p>office@smiledental.com</p>' }],
    });
    expect(email).toBe('office@smiledental.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the usual pages it was already given', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    await findEmail('https://smiledental.com/', {
      homepageHtml: '<p>No email here</p>',
      pages: [{ url: 'https://www.smiledental.com/contact/', html: '<p>Call us</p>' }],
    });
    const fetched = fetchMock.mock.calls.map(([url]) => url as string);
    expect(fetched).toContain('https://smiledental.com/about');
    expect(fetched).not.toContain('https://smiledental.com/contact');
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/utils/__tests__/emailFinder.test.ts`
Expected: the 2 new tests FAIL (the first fetches the usual pages and finds nothing → `null`; the second fetches `/contact`).

- [ ] **Step 3: Implement**

Replace `scrapeWebsite` and the `findEmail` signature/call in `emailFinder.ts`:

```ts
type KnownPage = { url: string; html: string };

async function scrapeWebsite(website: string, homepageHtml?: string | null, pages: KnownPage[] = []): Promise<string | null> {
  const url = new URL(website);
  const domain = url.hostname;

  // Homepage first (reusing HTML the audit already fetched) — if it has a good email, we're done
  const homepage = homepageHtml ?? (await fetchPage(website));
  const found = new Set<string>(homepage ? extractEmails(homepage) : []);
  const homepageBest = pickBestEmail([...found], domain);
  if (homepageBest) return homepageBest;

  // Then pages the audit already downloaded (contact, about…), without fetching them again
  pages.forEach((page) => extractEmails(page.html).forEach((e) => found.add(e)));
  const givenBest = pickBestEmail([...found], domain);
  if (givenBest) return givenBest;

  // Then the usual contact/about pages not read yet, concurrently
  const given = new Set(pages.map((page) => pageKey(page.url)));
  const usualPages = PAGES_TO_TRY.map((p) => `${url.origin}${p}`).filter((u) => !given.has(pageKey(u)));
  (await emailsFrom(usualPages)).forEach((e) => found.add(e));
  const usualBest = pickBestEmail([...found], domain);
  if (usualBest || !homepage) return usualBest;

  // Last, a few more of the site's own pages (privacy, new patients, careers…)
  const alreadyRead = new Set([website, ...usualPages].map(pageKey).concat([...given]));
  const extraPages = extraPageLinks(homepage, website, alreadyRead).slice(0, MAX_EXTRA_PAGES);
  (await emailsFrom(extraPages)).forEach((e) => found.add(e));
  return pickBestEmail([...found], domain);
}
```

and in `findEmail`:

```ts
export async function findEmail(
  website: string,
  opts: { apiFallback?: boolean; homepageHtml?: string | null; pages?: KnownPage[] } = {}
): Promise<string | null> {
```

with the scrape call changed to `const scraped = await scrapeWebsite(website, opts.homepageHtml, opts.pages);`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/utils/__tests__/emailFinder.test.ts app/_shared/lib/utils/__tests__/contactDiscovery.test.ts`
Expected: all PASS.

---

### Task 7: Wire lead capture into the audit (runAudit, route, migration)

**Files:**
- Modify: `app/_shared/lib/audit/runAudit.ts`, `app/_shared/lib/audit/types.ts`, `app/api/audit/route.ts`, `docs/supabase-schema.sql`
- Create: `docs/migrations/2026-09-30-lead-capture.sql`
- Test: `app/_shared/lib/audit/__tests__/runAudit.test.ts`, `app/api/audit/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `fetchPage` (Task 1), `checkLinks`, `LinkResult` (Task 3), `analyzeLeadCapture` (Task 4), `crawlKeyPages`, `linkTargets`, `keyPageLinks`, `CrawledPage` (Task 5), `findEmail` `pages` option (Task 6).
- Produces:
  - `AuditDeps` gains `fetchPage: typeof fetchPage; checkLinks: typeof checkLinks`.
  - `AuditInput.discoverEmail` becomes `(homepageHtml: string | null, pages: { url: string; html: string }[]) => Promise<string | null>`.
  - `AuditRow` gains `lead_score: number | null`; `row.checks.lead` is `LeadChecks | null`.

- [ ] **Step 1: Update the test helper and write the failing tests**

In `runAudit.test.ts`:

1. Imports: add `import type { PageFetchResult } from '@/app/_shared/lib/audit/siteFetch';` and `import type { LinkResult } from '@/app/_shared/lib/audit/linkCheck';`.
2. In `deps()`, add fakes so no test touches the network (key pages 404 by default, every link ok):

```ts
    fetchPage: vi.fn(async (url: string): Promise<PageFetchResult> => ({ ok: false, status: 404, finalUrl: url, html: null, reason: 'HTTP 404' })),
    checkLinks: vi.fn(async (urls: string[]): Promise<LinkResult[]> => urls.map((url) => ({ url, status: 'ok' }))),
```

3. In the existing test `'passes the homepage HTML to email discovery and survives its failure'`, change `expect(discoverEmail).toHaveBeenCalledWith(DENTIST_HOME);` to `expect(discoverEmail).toHaveBeenCalledWith(DENTIST_HOME, []);`.
4. Append a new block inside `describe('runAudit', …)`:

```ts
  describe('lead capture', () => {
    // DENTIST_HOME already has a tap-to-call link; add a contact link
    const HOME_WITH_CONTACT = DENTIST_HOME.replace('</footer>', '<a href="/contact">Contact us</a></footer>');
    const CONTACT_PAGE = '<form><input name="name"><textarea name="msg"></textarea></form><p>office@smiledental.com</p>';
    const contactSite = () =>
      deps({
        fetchSite: vi.fn(async () => siteOk(HOME_WITH_CONTACT)),
        fetchPage: vi.fn(async (url: string): Promise<PageFetchResult> => ({ ok: true, status: 200, finalUrl: url, html: CONTACT_PAGE })),
      });

    it('scores the homepage and the key pages it links to', async () => {
      const d = contactSite();
      const { row } = await runAudit(input, d);
      expect(d.fetchPage).toHaveBeenCalledWith('https://smiledental.com/contact');
      // call 25 + form 30 + booking 0 (warn) + contact page 10 + links 20
      expect(row.lead_score).toBe(85);
      expect(row.checks.lead?.pages.map((p) => p.kind)).toEqual(['home', 'contact']);
    });

    it('hands the key pages to email discovery instead of fetching them again', async () => {
      const discoverEmail = vi.fn(async () => null);
      await runAudit({ ...input, discoverEmail }, contactSite());
      expect(discoverEmail).toHaveBeenCalledWith(HOME_WITH_CONTACT, [
        { url: 'https://smiledental.com/contact', html: CONTACT_PAGE },
      ]);
    });

    it('is not measured for a JavaScript-only homepage', async () => {
      const { row } = await runAudit(input, deps({ fetchSite: vi.fn(async () => siteOk(JS_SHELL)) }));
      expect(row.lead_score).toBeNull();
      expect(row.checks.lead).toBeNull();
    });

    it('is not measured when the site blocks the crawler, and fetches no key pages', async () => {
      const d = deps({ fetchSite: vi.fn(async () => siteBlocked) });
      const { row } = await runAudit(input, d);
      expect(row.lead_score).toBeNull();
      expect(d.fetchPage).not.toHaveBeenCalled();
    });

    it('keeps the rest of the audit when fetching the key pages fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const d = contactSite();
      vi.mocked(d.fetchPage).mockRejectedValue(new Error('boom'));
      const { row } = await runAudit(input, d);
      expect(row.lead_score).toBeNull();
      expect(row.performance_score).toBe(42);
      vi.restoreAllMocks();
    });
  });
```

In `app/api/audit/__tests__/route.test.ts`, append inside `describe('POST /api/audit', …)` (and add `import { findEmail } from '@/app/_shared/lib/utils/emailFinder';`):

```ts
  it("hands the audit's key pages to the email finder", async () => {
    givenDb({
      'businesses.select': [ok({ ...business, email: null })],
      'audits.select': [ok(null)],
      'audits.insert': [ok(storedAudit())],
    });
    await post({ business_id: 'biz-1' });
    const pages = [{ url: 'https://smiledental.com/contact', html: '<p>office@smiledental.com</p>' }];
    await vi.mocked(runAudit).mock.calls[0][0].discoverEmail?.('<p>home</p>', pages);
    expect(findEmail).toHaveBeenCalledWith('https://smiledental.com', { homepageHtml: '<p>home</p>', pages });
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/runAudit.test.ts app/api/audit/__tests__/route.test.ts`
Expected: the 5 new runAudit tests FAIL (`lead_score` undefined; `discoverEmail` called with one argument), the edited email-discovery test FAILS (called with one argument), and the new route test FAILS (`findEmail` called without `pages`).

- [ ] **Step 3: Types**

In `types.ts`:
- `AuditInput.discoverEmail` becomes:
  ```ts
  /** Called once the homepage and key pages are fetched (html is null if the homepage couldn't be read). */
  discoverEmail?: (homepageHtml: string | null, pages: { url: string; html: string }[]) => Promise<string | null>;
  ```
- `AuditRow` gains, after `aeo_score`: `lead_score: number | null;`

- [ ] **Step 4: runAudit**

In `runAudit.ts`:

1. Imports — change the siteFetch import and add:
```ts
import { fetchSite, fetchPage, type SiteFetchResult } from '@/app/_shared/lib/audit/siteFetch';
import { checkLinks, type LinkResult } from '@/app/_shared/lib/audit/linkCheck';
import { crawlKeyPages, keyPageLinks, linkTargets, type CrawledPage } from '@/app/_shared/lib/audit/leadCrawl';
import { analyzeLeadCapture } from '@/app/_shared/lib/audit/analyzers/leadCapture';
```
and add `type LeadChecks` to the `@/app/_shared/lib/audit/types` import.

2. `AuditDeps` gains `fetchPage: typeof fetchPage;` and `checkLinks: typeof checkLinks;`; `defaultDeps` becomes `{ runPageSpeed, fetchSite, fetchPage, checkTls, checkLinks, now: () => Date.now() }`.

3. Add above `runAudit`:
```ts
// Key pages that loaded, for the email finder
const loadedKeyPages = (pages: CrawledPage[] | null) =>
  (pages ?? []).flatMap((p) => (p.kind !== 'home' && p.html !== null ? [{ url: p.url, html: p.html }] : []));
```

4. In `runAudit`, after `const finalHost = …`, add:
```ts
  // Lead capture: the key pages the homepage links to, then a check of the
  // site's links — all while PageSpeed runs. Email discovery reuses the pages.
  const crawlPromise: Promise<CrawledPage[] | null> = sitePromise
    .then((s) => (s.ok && s.html !== null ? crawlKeyPages(s.finalUrl ?? input.website, s.html, deps.fetchPage) : null))
    .catch((err) => {
      console.warn('[audit] key page crawl failed:', err);
      return null;
    });
  const linksPromise: Promise<LinkResult[]> = crawlPromise.then(async (pages) =>
    pages ? [...keyPageLinks(pages), ...(await deps.checkLinks(linkTargets(pages)))] : []
  );
```

5. Replace the email entry in `Promise.all` and destructure the new results:
```ts
  const [mobile, desktop, site, tls, email, crawl, links] = await Promise.all([
    pageSpeed(input.website, 'mobile', deadline),
    pageSpeed(input.website, 'desktop', deadline),
    sitePromise,
    sitePromise
      .then((s) => deps.checkTls(finalHost(s)))
      .catch((err) => {
        console.warn('[audit] TLS check failed:', err);
        return null;
      }),
    Promise.all([sitePromise, crawlPromise])
      .then(([s, pages]) => (input.discoverEmail ? input.discoverEmail(s.ok ? s.html : null, loadedKeyPages(pages)) : null))
      .catch((err) => {
        console.warn('[audit] email discovery failed:', err);
        return null;
      }),
    crawlPromise,
    linksPromise,
  ]);
```

6. After the `page` analysis block (after its `try/catch`), add:
```ts
  // Same "not measured" rule as GEO/AEO: a readable, non-JavaScript-only homepage
  let lead: { score: number; checks: LeadChecks } | null = null;
  if (crawl && page && !page.limitedReason) {
    try {
      lead = analyzeLeadCapture(crawl, links);
    } catch (err) {
      console.error('[audit] lead capture analysis failed:', err);
    }
  }
```

7. In the returned row: after `aeo_score: …` add `lead_score: lead?.score ?? null,`; in `checks`, after `aeo: …` add `lead: lead?.checks ?? null,`.

- [ ] **Step 5: Route**

In `app/api/audit/route.ts`, replace the `ensureEmail` signature and `findEmail` call:
```ts
  const ensureEmail = async (
    homepageHtml?: string | null,
    pages?: { url: string; html: string }[]
  ): Promise<string | null> => {
    if (business.email) return business.email;
    if (!business.website) return null;
    const found = await findEmail(business.website, { homepageHtml, pages });
```
(the rest of the function is unchanged).

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit app/api/audit`
Expected: all PASS.

- [ ] **Step 7: Migration and schema doc**

Create `docs/migrations/2026-09-30-lead-capture.sql`:
```sql
-- 2026-09-30 lead capture migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.
-- Run it BEFORE deploying the matching code: every new audit writes lead_score.

-- 0–100: can visitors call, message or book? NULL = not measured (older audits,
-- blocked or JavaScript-only sites).
ALTER TABLE audits ADD COLUMN IF NOT EXISTS lead_score INTEGER;
```

In `docs/supabase-schema.sql`, in `CREATE TABLE … audits`, after `aeo_score INTEGER,` add:
```sql
  lead_score          INTEGER,
```

- [ ] **Step 8: Type check**

Run: `npx tsc --noEmit`
Expected: no errors. (`AuditRow` is only built by `runAudit` and only cast in tests, so no fixture needs `lead_score`.)

---

### Task 8: AI prompt facts and the PDF

**Files:**
- Modify: `app/_shared/lib/audit/reportData.ts`, `app/_shared/components/auditely/pdfDocument/pdfDocument.tsx`, `app/_shared/components/auditely/pdfDocument/pdfSections.tsx`
- Test: `app/_shared/lib/audit/__tests__/reportData.test.ts`

**Interfaces:**
- Consumes: `AuditChecks.lead` (Task 4), `audits.lead_score`.
- Produces: `AuditLike.lead_score?: number | null`; `PdfDocumentProps.leadScore: number | null`, `PdfDocumentProps.leadFindings: PdfFinding[]`; `failingFindings` lists `lead.*` first; `auditFacts` uses a limit of 4.

- [ ] **Step 1: Write the failing tests**

In `reportData.test.ts` append:

```ts
describe('lead capture in the report', () => {
  // Same PDF arguments as the buildPdfProps tests (declared inside that block)
  const contact = { name: null, phone: null, email: 'contact@devartventures.com', bookingUrl: null };
  const business = { name: 'Smile Dental', website: null, address: '123 Main St', phone: null };
  const noReport = { summary: '', improvements: [] };
  const leadChecks: Partial<AuditChecks> = {
    ...checks,
    lead: {
      findings: [f('lead.form', 'fail'), f('lead.booking', 'warn'), f('lead.clickToCall', 'pass')],
      pages: [],
      links: { checked: 0, broken: [] },
    },
  };
  const withLead: AuditLike = { ...audit, lead_score: 30, checks: leadChecks };

  it('adds the lead capture score to the AI facts, and lists its failures first', () => {
    const { scores, issues } = auditFacts(withLead);
    expect(scores).toContain('Lead capture (can visitors call, message or book): 30/100');
    expect(issues.split('\n')).toEqual([
      '- Largest Contentful Paint (12.8 s)',
      '- Cumulative Layout Shift',
      '- lead.form',
      '- geo.b',
      '- aeo.a',
      '- aeo.c',
    ]);
  });

  it('says "not measured" for audits made before lead capture', () => {
    expect(auditFacts(audit).scores).toContain('Lead capture (can visitors call, message or book): not measured');
  });

  it('passes the lead capture score and its problems to the PDF', () => {
    const props = buildPdfProps(withLead, business, noReport, contact);
    expect(props.leadScore).toBe(30);
    expect(props.leadFindings).toEqual([
      { status: 'fail', label: 'lead.form' },
      { status: 'warn', label: 'lead.booking' },
    ]);
    expect(buildPdfProps(audit, business, noReport, contact)).toMatchObject({ leadScore: null, leadFindings: [] });
  });
});
```


- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/reportData.test.ts`
Expected: the 3 new tests FAIL.

- [ ] **Step 3: Implement reportData**

In `reportData.ts`:
1. `AuditLike` gains `lead_score?: number | null;` after `aeo_score`.
2. `failingFindings` becomes:
```ts
/** Failing (status 'fail') lead capture findings, then GEO, then AEO. */
export function failingFindings(checks: Partial<AuditChecks> | null | undefined, limit: number): Finding[] {
  return [...(checks?.lead?.findings ?? []), ...(checks?.geo?.findings ?? []), ...(checks?.aeo?.findings ?? [])]
    .filter((finding) => finding.status === 'fail')
    .slice(0, limit);
}
```
3. In `auditFacts`, add to the `scores` array after the AEO line:
```ts
    `Lead capture (can visitors call, message or book): ${formatScore(audit.lead_score)}`,
```
and change `failingFindings(audit.checks, 3)` to `failingFindings(audit.checks, 4)`.
4. In `buildPdfProps`'s returned object, after `aeoFindings`:
```ts
    leadScore: audit.lead_score ?? null,
    leadFindings: pdfFindings(audit.checks?.lead?.findings),
```

- [ ] **Step 4: Implement the PDF**

In `pdfDocument.tsx`:
1. `PdfDocumentProps` gains `leadScore: number | null;` and `leadFindings: PdfFinding[];`; destructure both in `PdfDocument`.
2. Import `LeadCaptureSection` alongside `SearchReadinessSection` from `pdfSections`.
3. In the scores row, after the AEO tile: `<ScoreTile label="Leads" score={leadScore} />`.
4. After the GEO / AEO block (before `{/* Summary */}`):
```tsx
        {/* Lead capture — audits made before it show nothing */}
        {leadScore !== null && (
          <>
            <LeadCaptureSection score={leadScore} findings={leadFindings} />
            <View style={styles.divider} />
          </>
        )}
```

In `pdfSections.tsx`:
1. Add `['Leads', 'how easily visitors can call, message or book'],` at the end of `SCORE_DEFINITIONS`.
2. Append:
```tsx
export function LeadCaptureSection({ score, findings }: { score: number | null; findings: PdfFinding[] }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionLabel}>Lead Capture</Text>
      <ReadinessBlock title="Can visitors reach you?" score={score} findings={findings} />
    </View>
  );
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/reportData.test.ts && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 9: Card, sort and CSV

**Files:**
- Modify: `app/_shared/lib/types/auditely.ts`, `app/_shared/components/auditely/auditScores/auditScores.tsx`, `app/_shared/components/auditely/auditChecklist/auditChecklist.tsx`, `app/_shared/components/auditely/businessCard/businessCard.tsx`, `app/_shared/lib/utils/leadView.ts`, `app/_shared/lib/utils/leadExport.ts`
- Test: `app/_shared/lib/utils/__tests__/leadView.test.ts`, `app/_shared/lib/utils/__tests__/leadExport.test.ts`

**Interfaces:**
- Consumes: `audits.lead_score`, `AuditChecks.lead`.
- Produces: `Audit.lead_score?: number | null` (optional: rows read before the migration lack the column).

- [ ] **Step 1: Write the failing tests**

In `leadView.test.ts`, in `describe('averageScore', …)`:
```ts
  it('includes the lead capture score when measured', () => {
    expect(averageScore({ ...scores(null), performance_score: 40, lead_score: 100 })).toBe(70);
  });
```

In `leadExport.test.ts`, in `describe('leadTable', …)`:
```ts
  it('includes the lead capture score, blank before it existed', () => {
    const audited = (lead_score?: number | null) =>
      business({
        audit: {
          id: 'a1', business_id: 'b1', performance_score: 98, seo_score: 100, mobile_score: 35,
          ssl_valid: true, geo_score: null, aeo_score: 45, checks: {}, engine_version: 2, raw_json: {},
          created_at: '2026-09-28T10:00:00Z', lead_score,
        },
      });
    expect(column(leadTable([audited(65), audited(undefined)]), 'Lead capture')).toEqual(['65', '']);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/utils/__tests__/leadView.test.ts app/_shared/lib/utils/__tests__/leadExport.test.ts`
Expected: the 2 new tests FAIL (average 40; no "Lead capture" column).

- [ ] **Step 3: Implement**

`app/_shared/lib/types/auditely.ts` — in `Audit`, after `aeo_score`:
```ts
  /** null = not measured; absent on rows read before the lead-capture migration */
  lead_score?: number | null;
```

`leadView.ts`:
- In `LeadLike`, the audit pick becomes `Pick<Audit, 'performance_score' | 'seo_score' | 'mobile_score' | 'geo_score' | 'aeo_score' | 'lead_score'>`.
- In `averageScore`, the list becomes `[audit.performance_score, audit.seo_score, audit.mobile_score, audit.geo_score, audit.aeo_score, audit.lead_score]`.

`leadExport.ts` — after the `['AEO', …]` column:
```ts
  ['Lead capture', (b) => b.audit?.lead_score],
```

`auditScores.tsx` — grid classes become `grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7`, and after the AEO tile:
```tsx
        <ScoreTile label="Lead capture" score={audit.lead_score} reason={siteReason} />
```

`auditChecklist.tsx`:
- `const { geo, aeo, seo, site, lead } = audit.checks ?? {};`
- the early-return condition becomes `if (!geo && !aeo && !lead && !showSeoBasics)`
- after the AEO group:
```tsx
      {lead && <FindingGroup title="Can visitors reach you? (Lead capture)" score={audit.lead_score} findings={lead.findings} />}
```
- update the component's doc comment to "GEO / AEO / lead capture findings, …".

`businessCard.tsx` — in `ScorePills`, add `['Leads', audit.lead_score ?? null],` after `['AEO', audit.aeo_score],`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/utils && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 10: Live check, full verification, hand-off

**Files:**
- Scratch only (not committed): `$SCRATCH/lead-live.test.ts`, `$SCRATCH/vitest.live.config.mts`, where `$SCRATCH` is the session scratchpad directory.

- [ ] **Step 1: Run the checks against three real sites**

`$SCRATCH/vitest.live.config.mts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  resolve: { alias: { '@': '/Users/cp/Downloads/Numan/work/auditely/' } },
  test: { include: ['lead-live.test.ts'], globals: true, testTimeout: 120_000 },
});
```

`$SCRATCH/lead-live.test.ts`:
```ts
import { fetchSite, fetchPage } from '@/app/_shared/lib/audit/siteFetch';
import { crawlKeyPages, keyPageLinks, linkTargets } from '@/app/_shared/lib/audit/leadCrawl';
import { checkLinks } from '@/app/_shared/lib/audit/linkCheck';
import { analyzeLeadCapture } from '@/app/_shared/lib/audit/analyzers/leadCapture';

// Squarespace (JS form block), Wix with a form, Wix with only an email link
const SITES = [
  'https://brine-demo.squarespace.com/',
  'https://smilevallarta.wixsite.com/dental',
  'https://dentalcornerdc.wixsite.com/website',
];

test.each(SITES)('%s', async (url) => {
  const home = await fetchSite(url);
  if (!home.ok || home.html === null) throw new Error(home.reason);
  const pages = await crawlKeyPages(home.finalUrl ?? url, home.html, fetchPage);
  const links = [...keyPageLinks(pages), ...(await checkLinks(linkTargets(pages)))];
  const { score, checks } = analyzeLeadCapture(pages, links);
  console.log(url, score, JSON.stringify(checks, null, 2));
});
```

Run: `cd /Users/cp/Downloads/Numan/work/auditely && npx vitest run --config $SCRATCH/vitest.live.config.mts`
Expected: brine-demo → `lead.form` pass ("Contact form on the contact page", via `.sqs-block-form`); smilevallarta → `lead.form` pass; dentalcornerdc → `lead.form` warn ("Only an email link"). No link marked broken that opens fine in a browser — spot-check any `broken` URL by opening it. If a result is wrong, fix the analyzer with a new failing test in Task 4's test file first.

- [ ] **Step 2: Full verification**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all tests pass (3 pre-existing skips), no type errors, no lint warnings, build succeeds.

- [ ] **Step 3: Hand-off (do not commit yet)**

Report to the user: what changed, the test results, the live-site results, and that `docs/migrations/2026-09-30-lead-capture.sql` must be run in Supabase before deploying. Ask for the go-ahead to commit everything — code, spec and this plan — on `staging`. Commit only after they say yes, ending the message with:
```
Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```
