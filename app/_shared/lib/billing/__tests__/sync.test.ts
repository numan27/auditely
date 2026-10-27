import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/app/_shared/lib/billing/subscriptionStore', () => ({
  saveSubscription: vi.fn(async () => 'saved'),
  userIdForCustomer: vi.fn(async () => null),
}));

const { saveSubscription, userIdForCustomer } = await import('@/app/_shared/lib/billing/subscriptionStore');
const { UnknownPrice, rowFromStripe, syncCheckoutSession, syncSubscription } = await import('@/app/_shared/lib/billing/sync');

const retrieveSub = vi.fn();
const retrieveSession = vi.fn();
const stripe = {
  subscriptions: { retrieve: retrieveSub },
  checkout: { sessions: { retrieve: retrieveSession } },
} as never;

const stripeSub = {
  id: 'sub_1', status: 'active', customer: 'cus_1', metadata: { user_id: 'u2' },
  billing_cycle_anchor: 1773480600 /* 2026-03-14T09:30Z */, cancel_at: null, cancel_at_period_end: true,
  items: { data: [{ current_period_start: 1773480600, current_period_end: 1805016600 /* 2027-03-14T09:30Z */,
    price: { id: 'price_a', lookup_key: 'auditely_agency_yearly' } }] },
};

beforeEach(() => {
  retrieveSub.mockReset();
  retrieveSession.mockReset();
  vi.mocked(saveSubscription).mockClear();
  vi.mocked(userIdForCustomer).mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('rowFromStripe', () => {
  it("maps a yearly Agency subscription that won't renew", () => {
    expect(rowFromStripe(stripeSub as never, 'u2')).toEqual({ user_id: 'u2', plan: 'agency', billing_interval: 'year', status: 'active',
      stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', current_period_start: '2026-03-14T09:30:00.000Z',
      current_period_end: '2027-03-14T09:30:00.000Z', period_anchor: '2026-03-14T09:30:00.000Z', ends_at: '2027-03-14T09:30:00.000Z' });
  });

  it('takes a set stop date, the customer from an expanded object, and renews with no end', () => {
    const cancelAt = { ...stripeSub, customer: { id: 'cus_9' }, cancel_at: 1790000000, cancel_at_period_end: false };
    expect(rowFromStripe(cancelAt as never, 'u2')).toMatchObject({ stripe_customer_id: 'cus_9', ends_at: new Date(1790000000e3).toISOString() });
    expect(rowFromStripe({ ...stripeSub, cancel_at_period_end: false } as never, 'u2').ends_at).toBeNull();
  });

  it('refuses a price that is not one of the four plans', () => {
    const other = { ...stripeSub, items: { data: [{ ...stripeSub.items.data[0], price: { id: 'price_x', lookup_key: null } }] } };
    expect(() => rowFromStripe(other as never, 'u2')).toThrow(UnknownPrice);
    expect(() => rowFromStripe(other as never, 'u2')).toThrow('price_x');
  });
});

describe('syncSubscription', () => {
  it('re-reads the subscription from Stripe and saves it to the account in its metadata', async () => {
    retrieveSub.mockResolvedValue(stripeSub);
    expect(await syncSubscription(stripe, 'sub_1')).toBe('saved');
    expect(retrieveSub).toHaveBeenCalledWith('sub_1');
    expect(vi.mocked(saveSubscription).mock.calls[0][0]).toMatchObject({ user_id: 'u2', plan: 'agency' });
  });

  it("falls back to the customer's account, and saves nothing when there is none", async () => {
    retrieveSub.mockResolvedValue({ ...stripeSub, metadata: {} });
    vi.mocked(userIdForCustomer).mockResolvedValueOnce('u7').mockResolvedValueOnce(null);
    expect(await syncSubscription(stripe, 'sub_1')).toBe('saved');
    expect(vi.mocked(saveSubscription).mock.calls[0][0]).toMatchObject({ user_id: 'u7' });
    expect(await syncSubscription(stripe, 'sub_1')).toBe('unmatched');
    expect(saveSubscription).toHaveBeenCalledTimes(1);
  });

  it('takes the hint when the metadata names no account', async () => {
    retrieveSub.mockResolvedValue({ ...stripeSub, metadata: {} });
    expect(await syncSubscription(stripe, 'sub_1', 'u4')).toBe('saved');
    expect(vi.mocked(saveSubscription).mock.calls[0][0]).toMatchObject({ user_id: 'u4' });
    expect(userIdForCustomer).not.toHaveBeenCalled();
  });
});

describe('syncCheckoutSession', () => {
  it("refuses another account's Checkout session without reading its subscription", async () => {
    retrieveSession.mockResolvedValue({ client_reference_id: 'u9', mode: 'subscription', subscription: 'sub_1' });
    expect(await syncCheckoutSession(stripe, 'cs_test_1', 'u2')).toBe('refused');
    expect(retrieveSub).not.toHaveBeenCalled();
  });

  it('refuses a session whose subscription names another account', async () => {
    retrieveSession.mockResolvedValue({ client_reference_id: 'u2', mode: 'subscription', subscription: 'sub_1' });
    retrieveSub.mockResolvedValue({ ...stripeSub, metadata: { user_id: 'u9' } });
    expect(await syncCheckoutSession(stripe, 'cs_test_1', 'u2')).toBe('refused');
    expect(saveSubscription).not.toHaveBeenCalled();
  });

  it("saves the account's own completed session, and refuses one with no subscription", async () => {
    retrieveSession.mockResolvedValue({ client_reference_id: 'u2', mode: 'subscription', subscription: { id: 'sub_1' } });
    retrieveSub.mockResolvedValue(stripeSub);
    expect(await syncCheckoutSession(stripe, 'cs_test_1', 'u2')).toBe('saved');
    expect(retrieveSession).toHaveBeenCalledWith('cs_test_1');
    expect(retrieveSub).toHaveBeenCalledWith('sub_1');
    retrieveSession.mockResolvedValue({ client_reference_id: 'u2', mode: 'payment', subscription: null });
    expect(await syncCheckoutSession(stripe, 'cs_test_2', 'u2')).toBe('refused');
  });
});
