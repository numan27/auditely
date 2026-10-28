import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const fake = vi.hoisted(() => ({ session: null as unknown, ready: true, portalCreate: vi.fn() }));
// No database: the routes read only through the session's own client
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => fake.session,
}));
vi.mock('@/app/_shared/lib/billing/stripe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/billing/stripe')>()),
  stripeClient: () => (fake.ready ? { billingPortal: { sessions: { create: fake.portalCreate } } } : null),
}));
vi.mock('@/app/_shared/lib/billing/subscription', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/billing/subscription')>()),
  customerIdOf: vi.fn(async () => 'cus_1'),
}));

const { customerIdOf } = await import('@/app/_shared/lib/billing/subscription');
const { POST } = await import('@/app/api/billing/portal/route');

const portalCreate = fake.portalCreate;
const open = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/billing/portal', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  fake.session = { db: {}, account: { id: 'u2', email: 'tester@x.com', isOwner: false, subscription: null } };
  fake.ready = true;
  portalCreate.mockReset().mockResolvedValue({ url: 'https://billing.stripe.com/p/1' });
  vi.mocked(customerIdOf).mockReset().mockResolvedValue('cus_1');
  vi.stubEnv('STRIPE_PORTAL_CONFIGURATION', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/billing/portal', () => {
  it("opens the portal for the account's customer and returns to Settings", async () => {
    const res = await open({});
    expect(await res.json()).toEqual({ url: 'https://billing.stripe.com/p/1' });
    expect(portalCreate).toHaveBeenCalledWith({ customer: 'cus_1', return_url: 'http://localhost/settings#plan' });
    expect(vi.mocked(customerIdOf).mock.calls[0][1]).toBe('u2');
  });

  it('returns to the plans page when asked, with the portal configuration when one is set', async () => {
    vi.stubEnv('STRIPE_PORTAL_CONFIGURATION', 'bpc_1');
    await open({ returnTo: 'plans' });
    expect(portalCreate.mock.calls[0][0]).toEqual({ customer: 'cus_1', return_url: 'http://localhost/plans', configuration: 'bpc_1' });
  });

  it('says there is nothing to manage before a first purchase', async () => {
    vi.mocked(customerIdOf).mockResolvedValue(null);
    const res = await open({});
    expect([res.status, (await res.json()).error]).toEqual([404, "There's no billing to manage yet. Choose a plan first."]);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("says billing isn't set up without a key, and answers 502 when Stripe fails", async () => {
    fake.ready = false;
    expect((await open({})).status).toBe(503);
    fake.ready = true;
    portalCreate.mockRejectedValueOnce(new Error('stripe down'));
    const res = await open({});
    expect([res.status, (await res.json()).error]).toEqual([502, "Couldn't open billing. Try again in a minute."]);
  });
});
