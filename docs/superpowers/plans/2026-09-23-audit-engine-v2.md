# Audit Engine v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-call PageSpeed audit with a modular engine that retries PageSpeed, verifies TLS directly, parses the homepage once, and adds GEO / AEO / NAP scores + findings — storing `null` (never `0`) for anything it couldn't measure.

**Architecture:** `/api/audit` calls one orchestrator, `runAudit()` in `app/_shared/lib/audit/`, which runs PageSpeed (mobile + desktop, with retry), a single homepage fetch, a TLS handshake and email discovery concurrently. Pure analyzer functions (structured data, NAP, GEO, AEO, SEO basics) read the parsed HTML. Results go into new `audits` columns (`geo_score`, `aeo_score`, `checks`, `engine_version`); the dashboard shows six tiles, a findings checklist, an "Outdated" badge and a Re-audit button.

**Tech Stack:** Next.js 16 App Router (Node runtime), TypeScript 5, `cheerio` 1.x, `node:tls`, Supabase JS, React 19, Tailwind v4, `vitest` 5 (new).

**Spec:** `docs/superpowers/specs/2026-09-23-audit-engine-v2-design.md`

## Global Constraints

- **No git write commands** (commit, branch, add, stash, reset, restore). The user's `~/.claude/CLAUDE.md` forbids commits without explicit approval; leave all changes uncommitted. Each task ends with a checkpoint, not a commit.
- `CLAUDE.md` rules: camelCase files/folders; imports via `@/app/_shared/...` (never relative `../`); page routes via `ROUTES.*`; `next/image` not `<img>`; every file ≤ 300 lines (hard cap 350).
- Server-only modules (`runAudit.ts`, `pageSpeed.ts`, `siteFetch.ts`, `tlsCheck.ts`) must never be imported by a `'use client'` file. `types.ts` and `reportData.ts` must stay free of Node-only imports.
- `CURRENT_ENGINE_VERSION = 2`.
- A metric that couldn't be measured is `null` → UI "—". Never write `0` for "unknown".
- PageSpeed: categories `performance`, `seo`, `best-practices`, `accessibility`; max 3 attempts; 90 s per attempt; 240 s total deadline; backoff 2 s → 4 s plus 0–30% jitter; honour `Retry-After`; route `export const maxDuration = 300`.
- Site fetch: 10 s timeout, 2 MB HTML cap, UA `Mozilla/5.0 (compatible; Auditely/1.0; +https://devartventures.com)`.
- TLS: 8 s timeout. SSL tile warns when `daysToExpiry < 30`.
- Near-empty page: visible text < 200 characters → GEO/AEO `null`, reason `Content loads via JavaScript — checks limited`.
- New dependencies: `cheerio@^1.2.0` (runtime) and `vitest@^5.0.1` (dev). No others.
- Tests: `npm test` (`vitest run`). Network tests run only with `RUN_NETWORK_TESTS=1`.

## Review Focus

- **PSI 200 response with a `null` category score** (Lighthouse category errored) → stored as `null` "—", not 0. *Pinned in Task 3.*
- **JSON-LD `@type` arrays and multi-location `@graph`** (`["Dentist","LocalBusiness"]`, several business nodes) → the node matching the Google name is used. *Pinned in Task 7.*
- **Phone numbers with `+1`, dots, URL-encoded `tel:` and extensions** (`ext. 2`, `x12`) → compared on the right 10 digits. *Pinned in Tasks 6 and 8.*
- **Google address without street number or ZIP** (`Springfield, IL, USA`) → `n/a`, not `mismatch`. *Pinned in Tasks 6 and 8.*
- **Listed website with path/query or `http://` that redirects to `https://www.`** → `robots.txt` read from the final origin, TLS checked on the final hostname. *Pinned in Tasks 5 and 12.*

---

### Task 1: Test harness, shared audit types, niche types

**Files:**
- Modify: `package.json` (scripts + deps)
- Create: `vitest.config.mts`
- Create: `app/_shared/lib/audit/types.ts`
- Create: `app/_shared/lib/audit/nicheTypes.ts`
- Test: `app/_shared/lib/audit/__tests__/nicheTypes.test.ts`, `app/_shared/lib/audit/__tests__/types.test.ts`

**Interfaces:**
- Produces: every type in `types.ts` (`Finding`, `FindingStatus`, `NapStatus`, `KeyAudit`, `LighthouseSummary`, `SslCheck`, `RobotsTxtStatus`, `SeoBasics`, `NapResult`, `GeoChecks`, `AeoChecks`, `AuditChecks`, `AuditInput`, `AuditRow`, `AuditOutcome`), `CURRENT_ENGINE_VERSION`, `isOutdatedAudit(v)`; `expectedTypesForNiche(niche): string[] | null`, `isMedicalNiche(niche): boolean`, `isLocalBusinessType(type): boolean`.

- [ ] **Step 1: Install dependencies and add the test script**

Run:
```bash
npm install cheerio@^1.2.0
npm install -D vitest@^5.0.1
npm pkg set scripts.test="vitest run"
```
Expected: `package.json` gains `"cheerio"` in `dependencies`, `"vitest"` in `devDependencies`, and `"test": "vitest run"` in `scripts`.

- [ ] **Step 2: Create `vitest.config.mts`**

```ts
// vitest.config.mts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" → "./*"
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write the failing tests**

`app/_shared/lib/audit/__tests__/nicheTypes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  expectedTypesForNiche,
  isLocalBusinessType,
  isMedicalNiche,
} from '@/app/_shared/lib/audit/nicheTypes';

describe('expectedTypesForNiche', () => {
  it('maps dental niches to Dentist, even when "clinic" is also present', () => {
    expect(expectedTypesForNiche('Dentists')).toEqual(['Dentist']);
    expect(expectedTypesForNiche('pediatric dental clinic')).toEqual(['Dentist']);
  });

  it('maps medical niches to medical types', () => {
    expect(expectedTypesForNiche('chiropractor')).toContain('MedicalClinic');
  });

  it('maps education niches to educational types', () => {
    expect(expectedTypesForNiche('math tutoring')).toContain('EducationalOrganization');
  });

  it('returns null for niches without a rule', () => {
    expect(expectedTypesForNiche('plumber')).toBeNull();
    expect(expectedTypesForNiche(null)).toBeNull();
  });
});

describe('isMedicalNiche', () => {
  it('is true for dental and medical niches only', () => {
    expect(isMedicalNiche('dentist')).toBe(true);
    expect(isMedicalNiche('physiotherapy')).toBe(true);
    expect(isMedicalNiche('tutor')).toBe(false);
    expect(isMedicalNiche(null)).toBe(false);
  });
});

describe('isLocalBusinessType', () => {
  it('accepts business and school types, rejects page/org types', () => {
    expect(isLocalBusinessType('Dentist')).toBe(true);
    expect(isLocalBusinessType('School')).toBe(true);
    expect(isLocalBusinessType('WebSite')).toBe(false);
    expect(isLocalBusinessType('Organization')).toBe(false);
  });
});
```

`app/_shared/lib/audit/__tests__/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CURRENT_ENGINE_VERSION, isOutdatedAudit } from '@/app/_shared/lib/audit/types';

describe('isOutdatedAudit', () => {
  it('treats missing or older engine versions as outdated', () => {
    expect(CURRENT_ENGINE_VERSION).toBe(2);
    expect(isOutdatedAudit(undefined)).toBe(true);
    expect(isOutdatedAudit(null)).toBe(true);
    expect(isOutdatedAudit(1)).toBe(true);
    expect(isOutdatedAudit(2)).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/nicheTypes` / `types`.

- [ ] **Step 5: Create `app/_shared/lib/audit/types.ts`**

```ts
// app/_shared/lib/audit/types.ts

// Shared audit-engine types. Safe to import from client components
// (no Node-only imports in this file).

export const CURRENT_ENGINE_VERSION = 2;

/** Audits written by an older engine are shown as "Outdated". */
export const isOutdatedAudit = (engineVersion: number | null | undefined): boolean =>
  (engineVersion ?? 1) < CURRENT_ENGINE_VERSION;

export type FindingStatus = 'pass' | 'warn' | 'fail';

// `id` is stable — Project B keys its plain-English impact translations on it
export interface Finding {
  id: string;
  status: FindingStatus;
  label: string;
  detail?: string;
}

export type NapStatus = 'match' | 'mismatch' | 'missing' | 'n/a';

export interface KeyAudit {
  score: number | null;
  title: string;
  displayValue?: string;
}

export interface LighthouseSummary {
  categories: Record<string, { score: number | null; title: string }>;
  keyAudits: Record<string, KeyAudit>;
}

export interface SslCheck {
  valid: boolean | null;
  daysToExpiry: number | null;
  issuer: string | null;
  error?: string;
}

export type RobotsTxtStatus = 'ok' | 'missing' | 'blocks-all' | 'unknown';

export interface SeoBasics {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  viewport: boolean;
  noindex: boolean;
  robotsTxt: RobotsTxtStatus;
  findings: Finding[];
}

export interface NapResult {
  name: NapStatus;
  address: NapStatus;
  phone: NapStatus;
  site: { name: string | null; address: string | null; phones: string[] };
}

export interface GeoChecks {
  findings: Finding[];
  schemaTypes: string[];
  nap: NapResult;
}

export interface AeoChecks {
  findings: Finding[];
  h1Count: number;
  h2Count: number;
  questionHeadings: number;
  hasFaqSchema: boolean;
}

export interface AuditChecks {
  ssl: SslCheck;
  seo: SeoBasics | null;
  geo: GeoChecks | null;
  aeo: AeoChecks | null;
  site: { ok: boolean; finalUrl: string | null; status: number | null; reason?: string };
  psi: { mobile: string; desktop: string }; // 'ok' or the failure reason
}

export interface AuditInput {
  website: string;
  name: string;
  address: string;
  phone: string | null;
  niche: string | null;
  /** Called once the homepage is fetched (html is null if it couldn't be read). */
  discoverEmail?: (homepageHtml: string | null) => Promise<string | null>;
}

/** Columns written to `audits` (besides id / business_id / created_at). */
export interface AuditRow {
  performance_score: number | null;
  seo_score: number | null;
  mobile_score: number | null;
  ssl_valid: boolean | null;
  geo_score: number | null;
  aeo_score: number | null;
  checks: AuditChecks;
  raw_json: { mobile: LighthouseSummary | null; desktop: LighthouseSummary | null };
  engine_version: number;
}

export interface AuditOutcome {
  row: AuditRow;
  email: string | null;
}
```

- [ ] **Step 6: Create `app/_shared/lib/audit/nicheTypes.ts`**

```ts
// app/_shared/lib/audit/nicheTypes.ts

// Maps a search niche to the schema.org types a business in that niche should
// use, and lists the LocalBusiness-family types GEO accepts as a business entity.

interface NicheRule {
  keywords: string[];
  types: string[];
  medical: boolean;
}

// First matching rule wins ("dental clinic" → Dentist, not MedicalClinic)
const NICHE_RULES: NicheRule[] = [
  { keywords: ['dentist', 'dental', 'orthodont'], types: ['Dentist'], medical: true },
  {
    keywords: ['clinic', 'medical', 'doctor', 'physician', 'chiropract', 'physio', 'dermatolog', 'pediatric'],
    types: ['MedicalClinic', 'Physician', 'MedicalBusiness', 'MedicalOrganization'],
    medical: true,
  },
  {
    keywords: ['school', 'academy', 'tutor', 'college', 'university', 'education', 'preschool', 'daycare', 'learning'],
    types: [
      'EducationalOrganization', 'School', 'CollegeOrUniversity', 'Preschool',
      'ElementarySchool', 'MiddleSchool', 'HighSchool',
    ],
    medical: false,
  },
];

// LocalBusiness and its common subtypes, plus the expected types above.
// Educational types aren't LocalBusiness subtypes in schema.org, but they are
// the local entity for schools.
const LOCAL_BUSINESS_TYPES = new Set([
  'LocalBusiness', 'ProfessionalService',
  'MedicalBusiness', 'MedicalClinic', 'MedicalOrganization', 'Dentist', 'Physician',
  'Optician', 'Pharmacy', 'VeterinaryCare',
  'HealthAndBeautyBusiness', 'BeautySalon', 'HairSalon', 'DaySpa', 'NailSalon',
  'HealthClub', 'ExerciseGym', 'SportsActivityLocation',
  'HomeAndConstructionBusiness', 'Plumber', 'Electrician', 'HVACBusiness',
  'RoofingContractor', 'GeneralContractor', 'HousePainter', 'Locksmith', 'MovingCompany',
  'AutomotiveBusiness', 'AutoRepair', 'AutoDealer',
  'LegalService', 'Attorney', 'Notary',
  'FinancialService', 'AccountingService', 'InsuranceAgency', 'RealEstateAgent',
  'FoodEstablishment', 'Restaurant', 'CafeOrCoffeeShop', 'Bakery', 'Store',
  'ChildCare', 'EntertainmentBusiness', 'LodgingBusiness', 'Hotel',
  'EmergencyService', 'EmploymentAgency', 'TravelAgency', 'AnimalShelter', 'Library',
  'EducationalOrganization', 'School', 'CollegeOrUniversity', 'Preschool',
  'ElementarySchool', 'MiddleSchool', 'HighSchool',
]);

function ruleFor(niche: string | null): NicheRule | null {
  if (!niche) return null;
  const n = niche.toLowerCase();
  return NICHE_RULES.find((rule) => rule.keywords.some((k) => n.includes(k))) ?? null;
}

export const expectedTypesForNiche = (niche: string | null): string[] | null =>
  ruleFor(niche)?.types ?? null;

export const isMedicalNiche = (niche: string | null): boolean => ruleFor(niche)?.medical ?? false;

export const isLocalBusinessType = (type: string): boolean => LOCAL_BUSINESS_TYPES.has(type);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 2 files, all tests green.

- [ ] **Step 8: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0. Do not commit.

---

### Task 2: Retry helper

**Files:**
- Create: `app/_shared/lib/audit/retry.ts`
- Test: `app/_shared/lib/audit/__tests__/retry.test.ts`

**Interfaces:**
- Produces: `class RetryableError extends Error { constructor(message: string, retryAfterMs?: number) }`, `interface RetryOptions { attempts: number; baseDelayMs: number; deadline: number; random?: () => number }`, `withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T>`.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/retry.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, RetryableError } from '@/app/_shared/lib/audit/retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  const opts = { attempts: 3, baseDelayMs: 2000, deadline: 60_000, random: () => 0 };

  it('returns the first successful result', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, opts)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries RetryableError with exponential backoff (2 s, then 4 s)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableError('503'))
      .mockRejectedValueOnce(new RetryableError('503'))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, opts);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('400'));
    await expect(withRetry(fn, opts)).rejects.toThrow('400');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last attempt', async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableError('503'));
    const assertion = expect(withRetry(fn, opts)).rejects.toThrow('503');
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('honours Retry-After when it is longer than the backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableError('429', 5000))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, opts);
    await vi.advanceTimersByTimeAsync(4999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
  });

  it('stops when the next wait would pass the deadline', async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableError('503'));
    await expect(withRetry(fn, { ...opts, deadline: 1000 })).rejects.toThrow('503');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/retry.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/retry`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/retry.ts`**

```ts
// app/_shared/lib/audit/retry.ts

/** An error worth retrying (network blip, timeout, 429, 5xx). */
export class RetryableError extends Error {
  constructor(message: string, readonly retryAfterMs?: number) {
    super(message);
    this.name = 'RetryableError';
  }
}

export interface RetryOptions {
  /** Total attempts, including the first */
  attempts: number;
  /** Wait before the 2nd attempt; doubles after each failure */
  baseDelayMs: number;
  /** Epoch ms — never wait past this */
  deadline: number;
  /** Jitter source in [0, 1); injectable for tests */
  random?: () => number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn` until it succeeds, throws a non-retryable error, runs out of
 * attempts, or the next wait would pass `deadline`. Only `RetryableError`s
 * are retried; anything else is rethrown immediately.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const random = opts.random ?? Math.random;
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (!(err instanceof RetryableError) || attempt === opts.attempts) throw err;

      const backoff = opts.baseDelayMs * 2 ** (attempt - 1) * (1 + 0.3 * random());
      const delay = Math.max(backoff, err.retryAfterMs ?? 0);
      if (Date.now() + delay >= opts.deadline) throw err;
      await sleep(delay);
    }
  }
  throw lastError;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/audit/__tests__/retry.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Do not commit.

---

### Task 3: PageSpeed client

**Files:**
- Create: `app/_shared/lib/audit/pageSpeed.ts`
- Test: `app/_shared/lib/audit/__tests__/pageSpeed.test.ts`

**Interfaces:**
- Consumes: `withRetry`, `RetryableError` (Task 2); `KeyAudit`, `LighthouseSummary` (Task 1).
- Produces: `type PageSpeedStrategy = 'mobile' | 'desktop'`; `type PageSpeedResult = { ok: true; summary: LighthouseSummary; isOnHttps: boolean | null } | { ok: false; reason: string }`; `runPageSpeed(website: string, strategy: PageSpeedStrategy, deadline: number): Promise<PageSpeedResult>`; `categoryScore(summary: LighthouseSummary | null, key: string): number | null`; `trimLighthouseData(lr)`.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/pageSpeed.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/pageSpeed.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/pageSpeed`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/pageSpeed.ts`**

```ts
// app/_shared/lib/audit/pageSpeed.ts

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
  | { ok: true; summary: LighthouseSummary; isOnHttps: boolean | null }
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/audit/__tests__/pageSpeed.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Do not commit.

---

### Task 4: TLS certificate check

**Files:**
- Create: `app/_shared/lib/audit/tlsCheck.ts`
- Test: `app/_shared/lib/audit/__tests__/tlsCheck.test.ts`

**Interfaces:**
- Consumes: `SslCheck` (Task 1).
- Produces: `interface TlsProbe { authorized: boolean; authorizationError: string | null; validTo: string | null; issuer: string | null }`; `interpretTls(probe: TlsProbe, now: number): SslCheck`; `probeTls(hostname): Promise<TlsProbe | null>`; `checkTls(hostname: string, now?: number): Promise<SslCheck | null>` (null = handshake couldn't complete).

Verified behaviour of Node `tls.connect` with `rejectUnauthorized: false` (2026-09-23): `expired.badssl.com` → `authorized:false, CERT_HAS_EXPIRED`; `wrong.host.badssl.com` → `ERR_TLS_CERT_ALTNAME_INVALID`; `self-signed.badssl.com` → `DEPTH_ZERO_SELF_SIGNED_CERT`; unknown host → `error` event `ENOTFOUND`. `valid_to` looks like `Oct 27 22:17:21 2026 GMT` and `Date.parse` handles it.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/tlsCheck.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { checkTls, interpretTls } from '@/app/_shared/lib/audit/tlsCheck';

const NOW = Date.parse('2026-09-23T00:00:00Z');

describe('interpretTls', () => {
  it('marks a trusted certificate valid with days to expiry', () => {
    expect(
      interpretTls({ authorized: true, authorizationError: null, validTo: 'Nov 2 00:00:00 2026 GMT', issuer: "Let's Encrypt" }, NOW)
    ).toEqual({ valid: true, daysToExpiry: 40, issuer: "Let's Encrypt" });
  });

  it('marks an expired certificate invalid', () => {
    const result = interpretTls(
      { authorized: false, authorizationError: 'CERT_HAS_EXPIRED', validTo: 'Apr 12 23:59:59 2015 GMT', issuer: 'COMODO CA Limited' },
      NOW
    );
    expect(result.valid).toBe(false);
    expect(result.daysToExpiry).toBeLessThan(0);
    expect(result.error).toBe('CERT_HAS_EXPIRED');
  });

  it('marks a wrong-host certificate invalid even when not expired', () => {
    const result = interpretTls(
      { authorized: false, authorizationError: 'ERR_TLS_CERT_ALTNAME_INVALID', validTo: 'Oct 26 20:03:01 2026 GMT', issuer: "Let's Encrypt" },
      NOW
    );
    expect(result).toMatchObject({ valid: false, error: 'ERR_TLS_CERT_ALTNAME_INVALID' });
  });

  it('leaves daysToExpiry null when the date is unreadable', () => {
    expect(interpretTls({ authorized: true, authorizationError: null, validTo: 'garbage', issuer: null }, NOW)).toEqual({
      valid: true,
      daysToExpiry: null,
      issuer: null,
    });
  });
});

describe.runIf(process.env.RUN_NETWORK_TESTS === '1')('checkTls (network)', () => {
  it('accepts a valid certificate', async () => {
    expect((await checkTls('example.com'))?.valid).toBe(true);
  }, 15_000);

  it('rejects expired, wrong-host and self-signed certificates', async () => {
    expect(await checkTls('expired.badssl.com')).toMatchObject({ valid: false, error: 'CERT_HAS_EXPIRED' });
    expect(await checkTls('wrong.host.badssl.com')).toMatchObject({ valid: false, error: 'ERR_TLS_CERT_ALTNAME_INVALID' });
    expect(await checkTls('self-signed.badssl.com')).toMatchObject({ valid: false, error: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
  }, 30_000);

  it('returns null when the host does not resolve', async () => {
    expect(await checkTls('nonexistent-zz9-auditely.example')).toBeNull();
  }, 15_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/tlsCheck.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/tlsCheck`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/tlsCheck.ts`**

```ts
// app/_shared/lib/audit/tlsCheck.ts

// Direct TLS handshake on port 443. Catches expired, self-signed and
// wrong-host certificates that "is the URL https?" checks miss.

import tls from 'node:tls';
import type { SslCheck } from '@/app/_shared/lib/audit/types';

const TLS_TIMEOUT_MS = 8000;
const DAY_MS = 86_400_000;

export interface TlsProbe {
  authorized: boolean;
  authorizationError: string | null;
  validTo: string | null; // e.g. 'Oct 27 22:17:21 2026 GMT'
  issuer: string | null;
}

/** Turns a completed handshake into the stored SSL check. */
export function interpretTls(probe: TlsProbe, now: number): SslCheck {
  const expiry = probe.validTo ? Date.parse(probe.validTo) : NaN;
  const daysToExpiry = Number.isFinite(expiry) ? Math.floor((expiry - now) / DAY_MS) : null;
  return {
    valid: probe.authorized && (daysToExpiry === null || daysToExpiry >= 0),
    daysToExpiry,
    issuer: probe.issuer,
    ...(probe.authorizationError ? { error: probe.authorizationError } : {}),
  };
}

/** Resolves null when the handshake can't complete (timeout, refused, DNS). */
export function probeTls(hostname: string): Promise<TlsProbe | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port: 443,
      servername: hostname,
      rejectUnauthorized: false, // we want to inspect bad certs, not throw
      timeout: TLS_TIMEOUT_MS,
    });
    const finish = (probe: TlsProbe | null) => {
      socket.destroy();
      resolve(probe);
    };

    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      finish({
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ? String(socket.authorizationError) : null,
        validTo: cert?.valid_to ?? null,
        issuer: cert?.issuer?.O ?? cert?.issuer?.CN ?? null,
      });
    });
    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));
  });
}

export async function checkTls(hostname: string, now = Date.now()): Promise<SslCheck | null> {
  const probe = await probeTls(hostname);
  return probe ? interpretTls(probe, now) : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/tlsCheck.test.ts`
Expected: PASS (4 tests; network suite skipped).

Run: `RUN_NETWORK_TESTS=1 npx vitest run app/_shared/lib/audit/__tests__/tlsCheck.test.ts`
Expected: PASS (7 tests) when online.

- [ ] **Step 5: Checkpoint**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Do not commit.

---

### Task 5: Site fetch

**Files:**
- Create: `app/_shared/lib/audit/siteFetch.ts`
- Test: `app/_shared/lib/audit/__tests__/siteFetch.test.ts`

**Interfaces:**
- Produces: `interface RobotsFetch { status: number | null; body: string | null }`; `interface SiteFetchResult { ok: boolean; finalUrl: string | null; status: number | null; html: string | null; headers: Record<string, string>; robots: RobotsFetch; reason?: string }`; `fetchSite(website: string): Promise<SiteFetchResult>`; `readCapped(res, maxBytes): Promise<string>`.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/siteFetch.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/siteFetch.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/siteFetch`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/siteFetch.ts`**

```ts
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
    return { ok: true, ...base, html, robots };
  } catch {
    return failure('Site timed out while loading', base);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/audit/__tests__/siteFetch.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Do not commit.

---

### Task 6: Text normalisers

**Files:**
- Create: `app/_shared/lib/audit/analyzers/text.ts`
- Test: `app/_shared/lib/audit/__tests__/text.test.ts`

**Interfaces:**
- Produces: `nameTokens(name): string[]`, `nameSimilarity(a, b): number` (0..1), `phoneDigits(phone): string | null` (last 10 digits), `formatPhone(digits): string`, `normalizeAddress(address): string`, `addressParts(address): { streetNumber: string | null; zip: string | null }`, `containsWord(haystack, word): boolean`, `visibleText($: CheerioAPI): string`.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/text.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  addressParts,
  containsWord,
  formatPhone,
  nameSimilarity,
  normalizeAddress,
  phoneDigits,
  visibleText,
} from '@/app/_shared/lib/audit/analyzers/text';

describe('nameSimilarity', () => {
  it('ignores punctuation, legal suffixes and extra title words', () => {
    expect(nameSimilarity('Smile Dental, P.C.', 'Home | Smile Dental')).toBe(1);
    expect(nameSimilarity('Bright Smiles D.D.S.', 'Bright Smiles')).toBe(1);
  });

  it('scores unrelated names 0', () => {
    expect(nameSimilarity('Bright Smiles Family Dentistry', 'Downtown Dental Care')).toBe(0);
    expect(nameSimilarity('Acme LLC', 'LLC')).toBe(0);
  });
});

describe('phoneDigits', () => {
  it('reduces US formats to the last 10 digits', () => {
    expect(phoneDigits('(555) 123-4567')).toBe('5551234567');
    expect(phoneDigits('+1 555.123.4567')).toBe('5551234567');
    expect(phoneDigits('%2B15551234567')).toBe('5551234567');
  });

  it('drops extensions before taking the last 10 digits', () => {
    expect(phoneDigits('+1 (555) 123-4567 ext. 2')).toBe('5551234567');
    expect(phoneDigits('555-123-4567 x12')).toBe('5551234567');
  });

  it('returns null for numbers that are too short', () => {
    expect(phoneDigits('123-4567')).toBeNull();
  });

  it('formats 10 digits for display', () => {
    expect(formatPhone('5559990000')).toBe('(555) 999-0000');
  });
});

describe('addressParts', () => {
  it('extracts street number and ZIP', () => {
    expect(addressParts('123 Main Street, Suite 4, Springfield, IL 62701-1234, USA')).toEqual({
      streetNumber: '123',
      zip: '62701',
    });
  });

  it('does not mistake a 5-digit street number for the ZIP', () => {
    expect(addressParts('12345 Ocean Blvd, Miami, FL')).toEqual({ streetNumber: '12345', zip: null });
  });

  it('returns nulls for city-only addresses', () => {
    expect(addressParts('Springfield, IL, USA')).toEqual({ streetNumber: null, zip: null });
  });

  it('normalises common abbreviations', () => {
    expect(normalizeAddress('500 North Avenue, Ste. 2')).toBe('500 n ave ste 2');
  });

  it('matches whole words only', () => {
    expect(containsWord('123 main st 62701', '123')).toBe(true);
    expect(containsWord('1234 main st', '123')).toBe(false);
  });
});

describe('visibleText', () => {
  it('joins text across elements and skips scripts and styles', () => {
    const $ = cheerio.load('<body><h1>Hi</h1><script>var a = 1</script><p>there <b>friend</b></p><style>p{}</style></body>');
    expect(visibleText($)).toBe('Hi there friend');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/text.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/analyzers/text`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/analyzers/text.ts`**

```ts
// app/_shared/lib/audit/analyzers/text.ts

// Normalisers shared by the structured-data and NAP analyzers.

import type { CheerioAPI } from 'cheerio';

// Business-name words that don't identify the business
const NAME_STOPWORDS = new Set(['llc', 'inc', 'pc', 'pllc', 'dds', 'dmd', 'md', 'ltd', 'co', 'the']);

const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  street: 'st', avenue: 'ave', road: 'rd', boulevard: 'blvd', drive: 'dr', suite: 'ste',
  lane: 'ln', court: 'ct', place: 'pl', highway: 'hwy', parkway: 'pkwy',
  north: 'n', south: 's', east: 'e', west: 'w',
};

const SKIPPED_ELEMENTS = new Set(['script', 'style', 'noscript', 'template', 'svg']);

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\./g, '') // "D.D.S." → "dds"
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !NAME_STOPWORDS.has(token));
}

/** Share of the shorter name's tokens that appear in the other name (0..1). */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

/** Last 10 digits of a phone number, ignoring +1 and extensions; null if too short. */
export function phoneDigits(phone: string): string | null {
  const withoutExtension = phone.replace(/\s*(?:ext\.?|extension|x|#)\s*\d{1,6}\s*$/i, '');
  const digits = withoutExtension.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function formatPhone(digits: string): string {
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : digits;
}

export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ADDRESS_ABBREVIATIONS[word] ?? word)
    .join(' ');
}

/** Leading street number and last 5-digit ZIP of a US address. */
export function addressParts(address: string): { streetNumber: string | null; zip: string | null } {
  const norm = normalizeAddress(address);
  const streetNumber = norm.match(/^(\d+[a-z]?)\s/)?.[1] ?? null;
  // Search for the ZIP after the street number so "12345 Ocean Blvd" isn't read as a ZIP
  const rest = streetNumber ? norm.slice(streetNumber.length) : norm;
  const zips = rest.match(/\b\d{5}\b/g);
  return { streetNumber, zip: zips ? zips[zips.length - 1] : null };
}

/** `word` must be alphanumeric (street numbers, ZIPs). */
export function containsWord(haystack: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(haystack);
}

type DomNode = { type: string; name?: string; data?: string; children?: DomNode[] };

function collectText(node: DomNode, out: string[]): void {
  if (node.type === 'text' && node.data) out.push(node.data);
  if (node.name && SKIPPED_ELEMENTS.has(node.name)) return;
  node.children?.forEach((child) => collectText(child, out));
}

/** Visible body text, space-separated across elements, whitespace collapsed. */
export function visibleText($: CheerioAPI): string {
  const body = $('body').get(0) as unknown as DomNode | undefined;
  if (!body) return '';
  const parts: string[] = [];
  collectText(body, parts);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/audit/__tests__/text.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Do not commit.

---

### Task 7: Structured data parser

**Files:**
- Create: `app/_shared/lib/audit/analyzers/structuredData.ts`
- Test: `app/_shared/lib/audit/__tests__/structuredData.test.ts`

**Interfaces:**
- Consumes: `isLocalBusinessType` (Task 1), `nameSimilarity` (Task 6).
- Produces: `interface BusinessEntity { types: string[]; name: string | null; address: string | null; telephone: string | null; hasHours: boolean; hasGeo: boolean; hasSameAs: boolean }`; `interface StructuredData { blocks: number; types: string[]; entity: BusinessEntity | null }`; `parseStructuredData($: CheerioAPI, preferredName: string | null): StructuredData`.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/structuredData.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { parseStructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';

const ld = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const page = (...blocks: string[]) => cheerio.load(`<html><head>${blocks.join('')}</head><body></body></html>`);

describe('parseStructuredData', () => {
  it('reads a business entity with address, phone and hours', () => {
    const $ = page(
      ld({
        '@context': 'https://schema.org',
        '@type': 'Dentist',
        name: 'Smile Dental',
        telephone: '+1 555-123-4567',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '123 Main St',
          addressLocality: 'Springfield',
          addressRegion: 'IL',
          postalCode: '62701',
        },
        openingHours: 'Mo-Fr 09:00-17:00',
      })
    );
    const sd = parseStructuredData($, 'Smile Dental');
    expect(sd.blocks).toBe(1);
    expect(sd.types).toEqual(expect.arrayContaining(['Dentist', 'PostalAddress']));
    expect(sd.entity).toMatchObject({
      types: ['Dentist'],
      name: 'Smile Dental',
      telephone: '+1 555-123-4567',
      address: '123 Main St, Springfield, IL, 62701',
      hasHours: true,
      hasGeo: false,
    });
  });

  it('handles @type arrays and a multi-location @graph, preferring the Google name', () => {
    const $ = page(
      ld({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Smile Group' },
          { '@type': ['Dentist', 'LocalBusiness'], name: 'Smile Dental Downtown', telephone: '555-000-0000' },
          { '@type': ['Dentist', 'LocalBusiness'], name: 'Smile Dental Uptown', telephone: '555-111-1111' },
        ],
      })
    );
    const sd = parseStructuredData($, 'Smile Dental Uptown');
    expect(sd.entity?.name).toBe('Smile Dental Uptown');
    expect(sd.entity?.types).toEqual(['Dentist', 'LocalBusiness']);
  });

  it('skips invalid JSON-LD blocks and falls back to an Organization', () => {
    const $ = page('<script type="application/ld+json">{ bad json</script>', ld({ '@type': 'Organization', name: 'Acme' }));
    const sd = parseStructuredData($, 'Acme');
    expect(sd.blocks).toBe(1);
    expect(sd.entity?.types).toEqual(['Organization']);
  });

  it('strips schema.org URL prefixes and CDATA wrappers', () => {
    const $ = page(
      `<script type="application/ld+json">/* <![CDATA[ */${JSON.stringify({ '@type': 'http://schema.org/Dentist', name: 'Smile' })}/* ]]> */</script>`
    );
    expect(parseStructuredData($, null).entity?.types).toEqual(['Dentist']);
  });

  it('returns no entity when only page-level types exist', () => {
    const sd = parseStructuredData(page(ld({ '@type': 'WebSite', name: 'Acme' })), 'Acme');
    expect(sd.entity).toBeNull();
    expect(sd.types).toEqual(['WebSite']);
  });

  it('reports zero blocks for pages without JSON-LD', () => {
    expect(parseStructuredData(page(), null)).toEqual({ blocks: 0, types: [], entity: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/structuredData.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/analyzers/structuredData`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/analyzers/structuredData.ts`**

```ts
// app/_shared/lib/audit/analyzers/structuredData.ts

// Reads JSON-LD blocks and picks the business entity GEO and NAP check against.

import type { CheerioAPI } from 'cheerio';
import { isLocalBusinessType } from '@/app/_shared/lib/audit/nicheTypes';
import { nameSimilarity } from '@/app/_shared/lib/audit/analyzers/text';

export interface BusinessEntity {
  types: string[];
  name: string | null;
  address: string | null;
  telephone: string | null;
  hasHours: boolean;
  hasGeo: boolean;
  hasSameAs: boolean;
}

export interface StructuredData {
  /** Number of parseable JSON-LD blocks */
  blocks: number;
  /** Every @type seen, deduped */
  types: string[];
  entity: BusinessEntity | null;
}

type JsonNode = Record<string, unknown>;

const MAX_DEPTH = 8;

function toArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function typesOf(node: JsonNode): string[] {
  return toArray(node['@type'])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.replace(/^https?:\/\/schema\.org\//, ''));
}

// Walks @graph, arrays and nested values, collecting every typed object
function collectNodes(value: unknown, out: JsonNode[], depth = 0): void {
  if (depth > MAX_DEPTH || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectNodes(item, out, depth + 1));
    return;
  }
  const node = value as JsonNode;
  if (node['@type']) out.push(node);
  for (const child of Object.values(node)) collectNodes(child, out, depth + 1);
}

function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

function formatAddress(value: unknown): string | null {
  const first = toArray(value)[0];
  if (typeof first === 'string') return first.trim() || null;
  if (first && typeof first === 'object') {
    const a = first as JsonNode;
    const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].map(text).filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  return null;
}

function toEntity(node: JsonNode): BusinessEntity {
  return {
    types: typesOf(node),
    name: text(node.name),
    address: formatAddress(node.address),
    telephone: text(toArray(node.telephone)[0]),
    hasHours: Boolean(node.openingHours || node.openingHoursSpecification),
    hasGeo: Boolean(node.geo),
    hasSameAs: toArray(node.sameAs).length > 0,
  };
}

// Multi-location sites list several businesses: prefer the Google name, then completeness
function pickBest(nodes: JsonNode[], preferredName: string | null): JsonNode | null {
  if (nodes.length === 0) return null;
  const rank = (node: JsonNode) => {
    const e = toEntity(node);
    const nameScore = preferredName && e.name ? nameSimilarity(preferredName, e.name) : 0;
    const completeness = [e.name, e.address, e.telephone].filter(Boolean).length;
    return nameScore * 10 + completeness;
  };
  return [...nodes].sort((a, b) => rank(b) - rank(a))[0];
}

export function parseStructuredData($: CheerioAPI, preferredName: string | null): StructuredData {
  const nodes: JsonNode[] = [];
  let blocks = 0;

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el)
      .text()
      .replace(/^\s*\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\/\s*$/g, '');
    try {
      collectNodes(JSON.parse(raw), nodes);
      blocks++;
    } catch {
      /* invalid JSON-LD block — skip it */
    }
  });

  const types = [...new Set(nodes.flatMap(typesOf))];
  const businesses = nodes.filter((n) => typesOf(n).some(isLocalBusinessType));
  const organizations = nodes.filter((n) => typesOf(n).includes('Organization'));
  const best = pickBest(businesses, preferredName) ?? pickBest(organizations, preferredName);

  return { blocks, types, entity: best ? toEntity(best) : null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/audit/__tests__/structuredData.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Do not commit.

---

### Task 8: NAP comparison

**Files:**
- Create: `app/_shared/lib/audit/analyzers/nap.ts`
- Test: `app/_shared/lib/audit/__tests__/nap.test.ts`

**Interfaces:**
- Consumes: `NapResult`, `NapStatus` (Task 1); `BusinessEntity` (Task 7); `addressParts`, `containsWord`, `nameSimilarity`, `normalizeAddress`, `phoneDigits` (Task 6).
- Produces: `interface GoogleNap { name: string; address: string; phone: string | null }`; `interface SiteNapSignals { entity: BusinessEntity | null; siteName: string | null; telLinks: string[]; text: string }`; `extractNapSignals($, entity, text): SiteNapSignals`; `compareNap(google, site): NapResult` (`site.phones` are 10-digit strings).

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/nap.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { compareNap, extractNapSignals, type SiteNapSignals } from '@/app/_shared/lib/audit/analyzers/nap';
import type { BusinessEntity } from '@/app/_shared/lib/audit/analyzers/structuredData';

const google = { name: 'Smile Dental', address: '123 Main St, Springfield, IL 62701, USA', phone: '(555) 123-4567' };

const entity = (over: Partial<BusinessEntity> = {}): BusinessEntity => ({
  types: ['Dentist'],
  name: 'Smile Dental',
  address: '123 Main Street, Springfield, IL, 62701',
  telephone: '+1-555-123-4567',
  hasHours: false,
  hasGeo: false,
  hasSameAs: false,
  ...over,
});

const signals = (over: Partial<SiteNapSignals> = {}): SiteNapSignals => ({
  entity: entity(),
  siteName: 'Smile Dental',
  telLinks: [],
  text: '',
  ...over,
});

describe('compareNap', () => {
  it('matches all three fields from the schema entity', () => {
    expect(compareNap(google, signals())).toMatchObject({ name: 'match', address: 'match', phone: 'match' });
  });

  it('flags a phone mismatch and reports the site value', () => {
    const result = compareNap(google, signals({ entity: entity({ telephone: '555-999-0000' }) }));
    expect(result.phone).toBe('mismatch');
    expect(result.site.phones).toEqual(['5559990000']);
  });

  it('matches phones from tel: links and visible text with +1 and extensions', () => {
    const fromLink = compareNap(google, signals({ entity: null, telLinks: ['%2B15551234567'] }));
    expect(fromLink.phone).toBe('match');
    const fromText = compareNap(google, signals({ entity: null, text: 'Call us at 555.123.4567 ext. 2 today' }));
    expect(fromText.phone).toBe('match');
  });

  it('uses visible text for the address when the schema has none', () => {
    const result = compareNap(google, signals({ entity: null, text: 'Visit us: 123 Main St, Springfield IL 62701' }));
    expect(result.address).toBe('match');
  });

  it('flags a schema address that disagrees with Google', () => {
    const result = compareNap(google, signals({ entity: entity({ address: '900 Oak Ave, Springfield, IL, 62704' }) }));
    expect(result.address).toBe('mismatch');
  });

  it('reports missing when the site shows nothing', () => {
    expect(compareNap(google, signals({ entity: null, siteName: null, text: 'Welcome!' }))).toMatchObject({
      name: 'missing',
      address: 'missing',
      phone: 'missing',
    });
  });

  it('returns n/a for fields Google does not have', () => {
    const result = compareNap({ name: 'Smile Dental', address: 'Springfield, IL, USA', phone: null }, signals());
    expect(result).toMatchObject({ name: 'match', address: 'n/a', phone: 'n/a' });
  });
});

describe('extractNapSignals', () => {
  it('falls back to og:site_name, then <title>, and collects tel: links', () => {
    const $ = cheerio.load(
      '<head><title>Home | Smile Dental</title></head><body><a href="tel:+15551234567">Call</a></body>'
    );
    const s = extractNapSignals($, null, 'Call');
    expect(s.siteName).toBe('Home | Smile Dental');
    expect(s.telLinks).toEqual(['+15551234567']);

    const withOg = cheerio.load('<head><meta property="og:site_name" content="Smile Dental"><title>Home</title></head>');
    expect(extractNapSignals(withOg, null, '').siteName).toBe('Smile Dental');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/nap.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/analyzers/nap`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/analyzers/nap.ts`**

```ts
// app/_shared/lib/audit/analyzers/nap.ts

// Name / Address / Phone consistency between the website and the Google listing.

import type { CheerioAPI } from 'cheerio';
import type { NapResult, NapStatus } from '@/app/_shared/lib/audit/types';
import type { BusinessEntity } from '@/app/_shared/lib/audit/analyzers/structuredData';
import {
  addressParts,
  containsWord,
  nameSimilarity,
  normalizeAddress,
  phoneDigits,
} from '@/app/_shared/lib/audit/analyzers/text';

const NAME_MATCH_THRESHOLD = 0.6;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

export interface GoogleNap {
  name: string;
  address: string;
  phone: string | null;
}

export interface SiteNapSignals {
  entity: BusinessEntity | null;
  siteName: string | null;
  telLinks: string[];
  text: string;
}

export function extractNapSignals($: CheerioAPI, entity: BusinessEntity | null, text: string): SiteNapSignals {
  const telLinks = $('a[href^="tel:"]')
    .map((_, el) => ($(el).attr('href') ?? '').slice(4))
    .get();
  const ogName = $('meta[property="og:site_name"]').attr('content')?.trim() || null;
  const title = $('title').first().text().trim() || null;
  return { entity, siteName: entity?.name ?? ogName ?? title, telLinks, text };
}

function compareName(google: string, siteName: string | null): NapStatus {
  if (!google.trim()) return 'n/a';
  if (!siteName) return 'missing';
  return nameSimilarity(google, siteName) >= NAME_MATCH_THRESHOLD ? 'match' : 'mismatch';
}

// Match = site shows Google's street number AND ZIP (whichever Google has)
function compareAddress(google: string, siteAddress: string | null, text: string): NapStatus {
  const { streetNumber, zip } = addressParts(google);
  if (!streetNumber && !zip) return 'n/a';

  const matches = (candidate: string) => {
    const norm = normalizeAddress(candidate);
    return (!streetNumber || containsWord(norm, streetNumber)) && (!zip || containsWord(norm, zip));
  };
  if (siteAddress) return matches(siteAddress) ? 'match' : 'mismatch';
  return matches(text) ? 'match' : 'missing';
}

function comparePhone(google: string | null, sitePhones: string[]): NapStatus {
  const target = google ? phoneDigits(google) : null;
  if (!target) return 'n/a';
  if (sitePhones.length === 0) return 'missing';
  return sitePhones.includes(target) ? 'match' : 'mismatch';
}

export function compareNap(google: GoogleNap, site: SiteNapSignals): NapResult {
  const candidates = [site.entity?.telephone, ...site.telLinks, ...(site.text.match(PHONE_PATTERN) ?? [])];
  const phones = [
    ...new Set(
      candidates.flatMap((p) => {
        const digits = p ? phoneDigits(p) : null;
        return digits ? [digits] : [];
      })
    ),
  ];
  const siteAddress = site.entity?.address ?? null;

  return {
    name: compareName(google.name, site.siteName),
    address: compareAddress(google.address, siteAddress, site.text),
    phone: comparePhone(google.phone, phones),
    site: { name: site.siteName, address: siteAddress, phones },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/audit/__tests__/nap.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Do not commit.

---

### Task 9: GEO analyzer

**Files:**
- Create: `app/_shared/lib/audit/analyzers/geo.ts`
- Test: `app/_shared/lib/audit/__tests__/geo.test.ts`

**Interfaces:**
- Consumes: `Finding`, `GeoChecks`, `NapResult`, `NapStatus` (Task 1); `expectedTypesForNiche`, `isLocalBusinessType`, `isMedicalNiche` (Task 1); `StructuredData` (Task 7); `formatPhone` (Task 6).
- Produces: `analyzeGeo(structured: StructuredData, nap: NapResult, niche: string | null): { score: number; checks: GeoChecks }`. Finding ids: `geo.jsonld`, `geo.businessType`, `geo.entityComplete`, `geo.nap.name`, `geo.nap.address`, `geo.nap.phone`, `geo.extras`.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/geo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { analyzeGeo } from '@/app/_shared/lib/audit/analyzers/geo';
import type { BusinessEntity, StructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';
import type { GeoChecks, NapResult } from '@/app/_shared/lib/audit/types';

const entity = (over: Partial<BusinessEntity> = {}): BusinessEntity => ({
  types: ['Dentist'],
  name: 'Smile Dental',
  address: '123 Main St, Springfield, IL, 62701',
  telephone: '555-123-4567',
  hasHours: true,
  hasGeo: false,
  hasSameAs: false,
  ...over,
});

const structured = (e: BusinessEntity | null): StructuredData => ({ blocks: e ? 1 : 0, types: e?.types ?? [], entity: e });

const nap = (over: Partial<NapResult> = {}): NapResult => ({
  name: 'match',
  address: 'match',
  phone: 'match',
  site: { name: 'Smile Dental', address: null, phones: ['5551234567'] },
  ...over,
});

const finding = (checks: GeoChecks, id: string) => checks.findings.find((f) => f.id === id);

describe('analyzeGeo', () => {
  it('scores a complete, matching Dentist schema 100 with all passes', () => {
    const { score, checks } = analyzeGeo(structured(entity()), nap(), 'dentist');
    expect(score).toBe(100);
    expect(checks.findings.every((f) => f.status === 'pass')).toBe(true);
    expect(checks.schemaTypes).toEqual(['Dentist']);
  });

  it('gives partial credit and a warning for generic LocalBusiness on a dentist', () => {
    const { score, checks } = analyzeGeo(structured(entity({ types: ['LocalBusiness'] })), nap(), 'dentist');
    expect(score).toBe(90);
    expect(finding(checks, 'geo.businessType')).toMatchObject({
      status: 'warn',
      label: 'Use the more specific Dentist schema type',
    });
  });

  it('accepts any LocalBusiness type when the niche has no expected type', () => {
    expect(analyzeGeo(structured(entity({ types: ['Plumber'] })), nap(), 'plumber').score).toBe(100);
  });

  it('gives 5 points for Organization-only schema', () => {
    const { score, checks } = analyzeGeo(structured(entity({ types: ['Organization'] })), nap(), 'dentist');
    expect(score).toBe(80);
    expect(finding(checks, 'geo.businessType')?.status).toBe('warn');
  });

  it('scores 0 with no schema and nothing on the site', () => {
    const missing = nap({ name: 'missing', address: 'missing', phone: 'missing', site: { name: null, address: null, phones: [] } });
    const { score, checks } = analyzeGeo(structured(null), missing, 'dentist');
    expect(score).toBe(0);
    expect(finding(checks, 'geo.jsonld')?.status).toBe('fail');
    expect(finding(checks, 'geo.nap.phone')?.label).toBe('Phone number not found on the website');
  });

  it('awards NAP points but warns when Google lacks the field', () => {
    const { score, checks } = analyzeGeo(structured(entity()), nap({ phone: 'n/a' }), 'dentist');
    expect(score).toBe(100);
    expect(finding(checks, 'geo.nap.phone')).toMatchObject({ status: 'warn', label: 'Google listing has no phone number' });
  });

  it('shows the site value on a mismatch', () => {
    const { score, checks } = analyzeGeo(
      structured(entity()),
      nap({ phone: 'mismatch', site: { name: 'Smile Dental', address: null, phones: ['5559990000'] } }),
      'dentist'
    );
    expect(score).toBe(85);
    expect(finding(checks, 'geo.nap.phone')).toMatchObject({ status: 'fail', detail: 'Site shows: (555) 999-0000' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/geo.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/analyzers/geo`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/analyzers/geo.ts`**

```ts
// app/_shared/lib/audit/analyzers/geo.ts

// GEO (Generative Engine Optimization): can AI search engines read who this
// business is, and does it agree with the Google listing? Rubric: see spec.

import type { Finding, GeoChecks, NapResult, NapStatus } from '@/app/_shared/lib/audit/types';
import type { StructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';
import { expectedTypesForNiche, isLocalBusinessType, isMedicalNiche } from '@/app/_shared/lib/audit/nicheTypes';
import { formatPhone } from '@/app/_shared/lib/audit/analyzers/text';

function napPoints(status: NapStatus, points: number): number {
  // n/a = Google has no value to compare — not the website's fault
  return status === 'match' || status === 'n/a' ? points : 0;
}

function napFinding(id: string, label: string, status: NapStatus, siteValue: string | null): Finding {
  switch (status) {
    case 'match':
      return { id, status: 'pass', label: `${label} matches Google listing` };
    case 'mismatch':
      return {
        id,
        status: 'fail',
        label: `${label} on site doesn't match Google listing`,
        ...(siteValue ? { detail: `Site shows: ${siteValue}` } : {}),
      };
    case 'missing':
      return { id, status: 'fail', label: `${label} not found on the website` };
    case 'n/a':
      return { id, status: 'warn', label: `Google listing has no ${label.toLowerCase()}` };
  }
}

export function analyzeGeo(
  structured: StructuredData,
  nap: NapResult,
  niche: string | null
): { score: number; checks: GeoChecks } {
  const findings: Finding[] = [];
  let score = 0;
  const add = (points: number, finding: Finding) => {
    score += points;
    findings.push(finding);
  };

  // 1. JSON-LD present (15)
  add(
    structured.blocks > 0 ? 15 : 0,
    structured.blocks > 0
      ? { id: 'geo.jsonld', status: 'pass', label: 'Structured data (JSON-LD) found' }
      : { id: 'geo.jsonld', status: 'fail', label: 'No structured data (JSON-LD) on the homepage' }
  );

  // 2. Business-type entity (25), niche-aware
  const entity = structured.entity;
  const entityTypes = entity?.types ?? [];
  const expected = expectedTypesForNiche(niche);
  const wanted = expected?.[0] ?? 'LocalBusiness';
  const isBusiness = entityTypes.some(isLocalBusinessType);

  if (isBusiness && (!expected || entityTypes.some((t) => expected.includes(t)))) {
    add(25, { id: 'geo.businessType', status: 'pass', label: `Business schema type: ${entityTypes.join(', ')}` });
  } else if (isBusiness) {
    add(15, {
      id: 'geo.businessType',
      status: 'warn',
      label: `Use the more specific ${wanted} schema type`,
      detail: `Found ${entityTypes.join(', ')}`,
    });
  } else if (entityTypes.includes('Organization')) {
    add(5, { id: 'geo.businessType', status: 'warn', label: `Only generic Organization schema — add ${wanted}` });
  } else {
    add(0, { id: 'geo.businessType', status: 'fail', label: `No ${wanted} schema for AI search engines to read` });
  }

  // 3. Entity completeness (5 each for name, address, telephone)
  const fields: [string, string | null | undefined][] = [
    ['name', entity?.name],
    ['address', entity?.address],
    ['telephone', entity?.telephone],
  ];
  const missing = fields.filter(([, value]) => !value).map(([key]) => key);
  add(
    (fields.length - missing.length) * 5,
    missing.length === 0
      ? { id: 'geo.entityComplete', status: 'pass', label: 'Schema includes name, address and phone' }
      : { id: 'geo.entityComplete', status: entity ? 'warn' : 'fail', label: `Schema is missing ${missing.join(', ')}` }
  );

  // 4. NAP vs Google (10 / 15 / 15)
  add(napPoints(nap.name, 10), napFinding('geo.nap.name', 'Business name', nap.name, nap.site.name));
  add(napPoints(nap.address, 15), napFinding('geo.nap.address', 'Address', nap.address, nap.site.address));
  add(
    napPoints(nap.phone, 15),
    napFinding('geo.nap.phone', 'Phone number', nap.phone, nap.site.phones.map(formatPhone).join(', ') || null)
  );

  // 5. Extras (5)
  const hasMedicalPage = isMedicalNiche(niche) && structured.types.includes('MedicalWebPage');
  const hasExtras = Boolean(entity?.hasHours || entity?.hasGeo || entity?.hasSameAs || hasMedicalPage);
  add(
    hasExtras ? 5 : 0,
    hasExtras
      ? { id: 'geo.extras', status: 'pass', label: 'Schema includes hours, map location or social profiles' }
      : { id: 'geo.extras', status: 'warn', label: 'Add opening hours, map coordinates or social profiles to the schema' }
  );

  return { score, checks: { findings, schemaTypes: structured.types, nap } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/audit/__tests__/geo.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Do not commit.

---

### Task 10: AEO analyzer

**Files:**
- Create: `app/_shared/lib/audit/analyzers/aeo.ts`
- Test: `app/_shared/lib/audit/__tests__/aeo.test.ts`

**Interfaces:**
- Consumes: `AeoChecks`, `Finding` (Task 1); `StructuredData` (Task 7).
- Produces: `analyzeAeo($: CheerioAPI, structured: StructuredData): { score: number; checks: AeoChecks }`. Finding ids: `aeo.h1`, `aeo.h2`, `aeo.hierarchy`, `aeo.questions`, `aeo.faqSchema`, `aeo.faqSection`.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/aeo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { analyzeAeo } from '@/app/_shared/lib/audit/analyzers/aeo';
import type { StructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';

const NO_SCHEMA: StructuredData = { blocks: 0, types: [], entity: null };
const FAQ_SCHEMA: StructuredData = { blocks: 1, types: ['FAQPage'], entity: null };
const run = (body: string, sd = NO_SCHEMA) => analyzeAeo(cheerio.load(`<body>${body}</body>`), sd);

describe('analyzeAeo', () => {
  it('scores a well-structured Q&A page 100', () => {
    const { score, checks } = run(
      `<h1>Smile Dental</h1>
       <h2>Our Services</h2>
       <h2>How much does a crown cost?</h2>
       <h2>Is teeth whitening safe</h2>
       <h3>FAQ</h3>
       <details><summary>Do you see kids?</summary>Yes</details>`,
      FAQ_SCHEMA
    );
    expect(score).toBe(100);
    expect(checks).toMatchObject({ h1Count: 1, h2Count: 3, questionHeadings: 2, hasFaqSchema: true });
  });

  it('fails multiple H1s', () => {
    const { checks } = run('<h1>A</h1><h1>B</h1><h1>C</h1>');
    expect(checks.findings.find((f) => f.id === 'aeo.h1')).toMatchObject({
      status: 'fail',
      label: '3 H1 headings (should be 1)',
    });
  });

  it('fails skipped heading levels', () => {
    const { checks } = run('<h1>Title</h1><h3>Jumped</h3>');
    expect(checks.findings.find((f) => f.id === 'aeo.hierarchy')?.status).toBe('fail');
  });

  it('fails the hierarchy check when a page has no headings', () => {
    const { score, checks } = run('<p>Just text</p>');
    expect(score).toBe(0);
    expect(checks.findings.find((f) => f.id === 'aeo.hierarchy')?.label).toBe('No headings on the page');
  });

  it('only counts H2–H4 question headings', () => {
    const { checks } = run('<h1>X</h1><h2>Our Services</h2><h5>What about H5?</h5><h4>Why choose us?</h4>');
    expect(checks.questionHeadings).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/aeo.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/analyzers/aeo`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/analyzers/aeo.ts`**

```ts
// app/_shared/lib/audit/analyzers/aeo.ts

// AEO (Answer Engine Optimization): is the page structured so ChatGPT,
// Perplexity and Google's AI answers can lift clear Q&A from it? Rubric: see spec.

import type { CheerioAPI } from 'cheerio';
import type { AeoChecks, Finding } from '@/app/_shared/lib/audit/types';
import type { StructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';

const QUESTION_START = /^(what|how|why|when|where|who|which|can|do|does|is|are|should|will)\b/i;
const FAQ_HEADING = /\bfaqs?\b|frequently asked/i;

interface Heading {
  level: number;
  text: string;
}

function readHeadings($: CheerioAPI): Heading[] {
  return $('h1, h2, h3, h4, h5, h6')
    .map((_, el) => ({
      level: Number(el.tagName.slice(1)),
      text: $(el).text().replace(/\s+/g, ' ').trim(),
    }))
    .get();
}

export function analyzeAeo($: CheerioAPI, structured: StructuredData): { score: number; checks: AeoChecks } {
  const headings = readHeadings($);
  const h1Count = headings.filter((h) => h.level === 1).length;
  const h2Count = headings.filter((h) => h.level === 2).length;
  const skipsLevel = headings.some((h, i) => i > 0 && h.level > headings[i - 1].level + 1);
  const questionHeadings = headings.filter(
    (h) => h.level >= 2 && h.level <= 4 && (h.text.endsWith('?') || QUESTION_START.test(h.text))
  ).length;
  const hasFaqSchema = structured.types.some((t) => t === 'FAQPage' || t === 'QAPage');
  const hasFaqSection = $('details summary').length > 0 || headings.some((h) => FAQ_HEADING.test(h.text));

  const findings: Finding[] = [];
  let score = 0;
  const check = (id: string, ok: boolean, points: number, pass: string, fail: string) => {
    if (ok) score += points;
    findings.push({ id, status: ok ? 'pass' : 'fail', label: ok ? pass : fail });
  };

  check('aeo.h1', h1Count === 1, 20, 'One H1 heading', h1Count === 0 ? 'No H1 heading' : `${h1Count} H1 headings (should be 1)`);
  check(
    'aeo.h2',
    h2Count >= 3,
    15,
    `${h2Count} H2 sections`,
    `Only ${h2Count} H2 section${h2Count === 1 ? '' : 's'} (aim for 3+)`
  );
  check(
    'aeo.hierarchy',
    headings.length > 0 && !skipsLevel,
    10,
    'Heading levels are in order',
    headings.length === 0 ? 'No headings on the page' : 'Heading levels skip (e.g. H1 → H3)'
  );
  check(
    'aeo.questions',
    questionHeadings >= 2,
    20,
    `${questionHeadings} question-style headings`,
    questionHeadings === 0 ? 'No question-style headings' : 'Only 1 question-style heading (aim for 2+)'
  );
  check('aeo.faqSchema', hasFaqSchema, 20, 'FAQ schema (FAQPage) found', 'No FAQPage schema');
  check('aeo.faqSection', hasFaqSection, 15, 'Visible FAQ / Q&A section', 'No FAQ / Q&A section');

  return { score, checks: { findings, h1Count, h2Count, questionHeadings, hasFaqSchema } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/audit/__tests__/aeo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Do not commit.

---

### Task 11: SEO basics analyzer

**Files:**
- Create: `app/_shared/lib/audit/analyzers/seoBasics.ts`
- Test: `app/_shared/lib/audit/__tests__/seoBasics.test.ts`

**Interfaces:**
- Consumes: `Finding`, `RobotsTxtStatus`, `SeoBasics` (Task 1); `RobotsFetch` (Task 5).
- Produces: `analyzeSeoBasics($, headers: Record<string, string>, robots: RobotsFetch): SeoBasics`; `robotsTxtStatus(robots: RobotsFetch): RobotsTxtStatus`. Finding ids: `seo.title`, `seo.metaDescription`, `seo.canonical`, `seo.viewport`, `seo.noindex`, `seo.robots`.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/seoBasics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { analyzeSeoBasics, robotsTxtStatus } from '@/app/_shared/lib/audit/analyzers/seoBasics';

const ROBOTS_OK = { status: 200, body: 'User-agent: *\nDisallow:' };

const FULL_HEAD = `<head>
  <title>Smile Dental | Springfield Family Dentist</title>
  <meta name="description" content="Gentle family dentistry in Springfield, IL — cleanings, crowns and whitening.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://smiledental.com/">
</head>`;

describe('analyzeSeoBasics', () => {
  it('passes a well-formed page', () => {
    const seo = analyzeSeoBasics(cheerio.load(FULL_HEAD), {}, ROBOTS_OK);
    expect(seo).toMatchObject({
      title: 'Smile Dental | Springfield Family Dentist',
      canonical: 'https://smiledental.com/',
      viewport: true,
      noindex: false,
      robotsTxt: 'ok',
    });
    expect(seo.findings.every((f) => f.status === 'pass')).toBe(true);
  });

  it('flags a missing title and a short description', () => {
    const seo = analyzeSeoBasics(cheerio.load('<head><meta name="description" content="Dentist"></head>'), {}, ROBOTS_OK);
    expect(seo.findings.find((f) => f.id === 'seo.title')).toMatchObject({ status: 'fail', label: 'Page title missing' });
    expect(seo.findings.find((f) => f.id === 'seo.metaDescription')).toMatchObject({
      status: 'warn',
      label: 'Meta description is 7 characters (aim for 50–160)',
    });
    expect(seo.findings.find((f) => f.id === 'seo.viewport')?.status).toBe('fail');
  });

  it('detects noindex from the X-Robots-Tag header', () => {
    const seo = analyzeSeoBasics(cheerio.load(FULL_HEAD), { 'x-robots-tag': 'noindex, nofollow' }, ROBOTS_OK);
    expect(seo.noindex).toBe(true);
    expect(seo.findings.find((f) => f.id === 'seo.noindex')?.status).toBe('fail');
  });
});

describe('robotsTxtStatus', () => {
  it('detects a robots.txt that blocks everyone', () => {
    expect(robotsTxtStatus({ status: 200, body: 'User-agent: Googlebot\nUser-agent: *\nDisallow: /' })).toBe('blocks-all');
  });

  it('allows partial disallows and non-* groups', () => {
    expect(robotsTxtStatus({ status: 200, body: 'User-agent: *\nDisallow: /private' })).toBe('ok');
    expect(robotsTxtStatus({ status: 200, body: 'User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow:' })).toBe('ok');
  });

  it('reports missing and unknown robots.txt', () => {
    expect(robotsTxtStatus({ status: 404, body: null })).toBe('missing');
    expect(robotsTxtStatus({ status: null, body: null })).toBe('unknown');
    expect(robotsTxtStatus({ status: 500, body: null })).toBe('unknown');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/seoBasics.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/analyzers/seoBasics`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/analyzers/seoBasics.ts`**

```ts
// app/_shared/lib/audit/analyzers/seoBasics.ts

// SEO basics read straight from the homepage HTML. Displayed (not scored) —
// the fallback when PageSpeed's SEO category is unavailable.

import type { CheerioAPI } from 'cheerio';
import type { Finding, RobotsTxtStatus, SeoBasics } from '@/app/_shared/lib/audit/types';
import type { RobotsFetch } from '@/app/_shared/lib/audit/siteFetch';

// True when the `User-agent: *` group contains `Disallow: /`
function blocksAll(body: string): boolean {
  let inStarGroup = false;
  let previousWasAgent = false;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'user-agent') {
      // Consecutive User-agent lines share one group
      inStarGroup = previousWasAgent ? inStarGroup || value === '*' : value === '*';
      previousWasAgent = true;
      continue;
    }
    previousWasAgent = false;
    if (inStarGroup && key === 'disallow' && value === '/') return true;
  }
  return false;
}

export function robotsTxtStatus(robots: RobotsFetch): RobotsTxtStatus {
  if (robots.status === 404 || robots.status === 410) return 'missing';
  if (robots.status !== 200 || robots.body === null) return 'unknown';
  return blocksAll(robots.body) ? 'blocks-all' : 'ok';
}

function lengthFinding(id: string, name: string, value: string | null, min: number, max: number): Finding {
  if (!value) return { id, status: 'fail', label: `${name} missing` };
  if (value.length < min || value.length > max) {
    return { id, status: 'warn', label: `${name} is ${value.length} characters (aim for ${min}–${max})` };
  }
  return { id, status: 'pass', label: `${name} present` };
}

function robotsFinding(status: RobotsTxtStatus): Finding {
  switch (status) {
    case 'ok':
      return { id: 'seo.robots', status: 'pass', label: 'robots.txt allows search engines' };
    case 'missing':
      return { id: 'seo.robots', status: 'warn', label: 'No robots.txt file' };
    case 'blocks-all':
      return { id: 'seo.robots', status: 'fail', label: 'robots.txt blocks all search engines' };
    case 'unknown':
      return { id: 'seo.robots', status: 'warn', label: "Couldn't check robots.txt" };
  }
}

export function analyzeSeoBasics($: CheerioAPI, headers: Record<string, string>, robots: RobotsFetch): SeoBasics {
  const title = $('title').first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;
  const viewport = $('meta[name="viewport"]').length > 0;
  const metaRobots = $('meta[name="robots"]').attr('content') ?? '';
  const noindex = /noindex/i.test(metaRobots) || /noindex/i.test(headers['x-robots-tag'] ?? '');
  const robotsTxt = robotsTxtStatus(robots);

  const findings: Finding[] = [
    lengthFinding('seo.title', 'Page title', title, 10, 60),
    lengthFinding('seo.metaDescription', 'Meta description', metaDescription, 50, 160),
    canonical
      ? { id: 'seo.canonical', status: 'pass', label: 'Canonical URL set' }
      : { id: 'seo.canonical', status: 'warn', label: 'No canonical URL' },
    viewport
      ? { id: 'seo.viewport', status: 'pass', label: 'Mobile viewport set' }
      : { id: 'seo.viewport', status: 'fail', label: 'Not set up for mobile (no viewport tag)' },
    noindex
      ? { id: 'seo.noindex', status: 'fail', label: 'Page tells Google not to index it (noindex)' }
      : { id: 'seo.noindex', status: 'pass', label: 'Page can be indexed' },
    robotsFinding(robotsTxt),
  ];

  return { title, metaDescription, canonical, viewport, noindex, robotsTxt, findings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/audit/__tests__/seoBasics.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm test && npx tsc --noEmit`
Expected: all green. Do not commit.

---

### Task 12: `runAudit` orchestrator

**Files:**
- Create: `app/_shared/lib/audit/runAudit.ts`
- Create: `app/_shared/lib/audit/__tests__/fixtures.ts`
- Test: `app/_shared/lib/audit/__tests__/runAudit.test.ts`

**Interfaces:**
- Consumes: `runPageSpeed`, `categoryScore`, `PageSpeedResult` (Task 3); `fetchSite`, `SiteFetchResult` (Task 5); `checkTls` (Task 4); `parseStructuredData` (Task 7); `extractNapSignals`, `compareNap` (Task 8); `analyzeGeo` (Task 9); `analyzeAeo` (Task 10); `analyzeSeoBasics` (Task 11); `visibleText` (Task 6); types (Task 1).
- Produces: `class AuditUnavailableError extends Error`; `interface AuditDeps { runPageSpeed; fetchSite; checkTls; now: () => number }`; `runAudit(input: AuditInput, deps?: AuditDeps): Promise<AuditOutcome>`.

- [ ] **Step 1: Create the HTML fixtures**

`app/_shared/lib/audit/__tests__/fixtures.ts`:
```ts
// HTML fixtures for audit-engine tests

export const DENTIST_HOME = `<!doctype html><html><head>
<title>Smile Dental | Family Dentist in Springfield</title>
<meta name="description" content="Gentle family dentistry in Springfield, IL. Cleanings, crowns, whitening and emergency care. Book online today.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://smiledental.com/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Dentist","name":"Smile Dental","telephone":"+1-555-123-4567","address":{"@type":"PostalAddress","streetAddress":"123 Main St","addressLocality":"Springfield","addressRegion":"IL","postalCode":"62701"},"openingHours":"Mo-Fr 08:00-17:00"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script>
</head><body>
<h1>Smile Dental</h1>
<p>Welcome to Smile Dental, Springfield's family dentist since 1998. We offer cleanings, fillings, crowns, whitening and same-day emergency appointments for patients of all ages.</p>
<h2>Our Services</h2><p>Preventive care, cosmetic dentistry and restorative treatments.</p>
<h2>How much does a dental crown cost?</h2><p>Most crowns cost between $900 and $1,500 depending on the material.</p>
<h2>Do you accept insurance?</h2><p>Yes, we accept most major PPO plans.</p>
<h3>FAQ</h3><details><summary>Do you see children?</summary><p>Yes, from age 2.</p></details>
<footer>123 Main St, Springfield, IL 62701 · <a href="tel:+15551234567">(555) 123-4567</a></footer>
</body></html>`;

// A client-rendered app shell: real content only appears after JavaScript runs
export const JS_SHELL = `<!doctype html><html><head><title>Loading…</title></head>
<body><div id="root"></div><script src="/static/app.js"></script></body></html>`;
```

- [ ] **Step 2: Write the failing test**

`app/_shared/lib/audit/__tests__/runAudit.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { runAudit, AuditUnavailableError, type AuditDeps } from '@/app/_shared/lib/audit/runAudit';
import type { PageSpeedResult, PageSpeedStrategy } from '@/app/_shared/lib/audit/pageSpeed';
import type { SiteFetchResult } from '@/app/_shared/lib/audit/siteFetch';
import type { AuditInput } from '@/app/_shared/lib/audit/types';
import { DENTIST_HOME, JS_SHELL } from '@/app/_shared/lib/audit/__tests__/fixtures';

const psiOk = (perf: number, seo: number | null, isOnHttps: boolean | null = true): PageSpeedResult => ({
  ok: true,
  isOnHttps,
  summary: {
    categories: { performance: { score: perf, title: 'Performance' }, seo: { score: seo, title: 'SEO' } },
    keyAudits: {},
  },
});
const psiFail: PageSpeedResult = { ok: false, reason: 'FAILED_DOCUMENT_REQUEST' };

const siteOk = (html: string, finalUrl = 'https://smiledental.com/'): SiteFetchResult => ({
  ok: true,
  finalUrl,
  status: 200,
  html,
  headers: { 'content-type': 'text/html' },
  robots: { status: 200, body: 'User-agent: *\nDisallow:' },
});
const siteBlocked: SiteFetchResult = {
  ok: false,
  finalUrl: 'https://smiledental.com/',
  status: 403,
  html: null,
  headers: {},
  robots: { status: null, body: null },
  reason: 'Blocked (403)',
};

const input: AuditInput = {
  website: 'http://smiledental.com',
  name: 'Smile Dental',
  address: '123 Main St, Springfield, IL 62701, USA',
  phone: '(555) 123-4567',
  niche: 'dentist',
};

function deps(over: Partial<AuditDeps> = {}): AuditDeps {
  return {
    runPageSpeed: vi.fn(async (_url: string, strategy: PageSpeedStrategy) =>
      strategy === 'mobile' ? psiOk(0.38, 0.71) : psiOk(0.42, 0.7)
    ),
    fetchSite: vi.fn(async () => siteOk(DENTIST_HOME)),
    checkTls: vi.fn(async () => ({ valid: true, daysToExpiry: 60, issuer: "Let's Encrypt" })),
    now: () => 0,
    ...over,
  };
}

describe('runAudit', () => {
  it('maps PageSpeed, TLS and page checks into the audit row', async () => {
    const { row } = await runAudit(input, deps());
    expect(row).toMatchObject({
      performance_score: 42,
      mobile_score: 38,
      seo_score: 71,
      ssl_valid: true,
      geo_score: 100,
      aeo_score: 100,
      engine_version: 2,
    });
    expect(row.checks.psi).toEqual({ mobile: 'ok', desktop: 'ok' });
    expect(row.checks.geo?.nap).toMatchObject({ name: 'match', address: 'match', phone: 'match' });
    expect(row.checks.site).toEqual({ ok: true, finalUrl: 'https://smiledental.com/', status: 200 });
  });

  it('stores null scores (not 0) when PageSpeed fails, keeping page checks', async () => {
    const { row } = await runAudit(input, deps({ runPageSpeed: vi.fn(async () => psiFail) }));
    expect(row).toMatchObject({ performance_score: null, mobile_score: null, seo_score: null, geo_score: 100 });
    expect(row.checks.psi).toEqual({ mobile: 'FAILED_DOCUMENT_REQUEST', desktop: 'FAILED_DOCUMENT_REQUEST' });
    expect(row.checks.seo?.title).toContain('Smile Dental');
    expect(row.raw_json).toEqual({ mobile: null, desktop: null });
  });

  it('uses desktop SEO when the mobile run failed', async () => {
    const runPageSpeed = vi.fn(async (_url: string, strategy: PageSpeedStrategy) =>
      strategy === 'mobile' ? psiFail : psiOk(0.42, 0.66)
    );
    const { row } = await runAudit(input, deps({ runPageSpeed }));
    expect(row).toMatchObject({ mobile_score: null, seo_score: 66, performance_score: 42 });
  });

  it('throws AuditUnavailableError when PageSpeed and the site both fail', async () => {
    const failingDeps = deps({ runPageSpeed: vi.fn(async () => psiFail), fetchSite: vi.fn(async () => siteBlocked) });
    await expect(runAudit(input, failingDeps)).rejects.toBeInstanceOf(AuditUnavailableError);
  });

  it('falls back to PageSpeed is-on-https when the TLS handshake fails', async () => {
    const { row } = await runAudit(input, deps({ checkTls: vi.fn(async () => null) }));
    expect(row.ssl_valid).toBe(true);
    expect(row.checks.ssl.error).toBe('TLS handshake could not complete');

    const unknown = await runAudit(
      input,
      deps({ checkTls: vi.fn(async () => null), runPageSpeed: vi.fn(async () => psiFail) })
    );
    expect(unknown.row.ssl_valid).toBeNull();
  });

  it('checks TLS against the final hostname after redirects', async () => {
    const checkTls = vi.fn(async () => ({ valid: true, daysToExpiry: 60, issuer: null }));
    await runAudit(input, deps({ checkTls, fetchSite: vi.fn(async () => siteOk(DENTIST_HOME, 'https://www.smiledental.com/')) }));
    expect(checkTls).toHaveBeenCalledWith('www.smiledental.com');
  });

  it('flags JavaScript-only pages instead of scoring them', async () => {
    const { row } = await runAudit(input, deps({ fetchSite: vi.fn(async () => siteOk(JS_SHELL)) }));
    expect(row.geo_score).toBeNull();
    expect(row.aeo_score).toBeNull();
    expect(row.checks.site.reason).toBe('Content loads via JavaScript — checks limited');
    expect(row.checks.seo?.title).toBe('Loading…');
  });

  it('keeps PageSpeed scores when the site blocks the crawler', async () => {
    const { row } = await runAudit(input, deps({ fetchSite: vi.fn(async () => siteBlocked) }));
    expect(row).toMatchObject({ performance_score: 42, geo_score: null, aeo_score: null });
    expect(row.checks.site.reason).toBe('Blocked (403)');
    expect(row.checks.seo).toBeNull();
  });

  it('passes the homepage HTML to email discovery and survives its failure', async () => {
    const discoverEmail = vi.fn(async () => 'hello@smiledental.com');
    const found = await runAudit({ ...input, discoverEmail }, deps());
    expect(found.email).toBe('hello@smiledental.com');
    expect(discoverEmail).toHaveBeenCalledWith(DENTIST_HOME);

    const failing = await runAudit({ ...input, discoverEmail: vi.fn(async () => { throw new Error('boom'); }) }, deps());
    expect(failing.email).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/runAudit.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/runAudit`.

- [ ] **Step 4: Implement `app/_shared/lib/audit/runAudit.ts`**

```ts
// app/_shared/lib/audit/runAudit.ts

// Audit orchestrator: PageSpeed (mobile + desktop), one homepage fetch, a TLS
// handshake and email discovery run concurrently; pure analyzers read the HTML.
// Server-only (imports node:tls via tlsCheck).

import * as cheerio from 'cheerio';
import { runPageSpeed, categoryScore, type PageSpeedResult } from '@/app/_shared/lib/audit/pageSpeed';
import { fetchSite, type SiteFetchResult } from '@/app/_shared/lib/audit/siteFetch';
import { checkTls } from '@/app/_shared/lib/audit/tlsCheck';
import { parseStructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';
import { compareNap, extractNapSignals } from '@/app/_shared/lib/audit/analyzers/nap';
import { analyzeGeo } from '@/app/_shared/lib/audit/analyzers/geo';
import { analyzeAeo } from '@/app/_shared/lib/audit/analyzers/aeo';
import { analyzeSeoBasics } from '@/app/_shared/lib/audit/analyzers/seoBasics';
import { visibleText } from '@/app/_shared/lib/audit/analyzers/text';
import {
  CURRENT_ENGINE_VERSION,
  type AeoChecks,
  type AuditInput,
  type AuditOutcome,
  type GeoChecks,
  type SeoBasics,
  type SslCheck,
} from '@/app/_shared/lib/audit/types';

const PSI_DEADLINE_MS = 240_000;
const MIN_VISIBLE_TEXT = 200;
const JS_ONLY_REASON = 'Content loads via JavaScript — checks limited';

/** Neither PageSpeed nor the site itself could be read — nothing worth storing. */
export class AuditUnavailableError extends Error {}

export interface AuditDeps {
  runPageSpeed: typeof runPageSpeed;
  fetchSite: typeof fetchSite;
  checkTls: typeof checkTls;
  now: () => number;
}

const defaultDeps: AuditDeps = { runPageSpeed, fetchSite, checkTls, now: () => Date.now() };

interface PageAnalysis {
  seo: SeoBasics;
  geo: { score: number; checks: GeoChecks } | null;
  aeo: { score: number; checks: AeoChecks } | null;
  limitedReason: string | null;
}

function analyzePage(html: string, site: SiteFetchResult, input: AuditInput): PageAnalysis {
  const $ = cheerio.load(html);
  const seo = analyzeSeoBasics($, site.headers, site.robots);
  const text = visibleText($);
  if (text.length < MIN_VISIBLE_TEXT) return { seo, geo: null, aeo: null, limitedReason: JS_ONLY_REASON };

  const structured = parseStructuredData($, input.name);
  const nap = compareNap(
    { name: input.name, address: input.address, phone: input.phone },
    extractNapSignals($, structured.entity, text)
  );
  return {
    seo,
    geo: analyzeGeo(structured, nap, input.niche),
    aeo: analyzeAeo($, structured),
    limitedReason: null,
  };
}

// TLS handshake wins; otherwise PageSpeed's is-on-https; otherwise unknown (null)
function resolveSsl(tls: SslCheck | null, psi: PageSpeedResult[]): SslCheck {
  if (tls) return tls;
  const fromPsi = psi.find((r) => r.ok && r.isOnHttps !== null);
  return {
    valid: fromPsi && fromPsi.ok ? fromPsi.isOnHttps : null,
    daysToExpiry: null,
    issuer: null,
    error: 'TLS handshake could not complete',
  };
}

export async function runAudit(input: AuditInput, deps: AuditDeps = defaultDeps): Promise<AuditOutcome> {
  let listedHost: string;
  try {
    listedHost = new URL(input.website).hostname;
  } catch {
    throw new AuditUnavailableError('Invalid website URL');
  }

  const deadline = deps.now() + PSI_DEADLINE_MS;
  const sitePromise = deps.fetchSite(input.website);
  const finalHost = (site: SiteFetchResult) => (site.finalUrl ? new URL(site.finalUrl).hostname : listedHost);

  const [mobile, desktop, site, tls, email] = await Promise.all([
    deps.runPageSpeed(input.website, 'mobile', deadline),
    deps.runPageSpeed(input.website, 'desktop', deadline),
    sitePromise,
    sitePromise.then((s) => deps.checkTls(finalHost(s))).catch(() => null),
    sitePromise
      .then((s) => (input.discoverEmail ? input.discoverEmail(s.ok ? s.html : null) : null))
      .catch(() => null),
  ]);

  if (!mobile.ok && !desktop.ok && !site.ok) {
    throw new AuditUnavailableError(site.reason ?? mobile.reason);
  }

  const page = site.ok && site.html !== null ? analyzePage(site.html, site, input) : null;
  const mobileSummary = mobile.ok ? mobile.summary : null;
  const desktopSummary = desktop.ok ? desktop.summary : null;
  const ssl = resolveSsl(tls, [mobile, desktop]);
  const siteReason = site.reason ?? page?.limitedReason ?? undefined;

  return {
    email,
    row: {
      performance_score: categoryScore(desktopSummary, 'performance'),
      mobile_score: categoryScore(mobileSummary, 'performance'),
      seo_score: categoryScore(mobileSummary, 'seo') ?? categoryScore(desktopSummary, 'seo'),
      ssl_valid: ssl.valid,
      geo_score: page?.geo?.score ?? null,
      aeo_score: page?.aeo?.score ?? null,
      checks: {
        ssl,
        seo: page?.seo ?? null,
        geo: page?.geo?.checks ?? null,
        aeo: page?.aeo?.checks ?? null,
        site: {
          ok: site.ok,
          finalUrl: site.finalUrl,
          status: site.status,
          ...(siteReason ? { reason: siteReason } : {}),
        },
        psi: { mobile: mobile.ok ? 'ok' : mobile.reason, desktop: desktop.ok ? 'ok' : desktop.reason },
      },
      raw_json: { mobile: mobileSummary, desktop: desktopSummary },
      engine_version: CURRENT_ENGINE_VERSION,
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/audit/__tests__/runAudit.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Checkpoint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all green, 0 lint errors. Do not commit.

---

### Task 13: Email finder reuses the homepage HTML

**Files:**
- Modify: `app/_shared/lib/utils/emailFinder.ts` (`scrapeWebsite` and `findEmail`)
- Test: `app/_shared/lib/utils/__tests__/emailFinder.test.ts`

**Interfaces:**
- Produces: `findEmail(website: string, opts?: { apiFallback?: boolean; homepageHtml?: string | null }): Promise<string | null>` — when `homepageHtml` is a string, the homepage is not fetched again.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/utils/__tests__/emailFinder.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findEmail } from '@/app/_shared/lib/utils/emailFinder';

describe('findEmail with prefetched homepage HTML', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('uses the given HTML instead of fetching the homepage', async () => {
    const email = await findEmail('https://smiledental.com/', {
      homepageHtml: '<a href="mailto:hello@smiledental.com">Email us</a>',
    });
    expect(email).toBe('hello@smiledental.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still scrapes the contact pages when the homepage has no email', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === 'https://smiledental.com/contact'
        ? new Response('<p>office@smiledental.com</p>', { status: 200 })
        : new Response('', { status: 404 })
    );
    const email = await findEmail('https://smiledental.com/', { homepageHtml: '<p>No email here</p>' });
    expect(email).toBe('office@smiledental.com');
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain('https://smiledental.com/');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/utils/__tests__/emailFinder.test.ts`
Expected: FAIL — first test: `fetchMock` was called (homepage fetched) and/or email is null because the mocked fetch returns `undefined`.

- [ ] **Step 3: Update `scrapeWebsite` in `emailFinder.ts`**

Replace the current function:
```ts
async function scrapeWebsite(website: string): Promise<string | null> {
  const url = new URL(website);
  const origin = url.origin;
  const domain = url.hostname;

  // Homepage first — if it has a good email, we're done
  const homepageEmails = await scrapePage(website);
```
with:
```ts
async function scrapeWebsite(website: string, homepageHtml?: string | null): Promise<string | null> {
  const url = new URL(website);
  const origin = url.origin;
  const domain = url.hostname;

  // Homepage first (reusing HTML the audit already fetched) — if it has a good email, we're done
  const homepageEmails = homepageHtml != null ? extractEmails(homepageHtml) : await scrapePage(website);
```
(The rest of `scrapeWebsite` is unchanged.)

- [ ] **Step 4: Update `findEmail` in `emailFinder.ts`**

Replace:
```ts
export async function findEmail(
  website: string,
  opts: { apiFallback?: boolean } = {}
): Promise<string | null> {
```
with:
```ts
export async function findEmail(
  website: string,
  opts: { apiFallback?: boolean; homepageHtml?: string | null } = {}
): Promise<string | null> {
```
and replace:
```ts
  const scraped = await scrapeWebsite(website);
```
with:
```ts
  const scraped = await scrapeWebsite(website, opts.homepageHtml);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/_shared/lib/utils/__tests__/emailFinder.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Checkpoint**

Run: `npm test && npx tsc --noEmit && wc -l app/_shared/lib/utils/emailFinder.ts`
Expected: all green; file ≤ 350 lines. Do not commit.

---

### Task 14: Database migration + `/api/audit` route

**Files:**
- Create: `docs/migrations/2026-09-23-audit-engine-v2.sql`
- Modify: `docs/supabase-schema.sql` (header comment + `audits` table)
- Modify (full rewrite): `app/api/audit/route.ts`

**Interfaces:**
- Consumes: `runAudit`, `AuditUnavailableError` (Task 12); `isOutdatedAudit`, `AuditOutcome`, `AuditRow` (Task 1); `findEmail` with `homepageHtml` (Task 13).
- Produces: `POST /api/audit` body `{ business_id: string; force?: boolean }` → `{ audit, email }`; `audit` includes `geo_score`, `aeo_score`, `checks`, `engine_version`. `force: true` updates the same row (same `id`, `created_at = now`) and deletes its `ai_reports` row.

- [ ] **Step 1: Create the migration**

`docs/migrations/2026-09-23-audit-engine-v2.sql`:
```sql
-- 2026-09-23 audit engine v2 migration for EXISTING Auditely databases.
-- Run AFTER docs/migrations/2026-09-23-hardening.sql.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.

BEGIN;

-- GEO / AEO scores, structured check results and the engine version.
-- Existing rows get engine_version = 1, which the dashboard shows as "Outdated".
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS geo_score      INTEGER,
  ADD COLUMN IF NOT EXISTS aeo_score      INTEGER,
  ADD COLUMN IF NOT EXISTS checks         JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS engine_version INTEGER NOT NULL DEFAULT 1;

-- A metric that couldn't be measured is stored as NULL ("—"), never 0.
ALTER TABLE audits
  ALTER COLUMN performance_score DROP NOT NULL,
  ALTER COLUMN performance_score DROP DEFAULT,
  ALTER COLUMN seo_score         DROP NOT NULL,
  ALTER COLUMN seo_score         DROP DEFAULT,
  ALTER COLUMN mobile_score      DROP NOT NULL,
  ALTER COLUMN mobile_score      DROP DEFAULT,
  ALTER COLUMN ssl_valid         DROP NOT NULL,
  ALTER COLUMN ssl_valid         DROP DEFAULT;

COMMIT;
```

- [ ] **Step 2: Update `docs/supabase-schema.sql`**

Replace line 2:
```sql
-- (Existing databases: run docs/migrations/2026-09-23-hardening.sql instead.)
```
with:
```sql
-- (Existing databases: run the files in docs/migrations/ in date/name order instead.)
```
Replace the whole `-- 3. audits` block with:
```sql
-- 3. audits (one per business). NULL score = not measured, never 0.
CREATE TABLE IF NOT EXISTS audits (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID        NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  performance_score   INTEGER,
  seo_score           INTEGER,
  mobile_score        INTEGER,
  ssl_valid           BOOLEAN,
  geo_score           INTEGER,
  aeo_score           INTEGER,
  checks              JSONB       NOT NULL DEFAULT '{}',
  engine_version      INTEGER     NOT NULL DEFAULT 1,
  raw_json            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 3: Rewrite `app/api/audit/route.ts`**

```ts
// app/api/audit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { findEmail } from '@/app/_shared/lib/utils/emailFinder';
import { runAudit, AuditUnavailableError } from '@/app/_shared/lib/audit/runAudit';
import { isOutdatedAudit, type AuditOutcome, type AuditRow } from '@/app/_shared/lib/audit/types';

// PageSpeed can be slow; runAudit keeps PageSpeed inside a 240 s budget.
export const maxDuration = 300;

interface BusinessRecord {
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  searches: { niche: string } | null;
}

// Newest audit for this business. Ordered + limited so it still works if
// duplicate rows exist (maybeSingle() errors on more than one row).
async function findLatestAudit(businessId: string) {
  const { data } = await supabase
    .from('audits')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function insertAudit(businessId: string, row: AuditRow) {
  const { data, error } = await supabase
    .from('audits')
    .insert({ business_id: businessId, ...row })
    .select()
    .single();
  // Unique violation → a concurrent request stored this business's audit first
  if (error?.code === '23505') return findLatestAudit(businessId);
  if (error) console.error('[audit] insert failed:', error.message);
  return data;
}

// Re-audit: overwrite the same row (stable id) and drop its now-stale AI report
async function replaceAudit(auditId: string, row: AuditRow) {
  const { data, error } = await supabase
    .from('audits')
    .update({ ...row, created_at: new Date().toISOString() })
    .eq('id', auditId)
    .select()
    .single();
  if (error || !data) {
    console.error('[audit] update failed:', error?.message);
    return null;
  }
  await supabase.from('ai_reports').delete().eq('audit_id', auditId);
  return data;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const businessId: string = typeof body.business_id === 'string' ? body.business_id : '';
  const force = body.force === true;

  if (!businessId) {
    return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
  }

  const { data, error: businessError } = await supabase
    .from('businesses')
    .select('name, address, phone, website, email, searches(niche)')
    .eq('id', businessId)
    .single();

  if (businessError || !data) {
    if (businessError) console.error('[audit] business lookup failed:', businessError.message);
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }
  const business = data as unknown as BusinessRecord;

  // Email discovery is the core value of the app, so attempt it on EVERY audit
  // request until an email is stored — including cache hits. Reuses the
  // homepage HTML when the audit already fetched it.
  const ensureEmail = async (homepageHtml?: string | null): Promise<string | null> => {
    if (business.email) return business.email;
    if (!business.website) return null;
    const found = await findEmail(business.website, { homepageHtml });
    if (found) {
      await supabase.from('businesses').update({ email: found }).eq('id', businessId);
    }
    return found;
  };

  const existing = await findLatestAudit(businessId);

  // Current-engine audit and no Re-audit requested → serve the cached audit
  if (existing && !force && !isOutdatedAudit(existing.engine_version)) {
    return NextResponse.json({ audit: existing, email: await ensureEmail() });
  }

  if (!business.website) {
    return NextResponse.json({ error: 'Business has no website' }, { status: 400 });
  }

  let outcome: AuditOutcome;
  try {
    outcome = await runAudit({
      website: business.website,
      name: business.name,
      address: business.address,
      phone: business.phone,
      niche: business.searches?.niche ?? null,
      discoverEmail: ensureEmail,
    });
  } catch (err) {
    if (err instanceof AuditUnavailableError) {
      return NextResponse.json({ error: `Couldn't audit this site: ${err.message}` }, { status: 502 });
    }
    console.error('[audit] unexpected failure:', err);
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 });
  }

  const saved = existing
    ? await replaceAudit(existing.id, outcome.row)
    : await insertAudit(businessId, outcome.row);

  if (!saved) {
    return NextResponse.json({ error: 'Failed to store audit' }, { status: 500 });
  }

  return NextResponse.json({ audit: saved, email: outcome.email });
}
```

- [ ] **Step 4: Verify typecheck, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all exit 0; the build lists `ƒ /api/audit`.
If the build fails with a cheerio/undici bundling error, add `'cheerio'` to `serverExternalPackages` in `next.config.ts` (next to `'@react-pdf/renderer'`) and rebuild.

- [ ] **Step 5: Checkpoint**

Run: `npm test`
Expected: all green. Do not commit. (End-to-end audit requests need the restored Supabase + both migrations — covered in Task 17.)

---

### Task 15: Report helpers, AI prompt and PDF compatibility

**Files:**
- Create: `app/_shared/lib/audit/reportData.ts`
- Test: `app/_shared/lib/audit/__tests__/reportData.test.ts`
- Modify (full rewrite): `app/api/generate/route.ts`
- Modify: `app/_shared/components/auditely/pdfDocument/pdfDocument.tsx` (props, styles, score tiles)
- Modify (full rewrite): `app/api/pdf/route.ts`, `app/api/send-email/route.ts`

**Interfaces:**
- Consumes: `AuditChecks`, `Finding`, `KeyAudit` (Task 1); `PdfDocumentProps` (this task).
- Produces (all client-safe): `formatScore(score)`, `formatSsl(valid)`, `topLighthouseIssues(rawJson, limit): IssueSummary[]`, `failingFindings(checks, limit): Finding[]`, `sortFindings(findings): Finding[]`, `type ScoreTone = 'good' | 'ok' | 'poor' | 'none'`, `scoreTone(score): ScoreTone`, `auditFacts(audit): { scores: string; issues: string }`, `buildPdfProps(audit, business, report): PdfDocumentProps`, `interface AuditLike`. `PdfDocumentProps` gains `geoScore`, `aeoScore` and nullable score/SSL fields.

- [ ] **Step 1: Write the failing test**

`app/_shared/lib/audit/__tests__/reportData.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  auditFacts,
  buildPdfProps,
  failingFindings,
  formatScore,
  formatSsl,
  scoreTone,
  sortFindings,
  topLighthouseIssues,
  type AuditLike,
} from '@/app/_shared/lib/audit/reportData';
import type { AuditChecks, Finding } from '@/app/_shared/lib/audit/types';

const rawJson = {
  mobile: {
    keyAudits: {
      lcp: { score: 0.1, title: 'Largest Contentful Paint', displayValue: '12.8 s' },
      cls: { score: 0.5, title: 'Cumulative Layout Shift' },
      https: { score: 1, title: 'Uses HTTPS' },
      odd: { score: null, title: 'Informative' },
    },
  },
};

const f = (id: string, status: Finding['status']): Finding => ({ id, status, label: id });

const checks: Partial<AuditChecks> = {
  geo: { findings: [f('geo.a', 'pass'), f('geo.b', 'fail')], schemaTypes: [], nap: { name: 'match', address: 'match', phone: 'match', site: { name: null, address: null, phones: [] } } },
  aeo: { findings: [f('aeo.a', 'fail'), f('aeo.b', 'warn'), f('aeo.c', 'fail')], h1Count: 1, h2Count: 0, questionHeadings: 0, hasFaqSchema: false },
};

const audit: AuditLike = {
  created_at: '2026-09-23T12:00:00Z',
  performance_score: 42,
  seo_score: null,
  mobile_score: 38,
  ssl_valid: null,
  geo_score: 25,
  aeo_score: 40,
  raw_json: rawJson,
  checks,
};

describe('formatting', () => {
  it('renders unmeasured values as "not measured"', () => {
    expect(formatScore(42)).toBe('42/100');
    expect(formatScore(null)).toBe('not measured');
    expect(formatSsl(true)).toBe('valid');
    expect(formatSsl(false)).toBe('invalid or missing');
    expect(formatSsl(null)).toBe('not measured');
  });

  it('maps scores to tones', () => {
    expect([scoreTone(85), scoreTone(60), scoreTone(10), scoreTone(null)]).toEqual(['good', 'ok', 'poor', 'none']);
  });
});

describe('issue selection', () => {
  it('lists failing Lighthouse audits worst-first', () => {
    expect(topLighthouseIssues(rawJson, 4)).toEqual([
      { title: 'Largest Contentful Paint', displayValue: '12.8 s' },
      { title: 'Cumulative Layout Shift' },
    ]);
    expect(topLighthouseIssues({ mobile: null }, 4)).toEqual([]);
  });

  it('picks failing GEO then AEO findings', () => {
    expect(failingFindings(checks, 2).map((x) => x.id)).toEqual(['geo.b', 'aeo.a']);
    expect(failingFindings({}, 3)).toEqual([]);
  });

  it('sorts findings fail → warn → pass', () => {
    expect(sortFindings([f('a', 'pass'), f('b', 'warn'), f('c', 'fail')]).map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('auditFacts', () => {
  it('builds the prompt facts with GEO/AEO and "not measured"', () => {
    const { scores, issues } = auditFacts(audit);
    expect(scores).toContain('SEO Score: not measured');
    expect(scores).toContain('SSL Certificate: not measured');
    expect(scores).toContain('GEO Score (visibility in AI search engines): 25/100');
    expect(issues.split('\n')).toEqual([
      '- Largest Contentful Paint (12.8 s)',
      '- Cumulative Layout Shift',
      '- geo.b',
      '- aeo.a',
      '- aeo.c',
    ]);
  });
});

describe('buildPdfProps', () => {
  it('passes nulls through and drops non-string improvements', () => {
    const props = buildPdfProps(
      audit,
      { name: 'Smile Dental', website: null, address: '123 Main St', phone: null },
      { summary: 'Slow site.', improvements: ['Compress images', 42] }
    );
    expect(props).toMatchObject({
      businessName: 'Smile Dental',
      website: '',
      auditDate: 'September 23, 2026',
      performanceScore: 42,
      seoScore: null,
      sslValid: null,
      geoScore: 25,
      aeoScore: 40,
      improvements: ['Compress images'],
    });
    expect(props.topIssues).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_shared/lib/audit/__tests__/reportData.test.ts`
Expected: FAIL — cannot resolve `@/app/_shared/lib/audit/reportData`.

- [ ] **Step 3: Implement `app/_shared/lib/audit/reportData.ts`**

```ts
// app/_shared/lib/audit/reportData.ts

// Shared formatting for everything that presents an audit: the AI prompt, the
// PDF and the dashboard. Client-safe (no Node-only imports).

import type { AuditChecks, Finding, KeyAudit } from '@/app/_shared/lib/audit/types';
import type { PdfDocumentProps } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';

export interface IssueSummary {
  title: string;
  displayValue?: string;
}

/** The audit fields presentation code reads (DB rows from any engine version). */
export interface AuditLike {
  created_at: string;
  performance_score: number | null;
  seo_score: number | null;
  mobile_score: number | null;
  ssl_valid: boolean | null;
  geo_score?: number | null;
  aeo_score?: number | null;
  raw_json: unknown;
  checks?: Partial<AuditChecks> | null;
}

export type ScoreTone = 'good' | 'ok' | 'poor' | 'none';

const FINDING_ORDER: Record<Finding['status'], number> = { fail: 0, warn: 1, pass: 2 };

export const formatScore = (score: number | null | undefined): string =>
  typeof score === 'number' ? `${score}/100` : 'not measured';

export const formatSsl = (valid: boolean | null | undefined): string =>
  valid === true ? 'valid' : valid === false ? 'invalid or missing' : 'not measured';

export function scoreTone(score: number | null | undefined): ScoreTone {
  if (typeof score !== 'number') return 'none';
  if (score >= 80) return 'good';
  if (score >= 50) return 'ok';
  return 'poor';
}

/** Worst Lighthouse audits (score < 0.9), worst first. */
export function topLighthouseIssues(rawJson: unknown, limit: number): IssueSummary[] {
  const mobile = (rawJson as { mobile?: { keyAudits?: Record<string, KeyAudit> } | null } | null)?.mobile;
  return Object.values(mobile?.keyAudits ?? {})
    .filter((a): a is KeyAudit & { score: number } => typeof a.score === 'number' && a.score < 0.9)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((a) => ({ title: a.title, ...(a.displayValue && { displayValue: a.displayValue }) }));
}

/** Failing (status 'fail') GEO findings, then AEO findings. */
export function failingFindings(checks: Partial<AuditChecks> | null | undefined, limit: number): Finding[] {
  return [...(checks?.geo?.findings ?? []), ...(checks?.aeo?.findings ?? [])]
    .filter((finding) => finding.status === 'fail')
    .slice(0, limit);
}

/** fail → warn → pass, keeping the original order within each group. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => FINDING_ORDER[a.status] - FINDING_ORDER[b.status]);
}

/** Score lines and issue bullets for the AI prompt. */
export function auditFacts(audit: AuditLike): { scores: string; issues: string } {
  const scores = [
    `Performance Score: ${formatScore(audit.performance_score)}`,
    `SEO Score: ${formatScore(audit.seo_score)}`,
    `Mobile Score: ${formatScore(audit.mobile_score)}`,
    `SSL Certificate: ${formatSsl(audit.ssl_valid)}`,
    `GEO Score (visibility in AI search engines): ${formatScore(audit.geo_score)}`,
    `AEO Score (readiness for answer engines like ChatGPT and Perplexity): ${formatScore(audit.aeo_score)}`,
  ].join('\n');

  const issues =
    [
      ...topLighthouseIssues(audit.raw_json, 6).map((a) => `- ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`),
      ...failingFindings(audit.checks, 3).map((finding) => `- ${finding.label}`),
    ].join('\n') || 'No specific issues identified.';

  return { scores, issues };
}

export function buildPdfProps(
  audit: AuditLike,
  business: { name: string; website: string | null; address: string; phone: string | null },
  report: { summary: string; improvements: unknown }
): PdfDocumentProps {
  const topIssues = topLighthouseIssues(audit.raw_json, 4);
  const improvements = Array.isArray(report.improvements)
    ? report.improvements.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    businessName: business.name,
    website: business.website ?? '',
    address: business.address,
    phone: business.phone,
    auditDate: new Date(audit.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }),
    performanceScore: audit.performance_score,
    seoScore: audit.seo_score,
    mobileScore: audit.mobile_score,
    sslValid: audit.ssl_valid,
    geoScore: audit.geo_score ?? null,
    aeoScore: audit.aeo_score ?? null,
    topIssues: topIssues.length > 0 ? topIssues : undefined,
    summary: report.summary,
    improvements,
  };
}
```

- [ ] **Step 4: Update `pdfDocument.tsx` props, styles and score tiles**

In `app/_shared/components/auditely/pdfDocument/pdfDocument.tsx`:

(a) Replace the `scoresRow` and `scoreBox` style entries:
```ts
  scoresRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scoreBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
```
with:
```ts
  scoresRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
```

(b) Replace:
```ts
  scoreRed: { color: '#dc2626' },
```
with:
```ts
  scoreRed: { color: '#dc2626' },
  scoreNeutral: { color: '#9ca3af' },
```

(c) Replace the `scoreColor` function and the `PdfDocumentProps` interface:
```ts
function scoreColor(score: number) {
  if (score >= 80) return styles.scoreGreen;
  if (score >= 50) return styles.scoreAmber;
  return styles.scoreRed;
}

export interface PdfDocumentProps {
  businessName: string;
  website: string;
  address: string;
  phone: string | null;
  auditDate: string;
  performanceScore: number;
  seoScore: number;
  mobileScore: number;
  sslValid: boolean;
  topIssues?: { title: string; displayValue?: string }[];
  summary: string;
  improvements: string[];
}
```
with:
```ts
function scoreColor(score: number | null) {
  if (score === null) return styles.scoreNeutral;
  if (score >= 80) return styles.scoreGreen;
  if (score >= 50) return styles.scoreAmber;
  return styles.scoreRed;
}

// null = not measured → "—"
function ScoreTile({ label, score }: { label: string; score: number | null }) {
  return (
    <View style={styles.scoreBox}>
      <Text style={[styles.scoreValue, scoreColor(score)]}>{score ?? '—'}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

function SslTile({ valid }: { valid: boolean | null }) {
  const color = valid === null ? styles.scoreNeutral : valid ? styles.scoreGreen : styles.scoreRed;
  return (
    <View style={styles.scoreBox}>
      <Text style={[styles.scoreValue, color]}>{valid === null ? '—' : valid ? '✓' : 'X'}</Text>
      <Text style={styles.scoreLabel}>SSL</Text>
    </View>
  );
}

export interface PdfDocumentProps {
  businessName: string;
  website: string;
  address: string;
  phone: string | null;
  auditDate: string;
  performanceScore: number | null;
  seoScore: number | null;
  mobileScore: number | null;
  sslValid: boolean | null;
  geoScore: number | null;
  aeoScore: number | null;
  topIssues?: { title: string; displayValue?: string }[];
  summary: string;
  improvements: string[];
}
```

(d) In the `PdfDocument` parameter destructuring, replace:
```ts
  sslValid,
  topIssues,
```
with:
```ts
  sslValid,
  geoScore,
  aeoScore,
  topIssues,
```

(e) Replace the whole `<View style={styles.scoresRow}>…</View>` block (four hand-written boxes) with:
```tsx
          <View style={styles.scoresRow}>
            <ScoreTile label="Performance" score={performanceScore} />
            <ScoreTile label="SEO" score={seoScore} />
            <ScoreTile label="Mobile" score={mobileScore} />
            <SslTile valid={sslValid} />
            <ScoreTile label="GEO" score={geoScore} />
            <ScoreTile label="AEO" score={aeoScore} />
          </View>
```

- [ ] **Step 5: Rewrite `app/api/generate/route.ts`**

```ts
// app/api/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { auditFacts } from '@/app/_shared/lib/audit/reportData';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  // Newest report for this audit. Ordered + limited so it still works if
  // duplicate rows exist (maybeSingle() errors on more than one row).
  const findLatestReport = async () => {
    const { data } = await supabase
      .from('ai_reports')
      .select('*')
      .eq('audit_id', auditId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };

  // Cache check
  const existing = await findLatestReport();

  if (existing) {
    return NextResponse.json({ ai_report: existing });
  }

  // Fetch audit + business name/website via join
  const { data: audit } = await supabase
    .from('audits')
    .select('*, businesses(name, website)')
    .eq('id', auditId)
    .single();

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 503 });
  }

  const groq = new Groq({ apiKey });

  const biz = audit.businesses as { name: string; website: string } | null;
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const { scores, issues } = auditFacts(audit);

  const prompt = `Analyze this website audit and respond in JSON only.

Business: ${biz.name}
Website: ${biz.website}
${scores}

Specific Issues Found:
${issues}

Only mention metrics that were measured. Never claim a problem for a metric marked "not measured".

Instructions:
1. Write a 2-3 sentence summary referencing 1-2 of the specific issues above in plain business language
2. List exactly 4 actionable improvements directly tied to the issues above
3. Write a personalized cold email exactly 2 paragraphs long:
   - Paragraph 1: Introduce yourself briefly, mention you audited their website, and call out 2-3 specific issues found (reference the actual issue names above and their business impact).
   - Paragraph 2: Explain the value of fixing these issues for their business (more customers, better Google ranking, faster site), offer a free consultation or quick call, and end with a clear call to action.
   - Include a subject line at the very top prefixed with "Subject: "
   - Do NOT use bullet points inside the email — flowing prose only.

Tone: professional, warm, specific, value-focused. Never generic. Never pushy.

Respond with ONLY valid JSON in this exact format:
{
  "summary": "...",
  "improvements": ["...", "...", "...", "..."],
  "cold_email": "..."
}`;

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1536,
    });
  } catch {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 });
  }

  const content = completion.choices[0]?.message?.content ?? '{}';
  let parsed: { summary?: string; improvements?: string[]; cold_email?: string } = {};

  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
  }

  const { data: aiReport, error } = await supabase
    .from('ai_reports')
    .insert({
      audit_id: auditId,
      summary: parsed.summary ?? '',
      improvements: parsed.improvements ?? [],
      cold_email: parsed.cold_email ?? '',
    })
    .select()
    .single();

  // Unique violation → a concurrent request stored this audit's report first
  if (error?.code === '23505') {
    const stored = await findLatestReport();
    if (stored) return NextResponse.json({ ai_report: stored });
  }

  if (error || !aiReport) {
    return NextResponse.json({ error: 'Failed to store AI report' }, { status: 500 });
  }

  return NextResponse.json({ ai_report: aiReport });
}
```

- [ ] **Step 6: Rewrite `app/api/pdf/route.ts`**

```ts
// app/api/pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps } from '@/app/_shared/lib/audit/reportData';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  // Fetch audit + business
  const { data: audit } = await supabase
    .from('audits')
    .select('*, businesses(*)')
    .eq('id', auditId)
    .single();

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  // Fetch AI report
  const { data: aiReport } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!aiReport) {
    return NextResponse.json(
      { error: 'AI report not found — generate the report first' },
      { status: 404 }
    );
  }

  const business = audit.businesses as {
    name: string;
    website: string | null;
    address: string;
    phone: string | null;
  };

  let buffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buffer = await renderToBuffer(createElement(PdfDocument, buildPdfProps(audit, business, aiReport)) as any);
  } catch {
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }

  const safeFilename = `audit-${business.name
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
    },
  });
}
```

- [ ] **Step 7: Rewrite `app/api/send-email/route.ts`**

```ts
// app/api/send-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps } from '@/app/_shared/lib/audit/reportData';

// The AI writes "Subject: ..." as the first line of cold_email. Use it as the
// real subject and strip it from the body; fall back to a default subject.
function splitSubject(coldEmail: string, fallback: string): { subject: string; body: string } {
  const [firstLine, ...rest] = coldEmail.trimStart().split('\n');
  const match = firstLine?.match(/^\s*subject:\s*(.+)$/i);
  if (!match) return { subject: fallback, body: coldEmail };
  return { subject: match[1].trim(), body: rest.join('\n').trimStart() };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  // Fetch audit + business
  const { data: audit } = await supabase
    .from('audits')
    .select('*, businesses(*)')
    .eq('id', auditId)
    .single();

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  const business = audit.businesses as {
    name: string;
    website: string | null;
    address: string;
    phone: string | null;
    email: string | null;
  };

  if (!business.email) {
    return NextResponse.json({ error: 'Business has no email address' }, { status: 400 });
  }

  // Fetch AI report
  const { data: aiReport } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!aiReport) {
    return NextResponse.json({ error: 'Generate the AI report first' }, { status: 400 });
  }

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(createElement(PdfDocument, buildPdfProps(audit, business, aiReport)) as any);
  } catch {
    return NextResponse.json({ error: 'Failed to generate PDF attachment' }, { status: 500 });
  }

  // Send via Resend
  const resend = new Resend(apiKey);
  const safeName = business.name
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-');

  const { subject, body: text } = splitSubject(
    aiReport.cold_email,
    `Free Website Audit Report — ${business.name}`
  );

  try {
    await resend.emails.send({
      from: fromEmail,
      to: business.email,
      subject,
      text,
      attachments: [
        {
          filename: `audit-${safeName}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 8: Run tests and verify the build**

Run: `npx vitest run app/_shared/lib/audit/__tests__/reportData.test.ts`
Expected: PASS (7 tests).

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all exit 0. If lint reports an unused `eslint-disable` directive on either `renderToBuffer` line, delete that directive line.

- [ ] **Step 9: Smoke-render a PDF with null scores (no database needed)**

Add this temporary test, run it, then delete it:

`app/_shared/lib/audit/__tests__/pdfSmoke.test.ts`:
```ts
import { it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';

it('renders a PDF with unmeasured scores', async () => {
  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(PdfDocument, {
      businessName: 'Smile Dental', website: 'https://smiledental.com', address: '123 Main St', phone: null,
      auditDate: 'September 23, 2026', performanceScore: 42, seoScore: null, mobileScore: 38, sslValid: null,
      geoScore: 25, aeoScore: null, summary: 'Test summary.', improvements: ['Compress images'],
    }) as any
  );
  expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
}, 30_000);
```
Run: `npx vitest run app/_shared/lib/audit/__tests__/pdfSmoke.test.ts`
Expected: PASS. If `pdfDocument.tsx` fails to import in vitest because of JSX, that's a harness issue, not a product bug: skip this step and rely on the build plus the manual PDF check in Task 17.
Then delete the file: `rm app/_shared/lib/audit/__tests__/pdfSmoke.test.ts`.

- [ ] **Step 10: Checkpoint**

Run: `npm test`
Expected: all green. Do not commit.

---

### Task 16: Dashboard UI — six tiles, checklist, Outdated badge, Re-audit

**Files:**
- Modify: `app/_shared/lib/types/auditely.ts` (`Audit` interface)
- Modify: `app/_shared/lib/config/routes.ts` (`API_ROUTES`)
- Create: `app/_shared/lib/hooks/useBusinessAudit.ts`
- Create: `app/_shared/components/auditely/auditChecklist/auditChecklist.tsx`
- Modify (full rewrite): `app/_shared/components/auditely/auditScores/auditScores.tsx`
- Modify (full rewrite): `app/_shared/components/auditely/businessCard/businessCard.tsx`

**Interfaces:**
- Consumes: `AuditChecks`, `Finding`, `isOutdatedAudit` (Task 1); `scoreTone`, `ScoreTone`, `sortFindings`, `topLighthouseIssues` (Task 15); `POST /api/audit` with `force` (Task 14).
- Produces: `useBusinessAudit(business, initialAudit?, initialReport?)` → `{ audit, report, auditStatus, reportStatus, email, setEmail, pdfLoading, runAudit(force?: boolean), reAudit(), retryAudit(), generateReport(auditId), downloadPdf() }`; `<AuditChecklist audit />`; `<AuditScores audit />`.

- [ ] **Step 1: Update the `Audit` type**

In `app/_shared/lib/types/auditely.ts`, add at the top (after the header comment):
```ts
import type { AuditChecks } from '@/app/_shared/lib/audit/types';
```
and replace the `Audit` interface with:
```ts
export interface Audit {
  id: string;
  business_id: string;
  // null = not measured ("—"), never 0
  performance_score: number | null;
  seo_score: number | null;
  mobile_score: number | null;
  ssl_valid: boolean | null;
  geo_score: number | null;
  aeo_score: number | null;
  /** `{}` on audits written before engine v2 */
  checks: Partial<AuditChecks>;
  engine_version: number;
  raw_json: Record<string, unknown>;
  created_at: string;
}
```

- [ ] **Step 2: Add the audit API routes**

In `app/_shared/lib/config/routes.ts`, replace:
```ts
// API routes reachable without a session (the login endpoint itself)
export const API_ROUTES = {
  AUTH: '/api/auth',
} as const;
```
with:
```ts
// API route paths. Only AUTH is public (see PUBLIC_ROUTES below).
export const API_ROUTES = {
  AUTH: '/api/auth',
  AUDIT: '/api/audit',
  GENERATE: '/api/generate',
  PDF: '/api/pdf',
} as const;
```
(`PUBLIC_ROUTES` lists `API_ROUTES.AUTH` explicitly, so the new entries stay protected.)

- [ ] **Step 3: Create `app/_shared/lib/hooks/useBusinessAudit.ts`**

```ts
// app/_shared/lib/hooks/useBusinessAudit.ts

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { AiReport, Audit, AuditStatus, Business, ReportStatus } from '@/app/_shared/lib/types/auditely';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Audit + AI-report state and actions for one business card.
 * - runAudit(): serves a current cached audit, otherwise audits fresh
 * - reAudit(): forces a fresh audit; the server replaces the row and drops the
 *   stale report, so the report is regenerated afterwards
 * - retryAudit(): repeats the last request (normal or forced)
 */
export function useBusinessAudit(business: Business, initialAudit?: Audit, initialReport?: AiReport) {
  const [audit, setAudit] = useState<Audit | undefined>(initialAudit);
  const [report, setReport] = useState<AiReport | undefined>(initialReport);
  const [auditStatus, setAuditStatus] = useState<AuditStatus>(initialAudit ? 'done' : 'idle');
  const [reportStatus, setReportStatus] = useState<ReportStatus>(initialReport ? 'done' : 'idle');
  const [email, setEmail] = useState<string | null>(business.email ?? null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const lastForce = useRef(false);

  // Reflect emails discovered by background discovery (updates the prop).
  useEffect(() => {
    if (business.email) setEmail(business.email);
  }, [business.email]);

  const generateReport = useCallback(async (auditId: string) => {
    setReportStatus('loading');
    try {
      const res = await fetch(API_ROUTES.GENERATE, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ audit_id: auditId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.ai_report);
      setReportStatus('done');
    } catch {
      setReportStatus('error');
    }
  }, []);

  const runAudit = useCallback(
    async (force = false) => {
      lastForce.current = force;
      setAuditStatus('loading');
      try {
        const res = await fetch(API_ROUTES.AUDIT, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ business_id: business.id, force }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setAudit(data.audit);
        if (data.email) setEmail(data.email);
        if (force) setReport(undefined);
        setAuditStatus('done');
        generateReport(data.audit.id);
      } catch {
        setAuditStatus('error');
      }
    },
    [business.id, generateReport]
  );

  const reAudit = useCallback(() => runAudit(true), [runAudit]);
  const retryAudit = useCallback(() => runAudit(lastForce.current), [runAudit]);

  const downloadPdf = useCallback(async () => {
    if (!audit) return;
    setPdfLoading(true);
    try {
      const res = await fetch(API_ROUTES.PDF, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ audit_id: audit.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${business.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  }, [audit, business.name]);

  return {
    audit,
    report,
    auditStatus,
    reportStatus,
    email,
    setEmail,
    pdfLoading,
    runAudit,
    reAudit,
    retryAudit,
    generateReport,
    downloadPdf,
  };
}
```

- [ ] **Step 4: Create `app/_shared/components/auditely/auditChecklist/auditChecklist.tsx`**

```tsx
// app/_shared/components/auditely/auditChecklist/auditChecklist.tsx

import type { Audit } from '@/app/_shared/lib/types/auditely';
import type { Finding } from '@/app/_shared/lib/audit/types';
import { sortFindings } from '@/app/_shared/lib/audit/reportData';

const STATUS_STYLES: Record<Finding['status'], { icon: string; className: string }> = {
  fail: { icon: '✗', className: 'text-red-500' },
  warn: { icon: '!', className: 'text-amber-500' },
  pass: { icon: '✓', className: 'text-emerald-500' },
};

interface FindingGroupProps {
  title: string;
  score?: number | null;
  findings: Finding[];
}

function FindingGroup({ title, score, findings }: FindingGroupProps) {
  if (findings.length === 0) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
          {title}
        </p>
        {typeof score === 'number' && (
          <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">{score}/100</span>
        )}
      </div>
      <ul className="space-y-1.5">
        {sortFindings(findings).map((finding) => {
          const style = STATUS_STYLES[finding.status];
          return (
            <li key={finding.id} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
              <span className={`mt-0.5 w-3 shrink-0 text-xs font-bold ${style.className}`}>{style.icon}</span>
              <span>
                {finding.label}
                {finding.detail && (
                  <span className="ml-1 text-xs text-[var(--color-text-tertiary)]">({finding.detail})</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** GEO / AEO findings, plus HTML-based SEO basics when PageSpeed's SEO score is missing. */
export function AuditChecklist({ audit }: { audit: Audit }) {
  const { geo, aeo, seo } = audit.checks ?? {};
  const showSeoBasics = audit.seo_score === null && !!seo;
  if (!geo && !aeo && !showSeoBasics) return null;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {geo && <FindingGroup title="GEO — AI search visibility" score={audit.geo_score} findings={geo.findings} />}
      {aeo && <FindingGroup title="AEO — answer-engine readiness" score={audit.aeo_score} findings={aeo.findings} />}
      {showSeoBasics && seo && <FindingGroup title="SEO basics (from page HTML)" findings={seo.findings} />}
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `app/_shared/components/auditely/auditScores/auditScores.tsx`**

```tsx
// app/_shared/components/auditely/auditScores/auditScores.tsx

import type { Audit } from '@/app/_shared/lib/types/auditely';
import { scoreTone, topLighthouseIssues, type ScoreTone } from '@/app/_shared/lib/audit/reportData';

const SSL_EXPIRY_WARN_DAYS = 30;

const TONE_CLASSES: Record<ScoreTone, { value: string; bg: string }> = {
  good: { value: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  ok: { value: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  poor: { value: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' },
  none: { value: 'text-[var(--color-text-tertiary)]', bg: 'bg-[var(--color-bg-primary)]' },
};

interface TileProps {
  label: string;
  value: string;
  tone: ScoreTone;
  note?: string;
  reason?: string;
}

function Tile({ label, value, tone, note, reason }: TileProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <div title={reason} className={`flex flex-col items-center gap-1 rounded-xl px-3 py-4 ${classes.bg}`}>
      <span className={`text-xl font-bold tabular-nums ${classes.value}`}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </span>
      {note && <span className={`text-[10px] ${classes.value}`}>{note}</span>}
    </div>
  );
}

function ScoreTile({ label, score, reason }: { label: string; score: number | null; reason?: string }) {
  return (
    <Tile
      label={label}
      value={score === null ? '—' : String(score)}
      tone={scoreTone(score)}
      reason={score === null ? (reason ?? 'Not measured') : undefined}
    />
  );
}

function SslTile({ audit }: { audit: Audit }) {
  const ssl = audit.checks?.ssl;
  if (audit.ssl_valid === null) return <Tile label="SSL" value="—" tone="none" reason={ssl?.error ?? 'Not measured'} />;
  if (!audit.ssl_valid) return <Tile label="SSL" value="✗" tone="poor" reason={ssl?.error} />;

  const days = ssl?.daysToExpiry ?? null;
  const expiringSoon = days !== null && days < SSL_EXPIRY_WARN_DAYS;
  return (
    <Tile label="SSL" value="✓" tone={expiringSoon ? 'ok' : 'good'} note={expiringSoon ? `expires in ${days}d` : undefined} />
  );
}

function psiReason(audit: Audit, strategy: 'mobile' | 'desktop'): string | undefined {
  const status = audit.checks?.psi?.[strategy];
  return status && status !== 'ok' ? `PageSpeed failed: ${status}` : undefined;
}

function KeyIssues({ rawJson }: { rawJson: Record<string, unknown> }) {
  const issues = topLighthouseIssues(rawJson, 4);
  if (issues.length === 0) return null;

  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
        Top Issues
      </p>
      <ul className="space-y-1.5">
        {issues.map((issue, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
            <span className="mt-0.5 shrink-0 text-xs text-red-500">●</span>
            <span>
              {issue.title}
              {issue.displayValue && (
                <span className="ml-1 text-xs text-[var(--color-text-tertiary)]">({issue.displayValue})</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuditScores({ audit }: { audit: Audit }) {
  const siteReason = audit.checks?.site?.reason;
  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        <ScoreTile label="Performance" score={audit.performance_score} reason={psiReason(audit, 'desktop')} />
        <ScoreTile label="SEO" score={audit.seo_score} reason={psiReason(audit, 'mobile')} />
        <ScoreTile label="Mobile" score={audit.mobile_score} reason={psiReason(audit, 'mobile')} />
        <SslTile audit={audit} />
        <ScoreTile label="GEO" score={audit.geo_score} reason={siteReason} />
        <ScoreTile label="AEO" score={audit.aeo_score} reason={siteReason} />
      </div>
      <KeyIssues rawJson={audit.raw_json} />
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `app/_shared/components/auditely/businessCard/businessCard.tsx`**

```tsx
// app/_shared/components/auditely/businessCard/businessCard.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { Badge } from '@/app/_shared/components/ui/badge/badge';
import { AuditScores } from '@/app/_shared/components/auditely/auditScores/auditScores';
import { AuditChecklist } from '@/app/_shared/components/auditely/auditChecklist/auditChecklist';
import { AiReportSection } from '@/app/_shared/components/auditely/aiReportSection/aiReportSection';
import { BusinessEmail } from '@/app/_shared/components/auditely/businessEmail/businessEmail';
import { useBusinessAudit } from '@/app/_shared/lib/hooks/useBusinessAudit';
import { isOutdatedAudit } from '@/app/_shared/lib/audit/types';
import { scoreTone, type ScoreTone } from '@/app/_shared/lib/audit/reportData';
import type { Business, Audit, AiReport } from '@/app/_shared/lib/types/auditely';

interface BusinessCardProps {
  business: Business;
  initialAudit?: Audit;
  initialReport?: AiReport;
}

const PILL_TONES: Record<ScoreTone, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  ok: 'text-amber-600 dark:text-amber-400',
  poor: 'text-red-600 dark:text-red-400',
  none: 'text-[var(--color-text-tertiary)]',
};

// Compact score summary shown when a completed card is collapsed
function ScorePills({ audit }: { audit: Audit }) {
  const scores: [string, number | null][] = [
    ['Perf', audit.performance_score],
    ['SEO', audit.seo_score],
    ['Mobile', audit.mobile_score],
    ['GEO', audit.geo_score],
    ['AEO', audit.aeo_score],
  ];
  const ssl = audit.ssl_valid;
  const sslTone: ScoreTone = ssl === null ? 'none' : ssl ? 'good' : 'poor';

  return (
    <div className="flex items-center gap-x-3 gap-y-1 mt-2 flex-wrap text-xs font-semibold">
      {scores.map(([label, score]) => (
        <span key={label} className={PILL_TONES[scoreTone(score)]}>
          {label} {score ?? '—'}
        </span>
      ))}
      <span className={PILL_TONES[sslTone]}>SSL {ssl === null ? '—' : ssl ? '✓' : '✗'}</span>
    </div>
  );
}

export function BusinessCard({ business, initialAudit, initialReport }: BusinessCardProps) {
  const {
    audit,
    report,
    auditStatus,
    reportStatus,
    email,
    setEmail,
    pdfLoading,
    runAudit,
    reAudit,
    retryAudit,
    generateReport,
    downloadPdf,
  } = useBusinessAudit(business, initialAudit, initialReport);
  // Pre-loaded cards (from saved searches) start collapsed; freshly processed cards start expanded
  const [isExpanded, setIsExpanded] = useState(!(initialAudit && initialReport));

  const isCompleted = auditStatus === 'done' && reportStatus === 'done';
  const isOutdated = auditStatus === 'done' && !!audit && isOutdatedAudit(audit.engine_version);

  return (
    <div className={`rounded-2xl bg-[var(--color-bg-secondary)] overflow-hidden transition-all ${
      isCompleted
        ? 'border-2 border-emerald-400 dark:border-emerald-600'
        : 'border border-[var(--color-border)]'
    }`}>
      {/* Card Header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4 border-b border-[var(--color-border)]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] leading-tight">
              {business.name}
            </h3>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Audited
              </span>
            )}
            {isOutdated && (
              <Badge variant="warning" size="sm">Outdated</Badge>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{business.address}</p>
          {business.phone && (
            <p className="text-sm text-[var(--color-text-tertiary)]">{business.phone}</p>
          )}
          <BusinessEmail
            email={email}
            website={business.website}
            businessId={business.id}
            onFound={setEmail}
          />

          {isCompleted && !isExpanded && audit && <ScorePills audit={audit} />}
        </div>

        <div className="shrink-0 flex items-start gap-2">
          {business.website ? (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--color-primary-600)] hover:underline break-all text-right block max-w-[200px]"
            >
              {business.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          ) : (
            <Badge variant="warning">No website</Badge>
          )}

          {/* Accordion toggle — only on completed cards */}
          {isCompleted && (
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? 'Collapse' : 'Expand'}
              className="cursor-pointer mt-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Card Body — always visible for in-progress cards, collapsible when completed */}
      {(!isCompleted || isExpanded) && (
        <>
          {!business.website ? (
            <div className="px-6 py-5">
              <p className="text-sm text-[var(--color-text-tertiary)]">
                No website found — skipping audit.
              </p>
            </div>
          ) : (
            <div className="px-6 py-6 space-y-6">
              {/* Audit Scores */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
                    Audit Scores
                  </p>
                  {auditStatus === 'done' && (
                    <Button variant="ghost" size="sm" onClick={reAudit}>
                      Re-audit
                    </Button>
                  )}
                </div>
                {auditStatus === 'idle' && (
                  <Button variant="outline" size="sm" onClick={() => runAudit()}>
                    Run Audit
                  </Button>
                )}
                {auditStatus === 'loading' && (
                  <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                    <Spinner size="sm" />
                    <span>Running audit…</span>
                  </div>
                )}
                {auditStatus === 'error' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-500">Audit failed.</span>
                    <Button variant="ghost" size="sm" onClick={retryAudit}>
                      Retry
                    </Button>
                  </div>
                )}
                {auditStatus === 'done' && audit && (
                  <div className="space-y-6">
                    <AuditScores audit={audit} />
                    <AuditChecklist audit={audit} />
                  </div>
                )}
              </div>

              {/* AI Report */}
              {auditStatus === 'done' && (
                <div>
                  {reportStatus === 'idle' && audit && (
                    <Button variant="outline" size="sm" onClick={() => generateReport(audit.id)}>
                      Generate AI Summary
                    </Button>
                  )}
                  {reportStatus === 'loading' && (
                    <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                      <Spinner size="sm" />
                      <span>Generating AI report…</span>
                    </div>
                  )}
                  {reportStatus === 'error' && audit && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-500">Report generation failed.</span>
                      <Button variant="ghost" size="sm" onClick={() => generateReport(audit.id)}>
                        Retry
                      </Button>
                    </div>
                  )}
                  {reportStatus === 'done' && report && (
                    <AiReportSection report={report} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Card Footer — download button */}
          {audit && report && (
            <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <Button
                variant="primary"
                size="sm"
                onClick={downloadPdf}
                isLoading={pdfLoading}
                disabled={pdfLoading}
              >
                {pdfLoading ? 'Generating PDF…' : '↓ Download PDF Report'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```
Note: `Run Audit` uses `() => runAudit()` — passing `runAudit` directly would hand the click event in as `force` (truthy).

- [ ] **Step 7: Verify typecheck, lint, build and file sizes**

Run: `npx tsc --noEmit && npm run lint && npm run build && wc -l app/_shared/components/auditely/businessCard/businessCard.tsx app/_shared/lib/hooks/useBusinessAudit.ts app/_shared/components/auditely/auditScores/auditScores.tsx app/_shared/components/auditely/auditChecklist/auditChecklist.tsx`
Expected: all exit 0 with 0 lint errors; every file ≤ 300 lines.

- [ ] **Step 8: Visual check without a database**

Run `npm run dev` with `ADMIN_PASSWORD` and `AUTH_SECRET` set, log in, and confirm the home page renders and a search form appears. (Cards with audits need Supabase — covered in Task 17.) Stop the dev server afterwards.

- [ ] **Step 9: Checkpoint**

Run: `npm test`
Expected: all green. Do not commit.

---

### Task 17: Final verification

**Files:** none new.

- [ ] **Step 1: Full automated suite**

Run: `npm test && RUN_NETWORK_TESTS=1 npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: everything passes; network suite passes when online.

- [ ] **Step 2: Spec coverage spot-check**

Run: `grep -rn "category=\|maxDuration\|engine_version\|CURRENT_ENGINE_VERSION" app --include=*.ts --include=*.tsx | grep -v __tests__`
Expected: `maxDuration = 300` in `app/api/audit/route.ts`; `CURRENT_ENGINE_VERSION` used by `runAudit.ts` and `isOutdatedAudit`; no remaining hand-built `&category=` string in `app/api/audit/route.ts` (PageSpeed params now live in `pageSpeed.ts`).

- [ ] **Step 3: Manual end-to-end (requires the user to restore Supabase first)**

Blocked until the Supabase project resolves again. Then, in order:
1. Confirm `docs/migrations/2026-09-23-hardening.sql` and `docs/migrations/2026-09-23-audit-engine-v2.sql` have been run and `SUPABASE_SERVICE_ROLE_KEY` is set.
2. `npm run dev`, log in, search "dentist" in a US city.
3. Run Audit on a dentist site with schema → six tiles show numbers; SSL ✓; GEO/AEO checklist renders; AI report generates; PDF downloads with six tiles.
4. Run Audit on a site without schema → GEO shows "No Dentist schema…" fail.
5. Run Audit on a site that blocks bots (403) → GEO/AEO "—" with "Blocked (403)" tooltip; PageSpeed tiles still filled.
6. Load a saved search with a pre-v2 audit → amber **Outdated** badge; click **Re-audit** → badge disappears, AI report regenerates, audit date updates.
7. Download a PDF for an audit with a null score → tile shows "—".

- [ ] **Step 4: Report and hand back**

Summarise what passed, what was blocked (Supabase), and remind the user nothing has been committed and which branch they want to use.
