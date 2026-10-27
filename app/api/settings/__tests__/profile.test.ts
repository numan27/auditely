import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
}));

const { PUT } = await import('@/app/api/settings/profile/route');

let updates: { table: string; id: string; values: Record<string, unknown> }[] = [];
let updateError: unknown = null;
let updatedRows: unknown[] = [];

// The signed-in user's own client: records each update instead of running it
const userDb = {
  from: (table: string) => ({
    update: (values: Record<string, unknown>) => ({
      eq: (_column: string, id: string) => ({
        select: async () => {
          updates.push({ table, id, values });
          return updateError ? { data: null, error: updateError } : { data: updatedRows, error: null };
        },
      }),
    }),
  }),
};
const signIn = (id: string, email = `${id}@x.com`, isOwner = false) => {
  session.current = { db: userDb, account: { id, email, isOwner } };
};
const put = (body: unknown) =>
  new NextRequest('http://localhost/api/settings/profile', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(() => {
  updates = [];
  updateError = null;
  updatedRows = [{ id: 'u2' }];
  signIn('u2');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('PUT /api/settings/profile', () => {
  it('saves the signed-in user’s own profile, as that user', async () => {
    const res = await PUT(put({ display_name: 'Sam', company: 'Acme' }));
    expect(res.status).toBe(200);
    expect(updates).toEqual([
      { table: 'profiles', id: 'u2', values: expect.objectContaining({ display_name: 'Sam', company: 'Acme', updated_at: expect.any(String) }) },
    ]);
    expect((await res.json()).profile).toEqual({
      display_name: 'Sam',
      company: 'Acme',
      website: null,
      logo_data_url: null,
      contact_email: null,
      contact_phone: null,
      booking_url: null,
    });
  });

  it('never writes the email or the id, whatever the request sends', async () => {
    await PUT(put({ company: 'Acme', email: 'other@x.com', id: 'u9' }));
    expect(Object.keys(updates[0].values)).not.toContain('email');
    expect(Object.keys(updates[0].values)).not.toContain('id');
    expect(updates[0].id).toBe('u2');
  });

  it('names the field a bad value is in', async () => {
    const res = await PUT(put({ website: 'ftp://x' }));
    expect([res.status, (await res.json()).field]).toEqual([400, 'website']);
    expect(updates).toEqual([]);
  });

  it('refuses a body that isn’t a JSON object, instead of clearing the profile', async () => {
    for (const body of ['not json', 'null', '"Acme"']) {
      const res = await PUT(put(body));
      expect(res.status).toBe(400);
    }
    expect(updates).toEqual([]);
  });

  it('asks for the migration when the columns aren’t there yet, in words for whoever is signed in', async () => {
    updateError = { code: 'PGRST204', message: "Could not find the 'company' column" };
    const res = await PUT(put({ company: 'Acme' }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Settings can't be saved right now. Try again later.");

    vi.stubEnv('OWNER_EMAIL', 'owner@x.com');
    signIn('u1', 'owner@x.com', true);
    updateError = { code: '42703', message: 'column "company" does not exist' };
    expect((await (await PUT(put({ company: 'Acme' }))).json()).error).toBe(
      'Settings need the latest database update: run docs/migrations/2026-10-29-settings.sql in Supabase.'
    );
  });

  it('says the profile wasn’t saved on any other database error', async () => {
    updateError = { code: '57014', message: 'canceling statement due to statement timeout' };
    const res = await PUT(put({ company: 'Acme' }));
    expect([res.status, (await res.json()).error]).toEqual([500, "Your profile wasn't saved. Try again."]);
  });

  it('answers 404 when the account has no profile row', async () => {
    updatedRows = [];
    const res = await PUT(put({ company: 'Acme' }));
    expect([res.status, (await res.json()).error]).toEqual([404, 'Profile not found']);
  });
});
