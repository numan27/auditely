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
});
