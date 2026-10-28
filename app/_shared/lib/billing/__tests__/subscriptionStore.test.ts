import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The service client over subscriptions: a lookup answers `existing` (or `error`), an upsert is recorded
const db = vi.hoisted(() => ({
  existing: null as unknown,
  error: null as { message: string } | null,
  upsertError: null as { message: string; code?: string } | null,
  lookups: [] as unknown[][],
  upserts: [] as unknown[][],
}));
vi.mock('@/app/_shared/lib/supabase/client', () => ({
  serviceDb: {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => {
          db.lookups.push([table, columns, column, value]);
          return { maybeSingle: async () => ({ data: db.error ? null : db.existing, error: db.error }) };
        },
      }),
      upsert: async (payload: unknown, options: unknown) => {
        db.upserts.push([payload, options]);
        return { error: db.upsertError };
      },
    }),
  },
}));

const { saveSubscription, userIdForCustomer } = await import('@/app/_shared/lib/billing/subscriptionStore');

const row = {
  user_id: 'u2',
  plan: 'pro',
  billing_interval: 'month',
  status: 'active',
  stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_1',
  current_period_start: '2026-10-14T09:30:00.000Z',
  current_period_end: '2026-11-14T09:30:00.000Z',
  period_anchor: '2026-10-14T09:30:00.000Z',
  ends_at: null,
} as const;
const incoming = { ...row, stripe_subscription_id: 'sub_old', status: 'canceled' };

beforeEach(() => {
  db.existing = null;
  db.error = null;
  db.upsertError = null;
  db.lookups = [];
  db.upserts = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('saveSubscription', () => {
  it('keeps a live subscription when a late event for an older, ended one arrives', async () => {
    db.existing = { stripe_subscription_id: 'sub_new', status: 'active' };
    expect(await saveSubscription(incoming)).toBe('kept');
    expect(db.upserts).toEqual([]);
  });

  it('records the cancellation of the subscription it holds', async () => {
    db.existing = { stripe_subscription_id: 'sub_old', status: 'active' };
    expect(await saveSubscription(incoming)).toBe('saved');
    expect(db.upserts[0][0]).toMatchObject({ user_id: 'u2', stripe_subscription_id: 'sub_old', status: 'canceled' });
    expect(db.upserts[0][1]).toEqual({ onConflict: 'user_id' });
  });

  it('replaces an ended row with a new live subscription', async () => {
    db.existing = { stripe_subscription_id: 'sub_old', status: 'canceled' };
    expect(await saveSubscription({ ...row, stripe_subscription_id: 'sub_new' })).toBe('saved');
    expect(db.upserts[0][0]).toMatchObject({ stripe_subscription_id: 'sub_new', updated_at: expect.any(String) });
  });

  it('says so when an account ends up with two live subscriptions', async () => {
    db.existing = { stripe_subscription_id: 'sub_a', status: 'active' };
    expect(await saveSubscription({ ...row, stripe_subscription_id: 'sub_b' })).toBe('saved');
    expect(String(vi.mocked(console.error).mock.calls[0])).toContain('two live subscriptions');
  });

  it('throws when the account can’t be read or written', async () => {
    db.error = { message: 'down' };
    await expect(saveSubscription(row)).rejects.toThrow('down');
    db.error = null;
    db.upsertError = { message: 'duplicate key' };
    await expect(saveSubscription(row)).rejects.toThrow('duplicate key');
  });

  it("acknowledges an event for an account that was deleted, since sending it again can't save it", async () => {
    db.upsertError = { code: '23503', message: 'insert or update on table "subscriptions" violates foreign key constraint' };
    expect(await saveSubscription({ ...row, status: 'canceled' })).toBe('unmatched');
    expect(String(vi.mocked(console.error).mock.calls[0])).toContain("[billing] Subscription sub_1's account u2 was deleted");
  });
});

describe('userIdForCustomer', () => {
  it('finds the account a Stripe customer belongs to, and throws on a read error', async () => {
    db.existing = { user_id: 'u7' };
    expect(await userIdForCustomer('cus_7')).toBe('u7');
    expect(db.lookups[0]).toEqual(['subscriptions', 'user_id', 'stripe_customer_id', 'cus_7']);
    db.existing = null;
    expect(await userIdForCustomer('cus_8')).toBeNull();
    db.error = { message: 'down' };
    await expect(userIdForCustomer('cus_9')).rejects.toThrow('down');
  });
});
