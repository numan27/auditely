import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openBilling } from '@/app/_shared/components/auditely/billing/billingRequest';

const fetchMock = vi.fn();
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('openBilling', () => {
  it("hands back Stripe's page, or the server's message", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { url: 'https://checkout.stripe.com/c/1' }));
    expect(await openBilling('/api/billing/checkout', { plan: 'pro', interval: 'month' })).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/1' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ plan: 'pro', interval: 'month' }) });
    fetchMock.mockResolvedValueOnce(json(409, { error: 'You’re already on the Pro plan.' }));
    expect(await openBilling('/x', {})).toEqual({ ok: false, error: 'You’re already on the Pro plan.' });
  });

  it('refuses a page that is not https, and says when Auditely is unreachable', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { url: 'javascript:alert(1)' }));
    expect(await openBilling('/x', {})).toEqual({ ok: false, error: "Couldn't open Stripe. Try again." });
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    expect(await openBilling('/x', {})).toEqual({ ok: false, error: "Couldn't open Stripe. Try again." });
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(await openBilling('/x', {})).toEqual({ ok: false, error: "Couldn't reach Auditely. Check your connection and try again." });
  });
});
