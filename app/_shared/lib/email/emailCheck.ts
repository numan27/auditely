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
