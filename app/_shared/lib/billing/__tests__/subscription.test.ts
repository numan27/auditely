import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Db } from '@/app/_shared/lib/supabase/client';
import { customerIdOf, subscriptionOf } from '@/app/_shared/lib/billing/subscription';

let filter: unknown[] = [];

/** A client whose subscriptions lookup answers `answer` and records its filter */
function db(answer: { data?: unknown; error?: { message: string } }): Db {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => {
          filter = [column, value];
          return { maybeSingle: async () => ({ data: answer.error ? null : answer.data ?? null, error: answer.error ?? null, table }) };
        },
      }),
    }),
  } as unknown as Db;
}

const row = {
  user_id: 'u2',
  plan: 'pro',
  billing_interval: 'year',
  status: 'active',
  stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_1',
  current_period_start: '2026-03-14T09:30:00.000Z',
  current_period_end: '2027-03-14T09:30:00.000Z',
  period_anchor: '2026-03-14T09:30:00.000Z',
  ends_at: null,
};

beforeEach(() => {
  filter = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('subscriptionOf', () => {
  it("reads the account's own live subscription", async () => {
    expect(await subscriptionOf(db({ data: row }), 'u2', new Date('2026-10-27T00:00:00Z'))).toEqual({
      plan: 'pro',
      interval: 'year',
      status: 'active',
      anchor: '2026-03-14T09:30:00.000Z',
      periodEnd: '2027-03-14T09:30:00.000Z',
      endsAt: null,
    });
    expect(filter).toEqual(['user_id', 'u2']);
  });

  it('reads a cancelled one, or none, as no subscription', async () => {
    expect(await subscriptionOf(db({ data: { ...row, status: 'canceled' } }), 'u2')).toBeNull();
    expect(await subscriptionOf(db({ data: null }), 'u2')).toBeNull();
  });

  it('reads a table it cannot read as no subscription, and says which migration to run', async () => {
    expect(await subscriptionOf(db({ error: { message: 'relation "subscriptions" does not exist' } }), 'u2')).toBeNull();
    expect(String(vi.mocked(console.error).mock.calls[0])).toContain('2026-10-30-subscriptions.sql');
  });
});

describe('customerIdOf', () => {
  it('finds the Stripe customer of a cancelled subscription, and throws on a read error', async () => {
    expect(await customerIdOf(db({ data: { stripe_customer_id: 'cus_1' } }), 'u2')).toBe('cus_1');
    expect(filter).toEqual(['user_id', 'u2']);
    expect(await customerIdOf(db({ data: null }), 'u2')).toBeNull();
    await expect(customerIdOf(db({ error: { message: 'down' } }), 'u2')).rejects.toThrow('down');
  });
});
