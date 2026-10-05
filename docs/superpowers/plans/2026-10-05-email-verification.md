# Email Verification (Verifalia) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before an outreach email is sent, the lead's address is checked with Verifalia on its free plan; an undeliverable address is never sent to and the dialog says why.

**Architecture:** The Verifalia SDK runs on the server only, behind `POST /api/verify-email`, which the Send email dialog calls when it opens. The result is saved on the lead (`businesses.email_check`, JSONB) and reused while fresh. `POST /api/send-email` runs the same check through the same function and refuses an undeliverable address. One pure module (`email/emailCheck.ts`) holds the rules both sides share: what a saved check is, when it is fresh, what blocks, and what the dialog and the card show.

**Tech Stack:** Next.js 16 App Router (route handlers), React 19, TypeScript 5, Tailwind v4, Supabase, `verifalia` 5.0.0 (new dependency), vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-05-email-verification-design.md`

## Global Constraints

- **Free plan only.** Every check is submitted at `Standard` quality. Nothing is submitted unless `freeCredits` is at least 1. If the balance can't be read, nothing is submitted.
- One new npm dependency: `verifalia` (5.0.0). No others.
- The Verifalia password is read only on the server. `verifalia` and `email/verifalia.ts` are never imported from a client component or from `email/emailCheck.ts`.
- Only an `Undeliverable` verdict blocks sending. Risky, Unknown, "not checked" and "Verifalia off" all send.
- The address that is checked and sent to always comes from the stored business, never from the request.
- Time limit for one check (balance read + verification): 20 000 ms. `/api/verify-email` has `maxDuration = 30`; `/api/send-email` keeps `maxDuration = 60`.
- Freshness: 30 days for Deliverable, Undeliverable and Risky; 1 hour for Unknown.
- With `VERIFALIA_USERNAME` or `VERIFALIA_PASSWORD` unset (or a `your_…_here` placeholder) and nothing fresh saved, everything behaves as before this change.
- Copy, verbatim from the spec. Dialog: "Checking this address…", "Verified", "Not deliverable: {reason} This email can't be sent.", "Risky: {reason}", "Couldn't be confirmed: {reason}". Server refusal: "Not sent: {reason}". Every "not checked" note starts with "Not checked: ".
- Imports of shared code use `@/app/_shared/...`; API paths come from `API_ROUTES`; files stay under 300 lines; component folders and files are camelCase; the modal stays its own component file.
- Next.js 16 differs from older versions: before changing a route handler or `next.config.ts`, read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md` and `03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`.
- **Git:** the user asked (2026-10-05) for the finished work to be committed to `main`. Commit once the last task's checks pass, not per task. Never push, branch, or commit `.env.local`.
- Commands: one file `npx vitest run <path>`; all `npm test`; types `npx tsc --noEmit`; lint `npm run lint`; build `npm run build`. Baseline before this work: 68 test files, 582 passed, 3 skipped.

## Review Focus

1. **A saved `email_check` that isn't a check** (hand-edited in Supabase: a string, an array, a misspelt verdict, a missing field, an unreadable date) must count as "no check": the card renders, nothing is blocked by it, and the address is checked again. Pinned in Task 1 (`asEmailCheck`, `isFresh`) and Task 7 (the card renders with garbage).
2. **The stored address written differently from the checked one** (`Office@SmileDental.com ` vs `office@smiledental.com`) must reuse the result and spend no credit; a different address must never inherit a verdict. Pinned in Task 1 (`checkFor`) and Task 3.
3. **A status code Auditely has never seen, or one carrying markup** (Verifalia adds codes; the value is external text) must still give a readable reason and reach the page escaped. Pinned in Task 1 (fallback reason) and Task 6 (the dialog escapes it).
4. **A check that never answers** (Verifalia hangs, Auditely's own request fails, a second click while the first check runs) must never leave the dialog stuck with Send disabled, and must not spend two credits. Pinned in Task 2 (time limit, the token is cancelled) and Task 6 (`requestEmailCheck` turns every failure into "not checked").
5. **A balance that isn't a plain 25** (`freeCredits` null on a plan without free credits, 0 with a credit pack of 500, a fraction below 1, a reset time in an unexpected format) must submit nothing and still give a readable note. Pinned in Task 2.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/_shared/lib/email/emailCheck.ts` | create | Pure rules shared by browser and server |
| `app/_shared/lib/email/__tests__/emailCheck.test.ts` | create | |
| `app/_shared/lib/types/auditely.ts` | modify | `email_check` on `Business` and `BusinessUpdate` |
| `app/_shared/lib/email/verifalia.ts` | create | The SDK call: balance, submit, time limit, error notes |
| `app/_shared/lib/email/__tests__/verifalia.test.ts` | create | |
| `package.json`, `package-lock.json`, `next.config.ts`, `.env.local.example` | modify | The dependency and its settings |
| `app/_shared/lib/email/leadEmailCheck.ts` | create | `checkLeadEmail`: fresh saved result, else verify and save |
| `app/_shared/lib/email/__tests__/leadEmailCheck.test.ts` | create | |
| `docs/migrations/2026-10-05-email-check.sql` | create | The column |
| `docs/supabase-schema.sql` | modify | The column, for new databases |
| `app/_shared/lib/config/routes.ts` | modify | `API_ROUTES.VERIFY_EMAIL` |
| `app/api/verify-email/route.ts` | create | The dialog's check |
| `app/api/verify-email/__tests__/route.test.ts` | create | |
| `app/api/send-email/route.ts` | modify | Refuses an undeliverable address |
| `app/api/send-email/__tests__/route.test.ts` | modify | |
| `app/_shared/lib/hooks/useEmailSend.ts` | modify | `requestEmailCheck`, and `check` / `checking` / `checkNote` / `verify` |
| `app/_shared/lib/hooks/__tests__/emailCheckRequest.test.ts` | create | |
| `app/_shared/components/auditely/emailCheckNote/emailCheckNote.tsx` | create | The dialog's status lines |
| `app/_shared/components/auditely/sendEmailModal/sendEmailModal.tsx` | modify | Shows the note; Send disabled while checking or blocked |
| `app/_shared/components/auditely/reportActions/reportActions.tsx` | modify | Starts the check when the dialog opens |
| `app/_shared/components/auditely/businessEmail/businessEmail.tsx` | modify | The mark beside the email |
| `app/_shared/components/auditely/businessCard/businessCard.tsx` | modify | Passes the check to the email row |
| `app/_shared/components/auditely/__tests__/emailCheck.test.ts` | create | The dialog's states and the card's mark |

---

### Task 1: The shared rules

**Files:**
- Create: `app/_shared/lib/email/emailCheck.ts`
- Modify: `app/_shared/lib/types/auditely.ts`
- Test: `app/_shared/lib/email/__tests__/emailCheck.test.ts` (create)

**Interfaces:**
- Produces:
  - `type EmailVerdict = 'Deliverable' | 'Undeliverable' | 'Risky' | 'Unknown'`
  - `interface EmailCheck { address: string; verdict: EmailVerdict; status: string; checked_at: string }`
  - `type EmailCheckResult = { state: 'off' } | { state: 'checked'; check: EmailCheck; warning?: string } | { state: 'unchecked'; reason: string }`
  - `isEmailVerdict(value: unknown): value is EmailVerdict`
  - `asEmailCheck(value: unknown): EmailCheck | null`
  - `checkFor(stored: unknown, email: string | null | undefined): EmailCheck | null`
  - `isFresh(check: EmailCheck, now?: Date): boolean`
  - `freshCheck(stored: unknown, email: string | null | undefined, now?: Date): EmailCheck | null`
  - `blocksSending(check: EmailCheck | null): boolean`
  - `checkReason(check: EmailCheck): string`
  - `type CheckTone = 'busy' | 'good' | 'warn' | 'bad'`; `interface CheckNotice { tone: CheckTone; text: string }`
  - `checkNotices(view: { checking: boolean; check: EmailCheck | null; note: string | null }): CheckNotice[]`
  - `interface CheckMark { tone: 'good' | 'warn' | 'bad'; label: string; title: string }`; `checkMark(check: EmailCheck): CheckMark | null`
  - `Business.email_check?: EmailCheck | null`; `'email_check'` in `BusinessUpdate`

- [ ] **Step 1: Write the failing test**

Create `app/_shared/lib/email/__tests__/emailCheck.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  asEmailCheck,
  blocksSending,
  checkFor,
  checkMark,
  checkNotices,
  checkReason,
  freshCheck,
  isFresh,
  type EmailCheck,
} from '@/app/_shared/lib/email/emailCheck';

const NOW = new Date('2026-10-05T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const check = (over: Partial<EmailCheck> = {}): EmailCheck => ({
  address: 'office@smiledental.com',
  verdict: 'Deliverable',
  status: 'Success',
  checked_at: ago(DAY),
  ...over,
});

describe('asEmailCheck', () => {
  it('reads a saved check', () => {
    expect(asEmailCheck({ ...check(), extra: 'ignored' })).toEqual(check());
  });

  // The column is JSON and can be edited by hand in Supabase
  it.each([
    [null],
    [undefined],
    ['Deliverable'],
    [42],
    [[check()]],
    [{}],
    [{ ...check(), verdict: 'deliverable' }],
    [{ ...check(), verdict: 'Maybe' }],
    [{ ...check(), address: null }],
    [{ ...check(), status: 7 }],
    [{ ...check(), checked_at: 1759665600000 }],
  ])('treats %j as no check', (value) => {
    expect(asEmailCheck(value)).toBeNull();
  });
});

describe('checkFor', () => {
  it("is the saved check when it was made for the lead's address", () => {
    expect(checkFor(check(), 'office@smiledental.com')).toEqual(check());
  });

  it('matches the address whatever its case or stray spaces', () => {
    expect(checkFor(check(), ' Office@SmileDental.com ')).toEqual(check());
    expect(checkFor(check({ address: 'OFFICE@SMILEDENTAL.COM' }), 'office@smiledental.com')).not.toBeNull();
  });

  it('never applies a verdict to another address', () => {
    expect(checkFor(check({ verdict: 'Undeliverable' }), 'owner@smiledental.com')).toBeNull();
  });

  it('has nothing for a lead without an email, or without a check', () => {
    expect(checkFor(check(), null)).toBeNull();
    expect(checkFor(check(), '')).toBeNull();
    expect(checkFor(null, 'office@smiledental.com')).toBeNull();
    expect(checkFor('yes', 'office@smiledental.com')).toBeNull();
  });
});

describe('isFresh', () => {
  it.each(['Deliverable', 'Undeliverable', 'Risky'] as const)('reuses a %s result for 30 days', (verdict) => {
    expect(isFresh(check({ verdict, checked_at: ago(29 * DAY) }), NOW)).toBe(true);
    expect(isFresh(check({ verdict, checked_at: ago(31 * DAY) }), NOW)).toBe(false);
  });

  // Long enough for the send that follows the dialog's check, short enough to try again later
  it('reuses an Unknown result for an hour only', () => {
    expect(isFresh(check({ verdict: 'Unknown', checked_at: ago(59 * MINUTE) }), NOW)).toBe(true);
    expect(isFresh(check({ verdict: 'Unknown', checked_at: ago(61 * MINUTE) }), NOW)).toBe(false);
  });

  it('does not trust a date it can not read', () => {
    expect(isFresh(check({ checked_at: 'yesterday' }), NOW)).toBe(false);
    expect(isFresh(check({ checked_at: '' }), NOW)).toBe(false);
  });

  // Two servers' clocks differ by a little: a check saved a moment "ahead" is still the one just made
  it('accepts a check dated slightly in the future', () => {
    expect(isFresh(check({ checked_at: ago(-5000) }), NOW)).toBe(true);
  });
});

describe('freshCheck', () => {
  it('is the saved check only when it is for this address and fresh', () => {
    expect(freshCheck(check(), 'office@smiledental.com', NOW)).toEqual(check());
    expect(freshCheck(check(), 'owner@smiledental.com', NOW)).toBeNull();
    expect(freshCheck(check({ checked_at: ago(40 * DAY) }), 'office@smiledental.com', NOW)).toBeNull();
    expect(freshCheck({ verdict: 'Undeliverable' }, 'office@smiledental.com', NOW)).toBeNull();
  });
});

describe('blocksSending', () => {
  it('blocks an undeliverable address and nothing else', () => {
    expect(blocksSending(check({ verdict: 'Undeliverable' }))).toBe(true);
    for (const verdict of ['Deliverable', 'Risky', 'Unknown'] as const) expect(blocksSending(check({ verdict }))).toBe(false);
    expect(blocksSending(null)).toBe(false);
  });
});

describe('checkReason', () => {
  it.each([
    ['MailboxDoesNotExist', "This mailbox doesn't exist."],
    ['DomainDoesNotExist', "This address's domain doesn't exist."],
    ['DomainIsMisconfigured', "This domain doesn't accept email."],
    ['DomainHasNullMx', "This domain doesn't accept email."],
    ['MailExchangerIsParked', "This domain doesn't accept email."],
    ['AtSignNotFound', "This isn't a valid email address."],
    ['InvalidCharacterInSequence', "This isn't a valid email address."],
    ['UnacceptableDomainLiteral', "This isn't a valid email address."],
    ['MailboxIsDea', 'This is a disposable (throwaway) address.'],
    ['DomainIsWellKnownDea', 'This is a disposable (throwaway) address.'],
    ['MailExchangerIsHoneypot', 'This address is a spam trap.'],
    ['ServerIsCatchAll', "This domain accepts every address, so the mailbox can't be confirmed."],
    ['MailboxTemporarilyUnavailable', 'The mail server was temporarily unavailable.'],
    ['ServerTemporaryUnavailable', 'The mail server was temporarily unavailable.'],
    ['ServerDoesNotSupportInternationalMailboxes', "The mail server doesn't support the characters in this address."],
    ['SmtpConnectionTimeout', "The mail server couldn't be reached to confirm this address."],
    ['MailboxValidationTimeout', "The mail server couldn't be reached to confirm this address."],
    ['UnhandledException', "The mail server couldn't be reached to confirm this address."],
  ])('explains %s', (status, reason) => {
    expect(checkReason(check({ verdict: 'Undeliverable', status }))).toBe(reason);
  });

  it('still says something for a status code it has never seen', () => {
    expect(checkReason(check({ verdict: 'Undeliverable', status: 'MailboxWasAbducted' }))).toBe(
      'Verifalia marked this address as undeliverable (MailboxWasAbducted).'
    );
    expect(checkReason(check({ verdict: 'Risky', status: '' }))).toBe('Verifalia marked this address as risky.');
  });
});

describe('checkNotices', () => {
  const texts = (view: Parameters<typeof checkNotices>[0]) => checkNotices(view).map(({ tone, text }) => `${tone}: ${text}`);

  it('says it is checking, and nothing else, while the check runs', () => {
    expect(texts({ checking: true, check: check({ verdict: 'Undeliverable' }), note: 'old note' })).toEqual(['busy: Checking this address…']);
  });

  it('shows each verdict the way the dialog words it', () => {
    expect(texts({ checking: false, check: check(), note: null })).toEqual(['good: Verified']);
    expect(texts({ checking: false, check: check({ verdict: 'Undeliverable', status: 'MailboxDoesNotExist' }), note: null })).toEqual([
      "bad: Not deliverable: This mailbox doesn't exist. This email can't be sent.",
    ]);
    expect(texts({ checking: false, check: check({ verdict: 'Risky', status: 'ServerIsCatchAll' }), note: null })).toEqual([
      "warn: Risky: This domain accepts every address, so the mailbox can't be confirmed.",
    ]);
    expect(texts({ checking: false, check: check({ verdict: 'Unknown', status: 'SmtpConnectionTimeout' }), note: null })).toEqual([
      "warn: Couldn't be confirmed: The mail server couldn't be reached to confirm this address.",
    ]);
  });

  it('shows why the address was not checked', () => {
    expect(texts({ checking: false, check: null, note: 'Not checked: Verifalia took too long.' })).toEqual([
      'warn: Not checked: Verifalia took too long.',
    ]);
  });

  it('shows the verdict and a warning about saving it together', () => {
    expect(texts({ checking: false, check: check(), note: "Checked, but the result couldn't be saved." })).toEqual([
      'good: Verified',
      "warn: Checked, but the result couldn't be saved.",
    ]);
  });

  it('says nothing when Verifalia is off', () => {
    expect(checkNotices({ checking: false, check: null, note: null })).toEqual([]);
  });
});

describe('checkMark', () => {
  // Midday UTC: the same calendar day in every time zone the tests may run in
  const at = '2026-10-03T12:00:00Z';

  it('marks a verified, an undeliverable and a risky address', () => {
    expect(checkMark(check({ checked_at: at }))).toEqual({ tone: 'good', label: 'Verified', title: 'Checked Oct 3' });
    expect(checkMark(check({ verdict: 'Undeliverable', status: 'MailboxDoesNotExist', checked_at: at }))).toEqual({
      tone: 'bad',
      label: 'Undeliverable',
      title: "This mailbox doesn't exist. Checked Oct 3",
    });
    expect(checkMark(check({ verdict: 'Risky', status: 'ServerIsCatchAll', checked_at: at }))).toMatchObject({ tone: 'warn', label: 'Risky' });
  });

  it('leaves an Unknown address unmarked', () => {
    expect(checkMark(check({ verdict: 'Unknown', status: 'SmtpConnectionTimeout' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run app/_shared/lib/email/__tests__/emailCheck.test.ts`
Expected: FAIL, the module `@/app/_shared/lib/email/emailCheck` can't be found.

- [ ] **Step 3: Write the module**

Create `app/_shared/lib/email/emailCheck.ts`:

```ts
// app/_shared/lib/email/emailCheck.ts

// What Verifalia said about a lead's email address, and what that means for
// "Send email". Pure: the browser (dialog, card) and the server apply the same
// rules, so they agree on what is fresh and what is blocked.

export const EMAIL_VERDICTS = ['Deliverable', 'Undeliverable', 'Risky', 'Unknown'] as const;
export type EmailVerdict = (typeof EMAIL_VERDICTS)[number];

export interface EmailCheck {
  /** The address that was checked, so a result never applies to a different one */
  address: string;
  verdict: EmailVerdict;
  /** Verifalia's status code, e.g. MailboxDoesNotExist */
  status: string;
  checked_at: string;
}

/** What asking for a lead's address to be checked comes back with */
export type EmailCheckResult =
  | { state: 'off' }
  | { state: 'checked'; check: EmailCheck; warning?: string }
  | { state: 'unchecked'; reason: string };

export const isEmailVerdict = (value: unknown): value is EmailVerdict =>
  (EMAIL_VERDICTS as readonly unknown[]).includes(value);

/** A stored or received value as a check; null for anything else (the column is JSON) */
export function asEmailCheck(value: unknown): EmailCheck | null {
  if (!value || typeof value !== 'object') return null;
  const { address, verdict, status, checked_at } = value as Record<string, unknown>;
  if (typeof address !== 'string' || !isEmailVerdict(verdict) || typeof status !== 'string' || typeof checked_at !== 'string') {
    return null;
  }
  return { address, verdict, status, checked_at };
}

const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The saved check, when it was made for this address */
export function checkFor(stored: unknown, email: string | null | undefined): EmailCheck | null {
  const check = email ? asEmailCheck(stored) : null;
  return check && email && sameAddress(check.address, email) ? check : null;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Unknown mostly means the mail server didn't answer in time: worth another try
// later, but not on the send that follows the dialog's own check
const FRESH_FOR: Record<EmailVerdict, number> = { Deliverable: 30 * DAY, Undeliverable: 30 * DAY, Risky: 30 * DAY, Unknown: HOUR };

/** Whether a check can be reused instead of spending another credit */
export function isFresh(check: EmailCheck, now: Date = new Date()): boolean {
  // An unreadable date compares false; one slightly ahead (another server's clock) is the check just made
  return now.getTime() - new Date(check.checked_at).getTime() < FRESH_FOR[check.verdict];
}

/** The saved check, when it is for this address and still fresh */
export function freshCheck(stored: unknown, email: string | null | undefined, now: Date = new Date()): EmailCheck | null {
  const check = checkFor(stored, email);
  return check && isFresh(check, now) ? check : null;
}

/** An address Verifalia calls undeliverable is never written to */
export const blocksSending = (check: EmailCheck | null): boolean => check?.verdict === 'Undeliverable';

const REASONS: [codes: string[], reason: string][] = [
  [['MailboxDoesNotExist'], "This mailbox doesn't exist."],
  [['DomainDoesNotExist'], "This address's domain doesn't exist."],
  [['DomainIsMisconfigured', 'DomainHasNullMx', 'MailExchangerIsParked'], "This domain doesn't accept email."],
  [
    [
      'UnmatchedQuotedPair', 'UnexpectedQuotedPairSequence', 'InvalidWordBoundaryStart', 'InvalidCharacterInSequence',
      'UnbalancedCommentParenthesis', 'DoubleDotSequence', 'InvalidLocalPartLength', 'InvalidFoldingWhiteSpaceSequence',
      'AtSignNotFound', 'InvalidEmptyQuotedWord', 'InvalidAddressLength', 'DomainPartCompliancyFailure',
      'IspSpecificSyntaxFailure', 'UnacceptableDomainLiteral',
    ],
    "This isn't a valid email address.",
  ],
  [['DomainIsWellKnownDea', 'MailExchangerIsWellKnownDea', 'MailboxIsDea'], 'This is a disposable (throwaway) address.'],
  [['MailExchangerIsHoneypot'], 'This address is a spam trap.'],
  [['ServerIsCatchAll'], "This domain accepts every address, so the mailbox can't be confirmed."],
  [['MailboxTemporarilyUnavailable', 'ServerTemporaryUnavailable'], 'The mail server was temporarily unavailable.'],
  [['ServerDoesNotSupportInternationalMailboxes'], "The mail server doesn't support the characters in this address."],
  [
    [
      'DnsQueryTimeout', 'DnsConnectionFailure', 'SmtpConnectionTimeout', 'SmtpConnectionFailure', 'MailboxConnectionFailure',
      'MailboxValidationTimeout', 'CatchAllValidationTimeout', 'CatchAllConnectionFailure', 'SmtpDialogError',
      'LocalEndPointRejected', 'LocalSenderAddressRejected', 'UnhandledException',
    ],
    "The mail server couldn't be reached to confirm this address.",
  ],
];
const REASON_BY_STATUS = new Map(REASONS.flatMap(([codes, reason]) => codes.map((code) => [code, reason] as const)));

/** Why Verifalia answered as it did, in plain words. The verdict decides the block; this only words it. */
export function checkReason(check: EmailCheck): string {
  const known = REASON_BY_STATUS.get(check.status);
  if (known) return known;
  // A code added by Verifalia since this was written
  return `Verifalia marked this address as ${check.verdict.toLowerCase()}${check.status ? ` (${check.status})` : ''}.`;
}

export type CheckTone = 'busy' | 'good' | 'warn' | 'bad';
export interface CheckNotice {
  tone: CheckTone;
  text: string;
}

function verdictNotice(check: EmailCheck): CheckNotice {
  const reason = checkReason(check);
  switch (check.verdict) {
    case 'Deliverable':
      return { tone: 'good', text: 'Verified' };
    case 'Undeliverable':
      return { tone: 'bad', text: `Not deliverable: ${reason} This email can't be sent.` };
    case 'Risky':
      return { tone: 'warn', text: `Risky: ${reason}` };
    case 'Unknown':
      return { tone: 'warn', text: `Couldn't be confirmed: ${reason}` };
  }
}

/** The "Send email" dialog's lines about the address; none when there is nothing to say */
export function checkNotices(view: { checking: boolean; check: EmailCheck | null; note: string | null }): CheckNotice[] {
  if (view.checking) return [{ tone: 'busy', text: 'Checking this address…' }];
  return [...(view.check ? [verdictNotice(view.check)] : []), ...(view.note ? [{ tone: 'warn' as const, text: view.note }] : [])];
}

export interface CheckMark {
  tone: 'good' | 'warn' | 'bad';
  label: string;
  /** The tooltip: the reason, and when it was checked */
  title: string;
}

const checkedOn = (iso: string) => `Checked ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

/** The mark beside the email on a business card; none for an address that couldn't be confirmed */
export function checkMark(check: EmailCheck): CheckMark | null {
  switch (check.verdict) {
    case 'Deliverable':
      return { tone: 'good', label: 'Verified', title: checkedOn(check.checked_at) };
    case 'Undeliverable':
      return { tone: 'bad', label: 'Undeliverable', title: `${checkReason(check)} ${checkedOn(check.checked_at)}` };
    case 'Risky':
      return { tone: 'warn', label: 'Risky', title: `${checkReason(check)} ${checkedOn(check.checked_at)}` };
    case 'Unknown':
      return null;
  }
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run app/_shared/lib/email/__tests__/emailCheck.test.ts`
Expected: PASS.

- [ ] **Step 5: Put the check on the lead's type**

In `app/_shared/lib/types/auditely.ts`, add the import under the existing two:

```ts
import type { EmailCheck } from '@/app/_shared/lib/email/emailCheck';
```

In `interface Business`, after the `emailed_at` field:

```ts
  /** What Verifalia said about the email address; absent before the email-check migration */
  email_check?: EmailCheck | null;
```

And extend `BusinessUpdate`:

```ts
export type BusinessUpdate = Partial<
  Pick<BusinessWithData, 'email' | 'audit' | 'ai_report' | 'crm_sent_at' | 'emailed_at' | 'email_check'>
>;
```

- [ ] **Step 6: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. No commit (see Global Constraints).

---

### Task 2: The Verifalia call

**Files:**
- Create: `app/_shared/lib/email/verifalia.ts`
- Modify: `package.json`, `package-lock.json`, `next.config.ts`, `.env.local.example`
- Test: `app/_shared/lib/email/__tests__/verifalia.test.ts` (create)

**Interfaces:**
- Consumes: `isEmailVerdict`, `EmailCheck` from Task 1.
- Produces:
  - `TIME_LIMIT_MS = 20_000`
  - `verifaliaConfigured(): boolean`
  - `type VerifyOutcome = { ok: true; check: EmailCheck } | { ok: false; reason: string }`
  - `verifyAddress(address: string): Promise<VerifyOutcome>` (never throws)

- [ ] **Step 1: Install the SDK**

Run: `npm install verifalia@5.0.0`
Expected: `verifalia` appears under `dependencies` in `package.json` as `^5.0.0`; nothing else changes there.

- [ ] **Step 2: Keep it out of the server bundle**

The package's `module` field points at its browser build and `main` at its Node build. In `next.config.ts`, replace the `serverExternalPackages` line:

```ts
  // verifalia ships a browser build beside its Node one: loaded by Node itself, the server gets the Node build
  serverExternalPackages: ["@react-pdf/renderer", "verifalia"],
```

- [ ] **Step 3: Write the failing test**

Create `app/_shared/lib/email/__tests__/verifalia.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TIME_LIMIT_MS, verifaliaConfigured, verifyAddress } from '@/app/_shared/lib/email/verifalia';

// Fake Verifalia SDK: records each login, the balance read and each submission
const sdk = vi.hoisted(() => {
  class VerifaliaError {
    message?: string;
    constructor(message?: string) {
      this.message = message;
    }
  }
  class AuthenticationError extends VerifaliaError {}
  class AuthorizationError extends VerifaliaError {}
  class InsufficientCreditError extends VerifaliaError {}
  class RequestThrottledError extends VerifaliaError {}
  class ServiceUnreachableError extends VerifaliaError {}
  class OperationCanceledError extends VerifaliaError {}
  class CancellationToken {
    canceled = false;
    cancel() {
      this.canceled = true;
    }
  }
  class WaitOptions {
    submissionWaitTime = 30_000;
    pollWaitTime = 30_000;
  }
  const getBalance = vi.fn();
  const submit = vi.fn();
  const logins: unknown[] = [];
  class VerifaliaRestClient {
    credits = { getBalance };
    emailValidations = { submit };
    constructor(login: unknown) {
      logins.push(login);
    }
  }
  return {
    AuthenticationError, AuthorizationError, InsufficientCreditError, RequestThrottledError, ServiceUnreachableError,
    OperationCanceledError, CancellationToken, WaitOptions, VerifaliaRestClient, getBalance, submit, logins,
  };
});
vi.mock('verifalia', () => ({
  AuthenticationError: sdk.AuthenticationError,
  AuthorizationError: sdk.AuthorizationError,
  InsufficientCreditError: sdk.InsufficientCreditError,
  RequestThrottledError: sdk.RequestThrottledError,
  OperationCanceledError: sdk.OperationCanceledError,
  CancellationToken: sdk.CancellationToken,
  WaitOptions: sdk.WaitOptions,
  VerifaliaRestClient: sdk.VerifaliaRestClient,
}));

const ADDRESS = 'office@smiledental.com';
const balance = (over: Record<string, unknown> = {}) => ({ creditPacks: 0, freeCredits: 25, freeCreditsResetIn: '09:07:53', ...over });
const validation = (entry: Record<string, unknown>, status = 'Completed') => ({
  overview: { id: 'job-1', status },
  entries: [{ index: 0, inputData: ADDRESS, ...entry }],
});
const USED_UP = "Not checked: today's free Verifalia checks are used up";

beforeEach(() => {
  vi.stubEnv('VERIFALIA_USERNAME', 'auditely-user');
  vi.stubEnv('VERIFALIA_PASSWORD', 'secret-password');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sdk.logins.length = 0;
  sdk.getBalance.mockReset().mockResolvedValue(balance());
  sdk.submit.mockReset().mockResolvedValue(validation({ classification: 'Deliverable', status: 'Success' }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('verifaliaConfigured', () => {
  it('needs both the username and the password', () => {
    expect(verifaliaConfigured()).toBe(true);
    vi.stubEnv('VERIFALIA_PASSWORD', '');
    expect(verifaliaConfigured()).toBe(false);
  });

  it('does not count the placeholders from .env.local.example', () => {
    vi.stubEnv('VERIFALIA_USERNAME', 'your_verifalia_username_here');
    expect(verifaliaConfigured()).toBe(false);
  });
});

describe('verifyAddress', () => {
  it('checks the one address at Standard quality and reports the verdict', async () => {
    const before = Date.now();
    const outcome = await verifyAddress(ADDRESS);
    expect(outcome).toEqual({ ok: true, check: { address: ADDRESS, verdict: 'Deliverable', status: 'Success', checked_at: expect.any(String) } });
    if (outcome.ok) expect(new Date(outcome.check.checked_at).getTime()).toBeGreaterThanOrEqual(before);
    expect(sdk.logins).toEqual([{ username: 'auditely-user', password: 'secret-password' }]);
    expect(sdk.submit).toHaveBeenCalledTimes(1);
    expect(sdk.submit).toHaveBeenCalledWith(
      { entries: [{ inputData: ADDRESS }], quality: 'Standard' },
      expect.objectContaining({ submissionWaitTime: TIME_LIMIT_MS, pollWaitTime: TIME_LIMIT_MS }),
      expect.any(sdk.CancellationToken)
    );
  });

  it('reports why an address is undeliverable', async () => {
    sdk.submit.mockResolvedValue(validation({ classification: 'Undeliverable', status: 'MailboxDoesNotExist' }));
    expect(await verifyAddress(ADDRESS)).toMatchObject({ ok: true, check: { verdict: 'Undeliverable', status: 'MailboxDoesNotExist' } });
  });

  // Free plan only: no free daily credit, no check
  it.each([[0], [null], [0.5]])('submits nothing with %j free credits left', async (freeCredits) => {
    sdk.getBalance.mockResolvedValue(balance({ freeCredits }));
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason: `${USED_UP} (back in 9 h 07 min).` });
    expect(sdk.submit).not.toHaveBeenCalled();
  });

  it('never draws on a credit pack', async () => {
    sdk.getBalance.mockResolvedValue(balance({ creditPacks: 500, freeCredits: 0 }));
    expect((await verifyAddress(ADDRESS)).ok).toBe(false);
    expect(sdk.submit).not.toHaveBeenCalled();
  });

  it.each([
    ['1.02:03:04', `${USED_UP} (back in 26 h 03 min).`],
    ['00:45:10', `${USED_UP} (back in 0 h 45 min).`],
    ['soon', `${USED_UP}.`],
    [null, `${USED_UP}.`],
  ])('reads a reset time of %j', async (freeCreditsResetIn, reason) => {
    sdk.getBalance.mockResolvedValue(balance({ freeCredits: 0, freeCreditsResetIn }));
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason });
  });

  it('submits nothing when the balance can not be read', async () => {
    sdk.getBalance.mockRejectedValue(new sdk.AuthorizationError());
    expect(await verifyAddress(ADDRESS)).toEqual({
      ok: false,
      reason: "Not checked: the Verifalia user isn't allowed to read the credit balance.",
    });
    expect(sdk.submit).not.toHaveBeenCalled();
  });

  it('says so when the user may read the balance but not verify', async () => {
    sdk.submit.mockRejectedValue(new sdk.AuthorizationError());
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason: "Not checked: the Verifalia user isn't allowed to verify emails." });
  });

  it.each([
    [new sdk.AuthenticationError(), 'Not checked: Verifalia refused the login — check VERIFALIA_USERNAME and VERIFALIA_PASSWORD.'],
    [new sdk.RequestThrottledError(), 'Not checked: Verifalia is busy — try again in a minute.'],
    [new sdk.InsufficientCreditError(), `${USED_UP}.`],
    [new sdk.ServiceUnreachableError(), "Not checked: Verifalia couldn't be reached."],
    [new Error('socket hang up'), "Not checked: Verifalia couldn't be reached."],
  ])('turns %o into a note', async (error, reason) => {
    sdk.submit.mockRejectedValue(error);
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason });
  });

  it('reads a refused login from the balance request too', async () => {
    sdk.getBalance.mockRejectedValue(new sdk.AuthenticationError());
    expect(await verifyAddress(ADDRESS)).toMatchObject({ ok: false, reason: expect.stringContaining('refused the login') });
    expect(sdk.submit).not.toHaveBeenCalled();
  });

  it.each([
    ['still in progress', validation({ classification: 'Deliverable', status: 'Success' }, 'InProgress')],
    ['no result', null],
    ['no entries', { overview: { status: 'Completed' }, entries: [] }],
    ['no classification', validation({ status: 'Success' })],
    ['a classification it does not know', validation({ classification: 'Maybe', status: 'Success' })],
  ])('counts %s as not checked', async (_name, result) => {
    sdk.submit.mockResolvedValue(result);
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason: "Not checked: Verifalia didn't finish the check." });
  });

  it('gives up after the time limit and cancels the request', async () => {
    vi.useFakeTimers();
    sdk.submit.mockReturnValue(new Promise(() => {}));
    const pending = verifyAddress(ADDRESS);
    await vi.advanceTimersByTimeAsync(TIME_LIMIT_MS);
    expect(await pending).toEqual({ ok: false, reason: 'Not checked: Verifalia took too long.' });
    expect(sdk.submit.mock.calls[0][2].canceled).toBe(true);
  });

  it('counts the balance read against the same time limit', async () => {
    vi.useFakeTimers();
    sdk.getBalance.mockReturnValue(new Promise(() => {}));
    const pending = verifyAddress(ADDRESS);
    await vi.advanceTimersByTimeAsync(TIME_LIMIT_MS);
    expect(await pending).toEqual({ ok: false, reason: 'Not checked: Verifalia took too long.' });
    expect(sdk.submit).not.toHaveBeenCalled();
  });

  it('asks nothing of Verifalia when it is not set up', async () => {
    vi.stubEnv('VERIFALIA_USERNAME', '');
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason: "Not checked: Verifalia isn't set up." });
    expect(sdk.logins).toEqual([]);
  });

  it('keeps the password out of the log', async () => {
    sdk.submit.mockRejectedValue(Object.assign(new sdk.ServiceUnreachableError('down'), { login: 'secret-password' }));
    await verifyAddress(ADDRESS);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('secret-password');
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run app/_shared/lib/email/__tests__/verifalia.test.ts`
Expected: FAIL, the module `@/app/_shared/lib/email/verifalia` can't be found.

- [ ] **Step 5: Write the module**

Create `app/_shared/lib/email/verifalia.ts`:

```ts
// app/_shared/lib/email/verifalia.ts

// Checks one email address with Verifalia (https://verifalia.com) without
// sending to it. Free plan only: 25 credits a day, 1 per check at Standard
// quality. Nothing is submitted unless a free daily credit is left, so a paid
// credit pack is never drawn on. Server only: the password stays here.

import {
  AuthenticationError,
  AuthorizationError,
  CancellationToken,
  InsufficientCreditError,
  OperationCanceledError,
  RequestThrottledError,
  VerifaliaRestClient,
  WaitOptions,
} from 'verifalia';
import { isEmailVerdict, type EmailCheck } from '@/app/_shared/lib/email/emailCheck';

export type VerifyOutcome = { ok: true; check: EmailCheck } | { ok: false; reason: string };

/** The balance read and the verification together */
export const TIME_LIMIT_MS = 20_000;
// Verifalia's cheapest level, 1 credit per address. (The SDK's own constant for it isn't visible to TypeScript.)
const QUALITY = 'Standard';

const USED_UP = "Not checked: today's free Verifalia checks are used up";
const NOT_SET_UP = "Not checked: Verifalia isn't set up.";
const NO_BALANCE_ACCESS = "Not checked: the Verifalia user isn't allowed to read the credit balance.";
const NO_VERIFY_ACCESS = "Not checked: the Verifalia user isn't allowed to verify emails.";
const LOGIN_REFUSED = 'Not checked: Verifalia refused the login — check VERIFALIA_USERNAME and VERIFALIA_PASSWORD.';
const BUSY = 'Not checked: Verifalia is busy — try again in a minute.';
const TOO_LONG = 'Not checked: Verifalia took too long.';
const UNFINISHED = "Not checked: Verifalia didn't finish the check.";
const UNREACHABLE = "Not checked: Verifalia couldn't be reached.";

// Present, and not a template placeholder (`your_x_here`)
const isSet = (value: string | undefined): value is string => !!value && !/your_.*_here/i.test(value);

function login(): { username: string; password: string } | null {
  const { VERIFALIA_USERNAME: username, VERIFALIA_PASSWORD: password } = process.env;
  return isSet(username) && isSet(password) ? { username, password } : null;
}

export const verifaliaConfigured = (): boolean => login() !== null;

// Verifalia writes the wait as [d.]hh:mm:ss
function backIn(resetIn: string | null | undefined): string {
  const parts = resetIn?.match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2}):\d{2}/);
  if (!parts) return '';
  return ` (back in ${Number(parts[1] ?? 0) * 24 + Number(parts[2])} h ${parts[3]} min)`;
}

function noteFor(err: unknown): string {
  if (err instanceof OperationCanceledError) return TOO_LONG;
  if (err instanceof AuthenticationError) return LOGIN_REFUSED;
  if (err instanceof AuthorizationError) return NO_VERIFY_ACCESS;
  if (err instanceof RequestThrottledError) return BUSY;
  if (err instanceof InsufficientCreditError) return `${USED_UP}.`;
  return UNREACHABLE;
}

async function check(client: VerifaliaRestClient, address: string, cancel: CancellationToken): Promise<VerifyOutcome> {
  // Free plan only: no free daily credit, no check
  const balance = await client.credits.getBalance(cancel).catch((err: unknown) => {
    if (err instanceof AuthorizationError) return null;
    throw err;
  });
  if (!balance) return { ok: false, reason: NO_BALANCE_ACCESS };
  if ((balance.freeCredits ?? 0) < 1) return { ok: false, reason: `${USED_UP}${backIn(balance.freeCreditsResetIn)}.` };

  const wait = new WaitOptions();
  wait.submissionWaitTime = TIME_LIMIT_MS;
  wait.pollWaitTime = TIME_LIMIT_MS;
  const result = await client.emailValidations.submit(
    { entries: [{ inputData: address }], quality: QUALITY },
    wait,
    cancel
  );
  const entry = result?.entries?.[0];
  if (result?.overview?.status !== 'Completed' || !entry || !isEmailVerdict(entry.classification)) {
    return { ok: false, reason: UNFINISHED };
  }
  return {
    ok: true,
    check: { address, verdict: entry.classification, status: entry.status ?? '', checked_at: new Date().toISOString() },
  };
}

/** Asks Verifalia whether mail to this address can be delivered. Never throws. */
export async function verifyAddress(address: string): Promise<VerifyOutcome> {
  const credentials = login();
  if (!credentials) return { ok: false, reason: NOT_SET_UP };

  const cancel = new CancellationToken();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeLimit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      cancel.cancel();
      reject(new OperationCanceledError());
    }, TIME_LIMIT_MS);
  });
  try {
    return await Promise.race([check(new VerifaliaRestClient(credentials), address, cancel), timeLimit]);
  } catch (err) {
    const reason = noteFor(err);
    // The SDK's errors carry the whole response: only the kind and its message are logged
    console.error('[verifalia]', reason, (err as { message?: unknown } | null)?.message ?? '');
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 6: Run the test to see it pass**

Run: `npx vitest run app/_shared/lib/email/__tests__/verifalia.test.ts`
Expected: PASS.

- [ ] **Step 7: Document the settings**

In `.env.local.example`, insert before the `# ── Public demo at /demo` section:

```
# ── Email verification before sending (optional) ─────────────────────────────
# Verifalia checks a lead's address when "Send email" opens; an undeliverable
# address is never sent to. Free plan only: 25 checks a day, and Auditely checks
# nothing once they are used up (the email can still be sent, unchecked).
# https://verifalia.com → sign up → client area → add a user for Auditely
# (not the account owner's login) that may verify emails and read the credit
# balance. Leave these empty to switch the check off.
VERIFALIA_USERNAME=your_verifalia_username_here
VERIFALIA_PASSWORD=your_verifalia_password_here

```

- [ ] **Step 8: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (The SDK's `QualityLevelName_Standard` constant is not used: the package's types resolve `./email-validations/constants` to a `.js` file, so TypeScript can't see it. The literal `'Standard'` is the same value.)

---

### Task 3: The check on a lead

**Files:**
- Create: `app/_shared/lib/email/leadEmailCheck.ts`, `docs/migrations/2026-10-05-email-check.sql`
- Modify: `docs/supabase-schema.sql`
- Test: `app/_shared/lib/email/__tests__/leadEmailCheck.test.ts` (create)

**Interfaces:**
- Consumes: `freshCheck`, `EmailCheckResult` (Task 1); `verifaliaConfigured`, `verifyAddress` (Task 2).
- Produces: `checkLeadEmail(lead: { id: string; email: string; email_check?: unknown }): Promise<EmailCheckResult>`

- [ ] **Step 1: Write the failing test**

Create `app/_shared/lib/email/__tests__/leadEmailCheck.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkLeadEmail } from '@/app/_shared/lib/email/leadEmailCheck';
import { verifaliaConfigured, verifyAddress } from '@/app/_shared/lib/email/verifalia';
import type { EmailCheck } from '@/app/_shared/lib/email/emailCheck';

// Fake Supabase: every update to a business
const db = vi.hoisted(() => {
  const state = { updates: [] as { id: string; value: Record<string, unknown> }[], updateError: null as string | null };
  const from = () => ({
    update: (value: Record<string, unknown>) => ({
      eq: async (_column: string, id: string) => {
        state.updates.push({ id, value });
        return { error: state.updateError ? { message: state.updateError } : null };
      },
    }),
  });
  return { state, from };
});
vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
vi.mock('@/app/_shared/lib/email/verifalia', () => ({ verifaliaConfigured: vi.fn(), verifyAddress: vi.fn() }));

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const EMAIL = 'office@smiledental.com';
const check = (over: Partial<EmailCheck> = {}): EmailCheck => ({
  address: EMAIL,
  verdict: 'Deliverable',
  status: 'Success',
  checked_at: ago(DAY),
  ...over,
});
const lead = (email_check?: unknown) => ({ id: 'b1', email: EMAIL, email_check });
const NEW = check({ verdict: 'Risky', status: 'ServerIsCatchAll', checked_at: ago(0) });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  db.state.updates = [];
  db.state.updateError = null;
  vi.mocked(verifaliaConfigured).mockReset().mockReturnValue(true);
  vi.mocked(verifyAddress).mockReset().mockResolvedValue({ ok: true, check: NEW });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkLeadEmail', () => {
  it('uses a fresh saved result without asking Verifalia', async () => {
    const saved = check({ verdict: 'Undeliverable', status: 'MailboxDoesNotExist' });
    expect(await checkLeadEmail(lead(saved))).toEqual({ state: 'checked', check: saved });
    expect(verifyAddress).not.toHaveBeenCalled();
    expect(db.state.updates).toEqual([]);
  });

  it('reuses a result saved for the same address written differently', async () => {
    expect(await checkLeadEmail({ id: 'b1', email: ' Office@SmileDental.com', email_check: check() })).toMatchObject({ state: 'checked' });
    expect(verifyAddress).not.toHaveBeenCalled();
  });

  // An address found undeliverable stays blocked after Verifalia is switched off
  it('keeps a fresh saved result when Verifalia is not set up', async () => {
    vi.mocked(verifaliaConfigured).mockReturnValue(false);
    const saved = check({ verdict: 'Undeliverable', status: 'MailboxDoesNotExist' });
    expect(await checkLeadEmail(lead(saved))).toEqual({ state: 'checked', check: saved });
  });

  it('is off when Verifalia is not set up and nothing fresh is saved', async () => {
    vi.mocked(verifaliaConfigured).mockReturnValue(false);
    expect(await checkLeadEmail(lead())).toEqual({ state: 'off' });
    expect(await checkLeadEmail(lead(check({ checked_at: ago(40 * DAY) })))).toEqual({ state: 'off' });
    expect(verifyAddress).not.toHaveBeenCalled();
  });

  it.each([
    ['nothing saved', undefined],
    ['a result older than 30 days', check({ checked_at: ago(31 * DAY) })],
    ['an Unknown result older than an hour', check({ verdict: 'Unknown', checked_at: ago(2 * 60 * 60 * 1000) })],
    ['a result for another address', check({ address: 'owner@smiledental.com', verdict: 'Undeliverable' })],
    ['a saved value that is not a check', 'Undeliverable'],
  ])('checks the address when there is %s, and saves the result', async (_name, saved) => {
    expect(await checkLeadEmail(lead(saved))).toEqual({ state: 'checked', check: NEW });
    expect(verifyAddress).toHaveBeenCalledWith(EMAIL);
    expect(db.state.updates).toEqual([{ id: 'b1', value: { email_check: NEW } }]);
  });

  it('saves nothing when the address could not be checked', async () => {
    vi.mocked(verifyAddress).mockResolvedValue({ ok: false, reason: 'Not checked: Verifalia took too long.' });
    expect(await checkLeadEmail(lead())).toEqual({ state: 'unchecked', reason: 'Not checked: Verifalia took too long.' });
    expect(db.state.updates).toEqual([]);
  });

  it('still reports the result when the column is missing, and names the migration', async () => {
    db.state.updateError = "Could not find the 'email_check' column of 'businesses' in the schema cache";
    expect(await checkLeadEmail(lead())).toEqual({
      state: 'checked',
      check: NEW,
      warning: "Checked, but the result couldn't be saved — run docs/migrations/2026-10-05-email-check.sql in Supabase.",
    });
  });

  it("doesn't blame the migration when saving fails for another reason", async () => {
    db.state.updateError = 'upstream connect error';
    expect(await checkLeadEmail(lead())).toEqual({
      state: 'checked',
      check: NEW,
      warning: "Checked, but the result couldn't be saved, so it will be checked again next time.",
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run app/_shared/lib/email/__tests__/leadEmailCheck.test.ts`
Expected: FAIL, the module `@/app/_shared/lib/email/leadEmailCheck` can't be found.

- [ ] **Step 3: Write the module**

Create `app/_shared/lib/email/leadEmailCheck.ts`:

```ts
// app/_shared/lib/email/leadEmailCheck.ts

// The check on a lead's address before it is emailed: the result saved on the
// lead while it is fresh, otherwise a new one from Verifalia, saved for next
// time. Used by the "Send email" dialog (api/verify-email) and by the send
// itself (api/send-email), so both go by the same answer.

import { supabase } from '@/app/_shared/lib/supabase/client';
import { freshCheck, type EmailCheckResult } from '@/app/_shared/lib/email/emailCheck';
import { verifaliaConfigured, verifyAddress } from '@/app/_shared/lib/email/verifalia';

const MIGRATION = 'docs/migrations/2026-10-05-email-check.sql';

export async function checkLeadEmail(lead: { id: string; email: string; email_check?: unknown }): Promise<EmailCheckResult> {
  // A fresh result stands even with Verifalia switched off: an undeliverable address stays blocked
  const saved = freshCheck(lead.email_check, lead.email);
  if (saved) return { state: 'checked', check: saved };
  if (!verifaliaConfigured()) return { state: 'off' };

  const outcome = await verifyAddress(lead.email);
  if (!outcome.ok) return { state: 'unchecked', reason: outcome.reason };

  const { error } = await supabase.from('businesses').update({ email_check: outcome.check }).eq('id', lead.id);
  if (!error) return { state: 'checked', check: outcome.check };

  console.error('[email-check] could not save the result:', error.message);
  // Only a missing column is fixed by the migration
  const warning = /email_check/.test(error.message)
    ? `Checked, but the result couldn't be saved — run ${MIGRATION} in Supabase.`
    : "Checked, but the result couldn't be saved, so it will be checked again next time.";
  return { state: 'checked', check: outcome.check, warning };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run app/_shared/lib/email/__tests__/leadEmailCheck.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the migration**

Create `docs/migrations/2026-10-05-email-check.sql`:

```sql
-- 2026-10-05 email check migration for EXISTING Auditely databases.
-- Supabase: Dashboard → SQL Editor → New query. Safe to re-run.

-- What Verifalia said about the lead's email address before it was emailed:
-- { address, verdict, status, checked_at }. Reused while fresh, so reopening
-- "Send email" doesn't spend another of the day's free checks.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email_check JSONB;
```

In `docs/supabase-schema.sql`, in `CREATE TABLE IF NOT EXISTS businesses`, after the `emailed_at          TIMESTAMPTZ,` line:

```sql
  -- What Verifalia said about the email address: { address, verdict, status, checked_at }
  email_check         JSONB,
```

- [ ] **Step 6: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

---

### Task 4: The dialog's route

**Files:**
- Create: `app/api/verify-email/route.ts`
- Modify: `app/_shared/lib/config/routes.ts`
- Test: `app/api/verify-email/__tests__/route.test.ts` (create)

**Interfaces:**
- Consumes: `checkLeadEmail` (Task 3).
- Produces: `API_ROUTES.VERIFY_EMAIL = '/api/verify-email'`; `POST { business_id }` answering an `EmailCheckResult` with status 200, or `{ error }` with 400 / 404.

- [ ] **Step 1: Add the route's path**

In `app/_shared/lib/config/routes.ts`, in `API_ROUTES`, after `SEND_EMAIL`:

```ts
  VERIFY_EMAIL: '/api/verify-email',
```

It is private without further change: `routes.test.ts` already asserts every `API_ROUTES` entry except `AUTH` is protected.

- [ ] **Step 2: Write the failing test**

Create `app/api/verify-email/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, maxDuration } from '@/app/api/verify-email/route';
import { checkLeadEmail } from '@/app/_shared/lib/email/leadEmailCheck';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

// Fake Supabase: the business, and which columns were asked for
const db = vi.hoisted(() => {
  const state = { business: null as unknown, selected: [] as string[] };
  const from = () => {
    const chain = {
      select: (columns: string) => {
        state.selected.push(columns);
        return chain;
      },
      eq: () => chain,
      single: async () => ({ data: state.business, error: null }),
    };
    return chain;
  };
  return { state, from };
});
vi.mock('@/app/_shared/lib/supabase/client', () => ({ supabase: { from: db.from } }));
// The check itself has its own tests
vi.mock('@/app/_shared/lib/email/leadEmailCheck', () => ({ checkLeadEmail: vi.fn() }));

const SAVED = { address: 'office@smiledental.com', verdict: 'Deliverable', status: 'Success', checked_at: '2026-10-04T12:00:00Z' };
const post = async (body: unknown) => {
  const res = await POST(new NextRequest(`https://auditely.app${API_ROUTES.VERIFY_EMAIL}`, { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

beforeEach(() => {
  db.state.business = { id: 'b1', name: 'Smile Dental', email: 'office@smiledental.com', email_check: SAVED };
  db.state.selected = [];
  vi.mocked(checkLeadEmail).mockReset().mockResolvedValue({ state: 'off' });
});

describe('POST /api/verify-email', () => {
  it("is given longer than Verifalia's 20 seconds", () => {
    expect(maxDuration).toBe(30);
  });

  it.each([[{}], [{ business_id: 7 }], [null], ['not an object']])('refuses %j', async (body) => {
    expect(await post(body)).toEqual({ status: 400, json: { error: 'business_id is required' } });
    expect(checkLeadEmail).not.toHaveBeenCalled();
  });

  it('needs a business with an email address', async () => {
    db.state.business = null;
    expect(await post({ business_id: 'b1' })).toEqual({ status: 404, json: { error: 'Business not found' } });
    db.state.business = { id: 'b1', email: null };
    expect(await post({ business_id: 'b1' })).toEqual({ status: 400, json: { error: 'This business has no email address.' } });
    expect(checkLeadEmail).not.toHaveBeenCalled();
  });

  it('checks the stored address, never one from the request', async () => {
    await post({ business_id: 'b1', email: 'someone@else.com', email_check: { verdict: 'Deliverable' } });
    expect(checkLeadEmail).toHaveBeenCalledWith({ id: 'b1', email: 'office@smiledental.com', email_check: SAVED });
  });

  // Naming the new column would fail before the migration is run
  it('reads the business without naming the new column', async () => {
    await post({ business_id: 'b1' });
    expect(db.state.selected).toEqual(['*']);
  });

  it.each([
    [{ state: 'off' } as const],
    [{ state: 'checked', check: SAVED, warning: "Checked, but the result couldn't be saved." } as const],
    [{ state: 'unchecked', reason: 'Not checked: Verifalia took too long.' } as const],
  ])('answers %j', async (result) => {
    vi.mocked(checkLeadEmail).mockResolvedValue(result as Awaited<ReturnType<typeof checkLeadEmail>>);
    expect(await post({ business_id: 'b1' })).toEqual({ status: 200, json: result });
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run app/api/verify-email/__tests__/route.test.ts`
Expected: FAIL, the module `@/app/api/verify-email/route` can't be found.

- [ ] **Step 4: Write the route**

Create `app/api/verify-email/route.ts`:

```ts
// app/api/verify-email/route.ts

// The check the "Send email" dialog asks for when it opens: can mail to this
// lead's address be delivered? Answers from the result saved on the lead while
// it is fresh, otherwise asks Verifalia (email/leadEmailCheck.ts).

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { checkLeadEmail } from '@/app/_shared/lib/email/leadEmailCheck';

// Verifalia gets 20 seconds (email/verifalia.ts); the rest is the database
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Anything that isn't a JSON object (a bare null, a string) is treated as empty
  const parsed: unknown = await request.json().catch(() => null);
  const input = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const businessId: string = typeof input.business_id === 'string' ? input.business_id : '';
  if (!businessId) return NextResponse.json({ error: 'business_id is required' }, { status: 400 });

  // The address always comes from the stored business, never from the request.
  // `*` rather than the column's name: it must also work before the migration is run.
  const { data } = await supabase.from('businesses').select('*').eq('id', businessId).single();
  if (!data) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  if (!data.email) return NextResponse.json({ error: 'This business has no email address.' }, { status: 400 });

  return NextResponse.json(await checkLeadEmail({ id: data.id, email: data.email, email_check: data.email_check }));
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run app/api/verify-email app/_shared/lib/config`
Expected: PASS (the route's tests, and `routes.test.ts` still finding every API route private).

- [ ] **Step 6: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

---

### Task 5: The send refuses an undeliverable address

**Files:**
- Modify: `app/api/send-email/route.ts`
- Test: `app/api/send-email/__tests__/route.test.ts` (modify)

**Interfaces:**
- Consumes: `checkLeadEmail` (Task 3); `blocksSending`, `checkReason` (Task 1).
- Produces: `POST /api/send-email` answers 400 `{ error: 'Not sent: {reason}', email_check }` for an undeliverable address.

- [ ] **Step 1: Add the failing tests**

In `app/api/send-email/__tests__/route.test.ts`:

Add to the imports:

```ts
import { checkLeadEmail } from '@/app/_shared/lib/email/leadEmailCheck';
```

Add after the mailer's `vi.mock` line:

```ts
// The address check (Verifalia) has its own tests
vi.mock('@/app/_shared/lib/email/leadEmailCheck', () => ({ checkLeadEmail: vi.fn() }));
```

Add after the `draft` constant:

```ts
const checked = (verdict: string, status: string) => ({
  state: 'checked' as const,
  check: { address: 'office@smiledental.com', verdict, status, checked_at: '2026-10-05T10:00:00Z' },
});
```

Add to `beforeEach`, after the `emailSetupProblem` line:

```ts
  vi.mocked(checkLeadEmail).mockReset().mockResolvedValue({ state: 'off' });
```

Add these tests at the end of `describe('POST /api/send-email', …)`:

```ts
  it('never sends to an address Verifalia calls undeliverable, and says why', async () => {
    const undeliverable = checked('Undeliverable', 'MailboxDoesNotExist');
    vi.mocked(checkLeadEmail).mockResolvedValue(undeliverable as Awaited<ReturnType<typeof checkLeadEmail>>);
    expect(await post(draft)).toEqual({
      status: 400,
      json: { error: "Not sent: This mailbox doesn't exist.", email_check: undeliverable.check },
    });
    expect(renderAuditPdf).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.state.updates).toEqual([]);
  });

  it('checks the stored address', async () => {
    db.state.business = businessRow({ email_check: { verdict: 'Deliverable' } });
    await post({ ...draft, email: 'someone@else.com' });
    expect(checkLeadEmail).toHaveBeenCalledWith({ id: 'b1', email: 'office@smiledental.com', email_check: { verdict: 'Deliverable' } });
  });

  it.each([
    ['deliverable', checked('Deliverable', 'Success')],
    ['risky', checked('Risky', 'ServerIsCatchAll')],
    ['unknown', checked('Unknown', 'SmtpConnectionTimeout')],
    ['not checked', { state: 'unchecked' as const, reason: "Not checked: today's free Verifalia checks are used up." }],
    ['Verifalia off', { state: 'off' as const }],
  ])('sends when the address is %s', async (_name, result) => {
    vi.mocked(checkLeadEmail).mockResolvedValue(result as Awaited<ReturnType<typeof checkLeadEmail>>);
    expect((await post(draft)).status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('spends no check on a preview, or when the email could not be sent anyway', async () => {
    await post({ ...draft, preview: true });
    vi.mocked(emailSetupProblem).mockReturnValue("Email sending isn't set up.");
    await post(draft);
    db.state.business = businessRow({ audits: null });
    vi.mocked(emailSetupProblem).mockReturnValue(null);
    await post(draft);
    expect(checkLeadEmail).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run app/api/send-email`
Expected: FAIL: the undeliverable test gets status 200, and `checkLeadEmail` is never called.

- [ ] **Step 3: Refuse in the route**

In `app/api/send-email/route.ts`:

Add to the header comment, after the line about the send date:

```ts
// An address Verifalia calls undeliverable is refused (email/leadEmailCheck.ts).
```

Add the imports (keep the list's order by path):

```ts
import { blocksSending, checkReason } from '@/app/_shared/lib/email/emailCheck';
import { checkLeadEmail } from '@/app/_shared/lib/email/leadEmailCheck';
```

Insert between the `if (preview) { … }` block and `const report = await renderAuditPdf(business.audit.id);`:

```ts
  // The dialog checked the address when it opened, so this normally reads the saved result
  const checked = await checkLeadEmail({ id: business.id, email: business.email, email_check: business.email_check });
  if (checked.state === 'checked' && blocksSending(checked.check)) {
    return NextResponse.json({ error: `Not sent: ${checkReason(checked.check)}`, email_check: checked.check }, { status: 400 });
  }

```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run app/api/send-email`
Expected: PASS, including every test that was there before.

- [ ] **Step 5: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

---

### Task 6: The dialog

**Files:**
- Create: `app/_shared/components/auditely/emailCheckNote/emailCheckNote.tsx`
- Modify: `app/_shared/lib/hooks/useEmailSend.ts`, `app/_shared/components/auditely/sendEmailModal/sendEmailModal.tsx`, `app/_shared/components/auditely/reportActions/reportActions.tsx`
- Test: `app/_shared/lib/hooks/__tests__/emailCheckRequest.test.ts` (create), `app/_shared/components/auditely/__tests__/emailCheck.test.ts` (create)

**Interfaces:**
- Consumes: `API_ROUTES.VERIFY_EMAIL` (Task 4); `asEmailCheck`, `blocksSending`, `checkFor`, `checkNotices`, `checkReason`, `freshCheck`, `EmailCheck`, `EmailCheckResult`, `CheckTone` (Task 1).
- Produces:
  - `requestEmailCheck(businessId: string): Promise<EmailCheckResult>` (never rejects)
  - `useEmailSend(...)` additionally returns `check: EmailCheck | null`, `checking: boolean`, `checkNote: string | null`, `verify: () => Promise<void>`
  - `<EmailCheckNote checking check note />`
  - `SendEmailModal` props `check: EmailCheck | null`, `checking: boolean`, `checkNote: string | null`

- [ ] **Step 1: Write the failing request test**

Create `app/_shared/lib/hooks/__tests__/emailCheckRequest.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestEmailCheck } from '@/app/_shared/lib/hooks/useEmailSend';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

const CHECK = { address: 'office@smiledental.com', verdict: 'Undeliverable', status: 'MailboxDoesNotExist', checked_at: '2026-10-05T10:00:00Z' };
const NOT_RUN = { state: 'unchecked', reason: "Not checked: the check couldn't be run." };
const fetchMock = vi.fn();
const answer = (body: unknown, status = 200) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestEmailCheck', () => {
  it("asks the server about the business's address", async () => {
    answer({ state: 'checked', check: CHECK });
    expect(await requestEmailCheck('b1')).toEqual({ state: 'checked', check: CHECK });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(API_ROUTES.VERIFY_EMAIL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ business_id: 'b1' });
    // Bounded, so the dialog can't wait forever
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('passes on a warning, a reason, and "off"', async () => {
    answer({ state: 'checked', check: CHECK, warning: "Checked, but the result couldn't be saved." });
    expect(await requestEmailCheck('b1')).toEqual({ state: 'checked', check: CHECK, warning: "Checked, but the result couldn't be saved." });
    answer({ state: 'unchecked', reason: 'Not checked: Verifalia took too long.' });
    expect(await requestEmailCheck('b1')).toEqual({ state: 'unchecked', reason: 'Not checked: Verifalia took too long.' });
    answer({ state: 'off' });
    expect(await requestEmailCheck('b1')).toEqual({ state: 'off' });
  });

  // Whatever goes wrong reads as "not checked": the dialog is never stuck, and never blocked by a failure
  it.each([
    ['an error answer', () => answer({ error: 'Business not found' }, 404)],
    ['a server crash', () => fetchMock.mockResolvedValue(new Response('<html>500</html>', { status: 500 }))],
    ['an answer that is not JSON', () => fetchMock.mockResolvedValue(new Response('ok', { status: 200 }))],
    ['a null answer', () => answer(null)],
    ['a state it does not know', () => answer({ state: 'maybe' })],
    ['a check that is not a check', () => answer({ state: 'checked', check: { verdict: 'Undeliverable' } })],
    ['no reason', () => answer({ state: 'unchecked' })],
    ['a lost connection', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
    ['a timeout', () => fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'))],
  ])('counts %s as not checked', async (_name, arrange) => {
    arrange();
    expect(await requestEmailCheck('b1')).toEqual(NOT_RUN);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run app/_shared/lib/hooks/__tests__/emailCheckRequest.test.ts`
Expected: FAIL, `requestEmailCheck` is not exported.

- [ ] **Step 3: Add the check to the hook**

Replace `app/_shared/lib/hooks/useEmailSend.ts` with:

```ts
// app/_shared/lib/hooks/useEmailSend.ts

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { asEmailCheck, checkFor, freshCheck, type EmailCheck, type EmailCheckResult } from '@/app/_shared/lib/email/emailCheck';
import type { OutreachDraft } from '@/app/_shared/lib/email/outreach';
import type { Business, BusinessUpdate } from '@/app/_shared/lib/types/auditely';

const CHECK_NOT_RUN: EmailCheckResult = { state: 'unchecked', reason: "Not checked: the check couldn't be run." };

/**
 * Asks the server whether the lead's address is deliverable. Whatever goes
 * wrong reads as "not checked", never as a block, and it always answers.
 */
export async function requestEmailCheck(businessId: string): Promise<EmailCheckResult> {
  try {
    const res = await fetch(API_ROUTES.VERIFY_EMAIL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: businessId }),
      // The route gives up after 30 seconds; the dialog doesn't wait much longer
      signal: AbortSignal.timeout(35_000),
    });
    const data: unknown = await res.json();
    if (!res.ok || !data || typeof data !== 'object') return CHECK_NOT_RUN;
    const { state, check, warning, reason } = data as Record<string, unknown>;
    if (state === 'off') return { state: 'off' };
    if (state === 'unchecked' && typeof reason === 'string') return { state: 'unchecked', reason };
    const valid = state === 'checked' ? asEmailCheck(check) : null;
    if (!valid) return CHECK_NOT_RUN;
    return { state: 'checked', check: valid, ...(typeof warning === 'string' ? { warning } : {}) };
  } catch {
    return CHECK_NOT_RUN;
  }
}

/**
 * "Send email" for one lead: when it was last emailed, the send in progress,
 * and what Verifalia said about its address. Used by the business card (it
 * stays mounted when collapsed); each send and check also reaches the list via
 * `onUpdate`, so sorting and filtering keep it.
 */
export function useEmailSend(business: Business, onUpdate?: (businessId: string, update: BusinessUpdate) => void) {
  const [sentAt, setSentAt] = useState<string | null>(business.emailed_at ?? null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The email went out but something after it didn't (the date wasn't saved)
  const [warning, setWarning] = useState<string | null>(null);
  // The address check: this card's own, else the one saved on the lead (of any age)
  const [checked, setChecked] = useState<EmailCheck | null>(null);
  const check = checked ?? checkFor(business.email_check, business.email);
  const [checking, setChecking] = useState(false);
  // Why the address wasn't checked, or that the result couldn't be saved
  const [checkNote, setCheckNote] = useState<string | null>(null);
  // A second click while a check runs must not spend a second credit
  const checkRunning = useRef(false);

  // A card that unmounted mid-send gets the result back through the list's prop
  useEffect(() => {
    if (business.emailed_at) setSentAt(business.emailed_at);
  }, [business.emailed_at]);

  /** Checks the address when the dialog opens; a fresh result is reused as it is */
  const verify = useCallback(async () => {
    if (checkRunning.current || freshCheck(check, business.email)) return;
    checkRunning.current = true;
    setChecking(true);
    setCheckNote(null);
    const result = await requestEmailCheck(business.id);
    if (result.state === 'checked') {
      setChecked(result.check);
      setCheckNote(result.warning ?? null);
      onUpdate?.(business.id, { email_check: result.check });
    } else if (result.state === 'unchecked') {
      setCheckNote(result.reason);
    }
    checkRunning.current = false;
    setChecking(false);
  }, [business.id, business.email, check, onUpdate]);

  /** Sends the email as edited; true once it has gone */
  const send = useCallback(
    async (draft: OutreachDraft): Promise<boolean> => {
      setSending(true);
      setError(null);
      setWarning(null);
      try {
        const res = await fetch(API_ROUTES.SEND_EMAIL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ business_id: business.id, subject: draft.subject, body: draft.body }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // The server checked the address again and it is undeliverable after all
          const refused = asEmailCheck(data.email_check);
          if (refused) {
            setChecked(refused);
            onUpdate?.(business.id, { email_check: refused });
          }
          throw new Error(data.error || "Couldn't send the email");
        }
        setSentAt(data.emailed_at);
        setWarning(data.warning ?? null);
        onUpdate?.(business.id, { emailed_at: data.emailed_at });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send the email");
        return false;
      } finally {
        setSending(false);
      }
    },
    [business.id, onUpdate]
  );

  /** The email as the lead will see it (HTML); nothing is sent */
  const preview = useCallback(
    async (draft: OutreachDraft): Promise<string> => {
      const res = await fetch(API_ROUTES.SEND_EMAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id, subject: draft.subject, body: draft.body, preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.html !== 'string') throw new Error(data.error || "Couldn't build the preview");
      return data.html;
    },
    [business.id]
  );

  const clearError = useCallback(() => setError(null), []);

  return { sentAt, sending, error, warning, send, preview, clearError, check, checking, checkNote, verify };
}
```

- [ ] **Step 4: Run the request test to see it pass**

Run: `npx vitest run app/_shared/lib/hooks/__tests__/emailCheckRequest.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing dialog test**

Create `app/_shared/components/auditely/__tests__/emailCheck.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SendEmailModal } from '@/app/_shared/components/auditely/sendEmailModal/sendEmailModal';
import type { EmailCheck } from '@/app/_shared/lib/email/emailCheck';

const check = (over: Partial<EmailCheck> = {}): EmailCheck => ({
  address: 'office@smiledental.com',
  verdict: 'Deliverable',
  status: 'Success',
  checked_at: '2026-10-03T12:00:00Z',
  ...over,
});

type DialogState = { check?: EmailCheck | null; checking?: boolean; checkNote?: string | null; error?: string | null };
const dialog = (state: DialogState = {}) =>
  renderToStaticMarkup(
    createElement(SendEmailModal, {
      businessName: 'Smile Dental',
      to: 'office@smiledental.com',
      draft: { subject: 'Quick note about your site', body: 'Hi there,\nYour site is slow.' },
      sentAt: null,
      sending: false,
      error: null,
      check: null,
      checking: false,
      checkNote: null,
      onSend: () => {},
      onPreview: async () => '',
      onClose: () => {},
      ...state,
    })
  );
// A button's opening tag and content, found by its label
const button = (html: string, label: string) => html.split('<button').find((part) => part.includes(`${label}</button>`)) ?? '';
const sendDisabled = (html: string) => button(html, 'Send email').includes('disabled=""');

describe('SendEmailModal and the address check', () => {
  it('works as before when nothing was checked (Verifalia off)', () => {
    const html = dialog();
    expect(button(html, 'Send email')).not.toBe('');
    expect(sendDisabled(html)).toBe(false);
    expect(html).not.toContain('Verified');
    expect(html).not.toContain('Checking');
  });

  it('holds the send while the address is being checked', () => {
    const html = dialog({ checking: true, check: check({ verdict: 'Undeliverable' }) });
    expect(html).toContain('Checking this address…');
    expect(html).not.toContain('Not deliverable');
    expect(sendDisabled(html)).toBe(true);
    // Looking at the email sends nothing
    expect(button(html, 'Preview')).not.toContain('disabled=""');
  });

  it('says a deliverable address is verified', () => {
    const html = dialog({ check: check() });
    expect(html).toContain('Verified');
    expect(sendDisabled(html)).toBe(false);
  });

  it('will not send to an undeliverable address, and says why', () => {
    const html = dialog({ check: check({ verdict: 'Undeliverable', status: 'MailboxDoesNotExist' }) });
    expect(html).toMatch(/role="alert"[^>]*>Not deliverable: This mailbox doesn(&#x27;|')t exist\. This email can(&#x27;|')t be sent\./);
    expect(sendDisabled(html)).toBe(true);
    expect(button(html, 'Send email')).toMatch(/title="This mailbox doesn(&#x27;|')t exist\./);
    expect(button(html, 'Preview')).not.toContain('disabled=""');
  });

  it.each([
    ['Risky', 'ServerIsCatchAll', 'Risky: This domain accepts every address'],
    ['Unknown', 'SmtpConnectionTimeout', /Couldn(&#x27;|')t be confirmed: The mail server couldn/],
  ] as const)('warns about a %s address and still sends', (verdict, status, text) => {
    const html = dialog({ check: check({ verdict, status }) });
    if (typeof text === 'string') expect(html).toContain(text);
    else expect(html).toMatch(text);
    expect(sendDisabled(html)).toBe(false);
  });

  it('says when the address could not be checked, and still sends', () => {
    const html = dialog({ checkNote: 'Not checked: Verifalia took too long.' });
    expect(html).toContain('Not checked: Verifalia took too long.');
    expect(sendDisabled(html)).toBe(false);
  });

  it('shows the verdict and a warning about saving it together', () => {
    const html = dialog({ check: check(), checkNote: 'Checked, but the result was not saved.' });
    expect(html).toContain('Verified');
    expect(html).toContain('Checked, but the result was not saved.');
  });

  // The status code is text from another service
  it('escapes a status code it has never seen', () => {
    const html = dialog({ check: check({ verdict: 'Undeliverable', status: '<img src=x onerror=alert(1)>' }) });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it("still shows the server's refusal", () => {
    const html = dialog({ error: "Not sent: This mailbox doesn't exist." });
    expect(html).toMatch(/role="alert"[^>]*>Not sent: This mailbox doesn/);
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run app/_shared/components/auditely/__tests__/emailCheck.test.ts`
Expected: FAIL: no "Checking this address…", Send not disabled.

- [ ] **Step 7: Write the note**

Create `app/_shared/components/auditely/emailCheckNote/emailCheckNote.tsx`:

```tsx
// app/_shared/components/auditely/emailCheckNote/emailCheckNote.tsx

import { CheckIcon } from '@/app/_shared/components/ui/icons/icons';
import { checkNotices, type CheckTone, type EmailCheck } from '@/app/_shared/lib/email/emailCheck';

interface EmailCheckNoteProps {
  checking: boolean;
  /** What Verifalia said about the address, if it was checked */
  check: EmailCheck | null;
  /** Why it wasn't checked, or that the result couldn't be saved */
  note: string | null;
}

const TONES: Record<CheckTone, string> = {
  busy: 'text-[var(--color-text-tertiary)]',
  good: 'font-medium text-emerald-700 dark:text-emerald-400',
  warn: 'rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400',
  bad: 'rounded-lg bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-400',
};

/** The "Send email" dialog's lines about the address the email is going to */
export function EmailCheckNote({ checking, check, note }: EmailCheckNoteProps) {
  const notices = checkNotices({ checking, check, note });
  if (notices.length === 0) return null;

  return (
    <div className="space-y-2">
      {notices.map(({ tone, text }) => (
        <p key={text} role={tone === 'bad' ? 'alert' : 'status'} className={`text-sm ${TONES[tone]}`}>
          {tone === 'good' && <CheckIcon size={13} strokeWidth={3} className="mr-1 inline align-[-1px]" />}
          {text}
        </p>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Show it in the dialog**

In `app/_shared/components/auditely/sendEmailModal/sendEmailModal.tsx`:

Add the imports (after the `Button` import, and after the `outreach` import):

```ts
import { EmailCheckNote } from '@/app/_shared/components/auditely/emailCheckNote/emailCheckNote';
```

```ts
import { blocksSending, checkReason, type EmailCheck } from '@/app/_shared/lib/email/emailCheck';
```

Add to `SendEmailModalProps`, after `error`:

```ts
  /** What Verifalia said about the address, when the check is fresh */
  check: EmailCheck | null;
  checking: boolean;
  /** Why the address wasn't checked, or that the result couldn't be saved */
  checkNote: string | null;
```

Destructure them in the component's signature:

```ts
export function SendEmailModal({ businessName, to, draft, sentAt, sending, error, check, checking, checkNote, onSend, onPreview, onClose }: SendEmailModalProps) {
```

After `const problem = outreachProblem({ subject, body });`:

```ts
  // An address Verifalia calls undeliverable is never written to
  const blocked = check && blocksSending(check) ? `${checkReason(check)} This email can't be sent.` : null;
```

After the "To" paragraph (`</p>` that closes `To <span …>{to}</span>`):

```tsx
          <EmailCheckNote checking={checking} check={check} note={checkNote} />
```

On the Send button, replace `disabled={!!problem}` and `title={problem ?? undefined}`:

```tsx
          disabled={!!problem || checking || !!blocked}
          title={blocked ?? problem ?? undefined}
```

- [ ] **Step 9: Start the check when the dialog opens**

In `app/_shared/components/auditely/reportActions/reportActions.tsx`:

Add the import (after the `leadDrafts` import):

```ts
import { freshCheck } from '@/app/_shared/lib/email/emailCheck';
```

Replace `openComposer`:

```ts
  const openComposer = () => {
    if (demo) return demo.restrict('sendEmail');
    mail.clearError();
    setComposing(true);
    // Is the address deliverable? A fresh saved answer is reused, so this often asks nothing
    void mail.verify();
  };
```

Add to the `<SendEmailModal … />` props, after `error={mail.error}`:

```tsx
          // A result too old to go by is not shown: the server would check again
          check={freshCheck(mail.check, email)}
          checking={mail.checking}
          checkNote={mail.checkNote}
```

- [ ] **Step 10: Run the tests to see them pass**

Run: `npx vitest run app/_shared/components/auditely/__tests__ app/_shared/lib/hooks`
Expected: PASS, including `removeSites.test.ts` and `demoVideo.test.ts`.

- [ ] **Step 11: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. `sendEmailModal.tsx` stays under 300 lines.

---

### Task 7: The mark on the card

**Files:**
- Modify: `app/_shared/components/auditely/businessEmail/businessEmail.tsx`, `app/_shared/components/auditely/businessCard/businessCard.tsx`
- Test: `app/_shared/components/auditely/__tests__/emailCheck.test.ts` (modify)

**Interfaces:**
- Consumes: `checkFor`, `checkMark`, `CheckMark`, `EmailCheck` (Task 1); `mail.check` (Task 6).
- Produces: `BusinessEmail` prop `check?: EmailCheck | null`.

- [ ] **Step 1: Add the failing card tests**

In `app/_shared/components/auditely/__tests__/emailCheck.test.ts`, add to the imports:

```ts
import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import type { Business } from '@/app/_shared/lib/types/auditely';
```

And add at the end of the file:

```ts
describe('BusinessCard and the address check', () => {
  const lead = (email_check: unknown, email: string | null = 'office@smiledental.com'): Business => ({
    id: 'b1',
    search_id: 's1',
    name: 'Smile Dental',
    address: '1 Main St',
    website: 'https://smiledental.com',
    phone: null,
    email,
    contact_page: null,
    socials: {},
    contacts_checked_at: null,
    email_lookup_at: null,
    rating: null,
    review_count: null,
    created_at: '2026-10-01T00:00:00Z',
    // Whatever the column holds, as it arrives from the database
    email_check: email_check as Business['email_check'],
  });
  const card = (email_check: unknown, email?: string | null) =>
    renderToStaticMarkup(createElement(BusinessCard, { business: lead(email_check, email) }));
  // The mark's opening tag and label
  const mark = (html: string, label: string) => html.match(new RegExp(`<span title="[^"]*"[^>]*>(?:<svg.*?</svg>)?${label}</span>`))?.[0] ?? '';

  it('marks an undeliverable address and gives the reason', () => {
    const html = card(check({ verdict: 'Undeliverable', status: 'MailboxDoesNotExist' }));
    expect(mark(html, 'Undeliverable')).toMatch(/title="This mailbox doesn(&#x27;|')t exist\. Checked Oct 3"/);
  });

  it('marks a verified and a risky address', () => {
    expect(mark(card(check()), 'Verified')).toContain('title="Checked Oct 3"');
    expect(mark(card(check({ verdict: 'Risky', status: 'ServerIsCatchAll' })), 'Risky')).not.toBe('');
  });

  it('keeps showing a result that is too old to send by', () => {
    expect(mark(card(check({ verdict: 'Undeliverable', status: 'MailboxDoesNotExist', checked_at: '2026-01-03T12:00:00Z' })), 'Undeliverable')).not.toBe('');
  });

  it.each([
    ['an address that could not be confirmed', check({ verdict: 'Unknown', status: 'SmtpConnectionTimeout' })],
    ['an unchecked lead', null],
    ['a result for another address', check({ address: 'owner@smiledental.com', verdict: 'Undeliverable' })],
    ['a saved value that is not a check', 'Undeliverable'],
    ['a half-written check', { verdict: 'Undeliverable' }],
  ])('leaves %s unmarked', (_name, saved) => {
    const html = card(saved);
    expect(html).toContain('office@smiledental.com');
    for (const label of ['Verified', 'Undeliverable', 'Risky']) expect(html).not.toContain(`>${label}</span>`);
  });

  it('has nothing to mark on a lead without an email', () => {
    expect(card(check({ verdict: 'Undeliverable' }), null)).not.toContain('Undeliverable');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run app/_shared/components/auditely/__tests__/emailCheck.test.ts`
Expected: FAIL: the three marking tests find no mark; the "unmarked" tests already pass.

- [ ] **Step 3: Show the mark beside the email**

In `app/_shared/components/auditely/businessEmail/businessEmail.tsx`:

Add the import (after the `API_ROUTES` import):

```ts
import { checkMark, type CheckMark, type EmailCheck } from '@/app/_shared/lib/email/emailCheck';
```

Add to `BusinessEmailProps`, after `businessId`:

```ts
  /** What Verifalia said about this address, once "Send email" has checked it */
  check?: EmailCheck | null;
```

Above the component, after the props interface:

```ts
const MARK_TONES: Record<CheckMark['tone'], string> = {
  good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'bg-red-500/10 text-red-700 dark:text-red-400',
};
```

Change the signature and add the mark below the `useState` lines:

```ts
export function BusinessEmail({ email, website, businessId, check, onFound }: BusinessEmailProps) {
```

```ts
  const mark = check ? checkMark(check) : null;
```

In the `if (email)` branch (the one with the copy button, not the demo's), after the copy `</button>`:

```tsx
          {/* The word, not just a tick: the copy button beside it turns into a tick too */}
          {mark && (
            <span title={mark.title} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${MARK_TONES[mark.tone]}`}>
              {mark.tone === 'good' && <CheckIcon size={11} strokeWidth={3} />}
              {mark.label}
            </span>
          )}
```

Also update the component's doc comment, adding one sentence at its end:

```ts
 * Beside a known email: what Verifalia said about it, once it was checked.
```

- [ ] **Step 4: Pass the check from the card**

In `app/_shared/components/auditely/businessCard/businessCard.tsx`:

Add the import (after the `useEmailSend` import):

```ts
import { checkFor } from '@/app/_shared/lib/email/emailCheck';
```

Replace the `<BusinessEmail … />` line:

```tsx
              <BusinessEmail email={email} website={business.website} businessId={business.id} check={checkFor(mail.check, email)} onFound={saveEmail} />
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run app/_shared/components/auditely/__tests__`
Expected: PASS.

- [ ] **Step 6: Checkpoint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. `businessCard.tsx` stays under 300 lines.

---

### Task 8: Build, the real service, wrap-up

**Files:**
- Modify: `docs/superpowers/specs/2026-10-05-email-verification-design.md` (status line)

- [ ] **Step 1: Everything, once**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: every test file passes (68 from before plus 6 new: 74), no type or lint errors.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: the build succeeds and lists `/api/verify-email` among the routes.

- [ ] **Step 3: The server loads the Node build**

Run:

```bash
grep -l 'verifalia' .next/server/app/api/verify-email/route.js .next/server/chunks/*.js 2>/dev/null | head -3
ls .next/standalone/node_modules/verifalia/node/cjs/index.js
grep -c 'browser/esm' .next/server/app/api/verify-email/route.js
```

Expected: the route (or one of its chunks) refers to `verifalia` as an external module; the Node build is traced into the standalone output; no reference to the browser build (`0`).

- [ ] **Step 4: One real request to Verifalia**

No Verifalia account is set up yet, so this checks the path up to the login, with a login that can't exist:

```bash
node -e "
const v = require('verifalia');
new v.VerifaliaRestClient({ username: 'auditely-setup-check', password: 'not-a-real-password' })
  .credits.getBalance()
  .then((b) => console.log('unexpected balance', b), (e) => console.log(e.constructor.name));
"
```

Expected: `AuthenticationError`. That shows the Node build loads, reaches Verifalia, and its refusal arrives as the error class `noteFor` reads.

- [ ] **Step 5: Mark the spec as built**

In `docs/superpowers/specs/2026-10-05-email-verification-design.md`, replace the Status line:

```md
**Status:** Built (2026-10-05). Not yet run against a real Verifalia account: that needs the user's `VERIFALIA_USERNAME` and `VERIFALIA_PASSWORD`, and the migration.
```

- [ ] **Step 6: Commit to `main`**

The user asked for the finished work on `main`. Check `git status` first: commit only this work's files (`CLAUDE.md` was already modified before it started; leave it out). Two commits, in the repository's style:

```bash
git add docs/superpowers/specs/2026-10-05-email-verification-design.md docs/superpowers/plans/2026-10-05-email-verification.md
git commit -m "docs: spec and plan for checking a lead's address before emailing it"
git add package.json package-lock.json next.config.ts .env.local.example docs/migrations/2026-10-05-email-check.sql docs/supabase-schema.sql app
git commit -m "feat: check a lead's address with Verifalia before emailing it"
```

Do not push.

- [ ] **Step 7: Hand back**

Tell the user what was built and what only they can do: create the Verifalia account and user, add the two variables locally and in Vercel, run `docs/migrations/2026-10-05-email-check.sql` in Supabase, then open Send email on one lead to see a real verdict.
