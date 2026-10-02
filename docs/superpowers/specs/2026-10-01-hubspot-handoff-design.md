# HubSpot Hand-off — Design Spec

**Date:** 2026-10-01
**Status:** Design approved in conversation (pending written-spec review)
**Project:** #5 of `update.txt` — "The Conversion Gap (Delivering the Lead to DevArtVentures)", using HubSpot's free CRM (user's choice over GoHighLevel / Zapier, 2026-09-30).

## Background

- Leads leave Auditely today only by CSV export or copy-paste.
- The PDF is generated on download (`/api/pdf`) and never stored, so there is no link to share.
- The whole app is behind the admin login (`proxy.ts`; only `/login` and `/api/auth` are public).
- HubSpot free CRM has API access through a private app token ("legacy private apps" — still supported). Free accounts: 100 requests / 10 s, 250,000 / day.

## Goals

1. One button per lead sends it to HubSpot: the business as a Company, its email (if any) as a linked Contact, and a Note with the audit.
2. Sending again updates the same records — never a duplicate company.
3. The note links to the PDF through a private, unguessable Auditely link that opens without logging in.

## Non-goals

- Automatic or bulk sending (user chose a button per lead).
- Email sequences, deals, owners, custom HubSpot properties.
- Storing PDFs (the link renders the PDF fresh).
- Syncing changes back from HubSpot.
- GoHighLevel / Zapier (the HubSpot code sits in its own module so another CRM can be added beside it).

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Trigger | "Send to HubSpot" button per lead | User choice; keeps HubSpot clean and inside the free plan's contact limit |
| Connection | Auditely → HubSpot API directly (approach A) | No extra service; one token in Vercel |
| PDF link | Private Auditely link, signed with `AUTH_SECRET` | Nothing to store; always the current audit; only that report is public |
| Duplicates | Company matched by stored id, else by website domain; contact by email | Re-sending updates and adds a fresh note |
| Lifecycle stage | Set only when creating a record | HubSpot refuses moving a stage backwards (e.g. a customer back to lead) |

## What is sent

**Company** (`/crm/objects/2026-09/companies`): `name`, `domain` (website host without `www.`), `website`, `phone`, `address` (the full listing address), `email` (a custom company property — see below), `industry` (only when the niche maps clearly — see below), and `lifecyclestage: lead` on create only.

**Company email:** HubSpot companies have no email property by default. To see the email in the Companies table, create a company property labelled "Email" (internal name `email`, single-line text). An account without it still gets the lead: HubSpot names the property it rejected, the company is saved again without it, and a warning is logged.

**Contact** (only when the business has an email; `/crm/objects/2026-09/contacts`): `email`, `phone`, `website`, `company` (business name); on create also `lifecyclestage: lead` and `hs_lead_status: NEW`. Linked to the company with the default association (`PUT /crm/objects/2026-09/contact/{id}/associations/default/company/{id}`).

**Note** (`POST /crm/objects/2026-09/notes`, `hs_timestamp` = now), associated to the company (type 190) and the contact (type 202). Body (HTML; every value escaped):

1. Tag line: "Auditely audit lead — {industry group}" (e.g. "Health"; "Other" when unmapped).
2. Audit date and scores: Performance, Mobile, SEO, SSL, GEO, AEO, Lead capture ("—" when not measured).
3. Google rating and review count, when known.
4. Top problems: the first 4 of `rankedProblems` (plain English).
5. AI summary.
6. Cold email draft (line breaks kept).
7. PDF report link.

**Industry mapping** (niche keywords → HubSpot `industry` value → tag group), a small fixed table:

| Niche contains | `industry` | Group |
|---|---|---|
| dentist, dental, orthodont, clinic, medical, doctor, physician, chiropract, physio, dermatolog, pediatric | `MEDICAL_PRACTICE` | Health |
| vet | `VETERINARY` | Health |
| school, academy, tutor, preschool, daycare, college, university, education | `EDUCATION_MANAGEMENT` | Education |
| lawyer, attorney, law firm, law office, legal (not "lawn") | `LAW_PRACTICE` | Legal |
| restaurant, cafe, bakery | `RESTAURANTS` | Food |
| roof, plumb, hvac, electric, contractor, construction | `CONSTRUCTION` | Home services |
| gym, fitness, yoga, spa, salon | `HEALTH_WELLNESS_AND_FITNESS` | Fitness & beauty |
| real estate, realtor | `REAL_ESTATE` | Real estate |
| accountant, accounting, cpa, bookkeep | `ACCOUNTING` | Finance |

All nine values are in HubSpot's allowed list (checked against the live API, 2026-10-01). If HubSpot ever rejects the `industry` value, the company is saved again without it and a warning is logged — the lead always goes through.

**Matching:** the company id saved from the last send is updated directly; if that company was deleted in HubSpot (404), or there is no saved id, the company is found by `domain` (search) and updated, else created. The contact is found by email (search) and updated, else created.

## The private PDF link

- `GET /report/{token}` returns the PDF inline (`Content-Disposition: inline`). It is added to the public routes; everything else stays private.
- Token: `{auditId}.{base64url(HMAC-SHA256(AUTH_SECRET, "report:" + auditId))}`. The `report:` prefix keeps it from ever matching a session signature. A changed character → 404.
- The PDF is built from the audit's current data and newest AI report (the same function `/api/pdf` uses; it moves into `app/_shared/lib/audit/auditPdf.ts`). No AI report → 404.
- Rotating `AUTH_SECRET` turns off every report link (and logs the admin out).
- The link's origin is the request's origin when sending (`request.nextUrl.origin`).

## Code layout

| File | Responsibility |
|---|---|
| `app/_shared/lib/auth/signing.ts` (new) | `sign` / `safeEqual` / secret check, moved out of `session.ts` (which imports them) |
| `app/_shared/lib/auth/reportLink.ts` (new) | `reportToken(auditId)`, `verifyReportToken(token)` |
| `app/_shared/lib/audit/auditPdf.ts` (new) | `renderAuditPdf(auditId)` — load audit + business + newest report, build props, render |
| `app/_shared/lib/crm/leadPayload.ts` (new) | Pure: business + audit + report → company / contact properties and the note HTML; industry mapping |
| `app/_shared/lib/crm/hubspot.ts` (new) | HubSpot API client: find-or-create company / contact, associate, note; error mapping |
| `app/api/crm/route.ts` (new) | `POST { business_id }` → send, save `hubspot_company_id` + `crm_sent_at` |
| `app/report/[token]/route.ts` (new) | The public PDF link |
| `app/api/pdf/route.ts` | Uses `renderAuditPdf` |
| UI: audit panel + a `useCrmSend` hook | Button, sent date, "Send again", errors |

## Data model

Migration `docs/migrations/2026-10-01-hubspot.sql` (run before deploying; `docs/supabase-schema.sql` updated):

```sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS hubspot_company_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_sent_at        TIMESTAMPTZ;
```

The company id is saved as soon as the company step succeeds, so a send that fails later (contact, note) updates that company on retry.

## Errors (shown on the button)

| Case | Status | Message |
|---|---|---|
| `HUBSPOT_TOKEN` not set | 503 | "HubSpot isn't connected — add HUBSPOT_TOKEN in Vercel." |
| 401 / 403 from HubSpot | 502 | "HubSpot refused the token — check it has companies and contacts read and write." |
| 429 | 503 | "HubSpot is busy — try again in a minute." |
| No audit / AI report yet | 400 | "Run the audit and AI summary first." |
| Other HubSpot error | 502 | "HubSpot couldn't save the lead: {its message}" |

The token is only read on the server and never sent to the browser.

## UI

In the audit panel's footer, next to "Download PDF report" (shown once the AI report exists): **Send to HubSpot**. While sending: "Sending…". After success: "Sent to HubSpot · {date}" and the button becomes **Send again**. Errors show beside the button.

## Setup (user, once)

1. Free HubSpot account.
2. Development → Legacy apps → Create legacy app → Private; scopes: `crm.objects.companies.read`, `crm.objects.companies.write`, `crm.objects.contacts.read`, `crm.objects.contacts.write` (notes use the contact scopes); create; Auth tab → copy the token.
3. Vercel → Settings → Environment Variables: `HUBSPOT_TOKEN` (Production and Preview); redeploy.
4. Run `docs/migrations/2026-10-01-hubspot.sql` in Supabase.

## Testing (written first)

- `leadPayload`: company / contact properties; domain from website; industry mapping and "Other"; note contents; HTML escaping of business text and the AI email; scores "—" when not measured.
- `hubspot` (fake `fetch`): create vs update company (saved id, 404 fallback, domain search); contact create vs update by email; stage only on create; association; note associations; industry rejected → saved without it; 401 / 403 / 429 / other mapped to the table above.
- `reportLink`: round trip; tampered id or signature → invalid; missing secret → invalid.
- Routes: `/api/crm` saves the company id and send date, and the id is kept when a later step fails; `/report/{token}` serves the PDF for a valid token and 404 otherwise; `isPublicRoute('/report/x')` true, other routes still private.

## Rollout

Run the migration, add `HUBSPOT_TOKEN`, deploy. Nothing changes until the button is pressed.

## Risks

- **API version** — paths use HubSpot's `2026-09` API version (one constant); HubSpot keeps old versions available for a long time.
- **Industry codes unverified** — rejected values fall back safely (logged).
- **Public report links** — anyone with a link can read that one report; they are unguessable and can all be revoked by rotating `AUTH_SECRET`.
