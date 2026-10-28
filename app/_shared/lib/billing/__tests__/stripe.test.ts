import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import { billingReady, cancelSubscriptions, findCustomer, priceIdFor, stripeClient, testKeyAtLaunch } from '@/app/_shared/lib/billing/stripe';

const LAUNCHED = { VERCEL_ENV: 'production', SIGNUPS_OPEN: 'true' };

describe('stripe', () => {
  it('is not ready without a secret key, and finds a price by its lookup key', async () => {
    expect([stripeClient({}), billingReady({})]).toEqual([null, false]);
    const list = vi.fn().mockResolvedValue({ data: [{ id: 'price_9' }] });
    expect(await priceIdFor({ prices: { list } } as unknown as Stripe, 'agency', 'year')).toBe('price_9');
    expect(list).toHaveBeenCalledWith({ lookup_keys: ['auditely_agency_yearly'], active: true, limit: 1 });
  });

  it('keeps one client per key', () => {
    const env = { STRIPE_SECRET_KEY: 'sk_test_one' };
    expect(stripeClient(env)).toBe(stripeClient(env));
    expect(stripeClient(env)).not.toBe(stripeClient({ STRIPE_SECRET_KEY: 'sk_test_two' }));
    expect(billingReady(env)).toBe(true);
  });

  it('answers null when no active price has the lookup key', async () => {
    const list = vi.fn().mockResolvedValue({ data: [] });
    expect(await priceIdFor({ prices: { list } } as unknown as Stripe, 'pro', 'month')).toBeNull();
  });

  it('turns billing off when production opens sign-ups on a test key', () => {
    expect(stripeClient({ STRIPE_SECRET_KEY: 'sk_test_1', VERCEL_ENV: 'production', SIGNUPS_OPEN: 'true' })).toBeNull();
    expect(billingReady({ STRIPE_SECRET_KEY: 'sk_test_1', VERCEL_ENV: 'preview', SIGNUPS_OPEN: 'true' })).toBe(true);
    expect(billingReady({ STRIPE_SECRET_KEY: 'sk_live_1', VERCEL_ENV: 'production', SIGNUPS_OPEN: 'true' })).toBe(true);
    // Before launch, production still tests on a test key
    expect(billingReady({ STRIPE_SECRET_KEY: 'sk_test_1', VERCEL_ENV: 'production', SIGNUPS_OPEN: 'false' })).toBe(true);
    expect(testKeyAtLaunch({ ...LAUNCHED, STRIPE_SECRET_KEY: ' sk_test_1 ' })).toBe(true);
    expect(testKeyAtLaunch({ ...LAUNCHED, STRIPE_SECRET_KEY: 'sk_live_1' })).toBe(false);
    expect(testKeyAtLaunch(LAUNCHED)).toBe(false);
  });

  it('says why billing is off, once', async () => {
    // A fresh module: the test above has already said it in this one
    vi.resetModules();
    const fresh = await import('@/app/_shared/lib/billing/stripe');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (let i = 0; i < 3; i++) fresh.stripeClient({ ...LAUNCHED, STRIPE_SECRET_KEY: 'sk_test_1' });
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        '[billing] STRIPE_SECRET_KEY is a test key while sign-ups are open in production. Billing is off until the live key is set.'
      );
    } finally {
      error.mockRestore();
    }
  });
});

describe('findCustomer', () => {
  it("finds the account's own customer under its email, and never makes one", async () => {
    const list = vi.fn().mockResolvedValue({
      data: [
        { id: 'cus_other', metadata: { user_id: 'u9' } },
        { id: 'cus_own', metadata: { user_id: 'u2' } },
      ],
    });
    const create = vi.fn();
    const stripe = { customers: { list, create } } as unknown as Stripe;
    expect(await findCustomer(stripe, { id: 'u2', email: 'tester@x.com' })).toBe('cus_own');
    expect(list).toHaveBeenCalledWith({ email: 'tester@x.com', limit: 100 });
    expect(await findCustomer(stripe, { id: 'u3', email: 'tester@x.com' })).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('cancelSubscriptions', () => {
  it('ends every subscription that could still bill, at once and with no refund', async () => {
    const list = vi.fn().mockResolvedValue({
      data: ['active', 'canceled', 'past_due', 'incomplete_expired', 'trialing', 'incomplete', 'unpaid', 'paused'].map(
        (status, i) => ({ id: `sub_${i}`, status })
      ),
    });
    const cancel = vi.fn().mockResolvedValue({});
    const stripe = { subscriptions: { list, cancel } } as unknown as Stripe;
    expect(await cancelSubscriptions(stripe, 'cus_1')).toBe(6);
    expect(list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'all', limit: 100 });
    expect(cancel.mock.calls).toEqual([['sub_0'], ['sub_2'], ['sub_4'], ['sub_5'], ['sub_6'], ['sub_7']]);
  });

  it('cancels nothing for a customer with no subscription left', async () => {
    const cancel = vi.fn();
    const stripe = { subscriptions: { list: vi.fn().mockResolvedValue({ data: [{ id: 'sub_1', status: 'canceled' }] }), cancel } };
    expect(await cancelSubscriptions(stripe as unknown as Stripe, 'cus_1')).toBe(0);
    expect(cancel).not.toHaveBeenCalled();
  });
});
