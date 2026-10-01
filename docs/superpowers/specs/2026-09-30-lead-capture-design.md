# Lead Capture Checks — Design Spec

**Date:** 2026-09-30
**Status:** Design approved in conversation (pending written-spec review)
**Project:** #2 of `update.txt` — "The Depth Gap (Single-Page Limitations)"

## Background

Verified in the code on 2026-09-30:

- The audit reads **only the homepage** (plus `robots.txt`): `runAudit` →
  `fetchSite(website)`; GEO, AEO and SEO basics all analyze that one page.
- The email finder already downloads up to **16 more pages** (8 guessed paths
  like `/contact`, `/about`, then up to 8 of the homepage's own links) — but
  only extracts emails and throws the HTML away.
- `contactChannels.ts` finds a `tel:` link and a contact-page link, but only on
  the homepage, only to fill the business's phone and contact page — never as
  audit findings.

Local businesses lose leads on their inner pages: no tap-to-call, no form, a
booking link that 404s. None of that is reported today.

## Goals

1. Every audit gets a **Lead capture score** (0–100) with a pass / warn / fail
   checklist, built from the homepage and up to 4 key pages.
2. The checks are specific and provable ("Booking link is broken: /book-now"),
   so the pitch can quote them.
3. Audits don't get slower: all extra fetching runs while PageSpeed runs.
4. No page is downloaded twice: the email finder reuses the key pages.

## Non-goals

- PageSpeed on subpages (10 more API calls per audit).
- Submitting forms, or claiming a form "works" — we only report that one exists.
- Headless-browser rendering. JavaScript-only homepages get "—", as GEO/AEO do.
- Plain-English impact translations of the findings (project #3).
- CRM hand-off (#5), bulk auditing (#1).
- Using the new crawl in "Find email" or the background discovery after a
  search — both keep working exactly as today.
- An engine-version bump: old audits are not marked Outdated.

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Presentation | Score + checklist | Headline number for the pitch, sortable; same pattern as GEO/AEO |
| Old audits | Lead capture shows "—" until re-audited | No Outdated-badge noise on existing leads |
| Crawl | One shared crawl for lead capture and email | No double downloads; fewer bot blocks |
| Booking missing | Warning, never fail | Law firms, schools etc. may legitimately not book online |
| WhatsApp | Positive only | Leads are US businesses; rarely used there |
| Blocked / timed-out link | "Couldn't check", not broken | Same rule as scores: unknown is never shown as bad |

## Architecture

| File | Responsibility |
|---|---|
| `audit/siteFetch.ts` | Gains `fetchPage(url)` → `{ ok, status, finalUrl, html, reason? }`: same UA, 10 s timeout, 2 MB cap and bot-challenge rule as `fetchSite`, without `robots.txt`. |
| `audit/siteLinks.ts` (new) | Same-site `<a href>` extraction and filters (files, WordPress technical paths, `mailto:`/`tel:`), moved out of `emailFinder.ts` so both use it. `pickKeyPages(html, pageUrl)` → up to 4 `{ url, kind }`. |
| `audit/linkCheck.ts` (new) | `checkLinks(urls)` → `{ url, status: 'ok' \| 'broken' \| 'unknown' }[]`. |
| `audit/analyzers/leadCapture.ts` (new) | Pure: pages + link results → `{ score, checks }`. No network I/O. |
| `audit/runAudit.ts` | Orchestrates: homepage → key pages → link checks + analyzer + email discovery, all alongside PageSpeed. New deps `fetchPage`, `checkLinks` (injected for tests). |
| `utils/emailFinder.ts` | `findEmail` accepts `pages: { url, html }[]` and searches them before fetching anything else. |

Each file stays under 300 lines.

### Data flow

```
runAudit
  ├─ PageSpeed mobile + desktop (cached per website) ─────────────┐
  └─ fetchSite(homepage)                                           │ concurrent
       └─ pickKeyPages → fetchPage × ≤4 (parallel)                 │
            ├─ checkLinks(≤30 same-site links, 8 at a time)        │
            ├─ analyzeLeadCapture(home + key pages + link results) │
            └─ discoverEmail(homepage html, key pages)             │
  ▼ ──────────────────────────────────────────────────────────────┘
row: lead_score + checks.lead (plus everything stored today)
```

## Key pages

From the homepage's same-site links, in page order, the first link of each kind
(matched on path or link text, case-insensitive), skipping the homepage itself:

| Kind | Matches |
|---|---|
| contact | `contact`, "get in touch", "reach us" |
| booking | `book`, `appointment`, `schedule`, `reserv` |
| services | `service`, `treatment`, `what-we-do`, `practice-area`, `program` |
| about | `about`, `our-story`, `who-we-are` |

At most 4 pages. A page that fails to load is recorded (`ok: false`) and
skipped by the analyzer. A key page that returns 404/410 also counts as a
broken link.

## Checks and scoring (100)

Finding ids are stable (`lead.*`), like `geo.*` / `aeo.*`.

| Id | Pass | Warn | Fail | Points |
|---|---|---|---|---|
| `lead.clickToCall` | `tel:` link (≥ 7 digits) on the homepage — 25 | only on a key page — 10 | none — 0 | 25 |
| `lead.form` | contact form on any checked page — 30 | only a `mailto:` link — 10 | neither — 0 | 30 |
| `lead.booking` | booking tool or booking link — 15 | none — 0 | — | 15 |
| `lead.contactPage` | contact page linked from the homepage, or a form on the homepage — 10 | — | neither — 0 | 10 |
| `lead.brokenLinks` | none broken, ≥ 1 checked — 20 | none could be checked — 20 | any broken — 0 (detail lists up to 3 paths) | 20 |
| `lead.whatsapp` | `wa.me` / `api.whatsapp.com` link — added only when found | — | — | 0 |

**Contact form:** a `<form>` with a `<textarea>`, or with ≥ 2 fillable fields
(text, email, tel, number, date, url, select — not hidden, password, checkbox,
radio). Excluded: search forms (`role="search"`, or a single field) and forms
whose class / id / name / action says newsletter, subscribe, mailchimp, search
or login — Squarespace's newsletter block is a real `<form class="newsletter-form">`
that can ask for a name and an email. Also counts: a known form tool in a link,
`iframe`/`script` src or form `action` — Jotform, Typeform, HubSpot (`hsforms`),
Google Forms, Formstack, Cognito Forms, Wufoo, 123FormBuilder, Paperform, Tally,
Formsite, Formspree, Zoho Forms — and Squarespace's form block
(`.sqs-block-form`), which it draws with JavaScript (verified 2026-09-30 on
brine-demo.squarespace.com: the block is in the HTML, the `<form>` is not). Wix
needs no marker: its forms are real `<form class="… wixui-form">` elements with a
`<textarea>` in the HTML (verified on two wixsite.com dental sites).

**Booking:** a link, `iframe` or `script` to a known tool — Calendly, Zocdoc,
NexHealth, LocalMed, Acuity (incl. `as.me`), Square Appointments, Setmore,
Vagaro, Mindbody, Jane, Schedulicity, Booksy, Fresha, Housecall Pro,
OpenTable, Resy, Tock, Doctible, Flex Dental (`flexbook.me`) — or a booking-kind
key page / booking-worded link on the site.

**Broken links:** unique same-site page links from all checked pages, homepage
links first, at most 30, not counting the key pages (already fetched — their
own status counts). `HEAD` request, 5 s limit each, 8 at a time, redirects
followed; any answer other than 2xx / 3xx is confirmed with a `GET` (some
servers refuse or mis-answer `HEAD`). 404 / 410 → broken; 2xx / 3xx → ok;
anything else (403, 429, 5xx, timeout) → unknown.

**Not measured** (`lead_score = null`, `checks.lead = null`): the homepage
couldn't be read, or it is JavaScript-only (the existing < 200 visible
characters rule). The card shows the existing site reason.

## Data model

Migration `docs/migrations/2026-09-30-lead-capture.sql`, run before deploying;
`docs/supabase-schema.sql` updated to match.

```sql
ALTER TABLE audits ADD COLUMN IF NOT EXISTS lead_score INTEGER;
```

`checks.lead`:

```ts
{
  findings: Finding[];
  pages: { url: string; kind: 'home' | 'contact' | 'booking' | 'services' | 'about'; ok: boolean }[];
  links: { checked: number; broken: string[] };
} | null
```

`CURRENT_ENGINE_VERSION` stays 2. Old rows have `lead_score = null` and no
`checks.lead` → "—".

## Where it shows

- **Card scores:** a 7th tile, "Lead capture" (grid becomes 2 / 4 / 7 columns).
- **Card checklist:** "Can visitors reach you? (Lead capture)" group, with score.
- **Collapsed card:** a "Leads" pill.
- **Sort:** "Weakest site first" includes `lead_score` in the average.
- **CSV:** a "Lead capture" column after AEO.
- **PDF:** a "Leads" tile in the scores row, and a "Lead capture — can visitors
  reach you?" block (fail, then warn; max 6) after the AI-search section.
- **AI prompt:** a "Lead capture (can visitors call, message or book)" score
  line; failing `lead.*` findings are listed first in "Specific Issues Found"
  (failing findings limit 3 → 4).

## Email finder

`findEmail(website, { homepageHtml, pages })`: homepage → the given pages
(no fetch) → the usual guessed pages not already read → up to 8 extra links not
already read. The audit route's `ensureEmail` passes the key pages through.
"Find email" and background discovery don't pass `pages` and behave as today.

## Reliability & error handling

- A key page that fails or is bot-blocked is skipped; the checks use what loaded.
- The analyzer runs inside the existing try/catch: a crash leaves
  `lead_score = null`, and the rest of the audit is kept.
- Link checks never throw; every failure is `unknown`.
- Time: key pages (≤ 10 s) then link checks (≤ 4 rounds × 5 s) run alongside
  PageSpeed, which usually takes longer; the 240 s PageSpeed budget still bounds
  the audit.

## Testing (written first)

- `siteLinks`: key-page picking per kind, same-site only, first per kind,
  homepage skipped, files and technical paths skipped.
- `leadCapture`: pass / warn / fail for every check using HTML fixtures;
  search and newsletter forms not counted; form-tool embeds counted; booking
  tools and booking links; score totals; WhatsApp only when found.
- `linkCheck`: 404/410 broken, 2xx ok, 403/429/5xx/timeout unknown, a failed
  `HEAD` confirmed with `GET`, 30-link cap, 8 at a time.
- `runAudit`: key pages feed both the analyzer and email discovery; not-measured
  cases; analyzer crash keeps the rest.
- `emailFinder`: given pages are searched and never re-fetched.
- `reportData`: lead line and lead findings in the AI facts; PDF props.
- `leadView` / `leadExport`: average and CSV column.

## Rollout

1. Run `docs/migrations/2026-09-30-lead-capture.sql` in Supabase.
2. Deploy. No new env vars.
3. Existing leads show "—" for Lead capture until Re-audit.

## Risks

- **Forms rendered by JavaScript** on builders not in the marker list are
  reported as "no contact form". Mitigated by the tool/marker lists; the label
  says "No contact form found on the pages we checked", not "has no form".
- **Extra requests to the prospect's site:** ≤ 4 pages + ≤ 30 link checks per
  audit, with the same polite user agent.
- **Bot protection** blocks subpages more often than the homepage; those checks
  fall back to "couldn't check".
