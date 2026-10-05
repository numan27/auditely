# Email Verification (Verifalia) — Design Spec

**Date:** 2026-10-05
**Status:** Built (2026-10-05). Not yet run against a real Verifalia account: that needs the user's `VERIFALIA_USERNAME` and `VERIFALIA_PASSWORD`, and the migration.
**Project:** "integrate https://github.com/verifalia/verifalia-js-sdk into auditely" — check a lead's email address before the outreach email is sent to it.

## Background

- A lead's email comes from scraping its website, or from Hunter / Snov / Tomba / Apollo (`utils/emailFinder.ts`, `utils/emailApis.ts`). `isValidBusinessEmail` only filters obvious junk; nothing checks that the mailbox exists.
- "Send email" sends from the user's own mailbox over SMTP (`email/mailer.ts`). Every bounce counts against that mailbox.
- Verifalia verifies an address without sending to it and answers with a classification (`Deliverable`, `Undeliverable`, `Risky`, `Unknown`) and a status code that says why (`MailboxDoesNotExist`, `DomainHasNullMx`, `ServerIsCatchAll`, …).
- Its free plan gives 25 credits a day; a check at Standard quality costs 1 credit (verifalia.com/pricing, read 2026-10-05).
- SDK: npm `verifalia` 5.0.0, MIT, TypeScript types included.

## Goals

1. Before an outreach email is sent, the lead's address is checked with Verifalia.
2. An undeliverable address is never sent to, and the user sees the reason.
3. Only Verifalia's free daily credits are ever used.

## Non-goals

- Checking addresses in bulk, or as soon as discovery finds them (user's choice: before sending only).
- Finding a replacement address for an undeliverable lead. A stored email is never overwritten today, so that lead stays reachable by phone or contact page only. A sensible follow-up.
- The check result in the CSV export or in HubSpot.
- High or Extreme quality checks (2 and 4 credits each).
- Showing the credit balance in the app.

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| When it runs | When the Send email dialog opens | User's choice (2026-10-05); a credit is spent only on leads that are about to be emailed |
| Undeliverable | Never sent; the reason is shown; no override | User: "Don't send the email then simply, and show the reason." The server refuses it too |
| Risky, Unknown | Amber note, sending allowed | A domain that accepts every address answers `Risky` (`ServerIsCatchAll`), and many small-business domains do; blocking them would block good leads |
| Verifalia can't check | Note saying it wasn't checked, sending allowed | An outage or an empty daily allowance must not stop outreach |
| Credits | Free daily credits only | User's choice (2026-10-05); see "Free plan only" |
| Where the SDK runs | Server only | The password stays out of the browser, and the server can trust the result |
| Where the result lives | On the lead, reused for 30 days | Reopening the dialog or sending the follow-up costs nothing |

## Flow

1. The user clicks **Send email** (or **Send follow-up**). The dialog opens and shows "Checking this address…"; Send is disabled.
2. The browser calls `POST /api/verify-email { business_id }`.
3. The server uses the saved result when it is fresh. Otherwise it reads the credit balance, verifies the address, and saves the result on the lead.
4. The dialog shows the result (see UI) and enables Send unless the address is undeliverable.
5. `POST /api/send-email` makes the same check before it builds the PDF. In the normal flow the result is already saved, so this costs nothing. An undeliverable address is refused.

A saved result is **fresh** when it is for the lead's current address (compared without case) and less than 30 days old. An `Unknown` result is fresh for one hour only: it usually means the mail server didn't answer in time, so it is worth another try later, but not on the send that follows the dialog's own check (that would spend a second credit).

A fresh saved result is used as it is, by the dialog without asking the server and by the server without asking Verifalia. It also stands when Verifalia is later switched off: an address found undeliverable stays blocked until the result expires.

## Free plan only

- Every check is submitted at `Standard` quality: 1 credit.
- Before each check the server reads the balance (`credits.getBalance()`, no credit cost). It verifies only when `freeCredits` is at least 1. Otherwise nothing is submitted and the dialog says today's free checks are used up and when they come back (`freeCreditsResetIn`).
- If the balance can't be read, nothing is submitted.
- Nothing in Auditely buys or asks for credit packs.

## Verifying an address

`email/verifalia.ts` wraps the SDK:

```ts
const verifalia = new VerifaliaRestClient({ username, password });
const balance = await verifalia.credits.getBalance(cancel);
const result = await verifalia.emailValidations.submit(
  { entries: [{ inputData: address }], quality: 'Standard' },
  waitOptions,
  cancel
);
const entry = result?.entries[0];   // entry.classification, entry.status
```

- One time limit of 20 seconds covers the balance read and the verification together, through the SDK's `CancellationToken`. When it runs out, the address counts as not checked.
- A result that isn't complete, or has no classification, also counts as not checked.
- The client is created per request; nothing is cached between requests.

## Reasons shown to the user

`email/emailCheck.ts` turns the status code into a sentence. The block itself depends only on the classification (`Undeliverable`); the status only picks the wording.

| Status codes | Reason |
|---|---|
| `MailboxDoesNotExist` | This mailbox doesn't exist. |
| `DomainDoesNotExist` | This address's domain doesn't exist. |
| `DomainIsMisconfigured`, `DomainHasNullMx`, `MailExchangerIsParked` | This domain doesn't accept email. |
| Syntax failures (`AtSignNotFound`, `InvalidCharacterInSequence`, `DoubleDotSequence`, `InvalidLocalPartLength`, `InvalidAddressLength`, `DomainPartCompliancyFailure`, `IspSpecificSyntaxFailure`, `UnacceptableDomainLiteral`, and the other quoting and comment errors) | This isn't a valid email address. |
| `DomainIsWellKnownDea`, `MailExchangerIsWellKnownDea`, `MailboxIsDea` | This is a disposable (throwaway) address. |
| `MailExchangerIsHoneypot` | This address is a spam trap. |
| `ServerIsCatchAll` | This domain accepts every address, so the mailbox can't be confirmed. |
| `MailboxTemporarilyUnavailable`, `ServerTemporaryUnavailable` | The mail server was temporarily unavailable. |
| `ServerDoesNotSupportInternationalMailboxes` | The mail server doesn't support the characters in this address. |
| Timeouts and connection failures (`DnsQueryTimeout`, `DnsConnectionFailure`, `SmtpConnectionTimeout`, `SmtpConnectionFailure`, `MailboxConnectionFailure`, `MailboxValidationTimeout`, `CatchAllValidationTimeout`, `CatchAllConnectionFailure`, `SmtpDialogError`, `LocalEndPointRejected`, `LocalSenderAddressRejected`, `UnhandledException`) | The mail server couldn't be reached to confirm this address. |
| Anything else | Verifalia marked this address as {classification, lower case} ({status}). |

## When it can't be checked

Shown in the dialog as an amber note; sending stays allowed. Nothing is saved, so the next opening tries again.

| Case | Note |
|---|---|
| No free credits left today | Not checked: today's free Verifalia checks are used up (back in {h} h {m} min). |
| Balance can't be read (`AuthorizationError`) | Not checked: the Verifalia user isn't allowed to read the credit balance. |
| Verifying refused (`AuthorizationError`) | Not checked: the Verifalia user isn't allowed to verify emails. |
| Login refused (`AuthenticationError`) | Not checked: Verifalia refused the login — check VERIFALIA_USERNAME and VERIFALIA_PASSWORD. |
| `RequestThrottledError` | Not checked: Verifalia is busy — try again in a minute. |
| `InsufficientCreditError` | Same note as "no free credits left today", without the time. |
| 20 seconds passed | Not checked: Verifalia took too long. |
| The result came back incomplete | Not checked: Verifalia didn't finish the check. |
| Auditely's own request failed | Not checked: the check couldn't be run. |
| Anything else | Not checked: Verifalia couldn't be reached. |

With `VERIFALIA_USERNAME` or `VERIFALIA_PASSWORD` unset (or still the `your_…_here` placeholder), the feature is off: no request to Verifalia, no note, and the dialog works as it does today.

## API

**`POST /api/verify-email { business_id }`** (private like every other API route; `maxDuration = 30`)

| Case | Status | Body |
|---|---|---|
| No `business_id` | 400 | `{ error }` |
| Business not found | 404 | `{ error }` |
| Business has no email | 400 | `{ error }` |
| Verifalia not set up, nothing fresh saved | 200 | `{ state: 'off' }` |
| Checked (fresh or new) | 200 | `{ state: 'checked', check }` |
| Checked, but the result couldn't be saved | 200 | `{ state: 'checked', check, warning }` |
| Couldn't be checked | 200 | `{ state: 'unchecked', reason }` |

The address always comes from the stored business, never from the request.

**`POST /api/send-email`** — after the business is loaded and before the PDF is built (not for `preview: true`), it runs the same check. An undeliverable address answers 400 with `{ error: "Not sent: {reason}", email_check }`. Every other outcome sends as today. The route keeps `maxDuration = 60`: the check adds at most 20 seconds, and only when no fresh result is saved.

## Data model

Migration `docs/migrations/2026-10-05-email-check.sql` (run before deploying; `docs/supabase-schema.sql` updated):

```sql
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email_check JSONB;
```

```ts
type EmailVerdict = 'Deliverable' | 'Undeliverable' | 'Risky' | 'Unknown';

interface EmailCheck {
  /** The address that was checked, so a result never applies to a different one */
  address: string;
  verdict: EmailVerdict;
  /** Verifalia's status code, e.g. MailboxDoesNotExist */
  status: string;
  checked_at: string;
}
```

One JSONB column rather than several flat ones: the four values are always written and read together, and the address travels with the verdict. `Business.email_check` is optional in the type (absent before the migration) and is added to `BusinessUpdate`.

The results list and the send route already select `*` from `businesses`, so the column reaches the cards and the server check with no change to those queries.

Before the migration is run, a check still works but can't be saved: the dialog shows the result with the warning "Checked, but the result couldn't be saved — run docs/migrations/2026-10-05-email-check.sql in Supabase", and every opening spends a credit.

## Code layout

| File | Responsibility |
|---|---|
| `app/_shared/lib/email/emailCheck.ts` (new) | Pure, used by browser and server: `EmailCheck`, `checkFor`, `isFresh`, `freshCheck`, `blocksSending`, `checkReason`, and what the dialog and the card show (`checkNotices`, `checkMark`) |
| `app/_shared/lib/email/verifalia.ts` (new) | Server only: `verifaliaConfigured()`, `verifyAddress(address)` — balance, submit, time limit, error mapping |
| `app/_shared/lib/email/leadEmailCheck.ts` (new) | Server only: `checkLeadEmail(business)` — fresh saved result, else verify and save. Used by both routes |
| `app/api/verify-email/route.ts` (new) | The dialog's check |
| `app/api/send-email/route.ts` | Refuses an undeliverable address |
| `app/_shared/lib/config/routes.ts` | `API_ROUTES.VERIFY_EMAIL` |
| `app/_shared/lib/hooks/useEmailSend.ts` | Gains the check: `check`, `checking`, `checkNote`, `verify()`; the result reaches the list through `onUpdate` |
| `app/_shared/components/auditely/emailCheckNote/emailCheckNote.tsx` (new) | The dialog's status line |
| `app/_shared/components/auditely/sendEmailModal/sendEmailModal.tsx` | Shows the note; Send disabled while checking or when blocked |
| `app/_shared/components/auditely/reportActions/reportActions.tsx` | Starts the check when the dialog opens |
| `app/_shared/components/auditely/businessEmail/businessEmail.tsx` | The mark beside the email on the card |
| `app/_shared/lib/types/auditely.ts` | `email_check` on `Business` and `BusinessUpdate` |
| `next.config.ts` | `verifalia` added to `serverExternalPackages` |
| `.env.local.example` | `VERIFALIA_USERNAME`, `VERIFALIA_PASSWORD` |

`next.config.ts`: the package's `module` field points at its browser build and `main` at its Node build. Listing it in `serverExternalPackages` makes the server load it with Node's own resolution, which picks the Node build.

## UI

**Send email dialog**, under the "To" line:

| State | Shown | Send button |
|---|---|---|
| Checking | "Checking this address…" | Disabled |
| Deliverable | Green check and "Verified" | Enabled |
| Undeliverable | Red note: "Not deliverable: {reason} This email can't be sent." | Disabled, with the reason as its tooltip |
| Risky | Amber note: "Risky: {reason}" | Enabled |
| Unknown | Amber note: "Couldn't be confirmed: {reason}" | Enabled |
| Not checked | Amber note from "When it can't be checked" | Enabled |
| Verifalia not set up | Nothing | Enabled |

Preview stays available in every state: it sends nothing. If the server refuses the send anyway (the result changed between opening and sending), its message shows where send errors show today.

**Business card**, beside the email once a result for that address is saved: a green "Verified" mark, a red "Undeliverable" mark or an amber "Risky" mark, with the reason and the check date as the tooltip. Nothing for Unknown or before a check. (A bare green check would sit beside the copy button, which turns into a green check when clicked; the word keeps the two apart.) The card's Send email button stays as it is: it opens the dialog, which shows the block.

**Demo:** the demo never opens the dialog (`demo.restrict('sendEmail')`), so nothing is checked and the sample data carries no result.

## Setup (user, once)

1. Create a free Verifalia account.
2. In the Verifalia client area, add a user for Auditely (rather than using the account owner's login) and allow it to verify emails and read the credit balance.
3. Add `VERIFALIA_USERNAME` and `VERIFALIA_PASSWORD` to `.env.local` and to Vercel (Production and Preview); redeploy.
4. Run `docs/migrations/2026-10-05-email-check.sql` in Supabase.

## Testing (written first)

- `emailCheck`: fresh / stale by age; a result for another address is not fresh; `Unknown` is fresh for an hour; a malformed saved value counts as no check; only `Undeliverable` blocks; a reason for each row of the table and the fallback.
- `verifalia` (SDK mocked): not configured, including placeholder values; no free credit → nothing submitted, note with the reset time; balance unreadable → nothing submitted; submitted at `Standard` quality with the one address; classification and status mapped to `EmailCheck`; incomplete result → not checked; each SDK error mapped to its note; the time limit.
- `leadEmailCheck`: a fresh saved result is returned without calling Verifalia, also when Verifalia is off; a stale, old `Unknown` or other-address result is checked again; the new result is saved; a failed save still returns the result with the warning; a failed check saves nothing.
- `/api/verify-email`: 400 / 404 / no email; `off`, `checked`, `unchecked`.
- `/api/send-email`: an undeliverable address → 400 and nothing is sent or recorded; deliverable, risky, unknown, not checked and Verifalia off all send; `preview: true` never checks.
- The dialog and the card's mark, rendered to static markup the way `components/auditely/__tests__/removeSites.test.ts` does: the note for each state in the UI table, Send disabled while checking and when undeliverable, and no mark on the card for Unknown or an unchecked lead.
- `npm run build`, then one real check against Verifalia from the running app.

## Rollout

Run the migration, add the two variables, deploy. Without the variables nothing changes.

## Risks

- **Server bundle** — the package ships a browser build next to its Node build; if the server picks the wrong one, checks fail at run time. Covered by `serverExternalPackages`, the build, and the real check before this is called done.
- **Which credits are spent** — Auditely submits only when a free daily credit is available. That keeps paid credits untouched as long as Verifalia spends free daily credits before credit packs, which is not verified here. An account with no credit pack has nothing paid to spend either way.
- **A check that times out is lost** — Verifalia may still finish it and take the credit, and the next opening checks again. Expected to be rare; not handled.
- **Client-area labels unverified** — the exact names of the Verifalia user permissions in Setup step 2 were not checked.
- **A wrong verdict** — an address Verifalia wrongly marks undeliverable can't be emailed from Auditely for 30 days. Accepted by the user's choice of no override.
