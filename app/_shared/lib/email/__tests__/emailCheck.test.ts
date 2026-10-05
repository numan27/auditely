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
