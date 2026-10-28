// The signed-in account's logo as an image, for the header's profile menu.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
}));

const { GET } = await import('@/app/api/settings/profile/logo/route');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
let row: Record<string, unknown> | null = null;
let readError: unknown = null;
const asked: string[] = [];

const userDb = {
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: (_column: string, id: string) => ({
        maybeSingle: async () => {
          asked.push(`${table}:${columns}:${id}`);
          return { data: row, error: readError };
        },
      }),
    }),
  }),
};

beforeEach(() => {
  row = null;
  readError = null;
  asked.length = 0;
  session.current = { db: userDb, account: { id: 'u2', email: 'u2@x.com', isOwner: false } };
});

describe('GET /api/settings/profile/logo', () => {
  it("sends the account's own logo as an image, kept by the browser until the next save", async () => {
    row = { logo_data_url: `data:image/png;base64,${PNG.toString('base64')}` };
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
    expect(asked).toEqual(['profiles:logo_data_url:u2']);
  });

  it('has nothing to send without a logo, or a stored one that is not a PNG or JPEG', async () => {
    expect((await GET()).status).toBe(404);
    row = { logo_data_url: null };
    expect((await GET()).status).toBe(404);
    row = { logo_data_url: 'data:image/svg+xml;base64,PHN2Zz4=' };
    expect((await GET()).status).toBe(404);
  });

  it('asks for a sign-in, and says when the profile cannot be read', async () => {
    session.current = null;
    expect((await GET()).status).toBe(401);
    session.current = { db: userDb, account: { id: 'u2', email: 'u2@x.com', isOwner: false } };
    readError = { message: 'timeout' };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await GET()).status).toBe(503);
  });
});
