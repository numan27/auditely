import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

vi.mock('@/app/_shared/lib/billing/sync', () => ({
  syncSubscription: vi.fn(async () => 'saved'),
  UnknownPrice: class UnknownPrice extends Error {},
}));

const { UnknownPrice, syncSubscription } = await import('@/app/_shared/lib/billing/sync');
const { POST } = await import('@/app/api/stripe/webhook/route');

const URL = 'http://localhost/api/stripe/webhook';
const signer = new Stripe('sk_test_x');

/** Posts an event, signed with the webhook secret unless a signature is given */
function post(event: object, signature?: string) {
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', ...event });
  const header = signature ?? signer.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' });
  return POST(new NextRequest(URL, { method: 'POST', body: payload, headers: { 'stripe-signature': header } }));
}

const updated = { type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } };

beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  vi.mocked(syncSubscription).mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/stripe/webhook', () => {
  it('refuses a body that Stripe did not sign, and syncs nothing', async () => {
    const res = await post(updated, 't=1,v1=forged');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid signature' });
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it('refuses a request with no signature header', async () => {
    const res = await POST(new NextRequest(URL, { method: 'POST', body: JSON.stringify({ id: 'evt_1', ...updated }) }));
    expect(res.status).toBe(400);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it('refuses an event signed with another secret', async () => {
    const payload = JSON.stringify({ id: 'evt_1', object: 'event', ...updated });
    const header = signer.webhooks.generateTestHeaderString({ payload, secret: 'whsec_other' });
    expect((await post(updated, header)).status).toBe(400);
  });

  it('syncs the subscription an event names', async () => {
    const res = await post({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(vi.mocked(syncSubscription).mock.calls[0].slice(1)).toEqual(['sub_1']);
  });

  it('passes a completed Checkout session’s account as the hint', async () => {
    await post({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_1', client_reference_id: 'u2' } } });
    expect(vi.mocked(syncSubscription).mock.calls[0].slice(1)).toEqual(['sub_1', 'u2']);
  });

  it('acknowledges other events without syncing', async () => {
    expect((await post({ type: 'invoice.paid', data: { object: { id: 'in_1' } } })).status).toBe(200);
    expect((await post({ type: 'checkout.session.completed', data: { object: { mode: 'payment', subscription: null } } })).status).toBe(200);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it('answers 500 when the sync fails, so Stripe tries again', async () => {
    vi.mocked(syncSubscription).mockRejectedValueOnce(new Error('db down'));
    expect((await post(updated)).status).toBe(500);
    expect(String(vi.mocked(console.error).mock.calls[0])).toContain('customer.subscription.updated evt_1: db down');
  });

  it("acknowledges a subscription that isn't Auditely's, since sending it again can't help", async () => {
    vi.mocked(syncSubscription).mockRejectedValueOnce(new UnknownPrice('Price price_x is not an Auditely plan'));
    expect((await post(updated)).status).toBe(200);
    expect(String(vi.mocked(console.error).mock.calls[0])).toContain('Ignored customer.subscription.updated evt_1');
  });

  it('answers 503 until billing is set up, naming what is missing', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    const res = await post(updated);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Billing isn't set up yet. Try again later." });
    expect(String(vi.mocked(console.error).mock.calls[0])).toContain('STRIPE_WEBHOOK_SECRET');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    expect((await post(updated)).status).toBe(503);
    expect(syncSubscription).not.toHaveBeenCalled();
  });
});
