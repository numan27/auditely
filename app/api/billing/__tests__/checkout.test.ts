import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const fake = vi.hoisted(() => ({
  session: null as unknown,
  ready: true,
  list: vi.fn(),
  create: vi.fn(),
  customers: { list: vi.fn(), create: vi.fn() },
  subscriptions: vi.fn(),
}));
// No database: the routes read only through the session's own client
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => fake.session,
}));
vi.mock('@/app/_shared/lib/billing/stripe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/billing/stripe')>()),
  stripeClient: () =>
    fake.ready
      ? {
          prices: { list: fake.list },
          checkout: { sessions: { create: fake.create } },
          customers: fake.customers,
          subscriptions: { list: fake.subscriptions },
        }
      : null,
}));
vi.mock('@/app/_shared/lib/billing/sync', () => ({ syncSubscription: vi.fn(async () => 'saved') }));
vi.mock('@/app/_shared/lib/billing/subscription', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/billing/subscription')>()),
  customerIdOf: vi.fn(async () => null),
}));

const { customerIdOf } = await import('@/app/_shared/lib/billing/subscription');
const { syncSubscription } = await import('@/app/_shared/lib/billing/sync');
const { POST } = await import('@/app/api/billing/checkout/route');

const tester = { id: 'u2', email: 'tester@x.com', isOwner: false, subscription: null };
const livePro = { plan: 'pro', interval: 'year', status: 'active', anchor: '2026-03-14T09:30:00.000Z', periodEnd: '2999-03-14T09:30:00.000Z', endsAt: null };
const create = fake.create;

const buy = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/billing/checkout', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_CHECKOUT_OPEN', 'true');
  fake.session = { db: {}, account: tester };
  fake.ready = true;
  fake.list.mockReset().mockResolvedValue({ data: [{ id: 'price_pro_y' }] });
  create.mockReset().mockResolvedValue({ url: 'https://checkout.stripe.com/c/1' });
  fake.customers.list.mockReset().mockResolvedValue({ data: [] });
  fake.customers.create.mockReset().mockResolvedValue({ id: 'cus_new' });
  fake.subscriptions.mockReset().mockResolvedValue({ data: [] });
  vi.mocked(customerIdOf).mockClear();
  vi.mocked(syncSubscription).mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/billing/checkout', () => {
  it("doesn't reach Stripe while paid plans wait for the end of the beta", async () => {
    vi.stubEnv('NEXT_PUBLIC_CHECKOUT_OPEN', '');
    const res = await buy({ plan: 'pro', interval: 'month' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Paid plans open after the beta.' });
    expect(fake.list).not.toHaveBeenCalled();
    expect(fake.customers.create).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('opens a taxed subscription Checkout for the account', async () => {
    const res = await buy({ plan: 'pro', interval: 'year' });
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/1' });
    expect(fake.list).toHaveBeenCalledWith({ lookup_keys: ['auditely_pro_yearly'], active: true, limit: 1 });
    expect(create.mock.calls[0][0]).toMatchObject({
      mode: 'subscription', line_items: [{ price: 'price_pro_y', quantity: 1 }], client_reference_id: 'u2',
      subscription_data: { metadata: { user_id: 'u2' } }, customer: 'cus_new', customer_update: { address: 'auto', name: 'auto' },
      automatic_tax: { enabled: true }, billing_address_collection: 'required', allow_promotion_codes: true,
      success_url: 'http://localhost/plans/done?session_id={CHECKOUT_SESSION_ID}', cancel_url: 'http://localhost/plans' });
    expect(create.mock.calls[0][0]).not.toHaveProperty('customer_email');
  });

  it('closes an unpaid Checkout after an hour, so an old tab can\'t buy a second plan later', async () => {
    await buy({ plan: 'pro', interval: 'month' });
    const left = create.mock.calls[0][0].expires_at - Date.now() / 1000;
    expect(left).toBeGreaterThan(59 * 60);
    expect(left).toBeLessThanOrEqual(60 * 60);
  });

  it('gives a first-time buyer one Stripe customer, and finds it again for the next Checkout', async () => {
    await buy({ plan: 'pro', interval: 'month' });
    expect(fake.customers.list).toHaveBeenCalledWith({ email: 'tester@x.com', limit: 100 });
    expect(fake.customers.create).toHaveBeenCalledWith(
      { email: 'tester@x.com', metadata: { user_id: 'u2' } },
      { idempotencyKey: 'auditely-customer-u2' }
    );
    // Another account's customer with the same email isn't this account's
    fake.customers.list.mockResolvedValue({ data: [{ id: 'cus_other', metadata: { user_id: 'u9' } }, { id: 'cus_new', metadata: { user_id: 'u2' } }] });
    await buy({ plan: 'agency', interval: 'year' });
    expect(fake.customers.create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls.map((call) => call[0].customer)).toEqual(['cus_new', 'cus_new']);
  });

  it("refuses a second Checkout while Stripe holds a live subscription Auditely hasn't recorded yet", async () => {
    const item = (product: string) => ({ data: [{ price: { product, recurring: { interval: 'month' } } }] });
    fake.subscriptions.mockResolvedValue({
      data: [
        { id: 'sub_old', status: 'canceled', items: item('auditely_agency') },
        { id: 'sub_1', status: 'active', items: item('auditely_pro') },
      ],
    });
    const res = await buy({ plan: 'agency', interval: 'month' });
    expect([res.status, (await res.json()).error]).toEqual([409, "You're already on the Pro plan. Change it from Manage billing in Settings."]);
    expect(fake.subscriptions).toHaveBeenCalledWith({ customer: 'cus_new', status: 'all', limit: 100 });
    // Recorded now, so Settings shows Manage billing after a refresh
    expect(vi.mocked(syncSubscription).mock.calls[0].slice(1)).toEqual(['sub_1', 'u2']);
    expect(create).not.toHaveBeenCalled();
  });

  it('reuses the Stripe customer of an earlier subscription', async () => {
    vi.mocked(customerIdOf).mockResolvedValueOnce('cus_1');
    await buy({ plan: 'agency', interval: 'month' });
    expect(vi.mocked(customerIdOf).mock.calls[0][1]).toBe('u2');
    expect(create.mock.calls[0][0]).toMatchObject({ customer: 'cus_1', customer_update: { address: 'auto', name: 'auto' } });
    expect(create.mock.calls[0][0]).not.toHaveProperty('customer_email');
    expect(fake.customers.list).not.toHaveBeenCalled();
  });

  it('sends an account that already pays to Manage billing, without opening Checkout', async () => {
    fake.session = { db: {}, account: { ...tester, subscription: livePro } };
    const res = await buy({ plan: 'agency', interval: 'month' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("You're already on the Pro plan. Change it from Manage billing in Settings.");
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses the owner, other plans and other intervals', async () => {
    fake.session = { db: {}, account: { ...tester, isOwner: true } };
    const owner = await buy({ plan: 'pro', interval: 'month' });
    expect([owner.status, (await owner.json()).error]).toEqual([400, "Your account has no limits, so there's no plan to buy."]);
    fake.session = { db: {}, account: tester };
    for (const body of [{ plan: 'owner', interval: 'month' }, { plan: 'free', interval: 'month' }, { plan: 'pro', interval: 'week' }, null]) {
      const res = await buy(body);
      expect([res.status, (await res.json()).error]).toEqual([400, 'Choose Pro or Agency, billed monthly or yearly.']);
    }
    expect(create).not.toHaveBeenCalled();
  });

  it("says billing isn't set up without a key or a price", async () => {
    fake.ready = false;
    const noKey = await buy({ plan: 'pro', interval: 'month' });
    expect([noKey.status, (await noKey.json()).error]).toEqual([503, "Billing isn't set up yet. Try again later."]);
    fake.ready = true;
    fake.list.mockResolvedValue({ data: [] });
    expect((await buy({ plan: 'pro', interval: 'month' })).status).toBe(503);
    expect(String(vi.mocked(console.error).mock.calls[0])).toContain('auditely_pro_monthly');
    expect(create).not.toHaveBeenCalled();
  });

  it('answers 502 when Stripe or the customer lookup fails', async () => {
    create.mockRejectedValueOnce(new Error('stripe down'));
    const res = await buy({ plan: 'pro', interval: 'month' });
    expect([res.status, (await res.json()).error]).toEqual([502, "Couldn't open checkout. Try again in a minute."]);
    vi.mocked(customerIdOf).mockRejectedValueOnce(new Error('db down'));
    expect((await buy({ plan: 'pro', interval: 'month' })).status).toBe(502);
  });

  it('answers 401 without a session', async () => {
    fake.session = null;
    expect((await buy({ plan: 'pro', interval: 'month' })).status).toBe(401);
  });
});
