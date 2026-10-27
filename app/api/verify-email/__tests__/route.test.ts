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
const session = vi.hoisted(() => ({ current: null as unknown }));
// The route runs as the signed-in user: the service client must stay unused
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
  ownerUserId: async () => 'owner-1',
}));
// The check itself has its own tests
vi.mock('@/app/_shared/lib/email/leadEmailCheck', () => ({ checkLeadEmail: vi.fn() }));

// The signed-in user's client: the route must hand this one to the libraries
const userDb = { from: db.from };
// Signed in, but not as the owner; the client records any query it is asked for
function signInAsMember() {
  const from = vi.fn(db.from);
  session.current = { db: { from }, account: { id: 'user-2', email: 'tester@example.com', isOwner: false } };
  return from;
}

const SAVED = { address: 'office@smiledental.com', verdict: 'Deliverable', status: 'Success', checked_at: '2026-10-04T12:00:00Z' };
const post = async (body: unknown) => {
  const res = await POST(new NextRequest(`https://auditely.app${API_ROUTES.VERIFY_EMAIL}`, { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

beforeEach(() => {
  session.current = { db: userDb, account: { id: 'owner-1', email: 'owner@example.com', isOwner: true } };
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
    expect(checkLeadEmail).toHaveBeenCalledWith(userDb, { id: 'b1', email: 'office@smiledental.com', email_check: SAVED });
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

describe('/api/verify-email for an account that is not the owner', () => {
  it('answers 403, before reading the lead or asking Verifalia', async () => {
    const from = signInAsMember();
    expect(await post({ business_id: 'b1' })).toEqual({ status: 403, json: { error: "This isn't available on your account yet." } });
    expect(from).not.toHaveBeenCalled();
    expect(checkLeadEmail).not.toHaveBeenCalled();
  });
});
