import { describe, it, expect } from 'vitest';
import { emailFinderNotice } from '@/app/_shared/lib/utils/emailFinderNotice';

const contacts = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  email: null,
  phone: null,
  contact_page: null,
  socials: {},
  ...over,
});

describe('emailFinderNotice', () => {
  it('reports the email that was found', () => {
    expect(emailFinderNotice('smiledental.com', contacts({ email: 'hello@smiledental.com' }))).toBe(
      'Found hello@smiledental.com for smiledental.com.'
    );
  });

  it('points to the other ways to reach them when there is no email', () => {
    expect(
      emailFinderNotice(
        'smiledental.com',
        contacts({ phone: '(702) 555-0100', contact_page: 'https://smiledental.com/contact', socials: { facebook: 'f' } })
      )
    ).toBe('No email found for smiledental.com. Its phone number, contact form and social profiles are on the card below.');
    expect(emailFinderNotice('smiledental.com', contacts({ contact_page: 'https://smiledental.com/contact' }))).toBe(
      'No email found for smiledental.com. Its contact form is on the card below.'
    );
  });

  it('says so when there is nothing at all', () => {
    expect(emailFinderNotice('smiledental.com', undefined)).toBe(
      'No email found for smiledental.com, and no other contact details on its website.'
    );
  });

  const freeLimit = { kind: 'email_lookup', plan: 'free', limit: 0, resetsAt: '2026-11-01T00:00:00.000Z' } as const;
  const usedUp = { kind: 'email_lookup', plan: 'pro', limit: 100, resetsAt: '2026-11-14T00:00:00.000Z' } as const;

  it('mentions paid plans when Free only scanned the website', () => {
    expect(emailFinderNotice('Acme', contacts(), freeLimit)).toBe(
      'No email found for Acme, and no other contact details on its website. Paid plans also search email databases.'
    );
  });

  it('says the lookups ran out', () => {
    expect(emailFinderNotice('Acme', undefined, usedUp)).toBe(
      "No email found for Acme, and no other contact details on its website. You've used your 100 email lookups. They reset on Nov 14."
    );
  });

  it('says nothing about plans when an email was found', () => {
    expect(emailFinderNotice('Acme', contacts({ email: 'hi@acme.com' }), freeLimit)).toBe('Found hi@acme.com for Acme.');
  });
});
