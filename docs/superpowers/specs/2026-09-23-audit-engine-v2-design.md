# Audit Engine v2 — Design Spec

**Date:** 2026-09-23
**Status:** Approved in conversation (pending written-spec review)
**Project:** A of 3 from `update.txt` (A: Audit Engine v2 → B: Reports & Outreach → C: Batch CSV)

## Background

Auditely's audit today is two PageSpeed Insights calls plus an email scrape.
Verified problems:

- **SEO is always 0 and SSL is always ✗.** PSI `runPagespeed` only runs the
  Performance category unless `category=` params are passed. Verified on
  Lighthouse 13.5.0: without params → `categories: performance` only and no
  `is-on-https` audit; with params → all 4 categories and `is-on-https: 1`.
  (The `category=` params were added in the 2026-09-23 fix pass; every audit
  stored before that is wrong.)
- **One failed PSI call fails the whole audit.** No retry, no fallback, no
  partial result. Missing numbers are stored as `0`, which the AI then
  presents to prospects as real findings.
- **No signals for AI-era search.** Nothing checks structured data, NAP
  consistency with the Google listing, or answer-engine readiness — the hooks
  `update.txt` asks for (GEO / AEO / local search).
- **Audits are cached forever** with no way to refresh them.

## Goals

1. Accurate, complete, defensible numbers: SSL and SEO correct on valid sites;
   a metric that couldn't be measured is `null` ("—"), never `0`.
2. Transient PSI failures are retried; if PSI fails outright the audit still
   stores HTML-derived SEO basics and the other checks.
3. Every audit gets a **GEO score** and an **AEO score** (0–100), each backed by
   a pass / warn / fail checklist, plus a NAP comparison against Google Places.
4. Old audits are visibly **Outdated** and can be **Re-audited** on demand.

## Non-goals (this project)

- PDF redesign — including the **premium look & feel** requested on
  2026-09-23 — the business-impact translation engine, the new cold-email
  prompt, WhatsApp templates and dashboard/PDF separation. All Project B.
- Batch CSV auditing and job queues (Project C).
- Headless-browser rendering (Puppeteer). JS-only sites are flagged instead.

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pipeline shape | One request, modular analyzers | Same UX as today; PSI dominates latency anyway; analyzers are pure and testable |
| HTML parsing | `cheerio` | Light, serverless-friendly; Puppeteer is heavy on Vercel |
| Retry | Hand-rolled `withRetry` (~40 lines) | Only 2 PSI calls per audit; `p-queue` deferred to Project C where concurrency matters |
| GEO/AEO presentation | Two 0–100 scores + findings checklist | Scores give headline hooks; findings feed Project B's impact engine |
| Old audits | `engine_version` + "Outdated" badge + manual Re-audit | No quota spent until the user asks |
| SSL source | Direct TLS handshake, PSI `is-on-https` as fallback | Catches expired / self-signed / wrong-host certs; never claims "broken" when unknown |
| Unmeasured metrics | `null` → "—" | A fabricated 0 becomes a false claim in outreach |

Rejected: **two-stage audit** (fast checks first, PSI later) — double the API
surface and UI partial states; **job queue now** — infra ahead of need.

## Architecture

New folder `app/_shared/lib/audit/`:

| File | Responsibility |
|---|---|
| `runAudit.ts` | Orchestrator: `runAudit(input: AuditInput): Promise<AuditResult>`. The only module the API route calls. |
| `pageSpeed.ts` | `runPageSpeed(url, strategy, deadline)` → `{ ok: true, categories, keyAudits, isOnHttps } \| { ok: false, reason }`. All 4 categories, wrapped in `withRetry`. |
| `retry.ts` | `withRetry(fn, { attempts, baseDelayMs, deadline, shouldRetry })` — exponential backoff + up to 30% jitter, honours `Retry-After`, never sleeps past `deadline`. |
| `siteFetch.ts` | `fetchSite(url)` → `{ ok, finalUrl, status, html, headers, robotsTxt }`. Follows redirects, 10 s timeout, 2 MB body cap, Auditely UA. `robots.txt` fetched from the final origin in parallel. |
| `tlsCheck.ts` | `checkTls(hostname)` via `node:tls` on 443 with SNI, `rejectUnauthorized: false`, 8 s timeout → `{ completed, valid, authorizationError, validTo, daysToExpiry, issuer }`. |
| `analyzers/structuredData.ts` | Parse all `script[type="application/ld+json"]`; flatten `@graph` and arrays; tolerate invalid JSON (skip block); return `{ types: string[], entity: BusinessEntity \| null }` where `entity` is the best LocalBusiness-family node (name, address, telephone, openingHours, geo, sameAs). |
| `analyzers/nap.ts` | `compareNap(google, site)` → `{ name, address, phone }`, each `'match' \| 'mismatch' \| 'missing' \| 'n/a'`, plus the site values found. |
| `analyzers/geo.ts` | `analyzeGeo($, structured, nap, niche)` → `{ score, findings }`. |
| `analyzers/aeo.ts` | `analyzeAeo($, structured)` → `{ score, findings, h1Count, h2Count, questionHeadings, hasFaqSchema }`. |
| `analyzers/seoBasics.ts` | `analyzeSeoBasics($, headers, robotsTxt)` → title, metaDescription, canonical, viewport, noindex, robotsTxt status. Displayed, not scored. |
| `nicheTypes.ts` | Niche keyword → expected schema types; curated LocalBusiness-family type set. |
| `types.ts` | `AuditInput`, `AuditResult`, `Finding`, `CURRENT_ENGINE_VERSION = 2`. |

`Finding = { id: string; status: 'pass' | 'warn' | 'fail'; label: string; detail?: string }`.
Labels are plain English and stable (Project B keys its impact translations on `id`).

Each file stays well under 300 lines; analyzers take already-parsed input and
do no network I/O.

### Data flow

```
Run Audit / Re-audit ─► POST /api/audit { business_id, force? }
  load business (+ search niche via searches join)
  latest audit exists AND engine_version = 2 AND !force → return it (email backfill as today)
  ▼
runAudit({ website, name, address, phone, niche })
  ├─ runPageSpeed(mobile)  ─┐
  ├─ runPageSpeed(desktop) ─┤ concurrent
  ├─ fetchSite             ─┤──► cheerio.load(html) ─► structuredData ─► nap ─► geo
  ├─ checkTls              ─┤                       ├─► aeo
  └─ (after fetchSite) findEmail(website, { homepageHtml })          └─► seoBasics
  ▼
store: insert (new) | update same row + delete its ai_report (force)
  ▼
{ audit, email } → UI renders scores + checklist → client calls /api/generate as today
```

`findEmail` gains an optional `homepageHtml` so the homepage is fetched once.

## Data model

New migration `docs/migrations/2026-09-23-audit-engine-v2.sql`, run **after**
`2026-09-23-hardening.sql`; `docs/supabase-schema.sql` updated to match.

```sql
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS geo_score      INTEGER,
  ADD COLUMN IF NOT EXISTS aeo_score      INTEGER,
  ADD COLUMN IF NOT EXISTS checks         JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS engine_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE audits
  ALTER COLUMN performance_score DROP NOT NULL,
  ALTER COLUMN seo_score         DROP NOT NULL,
  ALTER COLUMN mobile_score      DROP NOT NULL,
  ALTER COLUMN ssl_valid         DROP NOT NULL;
```

Existing rows get `engine_version = 1` → shown as Outdated. New rows are
written with `engine_version = 2`.

Column semantics (unchanged names):
- `performance_score` = desktop performance, `mobile_score` = mobile
  performance, `seo_score` = mobile SEO (desktop SEO if the mobile run failed).
  Each `null` if no PSI run produced it.
- `ssl_valid`: TLS result if the handshake completed (`authorized && daysToExpiry >= 0`);
  else PSI `is-on-https` (`1` → true, `0` → false); else `null`.
- `geo_score` / `aeo_score`: `null` when the site couldn't be read or is
  near-empty (see Reliability).
- `raw_json`: trimmed Lighthouse data as today.
- On Re-audit, `created_at` is set to `NOW()` so reports show the re-audit date.

`checks` JSONB:

```ts
{
  ssl:  { valid: boolean | null; daysToExpiry: number | null; issuer: string | null; error?: string },
  seo:  { title: string | null; metaDescription: string | null; canonical: string | null;
          viewport: boolean; noindex: boolean; robotsTxt: 'ok' | 'missing' | 'blocks-all' | 'unknown';
          findings: Finding[] } | null,                     // null = site couldn't be read
  geo:  { findings: Finding[]; schemaTypes: string[];
          nap: { name: NapStatus; address: NapStatus; phone: NapStatus;
                 site: { name: string | null; address: string | null; phones: string[] } } } | null,
  aeo:  { findings: Finding[]; h1Count: number; h2Count: number;
          questionHeadings: number; hasFaqSchema: boolean } | null,
  site: { ok: boolean; finalUrl: string | null; status: number | null; reason?: string },
  psi:  { mobile: 'ok' | string; desktop: 'ok' | string }   // string = failure reason
}
```

## Scoring

### GEO (100)

| Check | Points | Rule |
|---|---|---|
| JSON-LD present | 15 | ≥1 parseable JSON-LD block |
| Business-type entity | 25 | See niche rule below |
| Entity completeness | 15 | 5 each for name, address, telephone on the entity |
| NAP — name | 10 | `match` or `n/a` |
| NAP — address | 15 | `match` or `n/a` |
| NAP — phone | 15 | `match` or `n/a` |
| Extras | 5 | Entity has `openingHours*`, `geo` or `sameAs`, or page has `MedicalWebPage` (medical niches) |

**Niche rule** (`nicheTypes.ts`, niche = the search's `niche`, lowercase substring match):

| Niche keywords | Expected types |
|---|---|
| dentist, dental, orthodont | `Dentist` |
| clinic, medical, doctor, physician, chiropract, physio, dermatolog, pediatric | `MedicalClinic`, `Physician`, `MedicalBusiness`, `MedicalOrganization` |
| school, academy, tutor, college, university, education, preschool, daycare, learning | `EducationalOrganization`, `School`, `CollegeOrUniversity`, `Preschool`, `ElementarySchool`, `MiddleSchool`, `HighSchool` |

- Entity type ∈ expected set → 25.
- Niche has an expected set, entity is LocalBusiness-family but not in it →
  15 + `warn` "Use the more specific `<Type>` schema type".
- Niche has no expected set, entity is LocalBusiness-family → 25.
- Only `Organization` → 5 + `warn`. Nothing → 0 + `fail`.

LocalBusiness-family = curated list in `nicheTypes.ts` (LocalBusiness and its
common subtypes, plus the expected types above).

**NAP matching**
- Site sources, in order: JSON-LD entity → `tel:` links → visible text.
- Phone: compare last 10 digits. `match` if any site phone equals Google's;
  `mismatch` if site phones exist but none match; `missing` if none found.
- Name: lowercase, strip punctuation and suffixes (llc, inc, pc, pllc, dds,
  dmd, md, ltd, co). `match` if `|A∩B| / min(|A|,|B|) ≥ 0.6` over tokens.
  Site name = entity name, else `<title>` / `og:site_name`.
- Address: normalise abbreviations (street→st, avenue→ave, road→rd,
  boulevard→blvd, drive→dr, suite→ste, …). `match` if the site address (entity
  address, else visible text) contains Google's street number as a whole word
  **and** Google's ZIP.
- `n/a` when Google has no value for that field → points awarded, `warn`
  finding "Google listing has no <field>".

### AEO (100)

| Check | Points | Rule |
|---|---|---|
| Exactly one H1 | 20 | 0 or >1 → `fail` |
| ≥3 H2 sections | 15 | |
| No skipped heading levels | 10 | Fail if any heading level > previous level + 1 (document order) |
| ≥2 question-style headings | 20 | h2–h4 text ending in `?` or starting with what/how/why/when/where/who/which/can/do/does/is/are/should/will |
| `FAQPage` or `QAPage` schema | 20 | From `structuredData.types` |
| Visible FAQ / Q&A section | 15 | `<details><summary>` present, or a heading containing "FAQ" / "Frequently asked" |

### SEO basics (displayed, not scored)

Title present (warn outside 10–60 chars), meta description present (warn
outside 50–160), canonical, viewport, `noindex` (meta robots or
`X-Robots-Tag`) = fail, `robots.txt`: `ok` / `missing` (404) / `blocks-all`
(`User-agent: *` + `Disallow: /`) / `unknown`.

## Reliability & error handling

- **PSI retry:** max 3 attempts. Retry on network error, per-attempt timeout
  (if time remains), 429, 500/502/503/504; backoff 2 s → 4 s (+0–30% jitter);
  `Retry-After` honoured within the deadline. **No retry** on 400,
  `lighthouseResult.runtimeError` (e.g. `FAILED_DOCUMENT_REQUEST`,
  `DNS_FAILURE`, `NO_FCP`) or 429 whose message contains "Quota exceeded" and
  "per day". Failure reason recorded in `checks.psi`.
- **Budgets:** 90 s per PSI attempt, 240 s PSI deadline, route
  `export const maxDuration = 300`.
- **Partial audits are stored.** If PSI fails, scores are `null` and the HTML
  checks still stand. An audit where *both* PSI and the site fetch fail
  returns 502 and stores nothing (nothing to show).
- **Site fetch fails** (network, 4xx/5xx, non-HTML): `geo`/`aeo` = `null`,
  `checks.site.reason` = e.g. "Blocked (403)"; UI shows "Couldn't read site".
- **Near-empty page:** visible text (scripts/styles removed) < 200 chars →
  `geo`/`aeo` = `null`, reason "Content loads via JavaScript — checks limited".
- **TLS:** handshake timeout / connection refused → fall back to PSI
  `is-on-https`; `daysToExpiry < 30` → `warn` on the SSL tile.

## API changes

- `POST /api/audit` body: `{ business_id: string, force?: boolean }`.
  Response shape unchanged: `{ audit, email }`, `audit` now includes
  `geo_score`, `aeo_score`, `checks`, `engine_version`.
- Business query adds `name, address, phone` and `searches(niche)`.
- `force: true` with an existing audit → update that row (same `id`), delete
  its `ai_reports` row, return the new audit. Client then regenerates.

## UI changes

- `auditScores`: six tiles — Performance, SEO, Mobile, SSL, GEO, AEO. `null`
  → neutral "—" tile with the reason as `title` tooltip. SSL tile amber +
  "expires in Nd" when `daysToExpiry < 30`.
- New `auditChecklist/auditChecklist.tsx`: GEO and AEO groups, each with score
  and findings (fail → warn → pass). When `seo_score` is `null`, a compact
  "SEO basics (from page HTML)" group. Existing Top Issues list stays.
- `businessCard`: amber **Outdated** badge when `engine_version < 2`;
  **Re-audit** ghost button on every completed audit (`force: true`, then
  regenerate report). Audit/report state + actions extracted into
  `app/_shared/lib/hooks/useBusinessAudit.ts` to keep the card < 300 lines.
  Collapsed mini-pills include GEO / AEO.
- `types/auditely.ts`: `Audit` score fields nullable; new fields added.

### Minimal compatibility changes (full redesign is Project B)

- `/api/generate`: prompt includes GEO/AEO scores, renders `null` as "not
  measured", appends the top 3 failing GEO/AEO finding labels to the issue list.
- `pdfDocument` (+ `pdf`, `send-email` routes): nullable props render "—";
  GEO/AEO score tiles added.

## Dependencies

- `cheerio` (runtime). `vitest` (dev) + `"test": "vitest run"` script.

## Testing

- **Unit (vitest, fixtures under `app/_shared/lib/audit/__tests__/fixtures/`):**
  structuredData (`@graph`, arrays, invalid JSON, multi-type entities); nap
  (phone formats, name suffixes, address abbreviations, n/a); geo (expected
  vs generic type, Organization-only, none); aeo (H1 count, skipped levels,
  question headings, FAQ schema, details/summary); seoBasics (noindex header,
  robots blocks-all, missing); retry (fake timers: retries 503, stops on 400,
  honours deadline and Retry-After); runAudit null-mapping with stubbed I/O.
- **Network (opt-in `RUN_NETWORK_TESTS=1`):** `checkTls` against
  `expired.badssl.com`, `wrong.host.badssl.com`, `self-signed.badssl.com`,
  and a valid host.
- **Manual E2E (after Supabase is restored):** audit a dentist site with
  schema, one without, and one that blocks bots; Re-audit; confirm Outdated
  badge on a v1 audit; download PDF with a null score.
- `tsc`, `npm run lint`, `npm run build` pass.

## Rollout

1. Supabase restored; `2026-09-23-hardening.sql` applied; service-role key set.
2. Apply `2026-09-23-audit-engine-v2.sql`.
3. Deploy. No new env vars.

## Risks

- Some sites block datacenter IPs (Cloudflare bot protection) → "Couldn't read
  site"; GEO/AEO null for those. Accepted.
- NAP heuristics can mis-match unusual addresses; findings show both values so
  a human can judge before outreach.
- PSI daily quota (25k/day default) is ample for single audits; revisit in C.
