import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import { SendEmailModal } from '@/app/_shared/components/auditely/sendEmailModal/sendEmailModal';
import type { EmailCheck } from '@/app/_shared/lib/email/emailCheck';
import type { Business } from '@/app/_shared/lib/types/auditely';

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
  it('describes the email in the account’s own branding, never as DevArtVentures', () => {
    const html = dialog();
    expect(html).toContain('Sent with your branding: your message, a snapshot of the audit and a “Book your free call” button, with the PDF report attached.');
    expect(html.toLowerCase()).not.toContain('devart');
  });

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
