# Bulk Audit and Send Email — Design Spec

**Date:** 2026-10-02
**Status:** Built (user asked to start directly: "start with bulk audit … enable email sending from auditely", no bulk email sending)
**Project:** the time-saving follow-up to `update.txt` — #1 (queue) in the form that fits Vercel, plus sending the outreach email from the app.

## Background

Per lead the user clicked "Run audit" and waited about a minute, then downloaded the PDF, then copied the email draft into a mail client and attached the PDF. Three manual steps times every business in a search.

## Goals

1. One click audits every business in the current view and writes each AI summary.
2. One lead's outreach email is reviewed, edited and sent from Auditely with the PDF attached.

## Non-goals

- Bulk email sending (user's decision: every email is reviewed and sent one at a time).
- A server-side job queue. The run lives in the browser tab; that needs no new infrastructure on Vercel and each audit stays one request under the 300 s limit.
- Bulk "Send to HubSpot".
- Re-auditing stale or outdated audits in bulk (that stays "Re-audit" on the card).

## Bulk audit

| Decision | Choice | Why |
|---|---|---|
| What it covers | Businesses matching the active filters that have a website and no audit, or no AI summary | The filters are the selection: "Has email" + Audit all audits only leads you can email |
| Order | The current sort order | The likeliest prospects first |
| How many at once | 3 | An audit runs PageSpeed twice and the summary calls the AI; 3 stays inside both rate limits |
| Stop | Nothing new starts; running audits finish | Their results are already paid for |
| Failures | Shown on the card with its own "Try again"; the next "Audit all" picks them up | A dead website must not stop the run |
| Leaving | A new search cancels the run; closing the tab asks first | What was audited is saved either way |
| Afterwards | Cards finished by the run stay collapsed; the list re-arranges once | Dozens of open reports would bury the list; "Weakest site first" then means something |

Code: `utils/pool.ts` (`runPool`), `utils/bulkAudit.ts` (`needsAudit`, `auditBusiness`, `shownStatus`), `hooks/useBulkAudit.ts`, `bulkAuditControl/`. Results reach the cards the way a card's own audit does: through the list (`onUpdate`) and back in through `initialAudit` / `initialReport`, so cards that aren't on screen are covered. A card's own activity always wins over bulk state (`shownStatus`).

## Send email

- **Send email** in the card footer (disabled without an email address) opens a dialog: recipient, subject, message, a note that the PDF is attached, and a warning when the lead was already emailed.
- The draft is the AI's email: its "Subject:" line becomes the subject, and a sign-off the AI left on the offer's line moves to its own paragraph.
- `POST /api/send-email { business_id, subject, body }`: the recipient always comes from the stored business; subject and message are validated on both sides (`email/outreach.ts`); the PDF is the same one the download uses; sent through Resend from `FROM_EMAIL`, with `EMAIL_REPLY_TO` and `EMAIL_BCC` when set.
- `businesses.emailed_at` records the send (`docs/migrations/2026-10-02-emailed-at.sql`). When the email went out but the date couldn't be saved, the answer is still a success with a warning, so nobody sends it again thinking it failed.

| Case | Status | Message |
|---|---|---|
| `RESEND_API_KEY` or `FROM_EMAIL` missing | 503 | "Email sending isn't set up — add RESEND_API_KEY and FROM_EMAIL in Vercel." |
| No email address | 400 | "This business has no email address." |
| No audit or summary | 400 | "Run the audit and AI summary first." |
| Resend refuses (unverified domain, bad address) | 502 | "The email wasn't sent: {its reason}" |
| Resend unreachable | 502 | "The email service couldn't be reached — try again." |

## Setup (user, once)

1. Run `docs/migrations/2026-10-02-emailed-at.sql` in Supabase.
2. In Resend, verify the sending domain (DNS records) and create an API key.
3. Vercel → Environment Variables: `RESEND_API_KEY`, `FROM_EMAIL` (e.g. `Numan <numan@devartventures.com>`), optionally `EMAIL_REPLY_TO` and `EMAIL_BCC`; redeploy.

## Testing

- Unit (written first): `pool`, `bulkAudit`, `outreach`, the `/api/send-email` route.
- Browser (Playwright against `next dev`, API calls faked): Audit all — 3 at a time, Stop, a failing site, a second run; Send email — prefilled draft, validation, a refusal, a send, the second-send warning.

## Risks

- **The tab must stay open** during a bulk run.
- **Cold email rules** (CAN-SPAM and similar): the message should carry a postal address and a way to opt out; the dialog doesn't add them.
- **Attachments from a new sending domain** can land in spam; `EMAIL_BCC` to your own inbox shows what recipients get.
