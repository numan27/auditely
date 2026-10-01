# Plain-English Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prospects read every problem in owner language from a hand-written impact library, and the AI writes a short, fact-bound cold email offering the free report.

**Architecture:** `impactLibrary.ts` holds one plain-English entry per problem (problem, cost, fix, optional sourced statistic), in priority order. `impact.ts` turns a stored audit into ranked problems (findings + speed / SSL signals, real-visitor speed when present). `aiReport.ts` builds the prompt from those problems, takes the fixes straight from the library, and retries once when the model invents numbers or writes a long email. `/api/generate` and the PDF use them.

**Tech Stack:** Next.js 16 route handlers, TypeScript 5, Groq SDK (`openai/gpt-oss-120b`), @react-pdf/renderer, vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-01-plain-english-report-design.md`

## Global Constraints

- Imports of shared code use `@/app/_shared/...`; files under 300 lines; camelCase names.
- No migration, no new env vars, no new npm dependencies.
- Library text: "you / your" voice; problem ≤ 12 words, cost ≤ 25, fix ≤ 20; straight quotes only (the PDF font has no curly quotes); numbers only where written here.
- Only two statistics, exactly as in the spec, always shown with their source.
- The AI never receives raw metric names; it writes only `summary` and `cold_email`; `improvements` come from the library.
- Email: `Subject:` line, body under 90 words (retry above 110), ends with the exact offer sentence, signed "{REPORT_CONTACT_NAME}, DevArtVentures" or "The DevArtVentures team".
- **Git:** work on `staging`; do not commit until the user says so; never push.
- Test commands: one file `npx vitest run <path>`; all `npm test`; `npx tsc --noEmit`; `npm run lint`; `npm run build`.

## Review Focus

1. **Old audits** (engine v1, or v2 without `checks.lead` / real-visitor data) must still produce a PDF and a prompt without errors. Pinned in Task 6.
2. **The model reusing a fact's number in another form** ("4.1s", "3-second") must not be rejected as invented. Pinned in Task 4.
3. **Digits in the business name or website** ("Smile 4 U Dental", "dental32.com") must be allowed in the email. Pinned in Task 4.
4. **A site with no problems** must still get a sensible offer sentence and no fixes. Pinned in Task 4.
5. **"Couldn't check" results and Google-listing gaps** must never appear as a prospect's problem. Pinned in Task 3.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/_shared/lib/audit/pageSpeed.ts` | modify | Read real-visitor LCP into `summary.field` |
| `app/_shared/lib/audit/types.ts` | modify | `LighthouseSummary.field` |
| `app/_shared/lib/audit/analyzers/leadCapture.ts` | modify | "Couldn't check" form result → `lead.formUnchecked` |
| `app/_shared/lib/audit/impactLibrary.ts` | create | Entries + statistics (data) |
| `app/_shared/lib/audit/impact.ts` | create | `impactFor`, `plainLabel`, `rankedProblems` |
| `app/_shared/lib/audit/aiReport.ts` | create | Prompt, fixes, offer, guard, `writeReport` |
| `app/api/generate/route.ts` | modify | Use `rankedProblems` + `writeReport`; fixes from library |
| `app/_shared/lib/audit/reportData.ts` | modify | Drop `auditFacts` / `failingFindings`; PDF problems, plain labels, sources |
| `app/_shared/components/auditely/pdfDocument/*` | modify | "What's costing you customers", "How we'd fix it", Sources |

---

### Task 1: Real-visitor load time from PageSpeed

**Files:**
- Modify: `app/_shared/lib/audit/types.ts`, `app/_shared/lib/audit/pageSpeed.ts`
- Test: `app/_shared/lib/audit/__tests__/pageSpeed.test.ts`

**Interfaces:**
- Produces: `LighthouseSummary.field?: { lcpMs: number; scope: 'page' | 'origin' }` (present only when Google has real-visitor data).

- [ ] **Step 1: Write the failing tests** — append inside `describe('runPageSpeed', …)`:

```ts
  it('reads the real-visitor load time when Google has it', async () => {
    const lcp = (percentile: number) => ({ LARGEST_CONTENTFUL_PAINT_MS: { percentile, category: 'SLOW', distributions: [] } });
    fetchMock.mockResolvedValueOnce(json({ ...lighthouse(), loadingExperience: { id: 'https://acme.com/', metrics: lcp(4100), overall_category: 'SLOW' } }));
    const page = await runPageSpeed('https://acme.com/', 'mobile', deadline);
    if (!page.ok) throw new Error('expected ok');
    expect(page.summary.field).toEqual({ lcpMs: 4100, scope: 'page' });

    fetchMock.mockResolvedValueOnce(json({ ...lighthouse(), loadingExperience: { id: 'https://acme.com', metrics: lcp(2600), origin_fallback: true } }));
    const origin = await runPageSpeed('https://acme.com/', 'mobile', deadline);
    if (!origin.ok) throw new Error('expected ok');
    expect(origin.summary.field).toEqual({ lcpMs: 2600, scope: 'origin' });
  });

  it('leaves real-visitor data out when Google has none', async () => {
    fetchMock.mockResolvedValue(json({ ...lighthouse(), loadingExperience: { id: 'https://acme.com/' } }));
    const result = await runPageSpeed('https://acme.com/', 'mobile', deadline);
    if (!result.ok) throw new Error('expected ok');
    expect(result.summary).not.toHaveProperty('field');
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/pageSpeed.test.ts`
Expected: the first new test FAILS (`field` undefined); the second passes already (it guards the absence case).

- [ ] **Step 3: Implement**

`types.ts` — `LighthouseSummary` becomes:
```ts
export interface LighthouseSummary {
  categories: Record<string, { score: number | null; title: string }>;
  keyAudits: Record<string, KeyAudit>;
  /** Real-visitor load time (LCP, 75th percentile) from Chrome data; absent when Google has too few visits */
  field?: { lcpMs: number; scope: 'page' | 'origin' };
}
```

`pageSpeed.ts`:
1. After the `LighthouseResult` interface add:
```ts
// PageSpeed's real-visitor (Chrome UX Report) data for the URL, or its whole site (origin_fallback)
interface LoadingExperience {
  origin_fallback?: boolean;
  metrics?: Record<string, { percentile?: number; category?: string }>;
}

/** Real-visitor LCP when Google has it */
function fieldLcp(experience: LoadingExperience | undefined): LighthouseSummary['field'] {
  const ms = experience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile;
  return typeof ms === 'number' ? { lcpMs: ms, scope: experience?.origin_fallback ? 'origin' : 'page' } : undefined;
}
```
2. `requestOnce`'s return type becomes `Promise<{ lighthouseResult?: LighthouseResult; loadingExperience?: LoadingExperience }>`.
3. In `runPageSpeed`, replace `summary: trimLighthouseData(lr),` with:
```ts
      summary: { ...trimLighthouseData(lr), ...(field && { field }) },
```
and add `const field = fieldLcp(data.loadingExperience);` right after `const httpsScore = …`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/pageSpeed.test.ts && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 2: Give the "couldn't check" form result its own id

**Files:**
- Modify: `app/_shared/lib/audit/analyzers/leadCapture.ts`
- Test: `app/_shared/lib/audit/__tests__/leadCapture.test.ts`

**Interfaces:**
- Produces: finding id `lead.formUnchecked` (status `warn`, 30 points) for "Couldn't check the … for a form" and "Couldn't read the embedded widget …"; `lead.form` keeps pass / warn (email only) / fail.

- [ ] **Step 1: Update the tests first**

In `leadCapture.test.ts`:
- In `"never claims there's no contact form when the contact page couldn't be read"`, change `finding(withEmail, 'lead.form')` to `finding(withEmail, 'lead.formUnchecked')`, and add after it: `expect(finding(withEmail, 'lead.form')).toBeUndefined();`
- In `'says it could not check an unknown embedded widget on the contact page, but ignores maps'`, change the first `'lead.form'` (the widget case) to `'lead.formUnchecked'`. Leave the maps case on `'lead.form'`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/leadCapture.test.ts`
Expected: those 2 tests FAIL (`lead.formUnchecked` not found).

- [ ] **Step 3: Implement** — in `analyzeLeadCapture`, the unchecked branch becomes:
```ts
  } else if (unchecked) {
    // Its own id: never mistaken for "only an email link" (see impactLibrary.ts)
    add(30, { id: 'lead.formUnchecked', status: 'warn', label: unchecked });
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/leadCapture.test.ts`
Expected: all PASS.

---

### Task 3: The impact library and ranked problems

**Files:**
- Create: `app/_shared/lib/audit/impactLibrary.ts`, `app/_shared/lib/audit/impact.ts`
- Test: `app/_shared/lib/audit/__tests__/impact.test.ts`

**Interfaces:**
- Consumes: `AuditLike` (type) from `reportData.ts`; `LighthouseSummary.field` (Task 1); `lead.formUnchecked` (Task 2).
- Produces:
  ```ts
  // impactLibrary.ts
  export interface Stat { text: string; source: string }
  export const STATS: { mobileAbandon: Stat; nearbyVisit: Stat };
  export interface ImpactEntry { id: string; status: 'fail' | 'warn'; problem: string; cost: string; fix: string; stat?: keyof typeof STATS; group?: string }
  export const IMPACT_LIBRARY: ImpactEntry[];
  // impact.ts
  export interface Problem { id: string; problem: string; cost: string; fix: string; evidence?: string; stat?: Stat }
  export function impactFor(id: string, status: FindingStatus): ImpactEntry | undefined;
  export function plainLabel(finding: Finding): string;
  export function rankedProblems(audit: AuditLike): Problem[];
  ```

- [ ] **Step 1: Write the failing tests** — create `impact.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { impactFor, plainLabel, rankedProblems } from '@/app/_shared/lib/audit/impact';
import { IMPACT_LIBRARY, STATS } from '@/app/_shared/lib/audit/impactLibrary';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';
import type { AuditChecks, Finding, KeyAudit, LighthouseSummary } from '@/app/_shared/lib/audit/types';

const f = (id: string, status: Finding['status'], detail?: string): Finding => ({ id, status, label: `label of ${id}`, ...(detail && { detail }) });
const findings = (list: Finding[]) => ({ findings: list });

function audit(over: { checks?: Partial<AuditChecks>; mobile?: Partial<LighthouseSummary>; ssl?: boolean | null; engine?: number } = {}): AuditLike {
  return {
    created_at: '2026-10-01T00:00:00Z',
    performance_score: 50,
    seo_score: 80,
    mobile_score: 40,
    ssl_valid: over.ssl ?? true,
    raw_json: { mobile: { categories: {}, keyAudits: {}, ...over.mobile }, desktop: null },
    checks: over.checks ?? {},
    engine_version: over.engine ?? 2,
  };
}
const lab = (score: number, displayValue: string): KeyAudit => ({ score, title: 't', displayValue });
const ids = (a: AuditLike) => rankedProblems(a).map((p) => p.id);

describe('impact library', () => {
  it('follows the writing rules: short, plain, drawable, one entry per result', () => {
    const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
    for (const entry of IMPACT_LIBRARY) {
      expect(words(entry.problem), entry.id).toBeLessThanOrEqual(12);
      expect(words(entry.cost), entry.id).toBeLessThanOrEqual(25);
      expect(words(entry.fix), entry.id).toBeLessThanOrEqual(20);
      expect(`${entry.problem}${entry.cost}${entry.fix}`, entry.id).not.toMatch(/[‘’“”]/);
    }
    const keys = IMPACT_LIBRARY.map((e) => `${e.id}|${e.status}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives a failing check's owner-language label, or its own label when it has no entry", () => {
    expect(plainLabel(f('lead.form', 'fail'))).toBe(impactFor('lead.form', 'fail')?.problem);
    expect(plainLabel(f('geo.somethingNew', 'fail'))).toBe('label of geo.somethingNew');
  });
});

describe('rankedProblems', () => {
  it("never lists passes, couldn't-check results or a Google listing without a value", () => {
    const a = audit({
      checks: {
        lead: { ...findings([f('lead.formUnchecked', 'warn'), f('lead.brokenLinks', 'warn'), f('lead.clickToCall', 'pass')]), pages: [], links: { checked: 0, broken: [] } },
        geo: { ...findings([f('geo.nap.phone', 'warn'), f('geo.jsonld', 'pass')]), schemaTypes: [], nap: { name: 'n/a', address: 'n/a', phone: 'n/a', site: { name: null, address: null, phones: [] } } },
      },
    });
    expect(rankedProblems(a)).toEqual([]);
  });

  it('lists problems worst first, one per group, with their evidence', () => {
    const a = audit({
      checks: {
        aeo: { ...findings([f('aeo.h1', 'fail'), f('aeo.questions', 'fail')]), h1Count: 0, h2Count: 0, questionHeadings: 0, hasFaqSchema: false },
        geo: {
          ...findings([f('geo.jsonld', 'fail'), f('geo.nap.address', 'fail'), f('geo.nap.phone', 'fail', 'Site shows: (555) 000-1111')]),
          schemaTypes: [],
          nap: { name: 'match', address: 'missing', phone: 'mismatch', site: { name: null, address: null, phones: [] } },
        },
        lead: { ...findings([f('lead.form', 'fail')]), pages: [], links: { checked: 0, broken: [] } },
      },
    });
    expect(ids(a)).toEqual(['lead.form', 'geo.nap.phone', 'geo.jsonld', 'aeo.questions']);
    expect(rankedProblems(a)[1]).toMatchObject({ evidence: 'Site shows: (555) 000-1111', stat: STATS.nearbyVisit });
  });

  it('uses real-visitor load time when Google has it, else the mobile test', () => {
    const slowLab = { 'largest-contentful-paint': lab(0.1, '12.8 s') };
    expect(rankedProblems(audit({ mobile: { keyAudits: slowLab, field: { lcpMs: 4100, scope: 'page' } } }))[0]).toMatchObject({
      id: 'speed.slowLoad',
      evidence: 'Real visitors on phones wait about 4.1 s',
      stat: STATS.mobileAbandon,
    });
    // Real visitors are fast: the lab result alone doesn't make the site "slow"
    expect(ids(audit({ mobile: { keyAudits: slowLab, field: { lcpMs: 2000, scope: 'page' } } }))).toEqual([]);
    expect(rankedProblems(audit({ mobile: { keyAudits: slowLab } }))[0]).toMatchObject({ id: 'speed.slowLoad', evidence: "Google's mobile test: 12.8 s" });
    expect(ids(audit({ mobile: { keyAudits: { 'largest-contentful-paint': lab(0.6, '3.6 s') } } }))).toEqual([]);
  });

  it('flags an invalid certificate, layout jumps and heavy images, in that order', () => {
    const a = audit({
      ssl: false,
      mobile: {
        keyAudits: {
          'uses-optimized-images': lab(0.3, 'Potential savings of 1,234 KiB'),
          'cumulative-layout-shift': lab(0.2, '0.45'),
        },
      },
    });
    expect(ids(a)).toEqual(['ssl.invalid', 'speed.layoutShift', 'speed.heavyImages']);
    expect(rankedProblems(a)[2].evidence).toBe("Google's mobile test: Potential savings of 1,234 KiB");
  });

  it('ignores SSL on an outdated audit, which never measured it', () => {
    expect(ids(audit({ ssl: false, engine: 1 }))).toEqual([]);
  });

  it('lists a failing check the library does not know by its own label, last', () => {
    const a = audit({ checks: { lead: { ...findings([f('lead.newCheck', 'fail'), f('lead.form', 'fail')]), pages: [], links: { checked: 0, broken: [] } } } });
    expect(rankedProblems(a)).toEqual([
      expect.objectContaining({ id: 'lead.form' }),
      { id: 'lead.newCheck', problem: 'label of lead.newCheck', cost: '', fix: '' },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/impact.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `impactLibrary.ts`**

```ts
// app/_shared/lib/audit/impactLibrary.ts

// What each problem costs a business owner, in their words. The order is the
// priority: an audit's problems are listed in this order (see impact.ts).
// Rules: "you/your"; problem <= 12 words, cost <= 25, fix <= 20; straight
// quotes only (the PDF font has no curly quotes); no statistics outside STATS.

export interface Stat {
  text: string;
  source: string;
}

// The only two statistics a prospect sees, each always shown with its source
export const STATS = {
  mobileAbandon: {
    text: '53% of mobile site visits are abandoned if a page takes longer than 3 seconds to load.',
    source: 'Think with Google, The Need for Mobile Speed, 2016',
  },
  nearbyVisit: {
    text: '76% of people who search on their phone for something nearby visit a related business within a day.',
    source: 'Think with Google, 2016',
  },
} satisfies Record<string, Stat>;

export interface ImpactEntry {
  /** A finding id, or a speed / SSL signal (see impact.ts) */
  id: string;
  /** The result of the check this entry translates; other results aren't problems */
  status: 'fail' | 'warn';
  problem: string;
  cost: string;
  fix: string;
  stat?: keyof typeof STATS;
  /** Entries in a group are listed once, at the first one found */
  group?: string;
}

const SAME_AS_GOOGLE = 'Google Business Profile';

export const IMPACT_LIBRARY: ImpactEntry[] = [
  // 1. Invisible, or losing leads
  {
    id: 'seo.noindex', status: 'fail',
    problem: 'Your homepage tells Google not to show it in search',
    cost: 'People searching for you on Google may not find your site at all, so they call a competitor instead.',
    fix: 'Remove the setting that hides your homepage from Google.',
  },
  {
    id: 'seo.robots', status: 'fail',
    problem: 'Your site blocks search engines from reading it',
    cost: 'Google can\'t read your pages properly, so you show up far less often when people search for what you offer.',
    fix: 'Update your robots.txt file so search engines can read your site.',
  },
  {
    id: 'lead.form', status: 'fail',
    problem: 'There\'s no way to message you from your website',
    cost: 'Visitors who don\'t want to call, or who visit after hours, have no easy way to reach you, so they move on.',
    fix: 'Add a short contact form to your homepage and contact page.',
  },
  {
    id: 'lead.clickToCall', status: 'fail', stat: 'nearbyVisit',
    problem: 'Your phone number isn\'t a tap-to-call button',
    cost: 'On a phone, calling you should take one tap. Every extra step loses callers who were ready to book.',
    fix: 'Make your phone number a tap-to-call button at the top of every page.',
  },
  {
    id: 'lead.brokenLinks', status: 'fail',
    problem: 'Some links on your site lead to a missing page',
    cost: 'Visitors who click them see a "page not found" error, which looks neglected and makes them leave.',
    fix: 'Repair or redirect the broken links.',
  },
  {
    id: 'lead.contactPage', status: 'fail',
    problem: 'Your homepage has no link to a contact page',
    cost: 'Visitors looking for how to reach you can\'t find it quickly, and many give up instead of searching.',
    fix: 'Add a "Contact" link to your main menu that leads to a clear contact page.',
  },

  // 2. Driving visitors away
  {
    id: 'speed.slowLoad', status: 'fail', stat: 'mobileAbandon',
    problem: 'Your site is slow to load on phones',
    cost: 'Most local customers search on their phone, and many leave before a slow page appears, choosing another business.',
    fix: 'Speed up the page, mainly by compressing images, so it loads in under 3 seconds on phones.',
  },
  {
    id: 'ssl.invalid', status: 'fail',
    problem: 'Browsers warn visitors that your site is "Not secure"',
    cost: 'That warning scares many visitors away before they read anything, and it makes your business look less trustworthy.',
    fix: 'Install a valid security (SSL) certificate so your site loads securely.',
  },
  {
    id: 'seo.viewport', status: 'fail',
    problem: 'Your site isn\'t set up for phones',
    cost: 'On a phone your pages appear tiny and zoomed out, so visitors have to pinch and scroll, and most won\'t.',
    fix: 'Set up your pages to fit phone screens, then check each one on a phone.',
  },
  {
    id: 'speed.layoutShift', status: 'fail',
    problem: 'Your page jumps around while it loads',
    cost: 'Buttons move just as visitors try to tap them, causing wrong taps and frustration on phones.',
    fix: 'Reserve space for images and banners so the page stays still while it loads.',
  },
  {
    id: 'lead.form', status: 'warn',
    problem: 'Visitors can only email you, as there\'s no contact form',
    cost: 'Many people won\'t open their email app to write to you, but would fill in a short form on the page.',
    fix: 'Add a short contact form so visitors can message you without leaving your site.',
  },
  {
    id: 'lead.clickToCall', status: 'warn', stat: 'nearbyVisit',
    problem: 'Your homepage has no tap-to-call button',
    cost: 'Phone visitors have to dig through your site to call you, when one tap on the first page should do it.',
    fix: 'Add a tap-to-call button to the top of your homepage.',
  },

  // 3. Found less often
  {
    id: 'geo.nap.phone', status: 'fail', stat: 'nearbyVisit', group: 'nap',
    problem: 'Your phone number on your site is missing or doesn\'t match Google',
    cost: 'Customers may call the wrong number or doubt they found the right business, and search engines trust mismatched details less.',
    fix: `Show the same phone number on your site as on your ${SAME_AS_GOOGLE}.`,
  },
  {
    id: 'geo.nap.address', status: 'fail', stat: 'nearbyVisit', group: 'nap',
    problem: 'Your address on your site is missing or doesn\'t match Google',
    cost: 'Customers may go to the wrong place or doubt your details, and search engines trust mismatched details less.',
    fix: `Show the exact address from your ${SAME_AS_GOOGLE} on every page, for example in the footer.`,
  },
  {
    id: 'geo.nap.name', status: 'fail', group: 'nap',
    problem: 'Your business name on your site is missing or doesn\'t match Google',
    cost: 'Customers and search engines may not be sure your website and your Google listing belong to the same business.',
    fix: `Use the same business name on your site as on your ${SAME_AS_GOOGLE}.`,
  },
  {
    id: 'geo.jsonld', status: 'fail', group: 'schema',
    problem: 'AI search tools can\'t easily tell what your business is',
    cost: 'Tools like ChatGPT and Google\'s AI answers rely on business details your site doesn\'t provide, so they suggest others.',
    fix: 'Add business details (schema markup) that search engines and AI tools can read.',
  },
  {
    id: 'geo.businessType', status: 'fail', group: 'schema',
    problem: 'Search engines can\'t tell what kind of business you are',
    cost: 'AI tools and Google are less likely to suggest you when someone asks for a business like yours nearby.',
    fix: 'Mark your site with your exact business type, like Dentist or School.',
  },
  {
    id: 'geo.businessType', status: 'warn', group: 'schema',
    problem: 'Your site describes your type of business too generally',
    cost: 'AI tools may not match you to searches for your specific service, so they suggest a more clearly described competitor.',
    fix: 'Mark your site with your exact business type, like Dentist or School.',
  },
  {
    id: 'seo.title', status: 'fail',
    problem: 'Your homepage has no title for Google to show',
    cost: 'Google has to guess the headline it shows for you in search results, which usually gets fewer clicks.',
    fix: 'Write a clear page title with your business name, main service and city.',
  },
  {
    id: 'seo.metaDescription', status: 'fail',
    problem: 'Your homepage has no description for Google to show',
    cost: 'Google shows random text from your page under your name in search results, so fewer people click.',
    fix: 'Write a short description of what you do and where.',
  },
  {
    id: 'speed.heavyImages', status: 'fail',
    problem: 'Your images are much larger than they need to be',
    cost: 'Oversized images make your pages slow on phones, especially on mobile data, so some visitors give up.',
    fix: 'Resize and compress your images and use modern image formats.',
  },
  {
    id: 'lead.booking', status: 'warn',
    problem: 'Customers can\'t book with you online',
    cost: 'People who\'d rather book at 10 pm than call during office hours can\'t, so some book with a competitor who lets them.',
    fix: 'Add an online booking or appointment-request button.',
  },

  // 4. Polish
  {
    id: 'geo.entityComplete', status: 'fail', group: 'schema',
    problem: 'Your business details for search engines are incomplete',
    cost: 'Missing your name, address or phone in those details makes AI tools less sure about recommending you.',
    fix: 'Complete your schema markup with your business name, address and phone.',
  },
  {
    id: 'geo.entityComplete', status: 'warn', group: 'schema',
    problem: 'Your business details for search engines are incomplete',
    cost: 'Missing your name, address or phone in those details makes AI tools less sure about recommending you.',
    fix: 'Complete your schema markup with your business name, address and phone.',
  },
  {
    id: 'geo.extras', status: 'warn',
    problem: 'Search engines can\'t read your opening hours or map location',
    cost: 'AI tools may not show your hours or location when people ask who\'s open nearby.',
    fix: 'Add your opening hours, map location and social profiles to your schema markup.',
  },
  {
    id: 'aeo.questions', status: 'fail', group: 'aeo',
    problem: 'Your site doesn\'t answer the questions customers ask',
    cost: 'AI assistants like ChatGPT quote sites that answer questions directly, and yours gives them little to quote.',
    fix: 'Add a short FAQ answering the questions customers ask you most.',
  },
  {
    id: 'aeo.faqSection', status: 'fail', group: 'aeo',
    problem: 'Your homepage has no questions-and-answers section',
    cost: 'Customers and AI assistants look for quick answers, and without them people call a competitor who explains more.',
    fix: 'Add a short FAQ answering the questions customers ask you most.',
  },
  {
    id: 'aeo.faqSchema', status: 'fail', group: 'aeo',
    problem: 'Your answers aren\'t marked up for search engines',
    cost: 'Google and AI assistants can\'t easily pick out your answers to show or quote them.',
    fix: 'Mark up your FAQ so search engines and AI tools can read it.',
  },
  {
    id: 'aeo.h1', status: 'fail', group: 'aeo',
    problem: 'Your homepage has no single clear main heading',
    cost: 'Visitors and search engines can\'t tell at a glance what you offer or where.',
    fix: 'Give the page one clear main heading with your main service and city.',
  },
  {
    id: 'aeo.h2', status: 'fail', group: 'aeo',
    problem: 'Your homepage isn\'t split into clear sections',
    cost: 'Without clear section headings, visitors skim past what you offer and AI tools struggle to quote you.',
    fix: 'Break the page into clear sections, each with its own heading.',
  },
  {
    id: 'aeo.hierarchy', status: 'fail', group: 'aeo',
    problem: 'Your page headings are missing or out of order',
    cost: 'Jumbled headings make the page harder for search engines and screen readers to follow.',
    fix: 'Put the page\'s headings in a logical order.',
  },
];
```

- [ ] **Step 4: Create `impact.ts`**

```ts
// app/_shared/lib/audit/impact.ts

// Turns an audit into the problems a business owner reads, worst first, in the
// impact library's plain English. Client-safe (no Node-only imports).

import { isOutdatedAudit, type Finding, type FindingStatus, type LighthouseSummary } from '@/app/_shared/lib/audit/types';
import { IMPACT_LIBRARY, STATS, type ImpactEntry, type Stat } from '@/app/_shared/lib/audit/impactLibrary';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';

export interface Problem {
  id: string;
  /** The owner's version of the problem */
  problem: string;
  /** What it costs them; '' for a check the library doesn't know */
  cost: string;
  /** What we'd do about it; '' for a check the library doesn't know */
  fix: string;
  /** What was measured, e.g. "Google's mobile test: 4.2 s" */
  evidence?: string;
  stat?: Stat;
}

interface Candidate {
  id: string;
  status: FindingStatus;
  label: string;
  evidence?: string;
}

// "Slow" matches the statistic quoted with it (3 seconds); a Lighthouse score
// below 0.5 is about 4 s for LCP
const SLOW_LCP_MS = 3_000;
const POOR_SCORE = 0.5;
const IMAGE_AUDITS = ['uses-optimized-images', 'uses-webp-images', 'uses-responsive-images', 'offscreen-images'];

/** The library entry for a check's result, when that result is a problem */
export function impactFor(id: string, status: FindingStatus): ImpactEntry | undefined {
  return IMPACT_LIBRARY.find((entry) => entry.id === id && entry.status === status);
}

/** A finding in owner language, or its own label when the library has no entry */
export const plainLabel = (finding: Finding): string => impactFor(finding.id, finding.status)?.problem ?? finding.label;

const isPoor = (score: number | null | undefined) => typeof score === 'number' && score < POOR_SCORE;
const labTest = (displayValue: string | undefined) => (displayValue ? `Google's mobile test: ${displayValue}` : undefined);

/** Speed and SSL problems, read from the stored audit (they aren't findings) */
function signals(audit: AuditLike): Candidate[] {
  const mobile = (audit.raw_json as { mobile?: LighthouseSummary | null } | null)?.mobile;
  const audits = mobile?.keyAudits ?? {};
  const found: Candidate[] = [];
  const signal = (id: string, evidence: string | undefined) => found.push({ id, status: 'fail', label: id, evidence });

  // Real visitors decide when Google has them; the lab test only otherwise
  const lcp = audits['largest-contentful-paint'];
  if (mobile?.field) {
    if (mobile.field.lcpMs > SLOW_LCP_MS) {
      signal('speed.slowLoad', `Real visitors on phones wait about ${(mobile.field.lcpMs / 1000).toFixed(1)} s`);
    }
  } else if (lcp && isPoor(lcp.score)) {
    signal('speed.slowLoad', labTest(lcp.displayValue));
  }
  if (!isOutdatedAudit(audit.engine_version) && audit.ssl_valid === false) {
    signal('ssl.invalid', audit.checks?.ssl?.error);
  }
  const shift = audits['cumulative-layout-shift'];
  if (shift && isPoor(shift.score)) signal('speed.layoutShift', labTest(shift.displayValue && `layout shift ${shift.displayValue}`));
  const images = IMAGE_AUDITS.map((id) => audits[id]).find((a) => a && isPoor(a.score));
  if (images) signal('speed.heavyImages', labTest(images.displayValue));
  return found;
}

/** The audit's problems, worst first: library order, one per group, then failing checks the library doesn't know */
export function rankedProblems(audit: AuditLike): Problem[] {
  const checks = audit.checks ?? {};
  const findings = [checks.lead, checks.geo, checks.aeo, checks.seo].flatMap((c) => c?.findings ?? []);
  const candidates: Candidate[] = [
    ...signals(audit),
    ...findings
      .filter((finding) => finding.status !== 'pass')
      .map((finding) => ({ id: finding.id, status: finding.status, label: finding.label, evidence: finding.detail })),
  ];

  const known = candidates
    .map((c) => ({ c, index: IMPACT_LIBRARY.findIndex((e) => e.id === c.id && e.status === c.status) }))
    .filter(({ index }) => index !== -1)
    .sort((a, b) => a.index - b.index);
  const groups = new Set<string>();
  const ranked: Problem[] = [];
  for (const { c, index } of known) {
    const entry = IMPACT_LIBRARY[index];
    if (entry.group) {
      if (groups.has(entry.group)) continue;
      groups.add(entry.group);
    }
    ranked.push({
      id: entry.id,
      problem: entry.problem,
      cost: entry.cost,
      fix: entry.fix,
      ...(c.evidence && { evidence: c.evidence }),
      ...(entry.stat && { stat: STATS[entry.stat] }),
    });
  }

  // A failing check added after the library was written: shown by its own label, last
  const unknown = candidates
    .filter((c) => c.status === 'fail' && !IMPACT_LIBRARY.some((e) => e.id === c.id))
    .map((c) => ({ id: c.id, problem: c.label, cost: '', fix: '', ...(c.evidence && { evidence: c.evidence }) }));
  return [...ranked, ...unknown];
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/impact.test.ts && npx tsc --noEmit`
Expected: all PASS; no type errors. If the writing-rules test names an entry, shorten that entry's text (never loosen the test).

---

### Task 4: The AI report — prompt, fixes, offer and guard

**Files:**
- Create: `app/_shared/lib/audit/aiReport.ts`
- Test: `app/_shared/lib/audit/__tests__/aiReport.test.ts`

**Interfaces:**
- Consumes: `Problem` (Task 3).
- Produces:
  ```ts
  export interface ReportInput { businessName: string; website: string; problems: Problem[]; sender: string | null }
  export interface WrittenReport { summary: string; cold_email: string }
  export class InvalidReplyError extends Error {}
  export function reportFixes(problems: Problem[]): string[];
  export function offerSentence(input: ReportInput): string;
  export function buildReportPrompt(input: ReportInput, rejection?: string): string;
  export function replyProblem(reply: WrittenReport, input: ReportInput): string | null;
  export function writeReport(complete: (prompt: string) => Promise<string>, input: ReportInput): Promise<WrittenReport>;
  ```

- [ ] **Step 1: Write the failing tests** — create `aiReport.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  buildReportPrompt,
  InvalidReplyError,
  offerSentence,
  replyProblem,
  reportFixes,
  writeReport,
  type ReportInput,
} from '@/app/_shared/lib/audit/aiReport';
import type { Problem } from '@/app/_shared/lib/audit/impact';

const problem = (n: number, over: Partial<Problem> = {}): Problem => ({
  id: `p${n}`,
  problem: `Problem ${'abcdef'[n]}`,
  cost: `Cost ${'abcdef'[n]}.`,
  fix: `Fix ${'abcdef'[n]}.`,
  ...over,
});
const slow = problem(0, {
  problem: 'Your site is slow to load on phones',
  evidence: 'Real visitors on phones wait about 4.1 s',
  stat: { text: '53% of mobile site visits are abandoned if a page takes longer than 3 seconds to load.', source: 'Think with Google, 2016' },
});
const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  businessName: 'Smile Dental',
  website: 'https://smiledental.com',
  problems: [slow, problem(1), problem(2)],
  sender: 'Numan',
  ...over,
});
const reply = (cold_email: string, summary = 'Your site is slow on phones.') => ({ summary, cold_email });

describe('reportFixes and offerSentence', () => {
  it('takes up to 5 fixes, worst problem first, skipping checks without one', () => {
    const problems = [problem(0), problem(1, { fix: '' }), problem(2), problem(3), problem(4), problem(5), problem(1)];
    expect(reportFixes(problems)).toEqual(['Fix a.', 'Fix c.', 'Fix d.', 'Fix e.', 'Fix f.']);
  });

  it('offers a report with the number of fixes, or a plain report when there are none', () => {
    expect(offerSentence(input())).toBe('I put together a short report with 3 fixes for Smile Dental — want me to send it over?');
    expect(offerSentence(input({ problems: [problem(0)] }))).toBe('I put together a short report with 1 fix for Smile Dental — want me to send it over?');
    expect(offerSentence(input({ problems: [] }))).toBe("I put together a short report on Smile Dental's website — want me to send it over?");
  });
});

describe('buildReportPrompt', () => {
  it('gives the model only the ranked facts, the offer and the sign-off', () => {
    const prompt = buildReportPrompt(input());
    const first = prompt.indexOf('1. Your site is slow to load on phones.');
    expect(first).toBeGreaterThan(-1);
    expect(prompt.indexOf('2. Problem b.')).toBeGreaterThan(first);
    expect(prompt).toContain('Measured: Real visitors on phones wait about 4.1 s.');
    expect(prompt).toContain('Research: 53% of mobile site visits are abandoned if a page takes longer than 3 seconds to load. (Think with Google, 2016)');
    expect(prompt).toContain(offerSentence(input()));
    expect(prompt).toContain('Sign off with: Numan, DevArtVentures');
    expect(buildReportPrompt(input({ sender: null }))).toContain('Sign off with: The DevArtVentures team');
  });

  it('says when nothing was found, and passes on why a previous answer was rejected', () => {
    expect(buildReportPrompt(input({ problems: [] }))).toContain('No significant problems were found.');
    expect(buildReportPrompt(input(), 'It used numbers that aren\'t in the facts (40).')).toContain(
      "Your previous answer was rejected: It used numbers that aren't in the facts (40)."
    );
  });
});

describe('replyProblem', () => {
  it('accepts numbers from the facts, written in other forms too', () => {
    expect(replyProblem(reply('Subject: Your site\n\nVisitors wait 4.1s; 53% leave after a 3-second wait.'), input())).toBeNull();
  });

  it('accepts digits from the business name and website', () => {
    const named = input({ businessName: 'Smile 4 U Dental', website: 'https://dental32.com' });
    expect(replyProblem(reply('Subject: Smile 4 U\n\nI looked at dental32.com.'), named)).toBeNull();
  });

  it('rejects numbers that are not in the facts', () => {
    expect(replyProblem(reply('Subject: Hi\n\nYou are losing $2,000 a month and 40% of visitors.'), input())).toBe(
      "It used numbers that aren't in the facts (2,000, 40)."
    );
  });

  it('rejects an email body well over 90 words, not counting the subject', () => {
    const long = `Subject: ${'word '.repeat(30)}\n\n${'word '.repeat(111)}`;
    expect(replyProblem(reply(long), input())).toBe('The email body is 111 words; keep it under 90.');
    expect(replyProblem(reply(`Subject: x\n\n${'word '.repeat(105)}`), input())).toBeNull();
  });
});

describe('writeReport', () => {
  const answer = (cold_email: string) => JSON.stringify(reply(cold_email));

  it('keeps a good first answer', async () => {
    const complete = vi.fn(async () => answer('Subject: Hi\n\nYour site is slow.'));
    expect(await writeReport(complete, input())).toEqual(reply('Subject: Hi\n\nYour site is slow.'));
    expect(complete).toHaveBeenCalledOnce();
  });

  it('retries once with the reason, and keeps the second answer', async () => {
    const complete = vi
      .fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce(answer('Subject: Hi\n\nYou lose 40% of visitors.'))
      .mockResolvedValueOnce(answer('Subject: Hi\n\nVisitors leave before it loads.'));
    expect((await writeReport(complete, input())).cold_email).toBe('Subject: Hi\n\nVisitors leave before it loads.');
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1][0]).toContain("It used numbers that aren't in the facts (40).");
  });

  it('throws InvalidReplyError when the model does not answer with the JSON asked for', async () => {
    await expect(writeReport(vi.fn(async () => 'Sure! Here is the email'), input())).rejects.toBeInstanceOf(InvalidReplyError);
    await expect(writeReport(vi.fn(async () => '{"summary": "x"}'), input())).rejects.toBeInstanceOf(InvalidReplyError);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/aiReport.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `aiReport.ts`**

```ts
// app/_shared/lib/audit/aiReport.ts

// The AI report: the model only sees the impact library's facts, the fixes come
// straight from the library, and a guard asks once more when the model invents
// numbers or writes a long email. Server-side (used by /api/generate).

import type { Problem } from '@/app/_shared/lib/audit/impact';

export interface ReportInput {
  businessName: string;
  website: string;
  /** Worst first (rankedProblems) */
  problems: Problem[];
  /** REPORT_CONTACT_NAME; null signs as the team */
  sender: string | null;
}

export interface WrittenReport {
  summary: string;
  cold_email: string;
}

/** The model's answer wasn't the JSON asked for */
export class InvalidReplyError extends Error {}

const MAX_FIXES = 5;
const PROMPT_PROBLEMS = 5;
// The prompt asks for under 90 words; only a clearly longer body is sent back
const MAX_EMAIL_WORDS = 110;
const NUMBER = /\d+(?:[.,]\d+)*/g;

/** Up to 5 fixes, worst problem first; checks the library doesn't know have none */
export function reportFixes(problems: Problem[]): string[] {
  return problems.map((p) => p.fix).filter(Boolean).slice(0, MAX_FIXES);
}

/** The email's closing offer, used word for word */
export function offerSentence({ businessName, problems }: ReportInput): string {
  const fixes = reportFixes(problems).length;
  return fixes > 0
    ? `I put together a short report with ${fixes} fix${fixes === 1 ? '' : 'es'} for ${businessName} — want me to send it over?`
    : `I put together a short report on ${businessName}'s website — want me to send it over?`;
}

const signOff = (sender: string | null) => (sender ? `${sender}, DevArtVentures` : 'The DevArtVentures team');

function factLines(problems: Problem[]): string {
  if (problems.length === 0) return 'No significant problems were found.';
  return problems
    .slice(0, PROMPT_PROBLEMS)
    .map((p, i) =>
      [
        `${i + 1}. ${p.problem}.`,
        p.cost,
        p.evidence && `Measured: ${p.evidence}.`,
        p.stat && `Research: ${p.stat.text} (${p.stat.source})`,
      ]
        .filter(Boolean)
        .join(' ')
    )
    .join('\n');
}

export function buildReportPrompt(input: ReportInput, rejection?: string): string {
  return `You write for DevArtVentures, a web agency, about a local business's website. Respond in JSON only.

Business: ${input.businessName}
Website: ${input.website}

Problems we found, worst first. These are the ONLY facts you may use:
${factLines(input.problems)}

Write:
1. "summary": 2-3 sentences for the business owner, in plain language, about the most important problems above and what they cost the business.
2. "cold_email": a short cold email to the owner.
   - First line: "Subject: " and a short, specific subject.
   - Body under 90 words. Open with problem 1 and what it costs them; you may mention one more problem briefly.
   - End the body with this sentence, word for word: "${offerSentence(input)}"
   - Sign off with: ${signOff(input.sender)}
   - No bullet points.

Rules:
- Use only the facts above. Add no numbers, percentages, prices or dollar amounts that aren't in them.
- Never promise results as certain.
- Don't invent names, people or details about the business.
- Plain English an owner understands: no terms like LCP, schema, JSON-LD, SEO or viewport.${
    rejection ? `\n\nYour previous answer was rejected: ${rejection} Write it again.` : ''
  }

Respond with ONLY valid JSON: {"summary": "...", "cold_email": "..."}`;
}

// The email without its "Subject:" line
const emailBody = (email: string) => email.trimStart().replace(/^subject:[^\n]*/i, '');

/** Why a reply must be written again, or null when it's fine */
export function replyProblem(reply: WrittenReport, input: ReportInput): string | null {
  const facts = [factLines(input.problems), offerSentence(input), input.businessName, input.website, input.sender ?? ''].join(' ');
  const allowed = new Set(facts.match(NUMBER) ?? []);
  const used = new Set(`${reply.summary} ${reply.cold_email}`.match(NUMBER) ?? []);
  const invented = [...used].filter((n) => !allowed.has(n));
  if (invented.length > 0) return `It used numbers that aren't in the facts (${invented.join(', ')}).`;
  const words = emailBody(reply.cold_email).split(/\s+/).filter(Boolean).length;
  return words > MAX_EMAIL_WORDS ? `The email body is ${words} words; keep it under 90.` : null;
}

function parseReply(content: string): WrittenReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new InvalidReplyError('AI returned invalid JSON');
  }
  const { summary, cold_email } = (parsed ?? {}) as Partial<WrittenReport>;
  if (typeof summary !== 'string' || typeof cold_email !== 'string') throw new InvalidReplyError('AI reply is missing fields');
  return { summary, cold_email };
}

/** Asks the model; asks once more, with the reason, when the answer breaks a rule. The second answer is kept. */
export async function writeReport(complete: (prompt: string) => Promise<string>, input: ReportInput): Promise<WrittenReport> {
  const first = parseReply(await complete(buildReportPrompt(input)));
  const problem = replyProblem(first, input);
  if (!problem) return first;
  return parseReply(await complete(buildReportPrompt(input, problem)));
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit/__tests__/aiReport.test.ts && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 5: `/api/generate` uses the library and the guard

**Files:**
- Modify: `app/api/generate/route.ts`, `app/_shared/lib/audit/reportData.ts`, `app/_shared/lib/audit/__tests__/reportData.test.ts`
- Create test: `app/api/generate/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `rankedProblems`, `impactFor` (Task 3); `writeReport`, `reportFixes`, `InvalidReplyError` (Task 4); `reportContact()`.
- Produces: `ai_reports` rows whose `improvements` are library fixes; `auditFacts` and `failingFindings` are removed.

- [ ] **Step 1: Write the failing route test** — create `app/api/generate/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/generate/route';
import { impactFor } from '@/app/_shared/lib/audit/impact';

// Fake Supabase: no cached report, then the audit (with its business), then the insert
const db = vi.hoisted(() => {
  const state = { audit: null as unknown, inserted: null as Record<string, unknown> | null };
  const from = (table: string) => {
    let op = 'select';
    const chain = {
      select: () => chain,
      insert: (value: Record<string, unknown>) => {
        op = 'insert';
        state.inserted = value;
        return chain;
      },
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () =>
        table === 'audits'
          ? { data: state.audit, error: null }
          : op === 'insert'
            ? { data: { id: 'report-1', ...state.inserted }, error: null }
            : { data: null, error: null },
    };
    return chain;
  };
  return { state, from };
});
const groq = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: groq.create } };
  },
}));

const answer = (summary: string, cold_email: string) => ({ choices: [{ message: { content: JSON.stringify({ summary, cold_email }) } }] });

async function post() {
  const res = await POST(new NextRequest('http://localhost/api/generate', { method: 'POST', body: JSON.stringify({ audit_id: 'audit-1' }) }));
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  vi.stubEnv('GROQ_API_KEY', 'test-key');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  db.state.inserted = null;
  db.state.audit = {
    id: 'audit-1',
    created_at: '2026-10-01T00:00:00Z',
    performance_score: 80,
    seo_score: 90,
    mobile_score: 70,
    ssl_valid: true,
    raw_json: { mobile: null, desktop: null },
    checks: { lead: { findings: [{ id: 'lead.form', status: 'fail', label: 'No form' }], pages: [], links: { checked: 0, broken: [] } } },
    engine_version: 2,
    businesses: { name: 'Smile Dental', website: 'https://smiledental.com' },
  };
  groq.create.mockReset().mockResolvedValue(answer('No easy way to message you.', 'Subject: Quick note\n\nVisitors cannot message you.'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/generate', () => {
  it("stores the library's fixes with the model's summary and email", async () => {
    const { status, json } = await post();
    expect(status).toBe(200);
    expect(db.state.inserted).toEqual({
      audit_id: 'audit-1',
      summary: 'No easy way to message you.',
      improvements: [impactFor('lead.form', 'fail')?.fix],
      cold_email: 'Subject: Quick note\n\nVisitors cannot message you.',
    });
    expect(json.ai_report.id).toBe('report-1');
    expect(groq.create.mock.calls[0][0].messages[0].content).toContain("1. There's no way to message you from your website.");
  });

  it('returns 500 and stores nothing when the model does not answer in JSON', async () => {
    groq.create.mockResolvedValue({ choices: [{ message: { content: 'Sure! Here you go' } }] });
    const { status, json } = await post();
    expect(status).toBe(500);
    expect(json.error).toBe('AI returned invalid JSON');
    expect(db.state.inserted).toBeNull();
  });

  it('returns 503 when the AI service fails', async () => {
    groq.create.mockRejectedValue(new Error('rate limited'));
    const { status, json } = await post();
    expect(status).toBe(503);
    expect(json.error).toBe('AI service unavailable');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/api/generate/__tests__/route.test.ts`
Expected: the first test FAILS (improvements / prompt don't match: the old prompt is used); the 500 and 503 tests pass already — they guard existing behavior through the rewrite.

- [ ] **Step 3: Rewrite the generation part of the route**

In `app/api/generate/route.ts`:
1. Imports become:
```ts
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { rankedProblems } from '@/app/_shared/lib/audit/impact';
import { InvalidReplyError, reportFixes, writeReport, type WrittenReport } from '@/app/_shared/lib/audit/aiReport';
import { reportContact } from '@/app/_shared/lib/config/reportContact';
```
2. Replace everything from `const { scores, issues } = auditFacts(audit);` down to (and including) the `parsed` JSON-parsing block with:
```ts
  // The model only sees the impact library's facts; the fixes come from the library
  const problems = rankedProblems(audit);
  const complete = async (prompt: string): Promise<string> => {
    const completion = await groq.chat.completions.create({
      // llama-3.3-70b-versatile is no longer served by Groq (model_not_found)
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      // gpt-oss reasons before answering and those tokens count against
      // max_tokens: at default effort it used up to ~1.5k and got cut off
      // mid-JSON (json_validate_failed). Low effort uses ~50; 4096 is headroom.
      reasoning_effort: 'low',
      max_tokens: 4096,
    });
    return completion.choices[0]?.message?.content ?? '{}';
  };

  let written: WrittenReport;
  try {
    written = await writeReport(complete, {
      businessName: biz.name,
      website: biz.website ?? '',
      problems,
      sender: reportContact().name,
    });
  } catch (err) {
    if (err instanceof InvalidReplyError) {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }
    console.error('[generate] Groq request failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 });
  }
```
3. The insert payload becomes:
```ts
    .insert({
      audit_id: auditId,
      summary: written.summary,
      improvements: reportFixes(problems),
      cold_email: written.cold_email,
    })
```
4. The `biz` type annotation becomes `{ name: string; website: string | null } | null`.

- [ ] **Step 4: Remove the old prompt facts**

In `reportData.ts`, delete `failingFindings` and `auditFacts` (and the `measuredSeoAndSsl` import of them is unchanged — it is still used by `buildPdfProps`). In `reportData.test.ts`:
- remove `auditFacts` and `failingFindings` from the import list;
- delete the test `'picks failing GEO then AEO findings'`;
- delete the whole `describe('auditFacts', …)` block;
- in `describe('lead capture in the report', …)`, delete the tests `'adds the lead capture score to the AI facts, and lists its failures first'`, `"gives the AI a failing check's details, so the email can name the broken links"` and `'says "not measured" for audits made before lead capture'`.

Run `grep -rn "auditFacts\|failingFindings" app` — expected: no matches.

- [ ] **Step 5: Run to verify**

Run: `npx vitest run app/api/generate app/_shared/lib/audit && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 6: The PDF tells the story in owner language

**Files:**
- Modify: `app/_shared/lib/audit/reportData.ts`, `app/_shared/components/auditely/pdfDocument/pdfDocument.tsx`, `pdfSections.tsx`, `pdfStyles.ts`
- Test: `app/_shared/lib/audit/__tests__/reportData.test.ts`

**Interfaces:**
- Consumes: `rankedProblems`, `plainLabel` (Task 3), `STATS` sources.
- Produces: `PdfDocumentProps.problems: PdfProblem[]` (max 4) and `PdfDocumentProps.sources: string[]`; `topIssues` removed; findings in the GEO / AEO / Lead blocks carry plain labels.
  ```ts
  export interface PdfProblem { problem: string; cost: string; evidence?: string; stat?: string }
  ```

- [ ] **Step 1: Write the failing tests**

In `reportData.test.ts`:
1. Add imports: `import { STATS } from '@/app/_shared/lib/audit/impactLibrary';` and `import { impactFor } from '@/app/_shared/lib/audit/impact';`.
2. In `'passes nulls through and drops non-string improvements'`, replace `expect(props.topIssues).toHaveLength(2);` with:
```ts
    // The fixture's checks aren't in the library: shown by their own labels
    expect(props.problems.map((p) => p.problem)).toEqual(['geo.b', 'aeo.a', 'aeo.c']);
```
3. In `describe('lead capture in the report', …)`, the test `'passes the lead capture score and its problems to the PDF'` now expects plain labels — replace its `leadFindings` expectation with:
```ts
    expect(props.leadFindings).toEqual([
      { status: 'fail', label: impactFor('lead.form', 'fail')?.problem },
      { status: 'warn', label: impactFor('lead.booking', 'warn')?.problem },
    ]);
```
4. Append inside `describe('buildPdfProps', …)`:
```ts
  it('tells the top 4 problems in owner language, with what was measured and the sources', () => {
    const story: AuditLike = {
      ...audit,
      raw_json: { mobile: { categories: {}, keyAudits: {}, field: { lcpMs: 4100, scope: 'page' } }, desktop: null },
      checks: {
        lead: {
          findings: [
            { id: 'lead.form', status: 'fail', label: 'x' },
            { id: 'lead.clickToCall', status: 'fail', label: 'x' },
            { id: 'lead.brokenLinks', status: 'fail', label: 'x', detail: '/book-now' },
            { id: 'lead.contactPage', status: 'fail', label: 'x' },
          ],
          pages: [],
          links: { checked: 3, broken: [] },
        },
      },
    };
    const props = buildPdfProps(story, business, noReport, contact);
    expect(props.problems).toHaveLength(4);
    expect(props.problems[0]).toEqual({ problem: impactFor('lead.form', 'fail')?.problem, cost: impactFor('lead.form', 'fail')?.cost });
    expect(props.problems[2]).toMatchObject({ evidence: '/book-now' });
    expect(props.problems[1].stat).toBe(STATS.nearbyVisit.text);
    expect(props.sources).toEqual([STATS.nearbyVisit.source]);
  });

  it('shows plain labels in the GEO, AEO and lead capture blocks', () => {
    const plain: AuditLike = {
      ...audit,
      checks: { ...checks, lead: { findings: [{ id: 'lead.form', status: 'warn', label: 'Only an email link' }], pages: [], links: { checked: 0, broken: [] } } },
    };
    const props = buildPdfProps(plain, business, noReport, contact);
    expect(props.leadFindings[0].label).toBe(impactFor('lead.form', 'warn')?.problem);
    expect(props.geoFindings[0].label).toBe('geo.b');
  });

  it('still builds the report for an outdated audit with no checks', () => {
    const props = buildPdfProps({ ...v1Audit, checks: {}, raw_json: {} }, business, noReport, contact);
    expect(props.problems).toEqual([]);
    expect(props.sources).toEqual([]);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/_shared/lib/audit/__tests__/reportData.test.ts`
Expected: the 2 edited tests and the 3 new tests FAIL (`problems` / `sources` undefined; labels unchanged).

- [ ] **Step 3: Implement `reportData.ts`**

1. Imports: add `import { plainLabel, rankedProblems } from '@/app/_shared/lib/audit/impact';` and add `PdfProblem` to the `pdfDocument` type import.
2. Add `const PDF_PROBLEMS_LIMIT = 4;` next to `PDF_FINDINGS_LIMIT`.
3. In `pdfFindings`, the label line becomes `label: pdfText(plainLabel(finding)),`.
4. In `buildPdfProps`, replace `const topIssues = topLighthouseIssues(audit.raw_json, 4);` with:
```ts
  const problems = rankedProblems(audit).slice(0, PDF_PROBLEMS_LIMIT);
```
and replace the whole `topIssues: …` property with:
```ts
    problems: problems.map(
      (p): PdfProblem => ({
        problem: pdfText(p.problem),
        cost: pdfText(p.cost),
        ...(p.evidence && { evidence: pdfText(p.evidence) }),
        ...(p.stat && { stat: pdfText(p.stat.text) }),
      })
    ),
    sources: [...new Set(problems.flatMap((p) => (p.stat ? [p.stat.source] : [])))],
```

- [ ] **Step 4: Implement the PDF**

`pdfDocument.tsx`:
1. After `PdfFinding`, add:
```ts
/** A problem in owner language (see impact.ts) */
export interface PdfProblem {
  problem: string;
  cost: string;
  evidence?: string;
  stat?: string;
}
```
2. In `PdfDocumentProps`, replace `topIssues?: { title: string; displayValue?: string }[];` with `problems: PdfProblem[];` and add `sources: string[];` after `improvements`. Destructure `problems` and `sources` instead of `topIssues`.
3. Import `ProblemsSection` and `SourcesNote` from `pdfSections` (keep the list alphabetical).
4. Replace the whole `{/* Top Issues */}` block with:
```tsx
        {/* What it costs them, worst first */}
        {problems.length > 0 && (
          <>
            <ProblemsSection problems={problems} />
            <View style={styles.divider} />
          </>
        )}
```
5. Change the improvements label `Recommended Improvements` to `How We'd Fix It`, and render the section only when there are improvements: wrap it in `{improvements.length > 0 && ( … )}`.
6. Right after the improvements section, add `<SourcesNote sources={sources} />`.

`pdfSections.tsx` — add `PdfProblem` to the type import from `pdfDocument`, and append:
```tsx
export function ProblemsSection({ problems }: { problems: PdfProblem[] }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionLabel}>What's Costing You Customers</Text>
      {problems.map((p, i) => (
        <View key={i} style={styles.issueRow}>
          <View style={[styles.bulletDot, styles.dotRed]} />
          <View style={styles.findingBody}>
            <Text style={styles.problemTitle}>{p.problem}</Text>
            {p.cost ? <Text style={styles.findingLabel}>{p.cost}</Text> : null}
            {p.stat ? <Text style={styles.findingDetail}>{p.stat}</Text> : null}
            {p.evidence ? <Text style={styles.findingDetail}>{p.evidence}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Where the statistics in the report come from */
export function SourcesNote({ sources }: { sources: string[] }) {
  if (sources.length === 0) return null;
  return <Text style={styles.sources}>Sources: {sources.join('; ')}</Text>;
}
```

`pdfStyles.ts` — add after `findingDetail`:
```ts
  problemTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 1,
  },
  sources: {
    fontSize: 7.5,
    color: '#9ca3af',
    marginTop: -12,
    marginBottom: 16,
  },
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run app/_shared/lib/audit && npx tsc --noEmit`
Expected: all PASS; no type errors.

---

### Task 7: See it for real, verify everything, hand off

**Files:** scratch only (`$SCRATCH` = the session scratchpad directory), not committed.

- [ ] **Step 1: Render a sample PDF and print a sample prompt**

`$SCRATCH/vitest.sample.config.mts`:
```ts
export default {
  root: '$SCRATCH',
  resolve: { alias: { '@': '/Users/cp/Downloads/Numan/work/auditely/' } },
  test: { include: ['sample-report.test.tsx'], globals: true, testTimeout: 60_000 },
};
```
(write it with the real scratch path in place of `$SCRATCH`.)

`$SCRATCH/sample-report.test.tsx`:
```tsx
import { writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps, type AuditLike } from '@/app/_shared/lib/audit/reportData';
import { rankedProblems } from '@/app/_shared/lib/audit/impact';
import { buildReportPrompt, reportFixes } from '@/app/_shared/lib/audit/aiReport';

const audit: AuditLike = {
  created_at: '2026-10-01T00:00:00Z',
  performance_score: 61, seo_score: 83, mobile_score: 34, ssl_valid: true, geo_score: 40, aeo_score: 35, lead_score: 45, engine_version: 2,
  raw_json: { mobile: { categories: {}, keyAudits: { 'largest-contentful-paint': { score: 0.1, title: 'LCP', displayValue: '6.3 s' }, 'cumulative-layout-shift': { score: 0.3, title: 'CLS', displayValue: '0.41' } } }, desktop: null },
  checks: {
    lead: { findings: [
      { id: 'lead.clickToCall', status: 'fail', label: 'No tap-to-call phone link on the pages we checked' },
      { id: 'lead.form', status: 'warn', label: 'Only an email link — no contact form found' },
      { id: 'lead.brokenLinks', status: 'fail', label: '2 broken links', detail: '/book-now, /team' },
      { id: 'lead.booking', status: 'warn', label: 'No online booking' },
    ], pages: [], links: { checked: 12, broken: [] } },
    geo: { findings: [{ id: 'geo.nap.phone', status: 'fail', label: "Phone number on site doesn't match business listing", detail: 'Site shows: (555) 000-1111' }, { id: 'geo.jsonld', status: 'fail', label: 'No structured data (JSON-LD) on the homepage' }], schemaTypes: [], nap: { name: 'match', address: 'match', phone: 'mismatch', site: { name: null, address: null, phones: [] } } },
    aeo: { findings: [{ id: 'aeo.questions', status: 'fail', label: 'No question-style headings' }], h1Count: 1, h2Count: 1, questionHeadings: 0, hasFaqSchema: false },
  },
};
const business = { name: 'Smile Dental', website: 'https://smiledental.com', address: '123 Main St, Springfield, IL', phone: '(555) 123-4567' };

test('sample', async () => {
  const problems = rankedProblems(audit);
  const report = { summary: 'Sample summary written by the AI.', improvements: reportFixes(problems) };
  const contact = { name: 'Numan', phone: null, email: 'contact@devartventures.com', bookingUrl: null };
  writeFileSync('$SCRATCH/sample-report.pdf', await renderToBuffer(createElement(PdfDocument, buildPdfProps(audit, business, report, contact)) as never));
  writeFileSync('$SCRATCH/sample-prompt.txt', buildReportPrompt({ businessName: business.name, website: business.website, problems, sender: 'Numan' }));
});
```
Run: `cd /Users/cp/Downloads/Numan/work/auditely && npx vitest run --config $SCRATCH/vitest.sample.config.mts`, then open `$SCRATCH/sample-report.pdf` (Read tool) and `$SCRATCH/sample-prompt.txt`.
Expected: the PDF's first section is "WHAT'S COSTING YOU CUSTOMERS" with 4 plain problems (tap-to-call, broken links, slow on phones, page jumps), grey evidence lines, the two statistics and a Sources line; "HOW WE'D FIX IT" lists 5 fixes; em dashes and quotes draw correctly; nothing overlaps. The prompt lists the problems worst first with "Measured:" / "Research:" lines and the exact offer sentence. Fix any layout problem with a style change before continuing.

- [ ] **Step 2: Full verification**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all tests pass (3 pre-existing skips), no type errors, no lint warnings, build succeeds.

- [ ] **Step 3: Hand-off (do not commit yet)**

Report: what changed, test results, the sample PDF and prompt (attach or describe), and that no migration is needed. Ask for the go-ahead to commit code, spec and plan on `staging`; commit only after a yes, ending the message with:
```
Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```
