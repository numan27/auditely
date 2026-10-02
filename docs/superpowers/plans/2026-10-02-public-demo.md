# Public Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-out visitor who opens the bare domain gets the real workspace on a saved, masked sample search, can replay audits and download their PDFs, and can reach nothing that spends credits or reads the database.

**Architecture:** Read-only is enforced in the browser; the server only gains two public paths (`/demo`, `/demo/report/{id}`) and no API route changes. `/demo` renders the same `Workspace` as `/` inside a `DemoProvider`, whose context (`useDemo()`, `null` in the real app) supplies the sample data, a `replay` function with the shape of the real audit requests, and `restrict(action)`, which opens one notice dialog. Each hook or component that would call the API asks `useDemo()` first. The sample is a JSON file written by a capture script that masks contacts and replaces ids.

**Tech Stack:** Next.js 16 App Router (`proxy.ts`, route handlers with `generateStaticParams`), React 19, TypeScript 5, Tailwind v4, @react-pdf/renderer, Supabase (capture script only), vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-02-public-demo-design.md`

## Global Constraints

- No file under `app/api/` is touched, and no `API_ROUTES` entry is added to `PUBLIC_ROUTES`.
- No new npm dependencies.
- Nothing reachable from `app/demo/` may import `@/app/_shared/lib/supabase/client` (it throws at import without its settings).
- `demoData.json` is imported only through `lib/demo/demoData.ts`, and that module only from server code (`app/demo/page.tsx`, the PDF route, tests). Client code gets the data through `DemoProvider`'s props.
- Outside the demo (`useDemo()` is `null`) every hook and component must behave exactly as before.
- Imports of shared code use `@/app/_shared/...`; routes come from `ROUTES` / `API_ROUTES` / `demoReportPath`; files stay under 300 lines; component folders and files are camelCase (`components/providers/` keeps its existing PascalCase file names); a modal is its own component file.
- Copy, verbatim from the spec. Banner: "Demo: a real search with contact details hidden. Live search and audits are switched off." Notice title: "Live generation is switched off in this demo". Notice closing line: "Want to see it run live? Message me on Upwork and I'll walk you through it." Walkthrough link: "Watch the 45-second walkthrough". Replay status: "Replaying the saved audit of {domain}…" / "A live audit takes about a minute; this replay is shortened."
- Replay waits: 4000 ms for an audit, 2500 ms for a summary.
- The sample holds at most 10 leads and exactly 1 website.
- Next.js 16 differs from older versions: before changing `proxy.ts` or a route handler, read the matching page in `node_modules/next/dist/docs/01-app/` (`01-getting-started/16-proxy.md`, `01-getting-started/15-route-handlers.md`, `03-api-reference/04-functions/generate-static-params.md`, `03-api-reference/04-functions/connection.md`).
- **Git:** do not commit, create a branch or push unless the user says so, and ask which branch first. Each task ends with a checkpoint, not a commit. The `/home` alias in `proxy.ts`, `routes.ts` and `routes.test.ts` (commit `623b93c`) stays as it is: the new code goes beside it.
- Commands: one file `npx vitest run <path>`; all `npm test`; types `npx tsc --noEmit`; lint `npm run lint`; build `npm run build`.

## Review Focus

1. **A contact detail in a place or format the masking doesn't expect** (a phone number in a page title, an email inside a link, a number written `713.555.0142`) must not reach the committed file. Pinned in Task 2 (formats), Task 3 (the script refuses to write; the file test scans everything).
2. **A setting that isn't a web link** (`DEMO_VIDEO_URL=javascript:…`, a bare domain, blank) must not become a link on a public page. Pinned in Task 6.
3. **An id that isn't a sample audit at `/demo/report/{id}`** (a real audit UUID, an empty id) must be a 404 that never reaches the database or the PDF renderer. Pinned in Task 5.
4. **An expired or forged session cookie on `/`** must get the demo, and a logged-out request to any other private page or API route must be refused as before. Pinned in Task 1.
5. **A replay asked for something the sample doesn't hold** (a hand-edited `replayIds`, an audit with no summary) must fail on that card with a reason and let "Audit all" carry on. Pinned in Task 4 (replay answers, and the real `auditBusiness` run against it) and Task 3 (every `replayIds` entry has an audit and a summary).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/_shared/lib/config/routes.ts` | modify | `ROUTES.DEMO` (public), `LOGGED_OUT_HOME`, `demoReportPath` |
| `proxy.ts` | modify | Logged-out `/` goes to the demo |
| `app/_shared/lib/config/__tests__/proxy.test.ts` | create | Proxy behaviour |
| `app/_shared/lib/demo/mask.ts` | create | `maskEmail`, `maskPhone`, `maskText`, `maskDeep`, `findUnmasked` |
| `app/_shared/lib/demo/demoSamples.ts` | create | `DemoData`, `startingLeads`, `allSamples`, `DEMO_ID_PREFIX` |
| `app/_shared/lib/demo/demoData.ts` | create | Loads `demoData.json` (server only) |
| `app/_shared/lib/demo/demoData.json` | create (by the script) | The sample |
| `scripts/captureDemo.mjs` | create | Writes the sample from Supabase |
| `app/_shared/lib/demo/replay.ts` | create | `replayPost`, `REPLAY_WAIT` |
| `app/_shared/lib/audit/pdfRender.ts` | create | `renderPdf`, `pdfFileName` (no database) |
| `app/_shared/lib/audit/auditPdf.ts` | modify | Looks the audit up, calls `renderPdf` |
| `app/_shared/lib/audit/reportData.ts`, `components/auditely/pdfDocument/pdfDocument.tsx` | modify | `contact` may be `null` |
| `app/demo/report/[auditId]/route.ts` | create | The sample audits' PDFs, built ahead |
| `app/_shared/lib/demo/demoLinks.ts` | create | `DemoLinks`, `demoLinks()` from the environment |
| `app/_shared/lib/hooks/useDemo.ts` | create | `DemoContext`, `useDemo`, `Demo`, `DemoAction` |
| `app/_shared/components/providers/DemoProvider.tsx` | create | Context value and the open notice |
| `app/_shared/components/auditely/demoNoticeModal/demoNoticeModal.tsx` | create | The notice |
| `app/_shared/components/auditely/demoBanner/demoBanner.tsx` | create | The banner |
| `app/_shared/components/auditely/workspace/workspace.tsx` | create | The home page body, shared by `/` and `/demo` |
| `app/page.tsx` | modify | Renders `Workspace` |
| `app/demo/page.tsx` | create | `Workspace` inside `DemoProvider` |
| `hooks/useBusinessList.ts`, `useLeadSearch.ts`, `useEmailDiscovery.ts`, `useUrlAudits.ts` | modify | Start from the sample; no requests |
| `components/auditely/leadSearchForm`, `urlAuditForm`, `urlAuditPanel`, `appHeader` | modify | Demo behaviour of the forms, the open sample site, the header |
| `hooks/useBusinessAudit.ts`, `useBulkAudit.ts` | modify | Replay, notice, demo PDF |
| `components/auditely/auditPanel`, `businessCard`, `businessEmail`, `reportActions`, `exportMenu` | modify | Replay wording, no age badges, masked contacts as text, notices |
| `.env.local.example` | modify | The three optional settings |

All `hooks/` and `components/` paths above are under `app/_shared/lib/` and `app/_shared/` respectively.

---

### Task 1: The demo is public, and the home page leads to it

**Files:**
- Modify: `app/_shared/lib/config/routes.ts`, `proxy.ts`
- Test: `app/_shared/lib/config/__tests__/routes.test.ts` (modify), `app/_shared/lib/config/__tests__/proxy.test.ts` (create)

**Interfaces:**
- Produces: `ROUTES.DEMO: '/demo'`; `LOGGED_OUT_HOME`; `demoReportPath(auditId: string): string` (`/demo/report/{id}`).

- [ ] **Step 1: Add the failing route tests**

In `app/_shared/lib/config/__tests__/routes.test.ts`, change the import line and add one test inside `describe('route access', …)`:

```ts
import { API_ROUTES, demoReportPath, isHomeAlias, isProtectedRoute, isPublicRoute, ROUTES } from '@/app/_shared/lib/config/routes';
```

```ts
  it('opens the demo and its reports, and no API route', () => {
    expect(isPublicRoute(ROUTES.DEMO)).toBe(true);
    expect(demoReportPath('demo-a1')).toBe('/demo/report/demo-a1');
    expect(isPublicRoute(demoReportPath('demo-a1'))).toBe(true);
    expect(isPublicRoute('/demos')).toBe(false);
    for (const path of Object.values(API_ROUTES)) expect(isProtectedRoute(path)).toBe(path !== API_ROUTES.AUTH);
    expect(isProtectedRoute('/api/autocomplete')).toBe(true);
  });
```

- [ ] **Step 2: Write the failing proxy test**

Create `app/_shared/lib/config/__tests__/proxy.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { createSessionToken, SESSION_COOKIE } from '@/app/_shared/lib/auth/session';
import { API_ROUTES, demoReportPath, ROUTES } from '@/app/_shared/lib/config/routes';

const visit = (path: string, session?: string) =>
  proxy(new NextRequest(`http://localhost${path}`, session ? { headers: { cookie: `${SESSION_COOKIE}=${session}` } } : undefined));

// Where a redirect leads (path and query); null when the request passes
const sentTo = (res: Response) => {
  const location = res.headers.get('location');
  if (!location) return null;
  const url = new URL(location);
  return `${url.pathname}${url.search}`;
};

beforeEach(() => vi.stubEnv('AUTH_SECRET', 'a'.repeat(40)));
afterEach(() => vi.unstubAllEnvs());

describe('proxy', () => {
  it('shows a logged-out visitor the demo instead of the home page', async () => {
    expect(sentTo(await visit(ROUTES.HOME))).toBe(ROUTES.DEMO);
    expect(sentTo(await visit('/?load=abc'))).toBe(ROUTES.DEMO);
  });

  it('treats an expired or forged session as logged out', async () => {
    expect(sentTo(await visit(ROUTES.HOME, '1.not-a-signature'))).toBe(ROUTES.DEMO);
    expect(sentTo(await visit(ROUTES.HOME, `${Date.now() + 60_000}.forged`))).toBe(ROUTES.DEMO);
  });

  it('lets a logged-out visitor open the demo and its reports', async () => {
    expect(sentTo(await visit(ROUTES.DEMO))).toBeNull();
    expect(sentTo(await visit(demoReportPath('demo-a1')))).toBeNull();
  });

  it('still sends every other private page to the login, remembering where to return', async () => {
    expect(sentTo(await visit(ROUTES.SEARCHES))).toBe(`${ROUTES.LOGIN}?callbackUrl=%2Fsearches`);
  });

  it('still answers 401 to a logged-out call of any API route but the login', async () => {
    for (const path of Object.values(API_ROUTES).filter((p) => p !== API_ROUTES.AUTH)) {
      expect((await visit(path)).status).toBe(401);
    }
  });

  it('gives a logged-in user the real home page, and the demo when asked for', async () => {
    const session = await createSessionToken();
    expect(sentTo(await visit(ROUTES.HOME, session))).toBeNull();
    expect(sentTo(await visit(ROUTES.DEMO, session))).toBeNull();
  });
});
```

- [ ] **Step 3: Run both to see them fail**

Run: `npx vitest run app/_shared/lib/config`
Expected: FAIL. `demoReportPath is not a function` in `routes.test.ts`; in `proxy.test.ts` the demo tests fail (the logged-out home goes to `/login?callbackUrl=%2F`).

- [ ] **Step 4: Add the route**

In `app/_shared/lib/config/routes.ts`, add to `ROUTES` after `REPORT`:

```ts
  // The public demo: the workspace on a saved sample, with nothing live behind it
  DEMO: '/demo',
```

Replace the `PUBLIC_ROUTES` comment and line with:

```ts
// Everything is private (single-admin tool) except these; /report/{token} is checked by
// its signature, and /demo shows only the sample checked into the repo
export const PUBLIC_ROUTES = [ROUTES.LOGIN, API_ROUTES.AUTH, ROUTES.REPORT, ROUTES.DEMO] as const;
```

After `DEFAULT_LOGOUT_REDIRECT`, add:

```ts
// Where the home page sends a visitor who isn't logged in
export const LOGGED_OUT_HOME = ROUTES.DEMO;
```

At the end of the file, add:

```ts
/** A sample audit's PDF report in the demo */
export const demoReportPath = (auditId: string): string => `${ROUTES.DEMO}/report/${encodeURIComponent(auditId)}`;
```

- [ ] **Step 5: Send the logged-out home page to the demo**

In `proxy.ts`, add `LOGGED_OUT_HOME` to the import from `routes`, change the comment above `proxy` to:

```ts
// This proxy handles authentication and route protection.
// The whole app is private except the login page, the login API, report links and the demo.
```

and insert, directly after the `const isLoggedIn = …` line:

```ts
  // The home page shows a visitor who isn't logged in the public demo, not a password form
  if (pathname === ROUTES.HOME && !isLoggedIn) {
    return NextResponse.redirect(new URL(LOGGED_OUT_HOME, request.url));
  }
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run app/_shared/lib/config`
Expected: PASS, all tests in both files.

- [ ] **Step 7: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. No commit (see Global Constraints).

---

### Task 2: Masking

**Files:**
- Create: `app/_shared/lib/demo/mask.ts`
- Test: `app/_shared/lib/demo/__tests__/mask.test.ts`

**Interfaces:**
- Produces: `maskEmail(email: string): string`, `maskPhone(phone: string): string`, `maskText(text: string): string`, `maskDeep<T>(value: T): T`, `findUnmasked(value: unknown): string[]`. The module has no imports (the capture script loads it with plain `node`).

- [ ] **Step 1: Write the failing test**

Create `app/_shared/lib/demo/__tests__/mask.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findUnmasked, maskDeep, maskEmail, maskPhone, maskText } from '@/app/_shared/lib/demo/mask';

describe('maskEmail', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('jane.doe@brightsmile.com')).toBe('j•••@brightsmile.com');
  });

  it('leaves a masked address and a non-address alone', () => {
    expect(maskEmail('j•••@brightsmile.com')).toBe('j•••@brightsmile.com');
    expect(maskEmail('not an email')).toBe('not an email');
  });
});

describe('maskPhone', () => {
  it('keeps the last two digits and the punctuation', () => {
    expect(maskPhone('(713) 555-0142')).toBe('(•••) •••-••42');
    expect(maskPhone('+1 713-555-0142')).toBe('+• •••-•••-••42');
    expect(maskPhone('(•••) •••-••42')).toBe('(•••) •••-••42');
  });
});

describe('maskText', () => {
  it('masks emails and phone numbers inside a sentence, in every usual format', () => {
    expect(maskText('Call (713) 555-0142 or write to office@smile.com today')).toBe(
      'Call (•••) •••-••42 or write to o•••@smile.com today'
    );
    expect(maskText('7135550142')).toBe('••••••••42');
    expect(maskText('713.555.0142')).toBe('•••.•••.••42');
    expect(maskText('Site shows: (713) 555-0142, (713) 555-0199')).toBe('Site shows: (•••) •••-••42, (•••) •••-••99');
  });

  it('leaves dates, scores, sizes and addresses alone', () => {
    for (const text of [
      '2026-09-28T10:22:33.123456+00:00',
      'Largest Contentful Paint 12.8 s',
      '3,450 KiB',
      '1200 Binz St #1090, Houston, TX 77004, USA',
      'Houston, TX 77002-1234',
      'Open 2019-2024, Mon-Fri 800-1700',
      'demo-b12',
    ]) {
      expect(maskText(text)).toBe(text);
    }
  });

  it('masks an email inside a link but leaves the digits of a link alone', () => {
    expect(maskText('https://x.com/?to=bob@x.com')).toBe('https://x.com/?to=b•••@x.com');
    expect(maskText('https://facebook.com/profile.php?id=1000636284')).toBe('https://facebook.com/profile.php?id=1000636284');
  });

  it('gives the same result when run twice', () => {
    const once = maskText('Call (713) 555-0142 or office@smile.com');
    expect(maskText(once)).toBe(once);
  });
});

describe('maskDeep and findUnmasked', () => {
  const value = { email: 'bob@x.com', list: ['7135550142', { note: 'j•••@x.com', score: 72 }], when: '2026-09-28T10:22:33Z', none: null };

  it('finds every readable email and phone number, wherever it is', () => {
    expect(findUnmasked(value)).toEqual(['bob@x.com', '7135550142']);
  });

  it('masks every text in a value and nothing else', () => {
    const masked = maskDeep(value);
    expect(masked).toEqual({ email: 'b•••@x.com', list: ['••••••••42', { note: 'j•••@x.com', score: 72 }], when: '2026-09-28T10:22:33Z', none: null });
    expect(findUnmasked(masked)).toEqual([]);
    expect(value.email).toBe('bob@x.com');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run app/_shared/lib/demo/__tests__/mask.test.ts`
Expected: FAIL, cannot find module `@/app/_shared/lib/demo/mask`.

- [ ] **Step 3: Write the module**

Create `app/_shared/lib/demo/mask.ts`:

```ts
// app/_shared/lib/demo/mask.ts

// Hides the contact details of the businesses shown in the public demo. Used by
// the capture script and by the test that guards the captured file. No imports,
// so the script can load it with plain `node`.

const DOT = '•';
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// 10 digits in the usual groupings, with an optional country code: (713) 555-0142,
// 713.555.0142, +1 713 555 0142, 7135550142. Not part of a longer number or word.
const PHONE = /(?<![\w.])(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;

// Long digit runs in links are ids, not phone numbers
const isLink = (text: string) => /^https?:\/\//i.test(text);

/** jane.doe@brightsmile.com → j•••@brightsmile.com */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 1 ? email : `${email[0]}${DOT.repeat(3)}${email.slice(at)}`;
}

/** (713) 555-0142 → (•••) •••-••42 */
export function maskPhone(phone: string): string {
  const total = phone.replace(/\D/g, '').length;
  let seen = 0;
  return phone.replace(/\d/g, (digit) => (++seen > total - 2 ? digit : DOT));
}

/** Masks every email and phone number inside a text */
export function maskText(text: string): string {
  const masked = text.replace(EMAIL, maskEmail);
  return isLink(text) ? masked : masked.replace(PHONE, maskPhone);
}

/** A copy of a JSON value with every text in it masked */
export function maskDeep<T>(value: T): T {
  if (typeof value === 'string') return maskText(value) as T;
  if (Array.isArray(value)) return value.map(maskDeep) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, maskDeep(item)])) as T;
  }
  return value;
}

/** Every email and phone number still readable anywhere in a JSON value */
export function findUnmasked(value: unknown): string[] {
  if (typeof value === 'string') {
    return [...(value.match(EMAIL) ?? []), ...(isLink(value) ? [] : (value.match(PHONE) ?? []))];
  }
  if (Array.isArray(value)) return value.flatMap(findUnmasked);
  if (value && typeof value === 'object') return Object.values(value).flatMap(findUnmasked);
  return [];
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run app/_shared/lib/demo/__tests__/mask.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

---

### Task 3: The sample data

**Files:**
- Create: `app/_shared/lib/demo/demoSamples.ts`, `app/_shared/lib/demo/demoData.ts`, `scripts/captureDemo.mjs`, `app/_shared/lib/demo/demoData.json` (written by the script)
- Test: `app/_shared/lib/demo/__tests__/demoSamples.test.ts`, `app/_shared/lib/demo/__tests__/demoData.test.ts`

**Interfaces:**
- Consumes: `maskDeep`, `maskEmail`, `maskPhone`, `findUnmasked` from Task 2.
- Produces:
  - `DemoData { capturedAt: string; query: { niche: string; location: string }; leads: BusinessWithData[]; sites: BusinessWithData[]; replayIds: string[] }`
  - `startingLeads(data: DemoData): BusinessWithData[]`, `allSamples(data: DemoData): BusinessWithData[]`, `DEMO_ID_PREFIX = 'demo-'` (all in `demoSamples.ts`)
  - `demoData: DemoData` (in `demoData.ts`, server only)
  - Ids in the file: businesses `demo-b1`…`demo-b10` and `demo-bs1`, audits `demo-a…`, reports `demo-r…`, `search_id: 'demo-search'`.

- [ ] **Step 1: Write the failing test for the helpers**

Create `app/_shared/lib/demo/__tests__/demoSamples.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { allSamples, startingLeads, type DemoData } from '@/app/_shared/lib/demo/demoSamples';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

const business = (id: string) =>
  ({ id, name: id, website: `https://${id}.com`, audit: { id: `a-${id}` }, ai_report: { id: `r-${id}` } }) as BusinessWithData;

const data: DemoData = {
  capturedAt: '2026-10-02T00:00:00Z',
  query: { niche: 'dentists', location: 'houston, tx, usa' },
  leads: [business('b1'), business('b2'), business('b3')],
  sites: [business('s1')],
  replayIds: ['b2'],
};

describe('startingLeads', () => {
  it('holds back the audit and summary of the replay businesses only', () => {
    expect(startingLeads(data).map((b) => [b.id, !!b.audit, !!b.ai_report])).toEqual([
      ['b1', true, true],
      ['b2', false, false],
      ['b3', true, true],
    ]);
  });

  it('leaves the saved sample untouched', () => {
    startingLeads(data);
    expect(data.leads[1].audit).toBeDefined();
  });
});

describe('allSamples', () => {
  it('lists every business with its saved audit, leads then websites', () => {
    expect(allSamples(data).map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 's1']);
    expect(allSamples(data)[1].audit).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run app/_shared/lib/demo/__tests__/demoSamples.test.ts`
Expected: FAIL, cannot find module `@/app/_shared/lib/demo/demoSamples`.

- [ ] **Step 3: Write the helpers**

Create `app/_shared/lib/demo/demoSamples.ts`:

```ts
// app/_shared/lib/demo/demoSamples.ts

// The shape of the public demo's sample data and what is read from it. The data
// itself (demoData.json) is loaded on the server only, in demoData.ts.

import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

export const DEMO_ID_PREFIX = 'demo-';

export interface DemoData {
  /** When the capture script wrote the file */
  capturedAt: string;
  query: { niche: string; location: string };
  /** The sample search, each business with its audit and AI report */
  leads: BusinessWithData[];
  /** The Audit tab's sample websites */
  sites: BusinessWithData[];
  /** Leads shown as "Not audited yet" until the visitor replays their audit */
  replayIds: string[];
}

/** The search as a visitor first sees it: the audits of `replayIds` held back */
export function startingLeads(data: DemoData): BusinessWithData[] {
  const held = new Set(data.replayIds);
  return data.leads.map((business) => (held.has(business.id) ? { ...business, audit: undefined, ai_report: undefined } : business));
}

/** Every sample business with its audit and report: what the replay and the PDFs answer from */
export const allSamples = (data: DemoData): BusinessWithData[] => [...data.leads, ...data.sites];
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run app/_shared/lib/demo/__tests__/demoSamples.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing test that guards the captured file**

Create `app/_shared/lib/demo/__tests__/demoData.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CURRENT_ENGINE_VERSION } from '@/app/_shared/lib/audit/types';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { allSamples, DEMO_ID_PREFIX } from '@/app/_shared/lib/demo/demoSamples';
import { findUnmasked } from '@/app/_shared/lib/demo/mask';

const samples = allSamples(demoData);

describe('the demo capture (demoData.json)', () => {
  it('shows no readable email address or phone number', () => {
    expect(findUnmasked(demoData)).toEqual([]);
  });

  it('carries no outreach history', () => {
    for (const b of samples) {
      expect([b.hubspot_company_id ?? null, b.crm_sent_at ?? null, b.emailed_at ?? null]).toEqual([null, null, null]);
    }
  });

  it('uses demo ids only, linked to each other', () => {
    for (const b of samples) {
      expect(b.id.startsWith(DEMO_ID_PREFIX)).toBe(true);
      expect(b.search_id.startsWith(DEMO_ID_PREFIX)).toBe(true);
      expect(b.audit?.id.startsWith(DEMO_ID_PREFIX)).toBe(true);
      expect(b.audit?.business_id).toBe(b.id);
      expect(b.ai_report?.id.startsWith(DEMO_ID_PREFIX)).toBe(true);
      expect(b.ai_report?.audit_id).toBe(b.audit?.id);
    }
    expect(new Set(samples.map((b) => b.id)).size).toBe(samples.length);
  });

  it('has a website, an audit by the current engine and a summary for every business', () => {
    for (const b of samples) {
      expect(b.website).toBeTruthy();
      expect(b.audit?.engine_version).toBe(CURRENT_ENGINE_VERSION);
      expect(b.ai_report?.summary).toBeTruthy();
    }
  });

  it('is small enough to send with the page', () => {
    expect(demoData.leads.length).toBeGreaterThanOrEqual(2);
    expect(demoData.leads.length).toBeLessThanOrEqual(10);
    expect(demoData.sites.length).toBe(1);
  });

  it('replays only leads of the sample search, and leaves some audited from the start', () => {
    const leadIds = new Set(demoData.leads.map((b) => b.id));
    for (const id of demoData.replayIds) expect(leadIds.has(id)).toBe(true);
    expect(demoData.replayIds.length).toBeGreaterThan(0);
    expect(demoData.replayIds.length).toBeLessThan(demoData.leads.length);
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run app/_shared/lib/demo/__tests__/demoData.test.ts`
Expected: FAIL, cannot find module `@/app/_shared/lib/demo/demoData`.

- [ ] **Step 7: Write the capture script**

Create `scripts/captureDemo.mjs`:

```js
// scripts/captureDemo.mjs

// Writes the public demo's sample data, app/_shared/lib/demo/demoData.json,
// from one saved search and one website of the Audit tab. Run by hand:
//
//   node --env-file=.env.local scripts/captureDemo.mjs                        lists what can be captured
//   node --env-file=.env.local scripts/captureDemo.mjs <search_id> <domain>   writes the file
//
// Emails and phone numbers are masked, outreach history is cleared and database
// ids are replaced, so nothing in the file leads back to a row. Read the file
// through once before committing it.

import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { CURRENT_ENGINE_VERSION } from '../app/_shared/lib/audit/types.ts';
import { DIRECT_AUDIT_SEARCH } from '../app/_shared/lib/config/directAudits.ts';
import { findUnmasked, maskDeep, maskEmail, maskPhone } from '../app/_shared/lib/demo/mask.ts';

// The sample is sent with the page, so it stays small
const LEADS = 10;
const OUT = new URL('../app/_shared/lib/demo/demoData.json', import.meta.url);

function stop(message) {
  console.error(message);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !key) stop('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed: run with --env-file=.env.local');
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// PostgREST embeds a one-to-one row as an object, or as an array on older schemas
const one = (value) => (Array.isArray(value) ? value[0] : (value ?? undefined));

/** A search's businesses in the app's order, each with its audit and AI report */
async function businessesOf(searchId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*, audits (*, ai_reports (*))')
    .eq('search_id', searchId)
    .order('created_at', { ascending: true });
  if (error) stop(`Couldn't read the businesses: ${error.message}`);
  return data.map(({ audits, ...business }) => {
    const row = one(audits);
    if (!row) return business;
    const { ai_reports, ...audit } = row;
    return { ...business, audit, ai_report: one(ai_reports) };
  });
}

// Worth showing: a website, a current audit with its speed measured, and a summary
const isReady = (b) =>
  !!b.website && b.audit?.engine_version === CURRENT_ENGINE_VERSION && b.audit.performance_score !== null && !!b.ai_report;

const isDirect = (search) => search.niche === DIRECT_AUDIT_SEARCH.niche && search.location === DIRECT_AUDIT_SEARCH.location;

async function allSearches() {
  const { data, error } = await supabase
    .from('searches')
    .select('id, niche, location, created_at')
    .order('created_at', { ascending: false });
  if (error) stop(`Couldn't read the searches: ${error.message}`);
  return data;
}

async function list(searches) {
  console.log('Saved searches (id | search | businesses ready to show):');
  for (const search of searches.filter((s) => !isDirect(s))) {
    const ready = (await businessesOf(search.id)).filter(isReady).length;
    if (ready > 0) console.log(`  ${search.id} | ${search.niche} in ${search.location} | ${ready}`);
  }
  console.log('\nWebsites in the Audit tab ready to show:');
  for (const search of searches.filter(isDirect)) {
    for (const site of (await businessesOf(search.id)).filter(isReady)) console.log(`  ${site.website}`);
  }
  console.log('\nThen: node --env-file=.env.local scripts/captureDemo.mjs <search_id> <domain>');
}

/** One business as the demo shows it: new ids, masked contacts, no outreach history */
function sample(source, key) {
  const business = structuredClone(source);
  business.id = `demo-b${key}`;
  business.search_id = 'demo-search';
  business.email = business.email && maskEmail(business.email);
  business.phone = business.phone && maskPhone(business.phone);
  business.hubspot_company_id = null;
  business.crm_sent_at = null;
  business.emailed_at = null;
  business.audit.id = `demo-a${key}`;
  business.audit.business_id = business.id;
  const site = business.audit.checks?.geo?.nap?.site;
  if (site?.phones) site.phones = site.phones.map(maskPhone);
  business.ai_report.id = `demo-r${key}`;
  business.ai_report.audit_id = business.audit.id;
  // Whatever else mentions a contact: finding details, page titles, the AI's text
  return maskDeep(business);
}

const [searchId, domain] = process.argv.slice(2);
const searches = await allSearches();
if (!searchId || !domain) {
  await list(searches);
  process.exit(0);
}

const search = searches.find((s) => s.id === searchId);
if (!search) stop(`No saved search has the id ${searchId}`);
const leads = (await businessesOf(searchId)).filter(isReady).slice(0, LEADS);
if (leads.length < 2) stop('That search has fewer than 2 businesses ready to show (website, current audit, summary)');

const direct = searches.filter(isDirect);
const sites = (await Promise.all(direct.map((s) => businessesOf(s.id)))).flat().filter(isReady);
const site = sites.find((b) => b.website.includes(domain));
if (!site) stop(`No audited website matching "${domain}" in the Audit tab`);

const data = {
  capturedAt: new Date().toISOString(),
  query: { niche: search.niche, location: search.location },
  leads: leads.map((business, i) => sample(business, String(i + 1))),
  sites: [sample(site, 's1')],
  // Every second lead starts as "Not audited yet"; edit the list by hand to taste
  replayIds: leads.map((_, i) => `demo-b${i + 1}`).filter((_, i) => i % 2 === 1),
};

const readable = findUnmasked(data);
if (readable.length > 0) stop(`Not written: ${readable.length} contact details are still readable, the first being ${readable[0]}`);

const json = `${JSON.stringify(data, null, 2)}\n`;
writeFileSync(OUT, json);
console.log(`Wrote ${data.leads.length} leads and 1 website (${Math.round(json.length / 1024)} kB) to ${OUT.pathname}`);
console.log('Read it through once before committing it.');
```

- [ ] **Step 8: List what can be captured**

Run: `node --env-file=.env.local scripts/captureDemo.mjs`
Expected: a list of saved searches with their ready counts, the two Audit-tab websites, and the usage line. (On 2026-10-02: "cosmetic dentist in houston, tx, usa", id `01e20514-e966-47f0-9f52-6bbff307727e`, has 47 ready; the websites are `https://devartventures.com` and `https://cosmeticdentistshouston.com`.)

- [ ] **Step 9: Capture, with the search and website the user chose**

The user picks both at plan review. With the suggested pair:

Run: `node --env-file=.env.local scripts/captureDemo.mjs 01e20514-e966-47f0-9f52-6bbff307727e cosmeticdentistshouston.com`
Expected: `Wrote 10 leads and 1 website (… kB) to …/app/_shared/lib/demo/demoData.json`, somewhere between 100 and 200 kB (the same data is about 85 kB without the indentation).

Then read `app/_shared/lib/demo/demoData.json` through once: business names and websites are real, every `email` and `phone` shows `•`, ids start with `demo-`.

- [ ] **Step 10: Load the file**

Create `app/_shared/lib/demo/demoData.ts`:

```ts
// app/_shared/lib/demo/demoData.ts

// The public demo's sample data, written by scripts/captureDemo.mjs. Import it
// on the server only (the demo page and its PDF route): a client import would
// put the whole file in the browser's JavaScript as well.

import data from '@/app/_shared/lib/demo/demoData.json';
import type { DemoData } from '@/app/_shared/lib/demo/demoSamples';

export const demoData = data as unknown as DemoData;
```

- [ ] **Step 11: Run the guard test**

Run: `npx vitest run app/_shared/lib/demo`
Expected: PASS, all three files.

- [ ] **Step 12: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

---

### Task 4: Replay

**Files:**
- Create: `app/_shared/lib/demo/replay.ts`
- Test: `app/_shared/lib/demo/__tests__/replay.test.ts`

**Interfaces:**
- Consumes: `Post` (`(path: string, body: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown }>`) and `auditBusiness` from `@/app/_shared/lib/utils/bulkAudit`; `API_ROUTES`.
- Produces: `REPLAY_WAIT = { auditMs: 4000, reportMs: 2500 }`; `replayPost(samples: BusinessWithData[], wait?: { auditMs: number; reportMs: number }): Post`. An audit request (`{ business_id }`) answers `{ ok: true, data: { audit } }`; a summary request (`{ audit_id }`) answers `{ ok: true, data: { ai_report } }`; anything missing answers `{ ok: false, data: { error } }`.

- [ ] **Step 1: Write the failing test**

Create `app/_shared/lib/demo/__tests__/replay.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { REPLAY_WAIT, replayPost } from '@/app/_shared/lib/demo/replay';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { auditBusiness, type BulkState } from '@/app/_shared/lib/utils/bulkAudit';
import type { AiReport, Audit, BusinessWithData } from '@/app/_shared/lib/types/auditely';

const NO_WAIT = { auditMs: 0, reportMs: 0 };
const AUDIT = { id: 'demo-a1', business_id: 'demo-b1' } as Audit;
const REPORT = { id: 'demo-r1', audit_id: 'demo-a1' } as AiReport;
const LONE_AUDIT = { id: 'demo-a3', business_id: 'demo-b3' } as Audit;
const samples = [
  { id: 'demo-b1', website: 'https://one.com', audit: AUDIT, ai_report: REPORT },
  { id: 'demo-b2', website: 'https://two.com' },
  { id: 'demo-b3', website: 'https://three.com', audit: LONE_AUDIT },
] as BusinessWithData[];
const post = replayPost(samples, NO_WAIT);
const errorOf = (res: { data: unknown }) => (res.data as { error: string }).error;

afterEach(() => vi.useRealTimers());

describe('replayPost', () => {
  it('answers an audit request with the saved audit, in the real route\'s shape', async () => {
    expect(await post(API_ROUTES.AUDIT, { business_id: 'demo-b1', force: false })).toEqual({ ok: true, data: { audit: AUDIT } });
  });

  it('answers a summary request with the saved report', async () => {
    expect(await post(API_ROUTES.GENERATE, { audit_id: 'demo-a1' })).toEqual({ ok: true, data: { ai_report: REPORT } });
  });

  it('fails with a reason for a business that has no saved audit, or that it does not know', async () => {
    for (const id of ['demo-b2', 'someone-else']) {
      const res = await post(API_ROUTES.AUDIT, { business_id: id });
      expect(res.ok).toBe(false);
      expect(errorOf(res)).toBe('This business has no saved audit to replay.');
    }
  });

  it('fails with a reason for an audit that has no saved summary', async () => {
    const res = await post(API_ROUTES.GENERATE, { audit_id: 'demo-a3' });
    expect(res.ok).toBe(false);
    expect(errorOf(res)).toBe('This audit has no saved summary to replay.');
  });

  it('answers no other route', async () => {
    for (const path of [API_ROUTES.SEARCH, API_ROUTES.FIND_EMAILS, API_ROUTES.SEND_EMAIL, API_ROUTES.CRM, API_ROUTES.PDF]) {
      expect((await post(path, {})).ok).toBe(false);
    }
  });

  it('waits before answering, so the progress can be seen', async () => {
    vi.useFakeTimers();
    expect(REPLAY_WAIT).toEqual({ auditMs: 4000, reportMs: 2500 });
    let answered = false;
    const pending = replayPost(samples)(API_ROUTES.AUDIT, { business_id: 'demo-b1' }).then(() => {
      answered = true;
    });
    await vi.advanceTimersByTimeAsync(3999);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(answered).toBe(true);
  });
});

describe('"Audit all" on the replay', () => {
  const run = async (business: BusinessWithData) => {
    const onUpdate = vi.fn();
    const stages: BulkState[] = [];
    await auditBusiness(business, { post, onUpdate, onStage: (_id, state) => stages.push(state) });
    return { onUpdate, stages };
  };

  it('takes a business through the real steps to its saved audit and summary', async () => {
    const { onUpdate, stages } = await run({ ...samples[0], audit: undefined, ai_report: undefined });
    expect(stages.map((s) => s.stage)).toEqual(['auditing', 'writing', 'done']);
    expect(onUpdate.mock.calls).toEqual([
      ['demo-b1', { audit: AUDIT }],
      ['demo-b1', { ai_report: REPORT }],
    ]);
  });

  it('marks a business it cannot replay as failed, with the reason', async () => {
    const { stages } = await run(samples[1]);
    expect(stages.at(-1)).toEqual({ stage: 'failed', error: 'This business has no saved audit to replay.' });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run app/_shared/lib/demo/__tests__/replay.test.ts`
Expected: FAIL, cannot find module `@/app/_shared/lib/demo/replay`.

- [ ] **Step 3: Write the module**

Create `app/_shared/lib/demo/replay.ts`:

```ts
// app/_shared/lib/demo/replay.ts

// The public demo's stand-in for the audit and summary requests: it answers
// from the saved sample, in the shape the real routes use, after a wait long
// enough to watch. A card and "Audit all" run their usual steps on top of it.

import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';
import type { Post } from '@/app/_shared/lib/utils/bulkAudit';

// A live audit takes about a minute; the replay is shortened
export const REPLAY_WAIT = { auditMs: 4000, reportMs: 2500 };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const failed = (error: string) => ({ ok: false, data: { error } });

export function replayPost(samples: BusinessWithData[], wait: typeof REPLAY_WAIT = REPLAY_WAIT): Post {
  return async (path, body) => {
    if (path === API_ROUTES.AUDIT) {
      const audit = samples.find((b) => b.id === body.business_id)?.audit;
      await sleep(wait.auditMs);
      return audit ? { ok: true, data: { audit } } : failed('This business has no saved audit to replay.');
    }
    if (path === API_ROUTES.GENERATE) {
      const report = samples.find((b) => b.audit?.id === body.audit_id)?.ai_report;
      await sleep(wait.reportMs);
      return report ? { ok: true, data: { ai_report: report } } : failed('This audit has no saved summary to replay.');
    }
    return failed("The demo doesn't run this.");
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run app/_shared/lib/demo/__tests__/replay.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

---

### Task 5: The sample audits' PDFs

**Files:**
- Create: `app/_shared/lib/audit/pdfRender.ts`, `app/demo/report/[auditId]/route.ts`
- Modify: `app/_shared/lib/audit/auditPdf.ts`, `app/_shared/lib/audit/reportData.ts:106-111`, `app/_shared/components/auditely/pdfDocument/pdfDocument.tsx:89,200-211`
- Test: `app/_shared/lib/audit/__tests__/pdfRender.test.ts` (create), `app/_shared/lib/audit/__tests__/reportData.test.ts` (modify), `app/demo/report/[auditId]/__tests__/route.test.ts` (create)

**Interfaces:**
- Consumes: `demoData` (Task 3), `allSamples` (Task 3), `demoReportPath` only by convention (the route lives at `/demo/report/[auditId]`).
- Produces: `renderPdf(audit: AuditLike, business: PdfBusiness, report: { summary: string; improvements: unknown }, contact: PdfContact | null): Promise<Buffer>`; `pdfFileName(businessName: string): string`; `PdfBusiness = { name: string; website: string | null; address: string; phone: string | null }`. `buildPdfProps` and `PdfDocumentProps.contact` accept `null` (no "next step" box, no contact in the footer). `GET /demo/report/{auditId}` answers the PDF for a sample audit id and 404 for anything else.

- [ ] **Step 1: Add the failing test for a report without a contact**

In `app/_shared/lib/audit/__tests__/reportData.test.ts`, inside `describe('buildPdfProps', …)`, after the last test (the one ending `.contact).toEqual(withBooking);`), add:

```ts
  it('builds a report without a contact, for the public demo', () => {
    expect(buildPdfProps(audit, business, noReport, null).contact).toBeNull();
  });
```

- [ ] **Step 2: Write the failing test for the renderer**

Create `app/_shared/lib/audit/__tests__/pdfRender.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pdfFileName, renderPdf } from '@/app/_shared/lib/audit/pdfRender';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';

const audit: AuditLike = {
  created_at: '2026-09-23T12:00:00Z',
  performance_score: 42,
  seo_score: 80,
  mobile_score: 38,
  ssl_valid: true,
  geo_score: 25,
  aeo_score: 40,
  raw_json: {},
  checks: {},
  engine_version: 2,
};
const business = { name: 'Smile Dental', website: 'https://smiledental.com', address: '123 Main St', phone: '(•••) •••-••42' };
const report = { summary: 'Slow site.', improvements: ['Compress images'] };
const contact = { name: 'Numan', phone: null, email: 'contact@devartventures.com', bookingUrl: 'https://calendly.com/x/30min' };

describe('renderPdf', () => {
  it('draws a PDF with the contact box, and a shorter one without it', async () => {
    const withContact = await renderPdf(audit, business, report, contact);
    const without = await renderPdf(audit, business, report, null);
    expect(withContact.subarray(0, 5).toString()).toBe('%PDF-');
    expect(without.subarray(0, 5).toString()).toBe('%PDF-');
    expect(without.length).toBeLessThan(withContact.length);
  }, 30_000);
});

describe('pdfFileName', () => {
  it('names the file after the business, in lowercase with dashes', () => {
    expect(pdfFileName('Smile Dental & Co.')).toBe('audit-smile-dental-co-.pdf');
  });
});
```

- [ ] **Step 3: Run both to see them fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/pdfRender.test.ts app/_shared/lib/audit/__tests__/reportData.test.ts`
Expected: FAIL. `pdfRender` cannot be found; in `reportData.test.ts` TypeScript objects to `null` only at type-check time, so run `npx tsc --noEmit` too and expect an error on the new test's `null` argument.

- [ ] **Step 4: Let the report go without a contact**

In `app/_shared/lib/audit/reportData.ts`, change the last parameter of `buildPdfProps`:

```ts
export function buildPdfProps(
  audit: AuditLike,
  business: { name: string; website: string | null; address: string; phone: string | null },
  report: { summary: string; improvements: unknown },
  // null: no "next step" box (the public demo)
  contact: PdfContact | null
): PdfDocumentProps {
```

In `app/_shared/components/auditely/pdfDocument/pdfDocument.tsx`, change the prop type:

```ts
  /** null leaves out the "next step" box and the footer's contact */
  contact: PdfContact | null;
```

and replace the `<NextStepSection contact={contact} />` line and the footer after it with:

```tsx
        {contact && <NextStepSection contact={contact} />}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Powered by{' '}
            <Link src="https://devartventures.com" style={styles.link}>devartventures.com</Link>
          </Text>
          {contact && (
            <Text style={styles.footerText}>
              <Link src={`mailto:${contact.email}`} style={styles.link}>{contact.email}</Link>
            </Text>
          )}
        </View>
```

- [ ] **Step 5: Split the rendering from the lookup**

Create `app/_shared/lib/audit/pdfRender.ts`:

```ts
// app/_shared/lib/audit/pdfRender.ts

// Draws an audit's PDF report from data already in hand. No database: the
// download and the report link look the audit up first (auditPdf.ts), the
// public demo passes its saved sample. Server-only.

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { PdfDocument, type PdfContact } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps, type AuditLike } from '@/app/_shared/lib/audit/reportData';

export interface PdfBusiness {
  name: string;
  website: string | null;
  address: string;
  phone: string | null;
}

export const pdfFileName = (businessName: string): string =>
  `audit-${businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().replace(/-+/g, '-')}.pdf`;

/** @param contact null leaves out the "next step" box */
export function renderPdf(
  audit: AuditLike,
  business: PdfBusiness,
  report: { summary: string; improvements: unknown },
  contact: PdfContact | null
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(createElement(PdfDocument, buildPdfProps(audit, business, report, contact)) as any);
}
```

Replace `app/_shared/lib/audit/auditPdf.ts` with:

```ts
// app/_shared/lib/audit/auditPdf.ts

// An audit's PDF report, built from its stored data and newest AI report. Used
// by the download (/api/pdf) and the private report link (/report/{token}).
// Server-only.

import { supabase } from '@/app/_shared/lib/supabase/client';
import { pdfFileName, renderPdf, type PdfBusiness } from '@/app/_shared/lib/audit/pdfRender';
import { reportContact } from '@/app/_shared/lib/config/reportContact';

export type AuditPdfResult =
  | { ok: true; pdf: Buffer; filename: string }
  | { ok: false; status: 404 | 500; error: string };

export async function renderAuditPdf(auditId: string): Promise<AuditPdfResult> {
  const { data: audit } = await supabase.from('audits').select('*, businesses(*)').eq('id', auditId).single();
  if (!audit) return { ok: false, status: 404, error: 'Audit not found' };

  const { data: aiReport } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!aiReport) return { ok: false, status: 404, error: 'AI report not found — generate the report first' };

  const business = audit.businesses as PdfBusiness;
  try {
    const pdf = await renderPdf(audit, business, aiReport, reportContact());
    return { ok: true, pdf, filename: pdfFileName(business.name) };
  } catch {
    return { ok: false, status: 500, error: 'Failed to generate PDF' };
  }
}
```

- [ ] **Step 6: Run the renderer tests**

Run: `npx vitest run app/_shared/lib/audit/__tests__/pdfRender.test.ts app/_shared/lib/audit/__tests__/reportData.test.ts app/api/pdf app/report app/api/send-email`
Expected: PASS (the three route test files mock `auditPdf` and must still pass).

- [ ] **Step 7: Write the failing test for the demo's PDF route**

Create `app/demo/report/[auditId]/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET, generateStaticParams } from '@/app/demo/report/[auditId]/route';
import { renderPdf } from '@/app/_shared/lib/audit/pdfRender';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { allSamples } from '@/app/_shared/lib/demo/demoSamples';

// Nothing here may load the database client: without its settings (as in this
// test run) importing it throws, which would fail this file at import.
vi.mock('@/app/_shared/lib/audit/pdfRender', async (original) => ({
  ...(await original<typeof import('@/app/_shared/lib/audit/pdfRender')>()),
  renderPdf: vi.fn(async () => Buffer.from('%PDF-1.4')),
}));

const open = (auditId: string) =>
  GET(new Request(`http://localhost/demo/report/${auditId}`), { params: Promise.resolve({ auditId }) });
const first = demoData.leads[0];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(renderPdf).mockClear();
});

describe('GET /demo/report/[auditId]', () => {
  it('is built ahead for every sample audit', () => {
    expect(generateStaticParams()).toEqual(allSamples(demoData).map((b) => ({ auditId: b.audit!.id })));
  });

  it("downloads a sample audit's PDF, without the contact box", async () => {
    const res = await open(first.audit!.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="audit-[a-z0-9-]+\.pdf"$/);
    expect(vi.mocked(renderPdf).mock.calls[0][3]).toBeNull();
  });

  it('adds the contact box when DEMO_PDF_CONTACT is switched on', async () => {
    vi.stubEnv('DEMO_PDF_CONTACT', '1');
    await open(first.audit!.id);
    expect(vi.mocked(renderPdf).mock.calls[0][3]).toMatchObject({ email: expect.any(String) });
  });

  it('answers 404 for anything that is not a sample audit, without drawing a PDF', async () => {
    for (const id of ['demo-a999', '3f2b7c1e-8a4d-4f6b-9c2e-1d5a7b9e0c3f', '']) {
      expect((await open(id)).status).toBe(404);
    }
    expect(renderPdf).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: Run it to see it fail**

Run: `npx vitest run "app/demo/report/[auditId]/__tests__/route.test.ts"`
Expected: FAIL, cannot find module `@/app/demo/report/[auditId]/route`.

- [ ] **Step 9: Write the route**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md` (section "With Route Handlers") first. Create `app/demo/report/[auditId]/route.ts`:

```ts
// app/demo/report/[auditId]/route.ts

// The PDF reports of the public demo's sample audits. Built ahead, at build
// time, from the saved sample: no database, and nothing to pay per download.
// Any id that isn't a sample audit is a 404.

import { pdfFileName, renderPdf } from '@/app/_shared/lib/audit/pdfRender';
import { reportContact } from '@/app/_shared/lib/config/reportContact';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { allSamples } from '@/app/_shared/lib/demo/demoSamples';

export const dynamic = 'force-static';
export const dynamicParams = false;

const samples = allSamples(demoData).filter((b) => b.audit && b.ai_report);

export function generateStaticParams() {
  return samples.map((b) => ({ auditId: b.audit!.id }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const business = samples.find((b) => b.audit?.id === auditId);
  if (!business?.audit || !business.ai_report) return new Response('Report not found', { status: 404 });

  // Off by default: Upwork restricts sharing contact details before a contract
  const contact = process.env.DEMO_PDF_CONTACT === '1' ? reportContact() : null;
  const pdf = await renderPdf(business.audit, business, business.ai_report, contact);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdfFileName(business.name)}"`,
    },
  });
}
```

- [ ] **Step 10: Run the route test**

Run: `npx vitest run "app/demo/report/[auditId]/__tests__/route.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 11: Checkpoint**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no errors, every test passes.

---

### Task 6: The demo's context, notice and banner

**Files:**
- Create: `app/_shared/lib/demo/demoLinks.ts`, `app/_shared/lib/hooks/useDemo.ts`, `app/_shared/components/providers/DemoProvider.tsx`, `app/_shared/components/auditely/demoNoticeModal/demoNoticeModal.tsx`, `app/_shared/components/auditely/demoBanner/demoBanner.tsx`
- Test: `app/_shared/lib/demo/__tests__/demoLinks.test.ts`

**Interfaces:**
- Consumes: `DemoData`, `allSamples` (Task 3); `replayPost` (Task 4); `Post` from `utils/bulkAudit`.
- Produces:
  - `DemoLinks { videoUrl: string | null; contactUrl: string | null }`, `demoLinks(env?): DemoLinks`
  - `DemoAction = 'search' | 'auditUrl' | 'reaudit' | 'findEmail' | 'sendEmail' | 'crm' | 'export'`
  - `Demo { data: DemoData; links: DemoLinks; replay: Post; restrict: (action: DemoAction) => void }`
  - `useDemo(): Demo | null` (null in the real app), `DemoContext`
  - `<DemoProvider data links>{children}</DemoProvider>`, `<DemoNoticeModal action links onClose />`, `<DemoBanner />`

- [ ] **Step 1: Write the failing test for the links**

Create `app/_shared/lib/demo/__tests__/demoLinks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { demoLinks } from '@/app/_shared/lib/demo/demoLinks';

describe('demoLinks', () => {
  it('reads the walkthrough and contact links, trimmed', () => {
    expect(demoLinks({ DEMO_VIDEO_URL: ' https://www.loom.com/share/abc ', DEMO_CONTACT_URL: 'https://www.upwork.com/freelancers/~01' })).toEqual({
      videoUrl: 'https://www.loom.com/share/abc',
      contactUrl: 'https://www.upwork.com/freelancers/~01',
    });
  });

  it('has no links when nothing is set', () => {
    expect(demoLinks({})).toEqual({ videoUrl: null, contactUrl: null });
    expect(demoLinks({ DEMO_VIDEO_URL: '', DEMO_CONTACT_URL: '   ' })).toEqual({ videoUrl: null, contactUrl: null });
  });

  it('drops anything that is not a web link', () => {
    for (const value of ['javascript:alert(1)', 'loom.com/share/abc', 'mailto:me@example.com', 'data:text/html,hi', 'not a link']) {
      expect(demoLinks({ DEMO_VIDEO_URL: value, DEMO_CONTACT_URL: value })).toEqual({ videoUrl: null, contactUrl: null });
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run app/_shared/lib/demo/__tests__/demoLinks.test.ts`
Expected: FAIL, cannot find module `@/app/_shared/lib/demo/demoLinks`.

- [ ] **Step 3: Write the links module**

Create `app/_shared/lib/demo/demoLinks.ts`:

```ts
// app/_shared/lib/demo/demoLinks.ts

// The public demo's optional links, from the environment. Read on the server
// (app/demo/page.tsx) and handed to the page.

export interface DemoLinks {
  /** The recorded walkthrough (DEMO_VIDEO_URL) */
  videoUrl: string | null;
  /** Where "Get in touch" leads (DEMO_CONTACT_URL) */
  contactUrl: string | null;
}

// Web links only: these end up in an href on a public page
function webLink(value: string | undefined): string | null {
  const link = value?.trim();
  if (!link) return null;
  try {
    return ['http:', 'https:'].includes(new URL(link).protocol) ? link : null;
  } catch {
    return null;
  }
}

export const demoLinks = (env: Record<string, string | undefined> = process.env): DemoLinks => ({
  videoUrl: webLink(env.DEMO_VIDEO_URL),
  contactUrl: webLink(env.DEMO_CONTACT_URL),
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run app/_shared/lib/demo/__tests__/demoLinks.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the context hook**

Create `app/_shared/lib/hooks/useDemo.ts`:

```ts
// app/_shared/lib/hooks/useDemo.ts

'use client';

import { createContext, useContext } from 'react';
import type { DemoLinks } from '@/app/_shared/lib/demo/demoLinks';
import type { DemoData } from '@/app/_shared/lib/demo/demoSamples';
import type { Post } from '@/app/_shared/lib/utils/bulkAudit';

/** What the demo doesn't run: each opens the notice instead */
export type DemoAction = 'search' | 'auditUrl' | 'reaudit' | 'findEmail' | 'sendEmail' | 'crm' | 'export';

export interface Demo {
  data: DemoData;
  links: DemoLinks;
  /** Answers audit and summary requests from the saved sample (see demo/replay.ts) */
  replay: Post;
  /** Opens the notice for an action the demo doesn't run */
  restrict: (action: DemoAction) => void;
}

export const DemoContext = createContext<Demo | null>(null);

/**
 * The public demo's sample data and stand-ins, or null in the real app.
 * Anything that would call the API asks this first.
 */
export const useDemo = (): Demo | null => useContext(DemoContext);
```

- [ ] **Step 6: Write the notice**

Create `app/_shared/components/auditely/demoNoticeModal/demoNoticeModal.tsx`:

```tsx
// app/_shared/components/auditely/demoNoticeModal/demoNoticeModal.tsx

'use client';

import { Button } from '@/app/_shared/components/ui/button/button';
import { Modal } from '@/app/_shared/components/ui/modal/modal';
import type { DemoLinks } from '@/app/_shared/lib/demo/demoLinks';
import type { DemoAction } from '@/app/_shared/lib/hooks/useDemo';

// What each button does in the full app
const IN_THE_APP: Record<DemoAction, string> = {
  search: 'In the full app, Find leads searches Google for every business of that type in the area and lists them with their contact details.',
  auditUrl: 'In the full app, this audits any website you paste in about a minute, or finds its email address without a full audit.',
  reaudit: 'In the full app, Re-audit measures the website again and rewrites the summary and the outreach email.',
  findEmail: "In the full app, Find email searches the business's website and email databases for an address.",
  sendEmail: 'In the full app, this opens the outreach email to review, edit and send, with the PDF report attached.',
  crm: 'In the full app, this creates the company in HubSpot with the audit and a link to its PDF report.',
  export: 'In the full app, the list exports to CSV or straight into Google Sheets.',
};

const LINK = 'font-medium text-[var(--color-primary-600)] hover:underline';

interface DemoNoticeModalProps {
  action: DemoAction;
  links: DemoLinks;
  onClose: () => void;
}

/** Shown when a visitor to the public demo presses something that only runs in the full app */
export function DemoNoticeModal({ action, links, onClose }: DemoNoticeModalProps) {
  return (
    <Modal isOpen onClose={onClose} size="md">
      <Modal.Header title="Live generation is switched off in this demo" onClose={onClose} />
      <Modal.Content>
        <div className="space-y-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          <p>{IN_THE_APP[action]}</p>
          <p>Here you can explore a real saved search, replay its audits and download the PDF reports.</p>
          <p>
            Want to see it run live?{' '}
            {links.contactUrl ? (
              <>
                <a href={links.contactUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                  Get in touch
                </a>{' '}
                and I&apos;ll walk you through it.
              </>
            ) : (
              <>Message me on Upwork and I&apos;ll walk you through it.</>
            )}
          </p>
          {links.videoUrl && (
            <p>
              <a href={links.videoUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                Watch the 45-second walkthrough
              </a>
            </p>
          )}
        </div>
      </Modal.Content>
      <Modal.Footer>
        <Button variant="primary" size="sm" onClick={onClose}>
          Got it
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
```

- [ ] **Step 7: Write the provider**

Create `app/_shared/components/providers/DemoProvider.tsx`:

```tsx
// app/_shared/components/providers/DemoProvider.tsx

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { DemoNoticeModal } from '@/app/_shared/components/auditely/demoNoticeModal/demoNoticeModal';
import type { DemoLinks } from '@/app/_shared/lib/demo/demoLinks';
import { allSamples, type DemoData } from '@/app/_shared/lib/demo/demoSamples';
import { replayPost } from '@/app/_shared/lib/demo/replay';
import { DemoContext, type Demo, type DemoAction } from '@/app/_shared/lib/hooks/useDemo';

interface DemoProviderProps {
  /** The saved sample, loaded on the server */
  data: DemoData;
  links: DemoLinks;
  children: ReactNode;
}

/** Puts everything inside it in demo mode: sample data, replayed audits, and a notice instead of live actions */
export function DemoProvider({ data, links, children }: DemoProviderProps) {
  const [restricted, setRestricted] = useState<DemoAction | null>(null);
  const demo = useMemo<Demo>(
    () => ({ data, links, replay: replayPost(allSamples(data)), restrict: setRestricted }),
    [data, links]
  );

  return (
    <DemoContext.Provider value={demo}>
      {children}
      {restricted && <DemoNoticeModal action={restricted} links={links} onClose={() => setRestricted(null)} />}
    </DemoContext.Provider>
  );
}
```

- [ ] **Step 8: Write the banner**

Create `app/_shared/components/auditely/demoBanner/demoBanner.tsx`:

```tsx
// app/_shared/components/auditely/demoBanner/demoBanner.tsx

'use client';

import { useDemo } from '@/app/_shared/lib/hooks/useDemo';

/** Tells a visitor they are looking at the public demo; nothing in the real app */
export function DemoBanner() {
  const demo = useDemo();
  if (!demo) return null;

  return (
    <div role="note" className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <p className="mx-auto max-w-5xl px-4 py-2 text-sm text-[var(--color-text-secondary)] sm:px-6">
        <span className="font-medium text-[var(--color-text-primary)]">Demo:</span> a real search with contact details
        hidden. Live search and audits are switched off.
        {demo.links.videoUrl && (
          <>
            {' '}
            <a
              href={demo.links.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap font-medium text-[var(--color-primary-600)] hover:underline"
            >
              Watch the 45-second walkthrough
            </a>
          </>
        )}
      </p>
    </div>
  );
}
```

- [ ] **Step 9: Checkpoint**

Run: `npx tsc --noEmit && npm run lint && npx vitest run app/_shared/lib/demo`
Expected: no errors, the demo tests pass. (The components are first seen in the browser in Task 7.)

---

### Task 7: The demo page, on the shared workspace

**Files:**
- Create: `app/_shared/components/auditely/workspace/workspace.tsx`, `app/demo/page.tsx`
- Modify: `app/page.tsx`, `app/_shared/lib/hooks/useBusinessList.ts:8-9`, `app/_shared/lib/hooks/useLeadSearch.ts`, `app/_shared/lib/hooks/useEmailDiscovery.ts:71-93,150`, `app/_shared/lib/hooks/useUrlAudits.ts`, `app/_shared/components/auditely/leadSearchForm/leadSearchForm.tsx`, `app/_shared/components/auditely/urlAuditForm/urlAuditForm.tsx`, `app/_shared/components/auditely/urlAuditPanel/urlAuditPanel.tsx`, `app/_shared/components/auditely/businessCard/businessCard.tsx`, `app/_shared/components/auditely/appHeader/appHeader.tsx`

**Interfaces:**
- Consumes: `useDemo`, `DemoProvider`, `DemoBanner` (Task 6); `demoData`, `startingLeads` (Task 3); `demoLinks` (Task 6); `ROUTES.DEMO` (Task 1).
- Produces: `<Workspace />`; `useBusinessList(initial?)`; `useEmailDiscovery(businesses, onContactsFound, runKey, enabled = true)`; `BusinessCard` prop `defaultOpen?: boolean`.

- [ ] **Step 1: Move the home page body into a shared component**

Create `app/_shared/components/auditely/workspace/workspace.tsx` with the current body of `app/page.tsx`, the component renamed and the banner added:

```tsx
// app/_shared/components/auditely/workspace/workspace.tsx

'use client';

import { useState } from 'react';
import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';
import { DemoBanner } from '@/app/_shared/components/auditely/demoBanner/demoBanner';
import { LeadSearchForm } from '@/app/_shared/components/auditely/leadSearchForm/leadSearchForm';
import { LeadResults } from '@/app/_shared/components/auditely/leadResults/leadResults';
import { ModeTabs, panelId, tabId, type WorkspaceMode } from '@/app/_shared/components/auditely/modeTabs/modeTabs';
import { RecentSearches } from '@/app/_shared/components/auditely/recentSearches/recentSearches';
import { ResultsSkeleton } from '@/app/_shared/components/auditely/resultsSkeleton/resultsSkeleton';
import { UrlAuditPanel } from '@/app/_shared/components/auditely/urlAuditPanel/urlAuditPanel';
import { useLeadSearch } from '@/app/_shared/lib/hooks/useLeadSearch';

const INTRO: Record<WorkspaceMode, string> = {
  leads: 'Search local businesses, audit their websites and get a ready-to-send outreach email for each one.',
  audit: 'Paste any website to check its speed, SEO, mobile experience, SSL and AI-search readiness.',
};

/** The home page: "Find leads" and "Audit a website". The public demo renders it inside DemoProvider. */
export function Workspace() {
  const [mode, setMode] = useState<WorkspaceMode>('leads');
  // The audit tab loads its list the first time it's opened, then stays mounted
  const [auditOpened, setAuditOpened] = useState(false);
  const leads = useLeadSearch();

  const changeMode = (next: WorkspaceMode) => {
    setMode(next);
    if (next === 'audit') setAuditOpened(true);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppHeader />
      <DemoBanner />

      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <section className="pb-7 pt-10 sm:pt-16">
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--color-text-primary)] sm:text-[3.25rem]">
            Find your next client
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--color-text-secondary)]">{INTRO[mode]}</p>
        </section>

        <ModeTabs value={mode} onChange={changeMode} />

        <div id={panelId('leads')} role="tabpanel" aria-labelledby={tabId('leads')} hidden={mode !== 'leads'} className="mt-3">
          <LeadSearchForm onSearch={leads.search} isLoading={leads.isSearching} />
          {leads.error && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {leads.error}
            </p>
          )}

          {leads.isSearching ? (
            <ResultsSkeleton label="Finding businesses" />
          ) : !leads.hasSearched ? (
            !leads.error && <RecentSearches onOpen={leads.openSaved} />
          ) : leads.businesses.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-[var(--color-border-hover)] px-6 py-12 text-center">
              <p className="font-medium text-[var(--color-text-primary)]">No businesses found</p>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
                Try a broader business type, or a nearby larger city.
              </p>
            </div>
          ) : (
            <LeadResults
              key={leads.runKey}
              businesses={leads.businesses}
              query={leads.query}
              discovery={leads.discovery}
              onUpdate={leads.updateBusiness}
            />
          )}
        </div>

        <div id={panelId('audit')} role="tabpanel" aria-labelledby={tabId('audit')} hidden={mode !== 'audit'} className="mt-3">
          {auditOpened && <UrlAuditPanel />}
        </div>
      </main>
    </div>
  );
}
```

Replace `app/page.tsx` with:

```tsx
import { Workspace } from '@/app/_shared/components/auditely/workspace/workspace';

export default function HomePage() {
  return <Workspace />;
}
```

- [ ] **Step 2: Let a business list start filled**

In `app/_shared/lib/hooks/useBusinessList.ts`, replace the function's first two lines:

```ts
/**
 * A list of businesses that contact discovery and the cards write back into.
 * @param initial what the list starts with (the public demo's sample)
 */
export function useBusinessList(initial: BusinessWithData[] | (() => BusinessWithData[]) = []) {
  const [businesses, setBusinesses] = useState<BusinessWithData[]>(initial);
```

(Remove the old one-line doc comment above the function.)

- [ ] **Step 3: Let contact discovery be switched off**

In `app/_shared/lib/hooks/useEmailDiscovery.ts`, add one line to the doc comment's parameter list:

```ts
 * @param enabled         false in the public demo: nothing to find, no request
```

and change the hook's signature, its starting state, the reset and the effect's first lines and dependencies:

```ts
export function useEmailDiscovery(
  businesses: BusinessWithData[],
  onContactsFound: (found: ContactsFound[]) => void,
  runKey: string | number,
  enabled = true
): DiscoveryProgress {
  const totalAtStart = () => (enabled ? initialTotal(businesses) : 0);
  const [progress, setProgress] = useState(() => ({
    runKey,
    done: 0,
    total: totalAtStart(),
  }));

  // A new run resets progress. Adjusting state during render (instead of in the
  // effect) avoids an extra cascading render.
  if (progress.runKey !== runKey) {
    setProgress({ runKey, done: 0, total: totalAtStart() });
  }
```

```ts
  useEffect(() => {
    if (!enabled) return;
    const pending = getPendingIds();
```

```ts
    // Keyed on runKey: a new search restarts discovery. `businesses` and the
    // callback are read via effect events, so merging found emails does not re-run.
  }, [runKey, enabled]);
```

- [ ] **Step 4: Open the demo on its sample search**

In `app/_shared/lib/hooks/useLeadSearch.ts`, add the imports:

```ts
import { startingLeads } from '@/app/_shared/lib/demo/demoSamples';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
```

Replace the start of the hook, down to and including the `discovery` line, with:

```ts
export function useLeadSearch() {
  const demo = useDemo();
  // The public demo opens on its sample search
  const { businesses, setBusinesses, mergeContacts, updateBusiness } = useBusinessList(() =>
    demo ? websiteFirst(startingLeads(demo.data)) : []
  );
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!demo);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<SearchQuery | null>(demo?.data.query ?? null);
  // Changes whenever a new result set loads: restarts discovery, resets the list view
  const [runKey, setRunKey] = useState(0);

  const discovery = useEmailDiscovery(businesses, mergeContacts, runKey, !demo);
```

In `search`, add a first line and the dependency:

```ts
    async (niche: string, location: string) => {
      if (demo) return demo.restrict('search');
      start();
```

```ts
    [demo, start, show]
```

In the `?load=` effect, skip the demo:

```ts
  useEffect(() => {
    const searchId = new URLSearchParams(window.location.search).get('load');
    if (!searchId || demo) return;
    window.history.replaceState({}, '', ROUTES.HOME);
    openSaved(searchId);
  }, [demo, openSaved]);
```

- [ ] **Step 5: The search form in the demo**

In `app/_shared/components/auditely/leadSearchForm/leadSearchForm.tsx`, add the import `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';`, add `const demo = useDemo();` as the first line of the component, and change three places:

```ts
  const fetchSuggestions = useCallback(async (input: string) => {
    // The demo makes no requests, so it has no city suggestions
    if (demo || input.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
```

with `[demo]` as that callback's dependency list;

```ts
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = niche.trim();
    const l = location.trim();
    // In the demo the button always answers (with the notice), even with empty fields
    if (isLoading || (!demo && (!n || !l))) return;
    setIsOpen(false);
    onSearch(n, l);
  };
```

and on the submit button:

```tsx
        disabled={isLoading || (!demo && (!niche.trim() || !location.trim()))}
```

- [ ] **Step 6: The Audit tab in the demo**

In `app/_shared/lib/hooks/useUrlAudits.ts`, add `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';` and change the start of the hook and its loading effect:

```ts
export function useUrlAudits() {
  const demo = useDemo();
  // The public demo lists its sample website and loads nothing
  const { businesses, setBusinesses, mergeContacts, updateBusiness } = useBusinessList(demo?.data.sites);
  const [isLoading, setIsLoading] = useState(!demo);
  const [busy, setBusy] = useState<UrlAuditBusy>(null);
  const [notice, setNotice] = useState<UrlAuditNotice | null>(null);
  const [autoRunId, setAutoRunId] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    fetch(API_ROUTES.AUDIT_URL)
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setNotice({ tone: 'error', text: "Couldn't load your earlier audits. Reload the page to try again." }))
      .finally(() => setIsLoading(false));
  }, [demo, setBusinesses]);
```

At the top of both `addWebsite` and `findEmail` (before `setBusy(…)`), add:

```ts
      if (demo) {
        demo.restrict('auditUrl');
        return false;
      }
```

and add `demo` to both dependency lists: `[addSite, demo, discoverContacts]` and `[addSite, demo, findContacts]`.

In `app/_shared/components/auditely/urlAuditForm/urlAuditForm.tsx`, add `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';`, add `const demo = useDemo();` as the first line of the component, and change `run` and both buttons' `disabled`:

```ts
  const run = async (action: (url: string) => Promise<boolean>) => {
    const value = url.trim();
    // In the demo both buttons always answer (with the notice), even with an empty field
    if (isLoading || (!value && !demo)) return;
    if (await action(value)) setUrl('');
  };
```

```tsx
          disabled={isLoading || (!demo && !url.trim())}
```

In `app/_shared/components/auditely/businessCard/businessCard.tsx`, add the prop to `BusinessCardProps`:

```ts
  /** Start with the report open although it's already audited (the demo's sample website) */
  defaultOpen?: boolean;
```

take it in the component's parameters (`{ business, initialAudit, initialReport, onUpdate, autoRun, bulk, defaultOpen }`), and change the `toggled` state line to:

```ts
  const [toggled, setToggled] = useState<boolean | null>(defaultOpen ? true : null);
```

In `app/_shared/components/auditely/urlAuditPanel/urlAuditPanel.tsx`, add `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';`, add `const demo = useDemo();` as the first line of the component, and pass the prop to the card:

```tsx
                autoRun={business.id === autoRunId}
                defaultOpen={!!demo}
```

- [ ] **Step 7: The header in the demo**

In `app/_shared/components/auditely/appHeader/appHeader.tsx`, add `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';` and replace the component with:

```tsx
export function AppHeader() {
  const pathname = usePathname();
  const demo = useDemo();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:gap-8 sm:px-6">
        <Link
          href={demo ? ROUTES.DEMO : ROUTES.HOME}
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-[var(--color-text-primary)]"
        >
          <LogoMark />
          <span className="hidden sm:inline">Auditely</span>
        </Link>

        {demo ? (
          <span className="rounded-full bg-[var(--color-primary-600)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary-600)]">
            Demo
          </span>
        ) : (
          <nav className="flex items-center gap-1 text-sm" aria-label="Main">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                    active
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {demo ? (
            <Link
              href={ROUTES.LOGIN}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Sign in
            </Link>
          ) : (
            <LogoutButton />
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 8: The demo page**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md` first. Create `app/demo/page.tsx`:

```tsx
// app/demo/page.tsx

// The public demo: the workspace on the saved sample (see lib/demo/). Open to
// anyone; nothing on it calls the API.

import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Workspace } from '@/app/_shared/components/auditely/workspace/workspace';
import { DemoProvider } from '@/app/_shared/components/providers/DemoProvider';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { demoLinks } from '@/app/_shared/lib/demo/demoLinks';

export const metadata: Metadata = {
  title: 'Auditely demo',
  description: 'Find local businesses, audit their websites and draft the outreach email. A demo on saved sample data.',
};

export default async function DemoPage() {
  // Rendered per request, so DEMO_VIDEO_URL and DEMO_CONTACT_URL are read where the app runs, not where it was built
  await connection();

  return (
    <DemoProvider data={demoData} links={demoLinks()}>
      <Workspace />
    </DemoProvider>
  );
}
```

- [ ] **Step 9: Checkpoint: types, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no errors, every test passes.

- [ ] **Step 10: See it in the browser**

Run `npm run dev`, then in another terminal:

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/demo
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/audit
```

Expected: `307 http://localhost:3000/demo`, `200`, `401`.

Open `http://localhost:3000/` in a private window (logged out). Expected: it lands on `/demo`; header shows "Demo" and "Sign in"; the banner; the sample search's title and cards (about half "Audited" and collapsed, half "Not audited yet"); no "Finding contacts" spinner; sort and filters work; "Find leads" opens the notice; the "Audit a website" tab shows the sample site with its full report open, and "Run audit" / "Find email" open the notice; the browser console shows no hydration warning; the network panel shows no request to `/api/…`.

Then log in and open `/`: the real workspace, with Saved searches and Log out, as before.

---

### Task 8: The cards in the demo

**Files:**
- Modify: `app/_shared/lib/hooks/useBusinessAudit.ts`, `app/_shared/lib/hooks/useBulkAudit.ts`, `app/_shared/components/auditely/auditPanel/auditPanel.tsx`, `app/_shared/components/auditely/businessCard/businessCard.tsx`, `app/_shared/components/auditely/businessEmail/businessEmail.tsx`, `app/_shared/components/auditely/reportActions/reportActions.tsx`, `app/_shared/components/auditely/exportMenu/exportMenu.tsx`

**Interfaces:**
- Consumes: `useDemo()` → `{ replay: Post, restrict(action) }` (Task 6); `demoReportPath` (Task 1); `Post` from `utils/bulkAudit`.
- Produces: no new exports. Behaviour: in the demo "Run audit", "Write summary" and "Audit all" answer from `demo.replay`; "Re-audit", "Find email", "Send email", "Send to HubSpot" and both exports call `demo.restrict(…)`; "Download PDF report" fetches `demoReportPath(audit.id)`.

- [ ] **Step 1: One card's audit, summary and PDF**

In `app/_shared/lib/hooks/useBusinessAudit.ts`, change the imports:

```ts
import { API_ROUTES, demoReportPath } from '@/app/_shared/lib/config/routes';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { downloadBlob } from '@/app/_shared/lib/utils/browserExport';
import { shownStatus, type BulkState, type Post } from '@/app/_shared/lib/utils/bulkAudit';
```

Under `JSON_HEADERS`, add:

```ts
// The real routes. In the public demo the saved sample answers instead (demo/replay.ts).
const send: Post = async (path, body) => {
  const res = await fetch(path, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json() };
};
```

Add to the doc comment above `BusinessAuditOptions`, as its last lines:

```ts
 * In the public demo the audit and summary are replayed from the saved sample,
 * Re-audit opens the demo's notice, and the PDF is the sample's.
```

As the first lines of the hook body, add:

```ts
  const demo = useDemo();
  const request = demo?.replay ?? send;
```

Replace `generateReport`, `runAudit`, `reAudit` and `downloadPdf` with:

```ts
  const generateReport = useCallback(async (auditId: string) => {
    setReportStatus('loading');
    try {
      const { ok, data } = await request(API_ROUTES.GENERATE, { audit_id: auditId });
      const { ai_report, error } = data as { ai_report: AiReport; error?: string };
      if (!ok) throw new Error(error);
      setReport(ai_report);
      setReportStatus('done');
      onUpdate?.(business.id, { ai_report });
    } catch {
      setReportStatus('error');
    }
  }, [business.id, onUpdate, request]);

  const runAudit = useCallback(
    async (force = false) => {
      lastForce.current = force;
      setAuditStatus('loading');
      setAuditError(null);
      // A failed Re-audit keeps the previous results visible alongside the server's reason
      const fail = (message: string) => {
        setAuditError(message);
        setAuditStatus(audit ? 'done' : 'error');
      };
      try {
        const { ok, data } = await request(API_ROUTES.AUDIT, { business_id: business.id, force });
        const result = data as { audit: Audit; email?: string | null; error?: string };
        if (!ok) return fail(result.error || 'Audit failed');
        setAudit(result.audit);
        if (result.email) setEmail(result.email);
        if (force) setReport(undefined);
        setAuditStatus('done');
        onUpdate?.(business.id, {
          audit: result.audit,
          ...(result.email && { email: result.email }),
          ...(force && { ai_report: undefined }),
        });
        generateReport(result.audit.id);
      } catch {
        fail('Audit failed');
      }
    },
    [audit, business.id, generateReport, onUpdate, request]
  );
```

```ts
  // The demo has one saved audit per business: nothing fresh to measure
  const reAudit = useCallback(() => (demo ? demo.restrict('reaudit') : runAudit(true)), [demo, runAudit]);
```

```ts
  const downloadPdf = useCallback(async () => {
    if (!audit) return;
    setPdfLoading(true);
    try {
      // The demo's reports are built ahead from the saved sample
      const res = demo
        ? await fetch(demoReportPath(audit.id))
        : await fetch(API_ROUTES.PDF, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ audit_id: audit.id }),
          });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const blob = await res.blob();
      downloadBlob(blob, `audit-${business.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  }, [audit, business.name, demo]);
```

(The `autoStarted` effect and `retryAudit` between them stay as they are.)

- [ ] **Step 2: "Audit all"**

In `app/_shared/lib/hooks/useBulkAudit.ts`, add `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';`, add `const demo = useDemo();` as the first line of the hook, and change three places:

```ts
      // In the public demo the saved sample answers instead of the API
      const post = demo?.replay ?? poster(run.signal);
```

```ts
    [demo, onUpdate]
```

(the dependency list of `start`), and the "closing the tab" effect:

```ts
  // Closing the tab would cancel the run too: ask first. Not in the demo, where nothing is lost.
  const isRunning = progress?.isRunning ?? false;
  useEffect(() => {
    if (!isRunning || demo) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [demo, isRunning]);
```

- [ ] **Step 3: Say that it's a replay**

In `app/_shared/components/auditely/auditPanel/auditPanel.tsx`, add `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';`, add `const demo = useDemo();` as the first line of `AuditPanel` (before `const { audit, … } = state;` and before any `return`), and replace the two "busy" statuses:

```tsx
        {auditStatus === 'loading' ? (
          <Status
            busy
            title={demo ? `Replaying the saved audit of ${domainOf(business.website)}…` : `Auditing ${domainOf(business.website)}…`}
            detail={
              demo
                ? 'A live audit takes about a minute; this replay is shortened.'
                : 'Speed tests run on mobile and desktop, so this takes about a minute.'
            }
          />
```

```tsx
              {reportStatus === 'loading' ? (
                <Status busy title={demo ? 'Replaying the saved summary and outreach email…' : 'Writing the summary and outreach email…'} />
```

- [ ] **Step 4: No age badges, and the masked phone as text**

In `app/_shared/components/auditely/businessCard/businessCard.tsx`, add `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';`, add `const demo = useDemo();` as the first line of `BusinessCard`, and change the two badge lines:

```ts
  // The demo's sample has the age it has: no "Outdated" or "Over 30 days old" there
  const isOutdated = !demo && auditStatus === 'done' && !!audit && isOutdatedAudit(audit.engine_version);
  // Outdated already says "re-audit"; stale only needs saying for a current-engine audit
  const isStale = !demo && auditStatus === 'done' && !!audit && !isOutdated && isStaleAudit(audit);
```

and the phone line:

```tsx
              {business.phone && (
                <ContactLine icon={<PhoneIcon size={14} />}>
                  {/* The demo's numbers are masked: nothing to call */}
                  {demo ? (
                    business.phone
                  ) : (
                    <a
                      href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}
                      className="hover:text-[var(--color-primary-600)] hover:underline"
                    >
                      {business.phone}
                    </a>
                  )}
                </ContactLine>
              )}
```

- [ ] **Step 5: The masked email as text, and "Find email"**

In `app/_shared/components/auditely/businessEmail/businessEmail.tsx`, add `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';`, add `const demo = useDemo();` as the first line of the component, make the first line of `handleFind`:

```ts
    if (demo) return demo.restrict('findEmail');
```

and add, directly above `if (email) {`:

```tsx
  // The demo's emails are masked: nothing to write to or copy
  if (email && demo) {
    return (
      <ContactLine icon={<MailIcon size={14} />}>
        <span className="font-medium text-[var(--color-text-primary)]">{email}</span>
      </ContactLine>
    );
  }
```

- [ ] **Step 6: "Send email" and "Send to HubSpot"**

In `app/_shared/components/auditely/reportActions/reportActions.tsx`, add `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';`, add `const demo = useDemo();` as the first line of the component, and change `openComposer` and the HubSpot button:

```ts
  const openComposer = () => {
    if (demo) return demo.restrict('sendEmail');
    mail.clearError();
    setComposing(true);
  };
```

```tsx
        <Button variant="outline" size="sm" onClick={demo ? () => demo.restrict('crm') : crm.send} isLoading={crm.sending}>
```

- [ ] **Step 7: The exports**

In `app/_shared/components/auditely/exportMenu/exportMenu.tsx`, add `import { useDemo } from '@/app/_shared/lib/hooks/useDemo';`, add `const demo = useDemo();` as the first line of the component, and add as the first line of both `downloadCsv` and `copyForSheets`:

```ts
    // The demo doesn't hand out its list
    if (demo) return demo.restrict('export');
```

- [ ] **Step 8: Checkpoint: types, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no errors, every test passes (the existing `bulkAudit` and route tests prove the real paths are unchanged).

- [ ] **Step 9: See it in the browser**

With `npm run dev` running, logged out, on `/demo`:

1. On a "Not audited yet" card press **Run audit**. Expected: "Replaying the saved audit of …" for about 4 seconds, then the scores, then "Replaying the saved summary and outreach email…" for about 2.5 seconds, then the summary and email; the card turns "Audited".
2. Press **Audit all**. Expected: "Audited n of m" counts up, 3 cards at a time; **Stop** stops new ones; afterwards the list re-arranges and the button disappears when none are left.
3. On an audited card: **Re-audit**, **Send email**, **Send to HubSpot** each open the notice with its own first sentence; **Export** → both items open the notice.
4. **Download PDF report** downloads a PDF. Open it: the business, scores and summary are there, there is no "Want help fixing these?" box, and the masked phone shows as bullets. If the bullets are missing or drawn as other characters, add `.replace(/•/g, '*')` to `pdfText` in `app/_shared/lib/audit/reportData.ts` (the built-in PDF font cannot draw every character; see the comment there) and add `expect(buildPdfProps(audit, { ...business, phone: '(•••) •••-••42' }, noReport, null).phone).toBe('(***) ***-**42');` to the "replaces characters the built-in PDF font cannot draw" test.
5. A card's email and phone show masked, as plain text.
6. No "Outdated" or "Over 30 days old" badge anywhere. The network panel shows only `/demo/report/…` requests, none to `/api/…`.

Then log in and open `/`: run one real audit on a saved search and confirm the wording is "Auditing …", the email is a `mailto:` link and the PDF has its contact box.

---

### Task 9: Settings, build and wrap-up

**Files:**
- Modify: `.env.local.example`, `docs/superpowers/specs/2026-10-02-public-demo-design.md:3-4`

**Interfaces:**
- Consumes: everything above.
- Produces: documented settings; a production build that lists the demo's PDFs as pre-built.

- [ ] **Step 1: Document the settings**

Append to `.env.local.example`:

```bash

# ── Public demo at /demo (all optional) ──────────────────────────────────────
# What a logged-out visitor sees: the workspace on the saved sample in
# app/_shared/lib/demo/demoData.json (written by scripts/captureDemo.mjs).
# A recorded walkthrough, linked from the demo's banner and notice (http/https)
DEMO_VIDEO_URL=
# Turns the notice's "Message me on Upwork" into a "Get in touch" link (http/https).
# Left empty by default: Upwork restricts sharing contact details before a contract.
DEMO_CONTACT_URL=
# 1 = the demo's PDF reports show the "next step" contact box, like the real
# ones. Read at build time.
DEMO_PDF_CONTACT=
```

- [ ] **Step 2: Build**

Read the "Caching" section of `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` first. Run: `npm run build`
Expected: the build succeeds, and its route table lists `/demo/report/[auditId]` as pre-rendered (the `●` SSG mark) with the sample ids under it (`/demo/report/demo-a1`, …), and `/demo` as dynamic (`ƒ`).

If the PDF route is listed as dynamic instead, the downloads still work; note it in the hand-back to the user rather than changing the design.

- [ ] **Step 3: Everything, once more**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: every test passes, no type or lint errors.

- [ ] **Step 4: Mark the spec as built**

In `docs/superpowers/specs/2026-10-02-public-demo-design.md`, change the status line to:

```markdown
**Status:** Built
```

- [ ] **Step 5: Hand back**

Tell the user: what was built, the test and build results, the sample that was captured, that nothing is committed, and the reminder from their rules: "The demo module is complete. When you're ready, I can commit it to the branch you choose — just say the word." Offer the 45-second Loom shot list.
