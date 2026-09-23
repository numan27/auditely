# Email Discovery — Design Spec

**Date:** 2026-06-14
**Status:** Approved (pending spec review)

## Background

Email discovery is the core value of Auditely — it's what turns a list of
businesses into actionable leads. Today it is weak and nearly invisible:

- Email is discovered **only as a side effect of running a PageSpeed audit**,
  and only on a business's **first** audit. Cached audits returned early without
  attempting discovery (fixed separately — see "Already shipped" below).
- Discovery is **scrape-only in practice**: all API fallback keys
  (Snov / Tomba / Hunter / Apollo) are placeholders, so the cascade is a no-op.
- Emails surface one business at a time, gated behind the audit feature.

## Goals

1. Make email discovery **automatic** — emails populate the results list on
   their own after a search, without requiring a per-business audit.
2. Keep the search response **fast** — discovery runs in the background.
3. Add a real API fallback (**Hunter.io**, free tier) for sites that hide their
   email, used **only on explicit per-business action** so the limited monthly
   quota is never burned by bulk discovery.

## Already shipped (prerequisite bugfix)

The audit route's cache short-circuit was returning `{ audit }` early, before
email discovery, and omitting email. It now runs discovery (scrape-only) on
every audit request until an email is stored, including cache hits, and returns
the email. This backfilled previously-stuck businesses (verified:
`office@smilela.com`, `smile@ladentalclinic.com`). This spec builds on top.

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Discovery trigger | Auto at search time, background | Email is the backbone; shouldn't require manual audits |
| Orchestration | Client-driven sequential batches | Avoids serverless timeouts; progressive UI; cancellable |
| Bulk fallback | Scrape-only | Free + unlimited; safe for every business |
| Hunter usage | On-demand only (explicit per-business button) | Free tier is ~25–50/mo; bulk use would exhaust it in one search |

### Rejected orchestration alternatives

- **Server-side background (`after()` / streaming):** serverless duration limits
  make 70+ scrapes-per-search infeasible in one invocation; no progressive UI
  without SSE. Overkill.
- **Job queue / cron worker:** robust at scale but heavy infra the app lacks.
  YAGNI for this MVP.

## Architecture

### Component 1 — `findEmail` gains an `apiFallback` flag

`app/_shared/lib/utils/emailFinder.ts`

```ts
findEmail(website: string, opts?: { apiFallback?: boolean }): Promise<string | null>
```

- `apiFallback` defaults to **`false`** (scrape-only).
- When `false`: run `scrapeWebsite()` only.
- When `true`: scrape, then cascade through configured APIs (Snov → Tomba →
  Hunter → Apollo), stopping at the first hit.

All automatic callers (bulk discovery, audit safety-net) use the default
(scrape-only) and are quota-safe. Only the explicit "Find email" button passes
`apiFallback: true`.

### Component 2 — `POST /api/find-emails`

`app/api/find-emails/route.ts` (new)

- **Request:** `{ business_ids: string[], apiFallback?: boolean }`
- **Behavior:** load each business (`website`, `email`); skip those that already
  have an email or have no website; run `findEmail(website, { apiFallback })`
  concurrently across the batch; persist any hits with
  `update({ email }).eq('id', id)`; never overwrite a non-null email.
- **Response:** always `200` with `{ results: { business_id: string, email: string | null }[] }`.
- **Errors:** per-business `try/catch` → that business yields `null`; the batch
  never fails as a whole.

One endpoint serves both paths: bulk discovery omits `apiFallback` (scrape-only);
the on-demand button sends a single id with `apiFallback: true`.

### Component 3 — Frontend

**`useEmailDiscovery` hook** (`app/_shared/lib/hooks/useEmailDiscovery.ts`, new)
- Input: the current `businesses` list + a setter to merge discovered emails.
- Filters to businesses with a website and no email; chunks into groups of **8**;
  calls `/api/find-emails` **sequentially** per chunk (scrape-only); merges each
  chunk's results into list state as they return.
- Exposes progress `{ done, total }` for a subtle header indicator.
- Aborts in-flight work on a new search / unmount.

**`page.tsx`**
- After a successful search, invoke `useEmailDiscovery` to start background
  discovery. Show "Finding emails… {done}/{total}" in the results header while
  running.

**`businessEmail/businessEmail.tsx`** (new component)
- Extracted from `businessCard.tsx` (already ~304 lines; project rule = ≤300–350).
- **Controlled / presentational.** Props: `{ email: string | null, website: string | null, businessId: string, onFound: (email: string) => void }`.
- Renders: the email + mailto + copy button when `email` is set; otherwise, when
  `website` exists, a **"Find email"** button that calls `/api/find-emails` with
  `{ business_ids: [businessId], apiFallback: true }` (Hunter cascade), with
  loading and "no email found" states, and calls `onFound(email)` on a hit.
- Owns only its own transient UI state (copied flag, find-button loading). It does
  **not** own the canonical email value.

**`businessCard.tsx`**
- Remains the owner of the card's `email` state (it already coordinates the audit
  response and the background-discovery prop update).
- Replace the inline email JSX block with
  `<BusinessEmail email={email} website={business.website} businessId={business.id} onFound={setEmail} />`.
- Sync email from prop via
  `useEffect(() => { if (business.email) setEmail(business.email) }, [business.email])`
  so background-discovery updates render.
- Net effect: the ~25-line email display block and the on-demand fetch logic move
  out to `BusinessEmail`, keeping `businessCard.tsx` under the size limit.

### Component 4 — Audit route

No behavior change. Its `ensureEmail` helper now resolves to scrape-only via the
new `findEmail` default. Audits remain a backstop, not the primary path.

## Data flow

1. User searches → `/api/search` returns businesses immediately (unchanged).
2. `page.tsx` renders cards, then `useEmailDiscovery` runs: chunk IDs →
   sequential `POST /api/find-emails` (scrape-only) → merge emails → cards update
   progressively.
3. For a business still without an email, the user clicks **"Find email"** →
   `POST /api/find-emails` `{ business_ids:[id], apiFallback:true }` → Hunter
   cascade → card updates (or shows "no email found").
4. Audits, if run, backfill via scrape-only `ensureEmail`.

## Coverage & limits

- Hunter is **domain-based** → helps website businesses that hide their email.
- **No-website businesses have no email path** (scraping and domain-search both
  need a domain). Out of scope; would require a name-based provider (e.g. Apollo).
- Hunter calls occur only on explicit single-business clicks → at most one Hunter
  call per click → free quota preserved.

## Verification

- **Batch (scrape-only):** `POST /api/find-emails` with known IDs → smilela &
  ladentalclinic resolve, happysmiles → null; confirm DB persistence; confirm an
  existing email is never overwritten.
- **On-demand:** call with `{ business_ids:[id], apiFallback:true }` for a
  scrape-miss business → confirm Hunter cascade is invoked (null without a key;
  code path exercised).
- **Manual:** run a search in the browser; watch emails populate progressively;
  click "Find email" on a remaining card.
- **Lint:** `npm run lint` clean on all touched files.

## Files

| File | Change |
|---|---|
| `app/_shared/lib/utils/emailFinder.ts` | Add `apiFallback` option (default false) to `findEmail` |
| `app/api/find-emails/route.ts` | **New** — batch + `apiFallback` flag |
| `app/_shared/lib/hooks/useEmailDiscovery.ts` | **New** — chunked sequential background discovery |
| `app/_shared/components/auditely/businessEmail/businessEmail.tsx` | **New** — email display + copy + on-demand "Find email" |
| `app/_shared/components/auditely/businessCard/businessCard.tsx` | Use `<BusinessEmail>`; drop inline email block |
| `app/page.tsx` | Start background discovery after search; header progress |
| `app/api/audit/route.ts` | No change (scrape-only via new default) |

## Out of scope

- Email path for no-website businesses (name-based providers).
- Snov / Tomba / Apollo activation (Hunter only, per decision).
- Server-side background jobs / queues.
