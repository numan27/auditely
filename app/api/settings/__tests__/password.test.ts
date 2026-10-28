// Setting a password from Settings: a signed-in account sets or changes its own,
// as long as it's 8 to 72 characters, and Supabase's refusals say what to do.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
}));

const { PUT } = await import('@/app/api/settings/password/route');

const updateUser = vi.fn();
const put = (body: unknown) =>
  PUT(new NextRequest('http://localhost/api/settings/password', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => {
  updateUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  session.current = { db: { auth: { updateUser } }, account: { id: 'u1', email: 'u1@x.com', isOwner: false } };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PUT /api/settings/password', () => {
  it('needs a signed-in account', async () => {
    session.current = null;
    expect((await put({ password: 'long enough' })).status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('sets the password on the signed-in account', async () => {
    const res = await put({ password: 'correct horse battery' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ saved: true });
    expect(updateUser).toHaveBeenCalledWith({ password: 'correct horse battery' });
  });

  it('asks for 8 to 72 characters', async () => {
    for (const body of [{}, { password: '' }, { password: 'short' }, { password: 42 }, 'not json']) {
      const res = await put(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Use at least 8 characters.' });
    }
    const long = await put({ password: 'x'.repeat(73) });
    expect(await long.json()).toEqual({ error: 'Use 72 characters or fewer.' });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('says so when it is already the password', async () => {
    updateUser.mockResolvedValue({ data: { user: null }, error: { status: 422, code: 'same_password', message: 'New password should be different' } });
    const res = await put({ password: 'the same one' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "That's already your password." });
  });

  it('asks for a stronger one when Supabase calls it weak', async () => {
    updateUser.mockResolvedValue({ data: { user: null }, error: { status: 422, code: 'weak_password', message: 'Password is known to be weak' } });
    const res = await put({ password: 'password1' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Choose a stronger password: this one is too easy to guess.' });
  });

  it("says it wasn't saved when Supabase fails", async () => {
    updateUser.mockResolvedValue({ data: { user: null }, error: { status: 500, code: 'unexpected_failure', message: 'boom' } });
    const res = await put({ password: 'correct horse battery' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Your password wasn't saved. Try again." });
  });
});
