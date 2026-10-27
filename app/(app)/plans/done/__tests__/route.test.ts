import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const fake = vi.hoisted(() => ({ session: null as unknown, client: { name: 'stripe' } as unknown }));
// No database: the routes read only through the session's own client
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => fake.session,
}));
vi.mock('@/app/_shared/lib/billing/stripe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/billing/stripe')>()),
  stripeClient: () => fake.client,
}));
vi.mock('@/app/_shared/lib/billing/sync', () => ({ syncCheckoutSession: vi.fn(async () => 'saved') }));

const { syncCheckoutSession } = await import('@/app/_shared/lib/billing/sync');
const { GET } = await import('@/app/(app)/plans/done/route');

beforeEach(() => {
  fake.session = { db: {}, account: { id: 'u2', email: 'tester@x.com', isOwner: false, subscription: null } };
  fake.client = { name: 'stripe' };
  vi.mocked(syncCheckoutSession).mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('GET /plans/done', () => {
  it("saves the account's own Checkout and goes back to the plans page", async () => {
    const res = await GET(new NextRequest('http://localhost/plans/done?session_id=cs_test_a1B2'));
    expect(syncCheckoutSession).toHaveBeenCalledWith(fake.client, 'cs_test_a1B2', 'u2');
    expect([res.status, res.headers.get('location')]).toEqual([303, 'http://localhost/plans?subscribed=1']);
  });

  it('never asks Stripe about a malformed session id', async () => {
    for (const id of ['../../x', 'cs_test_', 'cs_other_1', '']) {
      const res = await GET(new NextRequest(`http://localhost/plans/done?session_id=${encodeURIComponent(id)}`));
      expect(res.status).toBe(303);
    }
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });

  it('still goes back to the plans page when the sync fails', async () => {
    vi.mocked(syncCheckoutSession).mockRejectedValueOnce(new Error('stripe down'));
    expect((await GET(new NextRequest('http://localhost/plans/done?session_id=cs_test_1'))).status).toBe(303);
    expect(String(vi.mocked(console.error).mock.calls[0])).toContain('stripe down');
  });

  it('goes back to the plans page without asking Stripe while billing is off', async () => {
    fake.client = null;
    expect((await GET(new NextRequest('http://localhost/plans/done?session_id=cs_live_1'))).status).toBe(303);
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });

  it('sends a visitor without a session to sign in', async () => {
    fake.session = null;
    const res = await GET(new NextRequest('http://localhost/plans/done?session_id=cs_test_1'));
    expect(res.headers.get('location')).toBe('http://localhost/login');
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });
});
