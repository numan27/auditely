// app/api/find-emails/__tests__/route.test.ts

// Contact discovery as the signed-in user. Scraping a lead's own website is for
// every account; a paid email lookup (Hunter, Tomba, Snov, Apollo) counts against
// the plan's allowance, one per business a credit is spent on. Free has none, and
// the owner is never counted.

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
// Another account's meter is this fake; the owner's is the real UNMETERED
const meter = vi.hoisted(() => ({ claim: vi.fn(), notOnPlan: vi.fn() }));
vi.mock('@/app/_shared/lib/usage/usage', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/app/_shared/lib/usage/usage')>();
  return { ...real, meterFor: (account: { isOwner: boolean }) => (account.isOwner ? real.UNMETERED : meter) };
});

const RESETS = '2026-11-01T00:00:00.000Z';
const freeLookupLimit = { kind: 'email_lookup', plan: 'free', limit: 0, resetsAt: RESETS };
const proLookupLimit = { kind: 'email_lookup', plan: 'pro', limit: 100, resetsAt: RESETS };
const okClaim = { ok: true, release: async () => {} };
// The fake lookup spends a credit only when its gate allows it, like the real cascade
const gated = async (_domain: string, _mode: string, allow?: () => Promise<boolean>) =>
  (await allow!()) ? { email: 'hello@smiledental.com', refused: false } : { email: null, refused: true };
const updatesWithLookupAt = () => db.state.updates.filter((u) => 'email_lookup_at' in u.value);

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
  vi.mocked(lookupEmailViaApis).mockReset().mockImplementation(gated);
  meter.claim.mockReset().mockResolvedValue(okClaim);
  meter.notOnPlan.mockReset().mockReturnValue(null);
  vi.mocked(discoverContacts)
    .mockReset()
    .mockResolvedValue({ fetched: true, email: null, phone: null, contactPage: null, socials: {} });
});

describe('POST /api/find-emails, automatic API pass', () => {
  it("looks the owner's lead up once with the paid APIs and records it", async () => {
    const { status, json } = await post({ business_ids: ['b1'], apiLookup: 'auto' });
    expect(status).toBe(200);
    expect(lookupEmailViaApis).toHaveBeenCalledWith('smiledental.com', 'auto', expect.any(Function));
    expect(db.state.updates).toEqual([
      { id: 'b1', value: { email: 'hello@smiledental.com', email_lookup_at: expect.any(String) } },
    ]);
    expect(json.results[0].email).toBe('hello@smiledental.com');
  });

  it('stops the automatic pass at the allowance and leaves the rest for later', async () => {
    signIn(false);
    db.state.rows = ['b1', 'b2', 'b3', 'b4', 'b5'].map((id) => ({ ...lead, id }));
    meter.claim.mockResolvedValueOnce(okClaim).mockResolvedValueOnce(okClaim).mockResolvedValueOnce(okClaim)
      .mockResolvedValue({ ok: false, status: 402, error: "You've used your 100 email lookups this month. They reset on Nov 1.", limit: proLookupLimit });
    const { status, json } = await post({ business_ids: ['b1', 'b2', 'b3', 'b4', 'b5'], apiLookup: 'auto' });
    expect(status).toBe(200);
    expect(meter.claim).toHaveBeenCalledWith('email_lookup');
    // A refused lookup saves nothing, so those businesses are looked up next month
    expect(updatesWithLookupAt()).toHaveLength(3);
    expect(db.state.updates).toHaveLength(3);
    expect(json.limit).toEqual(proLookupLimit);
  });

  it('looks nothing up automatically for a plan without email lookups', async () => {
    signIn(false);
    meter.notOnPlan.mockReturnValue(freeLookupLimit);
    const { json } = await post({ business_ids: ['b1'], apiLookup: 'auto' });
    expect(lookupEmailViaApis).not.toHaveBeenCalled();
    expect(discoverContacts).not.toHaveBeenCalled();
    expect(db.state.updates).toEqual([]);
    expect(json.limit).toEqual(freeLookupLimit);
  });

  it('answers without a limit while lookups are left', async () => {
    signIn(false);
    const { json } = await post({ business_ids: ['b1'], apiLookup: 'auto' });
    expect(json.limit).toBeUndefined();
    expect(updatesWithLookupAt()).toHaveLength(1);
  });
});

describe('POST /api/find-emails, on-demand lookup', () => {
  it("keeps the owner's lookups as they are", async () => {
    const { json } = await post({ business_ids: ['b1'], apiFallback: true });
    expect(discoverContacts).toHaveBeenCalledWith('https://www.smiledental.com');
    expect(lookupEmailViaApis).toHaveBeenCalledWith('smiledental.com', 'all', expect.any(Function));
    expect(meter.claim).not.toHaveBeenCalled();
    expect(db.state.updates[0].value).toMatchObject({ email: 'hello@smiledental.com', email_lookup_at: expect.any(String) });
    expect(json.limit).toBeUndefined();
  });

  it('looks nothing up for a plan without email lookups, and says so', async () => {
    signIn(false);
    meter.notOnPlan.mockReturnValue(freeLookupLimit);
    const { json } = await post({ business_ids: ['b1'], apiFallback: true });
    expect(lookupEmailViaApis).not.toHaveBeenCalled();
    expect(discoverContacts).toHaveBeenCalledWith('https://www.smiledental.com');
    expect(db.state.updates[0].value).toHaveProperty('contacts_checked_at');
    expect(db.state.updates[0].value).not.toHaveProperty('email_lookup_at');
    expect(json.limit).toEqual(freeLookupLimit);
  });

  it('records the one-time lookup after a manual paid lookup', async () => {
    signIn(false);
    const { json } = await post({ business_ids: ['b1'], apiFallback: true });
    expect(meter.claim).toHaveBeenCalledOnce();
    expect(db.state.updates[0].value).toMatchObject({ email: 'hello@smiledental.com', email_lookup_at: expect.any(String), contacts_checked_at: expect.any(String) });
    expect(json.results[0].email).toBe('hello@smiledental.com');
  });

  it('keeps the scrape but not the lookup when the claim is refused', async () => {
    signIn(false);
    meter.claim.mockResolvedValue({ ok: false, status: 402, error: "You've used your 100 email lookups this month. They reset on Nov 1.", limit: proLookupLimit });
    const { json } = await post({ business_ids: ['b1'], apiFallback: true });
    expect(db.state.updates[0].value).toHaveProperty('contacts_checked_at');
    expect(db.state.updates[0].value).not.toHaveProperty('email_lookup_at');
    expect(json.limit).toEqual(proLookupLimit);
  });

  it("doesn't look up an email the scrape already found", async () => {
    signIn(false);
    vi.mocked(discoverContacts).mockResolvedValue({ fetched: true, email: 'info@smiledental.com', phone: null, contactPage: null, socials: {} });
    await post({ business_ids: ['b1'], apiFallback: true });
    expect(lookupEmailViaApis).not.toHaveBeenCalled();
    expect(meter.claim).not.toHaveBeenCalled();
    expect(db.state.updates[0].value).toMatchObject({ email: 'info@smiledental.com' });
    expect(db.state.updates[0].value).not.toHaveProperty('email_lookup_at');
  });

  it('only scrapes in the background pass', async () => {
    signIn(false);
    await post({ business_ids: ['b1'] });
    expect(lookupEmailViaApis).not.toHaveBeenCalled();
    expect(meter.claim).not.toHaveBeenCalled();
  });
});
