// The header's profile menu: the name, company and email it shows, and where its
// picture comes from. The logo itself never rides along with every page.

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));

import { profileCardFor } from '@/app/_shared/lib/settings/profileCard';
import type { Db } from '@/app/_shared/lib/supabase/client';

const account = { id: 'u2', email: 'numan@x.com', isOwner: false };

/** The signed-in user's client: the profile row, and whether it has a logo */
function fakeDb({ row = null as Record<string, unknown> | null, rowError = null as unknown, logos = 0, logoError = null as unknown } = {}) {
  const asked: string[] = [];
  const db = {
    from: (table: string) => ({
      select: (columns: string, options?: { head?: boolean }) => {
        asked.push(`${table}:${columns}`);
        return {
          eq: () =>
            options?.head
              ? { not: async () => ({ count: logoError ? null : logos, error: logoError }) }
              : { maybeSingle: async () => ({ data: row, error: rowError }) },
        };
      },
    }),
  };
  return { db: db as unknown as Db, asked };
}

describe('profileCardFor', () => {
  it('shows the saved name and company, and the logo by its own address, new after each save', async () => {
    const { db, asked } = fakeDb({
      row: { display_name: 'Numan Khalil', company: 'My Tool', updated_at: '2026-10-28T13:20:48.593+00:00' },
      logos: 1,
    });
    expect(await profileCardFor(db, account)).toEqual({
      name: 'Numan Khalil',
      company: 'My Tool',
      email: 'numan@x.com',
      logo: '/api/settings/profile/logo?v=2026-10-28T13%3A20%3A48.593%2B00%3A00',
    });
    // Never the logo's data with every page
    expect(asked.join(' ')).not.toContain('logo_data_url');
  });

  it('has no picture without a logo, and no name without one saved', async () => {
    const { db } = fakeDb({ row: { display_name: null, company: null, updated_at: null }, logos: 0 });
    expect(await profileCardFor(db, account)).toEqual({ name: null, company: null, email: 'numan@x.com', logo: null });
  });

  it("falls back to the email when the profile can't be read", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const blank = { name: null, company: null, email: 'numan@x.com', logo: null };
    expect(await profileCardFor(fakeDb({ rowError: { message: 'timeout' } }).db, account)).toEqual(blank);
    expect(await profileCardFor(fakeDb({ row: null }).db, account)).toEqual(blank);
    const noLogoCheck = fakeDb({ row: { display_name: 'Sam', company: null, updated_at: 'x' }, logoError: { message: 'timeout' } });
    expect((await profileCardFor(noLogoCheck.db, account)).logo).toBeNull();
  });
});
