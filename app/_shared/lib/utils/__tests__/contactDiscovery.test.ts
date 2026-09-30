import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { contactsUpdate, discoverContacts, emailLookupUpdate, type DiscoveredContacts } from '@/app/_shared/lib/utils/contactDiscovery';

const found: DiscoveredContacts = {
  fetched: true,
  email: 'hello@smiledental.com',
  phone: '(702) 555-0100',
  contactPage: 'https://smiledental.com/contact',
  socials: { facebook: 'https://www.facebook.com/smiledental' },
};
const NOW = '2026-09-25T10:00:00.000Z';

describe('contactsUpdate', () => {
  it('fills an empty email and phone and records the channels', () => {
    expect(contactsUpdate({ email: null, phone: null }, found, NOW)).toEqual({
      email: 'hello@smiledental.com',
      phone: '(702) 555-0100',
      contact_page: 'https://smiledental.com/contact',
      socials: { facebook: 'https://www.facebook.com/smiledental' },
      contacts_checked_at: NOW,
    });
  });

  it('never overwrites an email or phone already on file', () => {
    const update = contactsUpdate({ email: 'old@smiledental.com', phone: '(702) 000-0000' }, found, NOW);
    expect(update).not.toHaveProperty('email');
    expect(update).not.toHaveProperty('phone');
  });

  it('leaves the channels alone when the site could not be loaded, so it is retried later', () => {
    const failed: DiscoveredContacts = { fetched: false, email: null, phone: null, contactPage: null, socials: {} };
    expect(contactsUpdate({ email: null, phone: null }, failed, NOW)).toEqual({});
  });
});

describe('discoverContacts', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('reads email, phone, contact page and socials from one homepage fetch', async () => {
    const home = `
      <a href="mailto:hello@smiledental.com">Email</a>
      <a href="tel:7025550100">Call</a>
      <a href="/contact">Contact</a>
      <a href="https://www.facebook.com/smiledental">Facebook</a>`;
    fetchMock.mockImplementation(async (url: string) =>
      url === 'https://smiledental.com/'
        ? new Response(home, { status: 200, headers: { 'content-type': 'text/html' } })
        : new Response('', { status: 404 })
    );

    expect(await discoverContacts('https://smiledental.com/')).toEqual({
      fetched: true,
      email: 'hello@smiledental.com',
      phone: '(702) 555-0100',
      contactPage: 'https://smiledental.com/contact',
      socials: { facebook: 'https://www.facebook.com/smiledental' },
    });
    const homepageFetches = fetchMock.mock.calls.filter(([url]) => url === 'https://smiledental.com/');
    expect(homepageFetches).toHaveLength(1);
  });
});

describe('emailLookupUpdate', () => {
  it('records the lookup so it never runs twice, saving any email found', () => {
    expect(emailLookupUpdate('hello@smiledental.com', NOW)).toEqual({ email: 'hello@smiledental.com', email_lookup_at: NOW });
    expect(emailLookupUpdate(null, NOW)).toEqual({ email_lookup_at: NOW });
  });
});
