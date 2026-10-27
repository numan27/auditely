import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { AUTOCOMPLETE_PER_DAY, AUTOCOMPLETE_PER_MINUTE } from '@/app/_shared/lib/usage/rateLimit';

const autocompleteGoogleCities = vi.hoisted(() => vi.fn());
vi.mock('@/app/_shared/lib/places/googlePlaces', () => ({ autocompleteGoogleCities }));
const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
}));

const { GET } = await import('@/app/api/autocomplete/route');

const SUGGESTIONS = [{ label: 'Austin, TX' }];
const signIn = (id: string, isOwner = false) => {
  session.current = { db: {}, account: { id, email: `${id}@x.com`, isOwner } };
};
const ask = async (input = 'aus') => (await GET(new NextRequest(`http://localhost/api/autocomplete?input=${input}`))).json();

beforeEach(() => {
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
  autocompleteGoogleCities.mockReset().mockResolvedValue(SUGGESTIONS);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('GET /api/autocomplete', () => {
  it('suggests cities for a signed-in account', async () => {
    signIn('u-suggest');
    expect(await ask()).toEqual({ suggestions: SUGGESTIONS });
    expect(autocompleteGoogleCities).toHaveBeenCalledWith('aus', 'test-key');
  });

  it('stops asking Google once an account passes its per-minute cap, without touching other accounts', async () => {
    signIn('u-minute');
    for (let i = 0; i < AUTOCOMPLETE_PER_MINUTE; i++) await ask();
    expect(await ask()).toEqual({ suggestions: [] });
    expect(autocompleteGoogleCities).toHaveBeenCalledTimes(AUTOCOMPLETE_PER_MINUTE);

    signIn('u-minute-other');
    expect(await ask()).toEqual({ suggestions: SUGGESTIONS });

    signIn('u-minute');
    vi.setSystemTime(new Date('2026-10-28T10:01:00Z'));
    expect(await ask()).toEqual({ suggestions: SUGGESTIONS });
  });

  it('stops for the rest of the day at the daily cap', async () => {
    signIn('u-day');
    let minute = 0;
    while (autocompleteGoogleCities.mock.calls.length < AUTOCOMPLETE_PER_DAY) {
      vi.setSystemTime(new Date(Date.parse('2026-10-28T10:00:00Z') + minute++ * 60_000));
      for (let i = 0; i < AUTOCOMPLETE_PER_MINUTE && autocompleteGoogleCities.mock.calls.length < AUTOCOMPLETE_PER_DAY; i++) await ask();
    }
    vi.setSystemTime(new Date(Date.parse('2026-10-28T10:00:00Z') + minute * 60_000));
    expect(await ask()).toEqual({ suggestions: [] });
    expect(autocompleteGoogleCities).toHaveBeenCalledTimes(AUTOCOMPLETE_PER_DAY);
  });

  it('never caps the owner', async () => {
    signIn('u-owner', true);
    for (let i = 0; i <= AUTOCOMPLETE_PER_MINUTE; i++) await ask();
    expect(autocompleteGoogleCities).toHaveBeenCalledTimes(AUTOCOMPLETE_PER_MINUTE + 1);
  });

  it('asks nothing for under two characters', async () => {
    signIn('u-short');
    expect(await ask('a')).toEqual({ suggestions: [] });
    expect(autocompleteGoogleCities).not.toHaveBeenCalled();
  });
});
