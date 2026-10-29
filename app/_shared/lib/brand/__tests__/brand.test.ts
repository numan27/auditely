import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveBrand } from '@/app/_shared/lib/brand/brandRules';

// The profiles lookup answers row/error, the subscriptions lookup subscription/subscriptionError
const db = vi.hoisted(() => ({
  row: null as unknown,
  error: null as unknown,
  subscription: null as unknown,
  subscriptionError: null as unknown,
  asked: [] as unknown[],
}));
vi.mock('@/app/_shared/lib/supabase/client', () => ({
  serviceDb: {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            db.asked.push({ table, columns, column, value });
            if (table === 'subscriptions') {
              return { data: db.subscriptionError ? null : db.subscription, error: db.subscriptionError };
            }
            return { data: db.error ? null : db.row, error: db.error };
          },
        }),
      }),
    }),
  },
}));

const { brandFor, emailLogo, BrandUnavailable, settingsUnavailable } = await import('@/app/_shared/lib/brand/brand');

// A 1×1 PNG and the first bytes of a JPEG
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

const ownerBrand = resolveBrand({ profile: null, isOwner: true, plan: 'owner' });
const auditelyBrand = resolveBrand({ profile: null, isOwner: false, plan: 'free' });

beforeEach(() => {
  db.row = null;
  db.error = null;
  db.subscription = null;
  db.subscriptionError = null;
  db.asked = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('brandFor', () => {
  it('brands the owner from the profile, by email', async () => {
    vi.stubEnv('OWNER_EMAIL', 'owner@x.com');
    db.row = { id: 'u1', email: 'owner@x.com', company: null };
    expect((await brandFor('u1')).kind).toBe('owner');
    expect(db.asked).toContainEqual({ table: 'profiles', columns: '*', column: 'id', value: 'u1' });
  });

  it('reads a profile from before the migration, with none of the new columns', async () => {
    db.row = { id: 'u2', email: 'zed@x.com' };
    expect((await brandFor('u2')).kind).toBe('auditely');
  });

  it('gives a tester on a paid plan their own brand', async () => {
    vi.stubEnv('PLAN_OVERRIDES', 'sam@x.com:pro');
    db.row = { id: 'u3', email: 'sam@x.com', display_name: 'Sam', company: 'Acme', logo_data_url: PNG };
    const brand = await brandFor('u3');
    expect([brand.kind, brand.name, brand.logo?.contentType]).toEqual(['account', 'Acme', 'image/png']);
  });

  it('gives a Free account Auditely’s brand after the beta, whatever its profile says', async () => {
    vi.stubEnv('NEXT_PUBLIC_BETA_MODE', 'false');
    db.row = { id: 'u4', email: 'free@x.com', company: 'Acme' };
    expect((await brandFor('u4')).kind).toBe('auditely');
  });

  it('gives a Free account Auditely’s brand during the beta too', async () => {
    vi.stubEnv('NEXT_PUBLIC_BETA_MODE', 'true');
    db.row = { id: 'u4', email: 'free@x.com', company: 'Acme' };
    expect((await brandFor('u4')).kind).toBe('auditely');
  });

  it('gives a row from before accounts, or an account with no profile, Auditely’s brand', async () => {
    expect((await brandFor(null)).kind).toBe('auditely');
    expect(db.asked).toEqual([]);
    expect((await brandFor('u5')).kind).toBe('auditely');
  });

  it('brands the reports of an account that pays through Stripe', async () => {
    db.row = { id: 'u2', email: 'sam@x.com', display_name: 'Sam', company: 'Acme' };
    db.subscription = {
      plan: 'pro', billing_interval: 'month', status: 'active', period_anchor: '2026-10-14T09:30:00.000Z',
      current_period_end: '2999-11-14T09:30:00.000Z', ends_at: null,
    };
    expect((await brandFor('u2')).kind).not.toBe('auditely');
    expect(db.asked).toContainEqual(expect.objectContaining({ table: 'subscriptions', column: 'user_id', value: 'u2' }));
  });

  it('brands as Free while the subscriptions table is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_BETA_MODE', 'false');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.row = { id: 'u2', email: 'sam@x.com', display_name: 'Sam', company: 'Acme' };
    db.subscriptionError = { message: 'relation "subscriptions" does not exist' };
    expect((await brandFor('u2')).kind).toBe('auditely');
  });

  it('refuses to guess when the profile can’t be read', async () => {
    db.error = { message: 'timeout' };
    await expect(brandFor('u1')).rejects.toBeInstanceOf(BrandUnavailable);
  });
});

describe('emailLogo', () => {
  it('gives the owner today’s logo file in emails, and nobody else', async () => {
    expect(await emailLogo({ ...ownerBrand, logo: null })).toMatchObject({ filename: 'brand-logo.png', contentType: 'image/png' });
    expect(await emailLogo({ ...auditelyBrand })).toBeNull();
  });

  it('attaches the profile’s own logo, decoded, named for its type', async () => {
    const png = await emailLogo({ ...ownerBrand, logo: { contentType: 'image/png', dataUrl: PNG } });
    expect(png?.filename).toBe('brand-logo.png');
    expect([...png!.content.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const jpeg = await emailLogo({ ...auditelyBrand, kind: 'account', logo: { contentType: 'image/jpeg', dataUrl: JPEG } });
    expect([jpeg?.filename, jpeg?.contentType, jpeg?.content[0]]).toEqual(['brand-logo.jpg', 'image/jpeg', 0xff]);
  });
});

describe('settingsUnavailable', () => {
  it('names the migration to the owner, and nothing technical to anyone else', () => {
    expect(settingsUnavailable(true)).toBe('Settings need the latest database update: run docs/migrations/2026-10-29-settings.sql in Supabase.');
    expect(settingsUnavailable(false)).toBe("Settings can't be saved right now. Try again later.");
  });
});
