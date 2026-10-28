import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import { billingReady, priceIdFor, stripeClient, testKeyAtLaunch } from '@/app/_shared/lib/billing/stripe';

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
