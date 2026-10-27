// app/api/find-emails/__tests__/route.test.ts

// Contact discovery as the signed-in user. Scraping a lead's own website is for
// every account; the paid email lookups (Hunter, Snov) stay the owner's: another
// account's automatic pass looks nothing up, and its on-demand lookup scrapes
// without the paid fallback.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/find-emails/route';
import { discoverContacts } from '@/app/_shared/lib/utils/contactDiscovery';
import { lookupEmailViaApis } from '@/app/_shared/lib/utils/emailApis';

// Fake Supabase: the businesses asked for, and every update with its row id
const db = vi.hoisted(() => {
  const state = { rows: [] as unknown[], updates: [] as { id: unknown; value: Record<string, unknown> }[] };
  const from = () => {
    const chain = {
      select: () => chain,
      in: async () => ({ data: state.rows, error: null }),
      update: (value: Record<string, unknown>) => ({
        eq: async (_column: string, id: unknown) => {
          state.updates.push({ id, value });
          return { error: null };
        },
      }),
    };
    return chain;
  };
  return { state, from };
});

const session = vi.hoisted(() => ({ current: null as unknown }));
// The route runs as the signed-in user: the service client must stay unused
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
  ownerUserId: async () => 'owner-1',
}));
vi.mock('@/app/_shared/lib/utils/emailApis', () => ({ lookupEmailViaApis: vi.fn() }));
vi.mock('@/app/_shared/lib/utils/contactDiscovery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/utils/contactDiscovery')>()),
  discoverContacts: vi.fn(),
}));

const lead = {
  id: 'b1',
  website: 'https://www.smiledental.com',
  email: null,
  phone: '(555) 123-4567',
  contact_page: null,
  socials: null,
  contacts_checked_at: null,
  email_lookup_at: null,
};

const signIn = (isOwner: boolean) => {
  const account = isOwner
    ? { id: 'owner-1', email: 'owner@example.com', isOwner: true }
    : { id: 'user-2', email: 'tester@example.com', isOwner: false };
  session.current = { db: { from: db.from }, account };
};

async function post(body: Record<string, unknown>) {
  const res = await POST(new NextRequest('http://localhost/api/find-emails', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  signIn(true);
  db.state.rows = [lead];
  db.state.updates = [];
  vi.mocked(lookupEmailViaApis).mockReset().mockResolvedValue('hello@smiledental.com');
  vi.mocked(discoverContacts)
    .mockReset()
    .mockResolvedValue({ fetched: true, email: null, phone: null, contactPage: null, socials: {} });
});

describe('POST /api/find-emails, automatic API pass', () => {
  it("looks the owner's lead up once with the paid APIs and records it", async () => {
    const { status, json } = await post({ business_ids: ['b1'], apiLookup: 'auto' });
    expect(status).toBe(200);
    expect(lookupEmailViaApis).toHaveBeenCalledWith('smiledental.com', 'auto');
    expect(db.state.updates).toEqual([
      { id: 'b1', value: { email: 'hello@smiledental.com', email_lookup_at: expect.any(String) } },
    ]);
    expect(json.results[0].email).toBe('hello@smiledental.com');
  });

  it("never spends a paid lookup on another account's lead", async () => {
    signIn(false);
    const { status, json } = await post({ business_ids: ['b1'], apiLookup: 'auto' });
    expect(status).toBe(200);
    expect(lookupEmailViaApis).not.toHaveBeenCalled();
    expect(discoverContacts).not.toHaveBeenCalled();
    expect(db.state.updates).toEqual([]);
    expect(json.results).toEqual([
      { business_id: 'b1', email: null, phone: '(555) 123-4567', contact_page: null, socials: {} },
    ]);
  });
});

describe('POST /api/find-emails, on-demand lookup', () => {
  it('adds the paid APIs to the scrape for the owner', async () => {
    await post({ business_ids: ['b1'], apiFallback: true });
    expect(discoverContacts).toHaveBeenCalledWith('https://www.smiledental.com', { apiFallback: true });
    expect(db.state.updates[0].value).toHaveProperty('email_lookup_at');
  });

  it('only scrapes the website for another account', async () => {
    signIn(false);
    await post({ business_ids: ['b1'], apiFallback: true });
    expect(discoverContacts).toHaveBeenCalledWith('https://www.smiledental.com', { apiFallback: false });
    expect(db.state.updates[0].value).toHaveProperty('contacts_checked_at');
    // Not counted as the one-time API lookup, which never ran
    expect(db.state.updates[0].value).not.toHaveProperty('email_lookup_at');
  });
});
