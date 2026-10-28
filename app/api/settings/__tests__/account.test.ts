// Deleting an account from Settings: the account types its email to confirm, any
// subscription it has ends at once with no refund, then the user and everything
// in it go and this browser is signed out. The owner's account can't be deleted,
// and nothing is deleted while a subscription might still bill.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const fake = vi.hoisted(() => ({
  session: null as unknown,
  ready: true,
  steps: [] as string[],
  deleteUser: vi.fn(),
  signOut: vi.fn(),
  customers: { list: vi.fn() },
  subscriptions: { list: vi.fn(), cancel: vi.fn() },
}));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: { auth: { admin: { deleteUser: fake.deleteUser } } } }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => fake.session,
}));
vi.mock('@/app/_shared/lib/billing/stripe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/billing/stripe')>()),
  stripeClient: () => (fake.ready ? { customers: fake.customers, subscriptions: fake.subscriptions } : null),
}));
vi.mock('@/app/_shared/lib/billing/subscription', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/billing/subscription')>()),
  customerIdOf: vi.fn(async () => null),
}));

const { customerIdOf } = await import('@/app/_shared/lib/billing/subscription');
const { DELETE } = await import('@/app/api/settings/account/route');

const NOT_DELETED = { error: "Your account wasn't deleted. Try again in a minute." };
const tester = { id: 'u2', email: 'tester@x.com', isOwner: false, subscription: null };
const livePro = { plan: 'pro', interval: 'month', status: 'active', anchor: '2026-10-14T09:30:00.000Z', periodEnd: '2999-11-14T09:30:00.000Z', endsAt: null };

const remove = (body: unknown) =>
  DELETE(
    new NextRequest('http://localhost/api/settings/account', {
      method: 'DELETE',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );

beforeEach(() => {
  fake.ready = true;
  fake.steps = [];
  fake.session = { db: { auth: { signOut: fake.signOut } }, account: tester };
  fake.deleteUser.mockReset().mockImplementation(async (id: string) => {
    fake.steps.push(`delete ${id}`);
    return { data: { user: null }, error: null };
  });
  fake.signOut.mockReset().mockImplementation(async (options: unknown) => {
    fake.steps.push(`sign out ${JSON.stringify(options)}`);
    return { error: null };
  });
  fake.customers.list.mockReset().mockResolvedValue({ data: [] });
  fake.subscriptions.list.mockReset().mockResolvedValue({ data: [] });
  fake.subscriptions.cancel.mockReset().mockImplementation(async (id: string) => {
    fake.steps.push(`cancel ${id}`);
    return {};
  });
  vi.mocked(customerIdOf).mockReset().mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('DELETE /api/settings/account', () => {
  it('needs a signed-in account', async () => {
    fake.session = null;
    expect((await remove({ confirm: 'tester@x.com' })).status).toBe(401);
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });

  it("won't delete the owner's account", async () => {
    fake.session = { db: { auth: { signOut: fake.signOut } }, account: { ...tester, email: 'owner@x.com', isOwner: true } };
    const res = await remove({ confirm: 'owner@x.com' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "This is the owner's account, which runs Auditely. It can't be deleted." });
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });

  it("asks for the account's email before deleting anything", async () => {
    for (const body of [{}, { confirm: '' }, { confirm: 'someone@else.com' }, { confirm: 42 }, 'not json']) {
      const res = await remove(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Type your email to confirm.', field: 'confirm' });
    }
    expect(fake.deleteUser).not.toHaveBeenCalled();
    expect(fake.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it('deletes the account and signs this browser out', async () => {
    const res = await remove({ confirm: '  Tester@X.com ' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(fake.steps).toEqual(['delete u2', 'sign out {"scope":"local"}']);
  });

  it('ends the subscription at once, with no refund, before deleting the account', async () => {
    vi.mocked(customerIdOf).mockResolvedValue('cus_2');
    fake.subscriptions.list.mockResolvedValue({ data: [{ id: 'sub_2', status: 'active' }, { id: 'sub_old', status: 'canceled' }] });
    expect((await remove({ confirm: 'tester@x.com' })).status).toBe(200);
    expect(customerIdOf).toHaveBeenCalledWith(expect.anything(), 'u2');
    expect(fake.subscriptions.list).toHaveBeenCalledWith({ customer: 'cus_2', status: 'all', limit: 100 });
    expect(fake.steps).toEqual(['cancel sub_2', 'delete u2', 'sign out {"scope":"local"}']);
    expect(fake.subscriptions.cancel).toHaveBeenCalledWith('sub_2');
  });

  it("finds the account's Stripe customer by its email when no subscription was recorded", async () => {
    fake.customers.list.mockResolvedValue({ data: [{ id: 'cus_9', metadata: { user_id: 'u2' } }] });
    fake.subscriptions.list.mockResolvedValue({ data: [{ id: 'sub_9', status: 'trialing' }] });
    expect((await remove({ confirm: 'tester@x.com' })).status).toBe(200);
    expect(fake.customers.list).toHaveBeenCalledWith({ email: 'tester@x.com', limit: 100 });
    expect(fake.steps).toEqual(['cancel sub_9', 'delete u2', 'sign out {"scope":"local"}']);
  });

  it("keeps the account when its subscription can't be read or cancelled", async () => {
    vi.mocked(customerIdOf).mockRejectedValue(new Error('down'));
    let res = await remove({ confirm: 'tester@x.com' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(NOT_DELETED);

    vi.mocked(customerIdOf).mockResolvedValue('cus_2');
    fake.subscriptions.list.mockResolvedValue({ data: [{ id: 'sub_2', status: 'active' }] });
    fake.subscriptions.cancel.mockRejectedValue(new Error('Stripe is down'));
    res = await remove({ confirm: 'tester@x.com' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(NOT_DELETED);
    expect(fake.deleteUser).not.toHaveBeenCalled();
    expect(String(vi.mocked(console.error).mock.calls.at(-1))).toContain("Couldn't end u2's subscription");
  });

  it("keeps an account with a subscription while billing isn't set up, since it couldn't be cancelled", async () => {
    fake.ready = false;
    fake.session = { db: { auth: { signOut: fake.signOut } }, account: { ...tester, subscription: livePro } };
    const res = await remove({ confirm: 'tester@x.com' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Your subscription can't be cancelled right now, so your account wasn't deleted. Try again later.",
    });
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes an account with no subscription while billing isn't set up", async () => {
    fake.ready = false;
    expect((await remove({ confirm: 'tester@x.com' })).status).toBe(200);
    expect(customerIdOf).not.toHaveBeenCalled();
    expect(fake.steps).toEqual(['delete u2', 'sign out {"scope":"local"}']);
  });

  it("says the account wasn't deleted when Supabase fails, and stays signed in", async () => {
    fake.deleteUser.mockResolvedValue({ data: { user: null }, error: { status: 500, message: 'boom' } });
    const res = await remove({ confirm: 'tester@x.com' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(NOT_DELETED);
    expect(fake.signOut).not.toHaveBeenCalled();
    expect(String(vi.mocked(console.error).mock.calls.at(-1))).toContain('boom');
  });

  it('still answers deleted when the sign-out fails, since the account is gone', async () => {
    fake.signOut.mockRejectedValue(new Error('network'));
    const res = await remove({ confirm: 'tester@x.com' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
  });
});
