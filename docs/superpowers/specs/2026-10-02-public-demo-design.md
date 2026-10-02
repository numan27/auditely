# Public Demo — Design Spec

**Date:** 2026-10-02
**Status:** Built
**Project:** make Auditely linkable from Upwork proposals without opening the private app.

## Background

Auditely is a single-admin tool: `proxy.ts` puts every page and every `/api/*` route behind the admin password, except `/login`, `/api/auth` and the signed `/report/{token}` PDF links. A client who opens the link from a proposal sees a password form and nothing else.

Every action that costs money is a client call to a protected route: search (Google Places), audit (PageSpeed), summary (Groq), find email (Hunter, Snov), send email, HubSpot. The cards and the report only call those routes when a button is pressed, so they can be drawn from data that is already there.

## Goals

1. A logged-out visitor who opens the bare domain sees the real workspace, filled with a real search, and can look around it.
2. Nothing a visitor does can spend API credits, send an email, write to HubSpot or read the database.
3. The visitor can watch an audit happen: "Run audit" and "Audit all" replay saved audits.
4. No contact details of the sample businesses are published.
5. The private app behaves exactly as it does today.

## Non-goals

- Real audits for guests, in any form (user's decision: replay only).
- Any change to an API route, or any new public API route.
- A demo of Saved searches, the send-email dialog or the HubSpot handoff. Their buttons explain themselves and stop.
- Recording the Loom walkthrough. The demo only links to it when a URL is set.
- Counting or tracking demo visitors.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Where read-only is enforced | In the browser, with the server untouched | No API route becomes public, so a visitor who tampers with the page still gets a 401. A guest session checked in all 11 routes would leak or spend on the first missed check |
| What the demo shows | The full workspace, both tabs | Lead search is the selling point; one report page would hide it |
| Sample data | A capture of one saved search and one audited website, checked into the repo | Genuine Auditely output, no database at run time, and the demo can't change under a visitor |
| Contact details | Emails and phone numbers masked; HubSpot and sent-email status removed | They belong to real businesses, and some came from Hunter and Snov |
| Guest audits | A replay of the saved audit, labelled as a replay | Shows the product working at no cost, without pretending it is live |
| Entry point | `/demo`; a logged-out visitor on `/` is sent there | The bare domain goes into the proposal. Every other private page still goes to login |
| PDF report | Built from the capture at build time, served from `/demo/report/{id}` | The branded PDF is worth showing, and a pre-built file costs nothing per download |
| Contact in the demo | Notice says "message me on Upwork", no link; the demo PDF has no "next step" box | Upwork restricts sharing off-platform contact details before a contract. Both can be switched on (see Setup) |

## Access

- `ROUTES.DEMO = '/demo'`, added to `PUBLIC_ROUTES`. The prefix match also opens `/demo/report/…`.
- `proxy.ts`: a request for `/` without a valid session redirects to `/demo`. Other protected pages keep the redirect to `/login?callbackUrl=…`; protected API routes keep the 401.
- A logged-in user can open `/demo` too, to check what clients see.
- The root layout already sets `robots: noindex, nofollow` for every page, so the demo stays out of search engines. The PDFs, which that tag doesn't cover, are served with `X-Robots-Tag: noindex`.
- Once the 7-day session runs out, the admin lands on the demo as well. The banner and the "Sign in" link make that obvious.

## Sample data

`scripts/captureDemo.mjs`, run locally and by hand: `node --env-file=.env.local scripts/captureDemo.mjs <search_id> <domain>` (without arguments it lists the searches and websites that can be captured). It reads one saved search and one website from the Audit tab, with their audits and AI reports, and writes `app/_shared/lib/demo/demoData.json`. From the search it takes the first 10 businesses, in the app's order, that are ready to show: a website the audit could read (a site that turns automated visitors away has no GEO, AEO or lead-capture results), an audit by the current engine with its speed measured, and a summary. The Audit tab's website is the user's pick and is taken even when it blocked the audit; the script says so.

```
{ capturedAt, query: { niche, location }, leads: BusinessWithData[], sites: BusinessWithData[], replayIds: string[] }
```

What the script changes on the way:

- **Ids** of searches, businesses, audits and reports are replaced with `demo-…` ids, so no database id is published and none can match a real row.
- **Emails** keep their first character and domain: `j•••@brightsmile.com`.
- **Phone numbers** keep their last two digits: `(•••) •••-••42`.
- Masking is by field for the known contact fields (`email`, `phone`, `checks.geo.nap.site.phones`), then every remaining text field (finding labels and details, the summary, the fixes, the outreach email) is scanned for emails and phone numbers. Dates and scores are left alone.
- `hubspot_company_id`, `crm_sent_at` and `emailed_at` are cleared.
- `replayIds` lists every second audited lead: those start as "Not audited yet". The list can be edited by hand.

Names, websites, addresses, ratings, social links, scores, findings and AI text stay as they are: they are public, and they are the point.

`lib/demo/mask.ts` holds the masking and `findUnmasked(value)`, the guard: it returns everything in a value that could still be a contact detail, with its path, by rules looser than the masking and independent of it (any `@`, `%40`, `mailto:`, `tel:` or WhatsApp link, any 7 or more digits however grouped, 10 or more inside a link). The script refuses to write a file in which it finds any, and lists them. `lib/demo/demoSamples.ts` has the file's type and the starting list (leads with the audits of `replayIds` held back). `lib/demo/demoData.ts` loads the file and is imported on the server only, so the file reaches the browser once, with the page, and not a second time inside the JavaScript.

## The workspace in demo mode

The body of `app/page.tsx` moves to `components/auditely/workspace/workspace.tsx`. `/` renders it as before. `app/demo/page.tsx` renders it inside `DemoProvider` (`components/providers/DemoProvider.tsx`), which holds the capture, the replay and the notice. `useDemo()` returns that, or `null` in the private app; everything below checks it at the point where it would call the API.

| Where | In the demo |
|---|---|
| `useLeadSearch` | Starts with the sample search open. A new search opens the notice. `?load=` is ignored |
| `useEmailDiscovery` | Off: nothing to find, no request |
| `leadSearchForm` | Fields can be typed in; city suggestions are off. "Find leads" always answers, even with empty fields |
| `useUrlAudits`, `urlAuditForm` | Lists the sample site, opened on its full report, no request. "Run audit" and "Find email" always answer, with the notice |
| `useBusinessAudit` | "Run audit" and "Write summary" replay. "Re-audit" opens the notice. "Download PDF report" fetches `/demo/report/{id}` |
| `useBulkAudit` | "Audit all" replays, 3 at a time, with Stop. No "leave page?" warning |
| `auditPanel` | While replaying: "Replaying the saved audit of {domain}…", "A live audit takes about a minute; this replay is shortened." |
| `businessCard` | No "Over 30 days old" or "Outdated" badge: the capture's age isn't the visitor's concern. A masked phone number is plain text, not a `tel:` link |
| `businessEmail` | A masked email is plain text, not a `mailto:` link, with no copy button. "Find email" opens the notice |
| `reportActions` | "Send email" and "Send to HubSpot" open the notice |
| `exportMenu` | Both exports open the notice: they would hand out the lead list |
| `appHeader` | Logo, a "Demo" tag, the theme toggle and "Sign in". No Saved searches, no Log out |

Sorting, filtering, expanding a card, copying the outreach email and the theme toggle work as in the app.

### Replay

`lib/demo/replay.ts` makes a function with the shape of `Post` in `utils/bulkAudit.ts`: asked for an audit, it waits about 4 seconds and answers with the saved one; asked for a summary, about 2.5 seconds and the saved report. The card and "Audit all" both go through it, so the real status flow runs unchanged (queued, auditing, writing, done, re-sorting afterwards). The waits are parameters, so tests run without them. Reloading the page starts over.

### Notice and banner

- `demoBanner/demoBanner.tsx`, above the heading: "Demo: a real search with contact details hidden. Live search and audits are switched off." Plus "Watch the 45-second walkthrough" when `DEMO_VIDEO_URL` is set.
- `demoNoticeModal/demoNoticeModal.tsx`, one dialog for every restricted action. Title: "Live generation is switched off in this demo". One sentence on what the button does in the full app, by action (search, audit a URL, re-audit, find email, send email, HubSpot, export). Then "Want to see it run live? Message me on Upwork and I'll walk you through it.", which becomes a "Get in touch" link when `DEMO_CONTACT_URL` is set, and the walkthrough link when there is one.

## PDF

- `renderAuditPdf` splits: the rendering moves to `lib/audit/pdfRender.ts` (`renderPdf(audit, business, report, contact)`), which doesn't touch the database. `auditPdf.ts` keeps the lookup and calls it. The demo route must not import the Supabase client, which throws at import when its settings are missing (as in a build).
- `app/demo/report/[auditId]/route.ts`: `GET`, pre-built for every sample audit that has a report (`generateStaticParams`, `dynamic = 'force-static'`, `dynamicParams = false`), any other id is a 404.
- `PdfDocument`'s `contact` becomes optional. Without it there is no "next step" box and no contact line in the footer. The demo passes none unless `DEMO_PDF_CONTACT=1`.

## Settings (all optional)

| Variable | Effect |
|---|---|
| `DEMO_VIDEO_URL` | Adds the walkthrough link to the banner and the notice |
| `DEMO_CONTACT_URL` | Turns the notice's last line into a "Get in touch" link |
| `DEMO_PDF_CONTACT=1` | The demo PDF shows the report contact box, as the real one does |

Read on the server (`lib/demo/demoLinks.ts`) and added to `.env.local.example`. The two links must be `http(s)` addresses; anything else is ignored. `app/demo/page.tsx` is rendered per request, so the two links take effect on a restart. `DEMO_PDF_CONTACT` is read when the PDFs are built, so it needs a new build.

## Setup (user, once)

1. Pick the saved search and the website to feature, ideally ones whose results you are happy to show. Run the capture script and look through `demoData.json`.
2. Record the Loom and set `DEMO_VIDEO_URL`.
3. Deploy. The bare domain is the link for proposals.

After a change to the audit engine or the report UI, run the capture again. A test fails when the capture's audits are from an older engine.

## Testing

- Unit (written first):
  - `routes`: `/demo` and `/demo/report/x` are public; every `API_ROUTES` entry except `AUTH` is still protected.
  - `proxy`: logged out, `/` goes to `/demo`, `/searches` goes to login, `/api/audit` is a 401; logged in, `/` passes.
  - `mask`: emails, phone formats, text with both, dates and scores untouched.
  - `demoData`: `findUnmasked` finds nothing in the capture; no HubSpot or emailed fields; no id that isn't a `demo-…` id; every audit is on the current engine; every `replayIds` entry has an audit and a report.
  - `replay`: answers with the saved audit and report, fails cleanly for an unknown id.
  - `pdfRender`: with and without a contact.
- Browser, logged out against `next dev`: the bare domain opens the demo; both tabs; sort and filter; a single replay; "Audit all" with Stop; every restricted button opens the notice; the PDF downloads; the network panel shows no `/api/*` request. Then logged in: the workspace is unchanged.

## Risks

- **Real businesses are named with weak scores** on a public page. It isn't indexed, but it is linkable. Choosing the search is the control; auditing well-known sites instead is the alternative.
- **The capture ages.** Dates in it are honest and will look old; a new capture takes a minute.
- **The capture ships in the page's JavaScript**, so it is limited to 10 leads and one site.
- **Masking is pattern-based.** The test is the guard, and the capture should still be read once by eye before it is committed.
- **Upwork's contact rules** are the reason for the cautious defaults; the user decides whether to switch the links on.
