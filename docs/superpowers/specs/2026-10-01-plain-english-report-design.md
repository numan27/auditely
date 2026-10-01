# Plain-English Report — Design Spec

**Date:** 2026-10-01
**Status:** Design approved in conversation (pending written-spec review)
**Project:** #3 of `update.txt` — "The Communication Gap (Technical Metrics vs. Revenue Impact)"; also the "Business Impact Translation Engine" and the short outreach email from the earlier brief (Project B in the v2 spec).

## Background

Verified in the code on 2026-10-01:

- The PDF's "Top Issues Found" lists raw Lighthouse titles: "Largest Contentful Paint (12.8 s)". GEO / AEO findings use technical labels ("No structured data (JSON-LD) on the homepage").
- `/api/generate` sends raw score lines and issue labels to Groq (`openai/gpt-oss-120b`) and asks for a 2–3 sentence summary, exactly 4 improvements and a 2-paragraph cold email. Nothing stops the model inventing statistics, dollar amounts or a sender name (the prompt says "introduce yourself" with no name).
- PageSpeed returns real-visitor Chrome data (`loadingExperience`), but `pageSpeed.ts` only reads `lighthouseResult`.
- Every check has a stable finding id (`lead.*`, `geo.*`, `aeo.*`, `seo.*`); Lighthouse audits have ids too, but `topLighthouseIssues` drops them.

## Goals

1. Every problem a prospect reads (PDF, email) is in owner language: what it costs them, not what it's called.
2. The same problem always reads the same way, from a hand-written library — the AI never invents numbers, dollar amounts or names.
3. A short cold email (under 90 words) naming the one worst problem and offering the free report.
4. Speed claims use real-visitor data when Google has it.

## Non-goals

- Dollar or "revenue lost" estimates (we don't know a prospect's traffic or sales).
- Translating the dashboard's technical checklist (it's for the agency).
- Re-writing existing AI reports: they stay until the business is re-audited.
- Languages other than English; WhatsApp templates; CRM hand-off (#5).

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Translation source | Hand-written impact library (approach A) | Consistent, testable, no invented facts |
| Statistics | Two, both Google research, printed with source | Credible; nothing unsourced reaches a prospect |
| Email | Subject + under 90 words, one worst problem, offer the report | User choice; short emails get replies; the report costs nothing to send |
| Fixes | Taken from the library, not the AI | They're facts; the AI only writes the summary and the email |
| AI guard | Reject invented numbers / long emails, retry once | A last check before a human reads it |

## The impact library

`app/_shared/lib/audit/impactLibrary.ts` (data) and `app/_shared/lib/audit/impact.ts` (functions).

An **entry** is keyed by a finding id and status (or a speed / SSL signal) and has:

- `problem` — the owner's version, ≤ 12 words ("No tap-to-call button on your site").
- `cost` — what it costs them, ≤ 25 words, "you / your" voice, no invented numbers.
- `fix` — what the agency would do, ≤ 20 words.
- `stat` (optional) — one of the two statistics below.
- `group` (optional) — problems in a group appear once in the ranked list (e.g. the six AEO checks are one "AI assistants can't quote you" problem).

**Order is priority.** The library is one ordered list; the ranked problems of an audit follow it. Tiers, top to bottom:

1. Invisible or losing leads: `seo.noindex`, `seo.robots` (blocks all), `lead.form` (fail), `lead.clickToCall` (fail), `lead.brokenLinks` (fail), `lead.contactPage` (fail)
2. Driving visitors away: `speed.slowLoad`, `ssl.invalid`, `seo.viewport` (fail), `speed.layoutShift`, `lead.form` (warn: email only), `lead.clickToCall` (warn)
3. Found less often: `geo.nap.phone` / `.address` / `.name` (fail), `geo.jsonld` (fail), `geo.businessType` (fail / warn), `seo.title` / `seo.metaDescription` (fail), `speed.heavyImages`, `lead.booking` (warn)
4. Polish: `geo.entityComplete`, `geo.extras`, `aeo.*` (one group)

**Not problems** (never in the ranked list, never translated): passes; "couldn't check" results; `geo.nap.*` warn (the Google listing has no value — not the site's fault); `seo.*` warns; `lead.whatsapp`. The lead-capture form's "couldn't check" result moves to its own id, `lead.formUnchecked`, so it can never be read as "only an email link".

**Speed and SSL signals** (from the stored audit, not findings):

- `speed.slowLoad` — real-visitor mobile LCP (p75) over 3 000 ms; else the mobile Lighthouse `largest-contentful-paint` score below 0.5 (about 4 s). Evidence: "Real visitors on phones wait about 4.1 s" or "Google's mobile test: 4.2 s".
- `speed.layoutShift` — mobile `cumulative-layout-shift` score below 0.5.
- `speed.heavyImages` — any of `uses-optimized-images`, `uses-webp-images`, `uses-responsive-images`, `offscreen-images` below 0.5 on mobile.
- `ssl.invalid` — `ssl_valid === false` on a current-engine audit.

Each ranked problem carries an `evidence` line (the measured value, from the finding's detail or the speed signal) so the PDF can show the number small and grey.

**Unknown ids** (a check added later without an entry) fall back to the finding's label as `problem`, with no cost / fix, ranked last — nothing breaks.

## Statistics (the only two)

| Used by | Text | Source |
|---|---|---|
| `speed.slowLoad` | 53% of mobile site visits are abandoned if a page takes longer than 3 seconds to load. | Think with Google, *The Need for Mobile Speed*, 2016 |
| `lead.clickToCall`, `geo.nap.*` | 76% of people who search on their phone for something nearby visit a related business within a day. | Think with Google, 2016 |

## Real-visitor speed data

`runPageSpeed` (mobile) reads `loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS` (`percentile` = p75 in ms, `category` FAST / AVERAGE / SLOW). `origin_fallback: true` means the figure is for the whole site, not the page. It's stored on the mobile `LighthouseSummary` as `field?: { lcpMs: number; scope: 'page' | 'origin' }` — inside `raw_json` and the PageSpeed cache, so no migration. Audits and cache entries without it use the lab wording.

## Where it shows

**PDF (prospect-facing):**
- "Top Issues Found" → **"What's costing you customers"**: the top 4 ranked problems, each `problem` (bold) + `cost`, with `evidence` small and grey.
- GEO, AEO and Lead capture blocks: each finding shows its entry's `problem` when it has one; otherwise its label.
- "Recommended Improvements" → **"How we'd fix it"**, numbered: the stored report's improvements (for new reports, up to 5 library fixes; old reports keep their 4). No count in the heading, so it's right for any number.
- A small **Sources** line when a statistic appears on the page.

**AI report (`/api/generate`):**
- `improvements` = the `fix` lines of the top 5 ranked problems (deterministic; fewer when fewer problems).
- The model writes only `summary` (2–3 sentences, owner language) and `cold_email`.
- The prompt is built by a pure function from: business name, website, the ranked problems (problem, cost, fix, evidence, stat + source), the sender (`REPORT_CONTACT_NAME`, "DevArtVentures"), and an exact offer sentence: "I put together a short report with {n} fixes for {business} — want me to send it over?" ({n} = number of fixes).
- Email rules: first line `Subject: …`; body under 90 words; names the top-ranked problem and its cost; uses only the given facts and numbers; no dollar amounts; no invented names; ends with the offer sentence and the sender's name.
- **Guard:** after the reply, any number in the summary or email that doesn't appear in the facts, the business name or the website, or an email body over 110 words, triggers one retry with the reason added to the prompt. The second answer is kept either way (a human reads every email before sending).

**Dashboard:** unchanged layout; its AI section shows the new summary, fixes and email.

## Reliability & error handling

- No problems found: the summary says the site is in good shape; fixes are empty; the offer sentence drops "{n} fixes" ("a short report on {business}'s site").
- AI failure / invalid JSON: as today (error, "Try again").
- Old audits (v1, no checks): only speed and SSL signals; old AI reports are not regenerated.

## Testing (written first)

- Library: lookups by id + status, "not a problem" cases (couldn't-check, listing has no value), unknown-id fallback, groups appear once.
- Ranking: tier order; evidence lines; real-visitor vs lab wording; thresholds.
- `pageSpeed`: reads `loadingExperience` LCP and `origin_fallback`.
- Prompt builder: the facts and their order, the offer sentence, the sender.
- Guard: an invented number or a long email triggers exactly one retry (fake completion function — no Groq calls).
- Report data / PDF props: problems, plain labels in the blocks, sources.
- Lead capture: the unchecked form finding uses `lead.formUnchecked`.

## Rollout

No migration, no new env vars. Deploy; new AI reports use the new prompt. To refresh an existing lead's report, Re-audit it.

## Risks

- **Library wording ages** — it's code: edit an entry, every report follows.
- **Statistics are from 2016** — the source and year are printed, so the claim stays honest.
- **The model may still drift** within the facts (tone, emphasis) — the user reviews every email before sending.
