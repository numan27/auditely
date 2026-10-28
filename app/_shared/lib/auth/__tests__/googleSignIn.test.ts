// Whether "Continue with Google" is offered: hidden for the beta, and after that
// Supabase's public auth settings say if its Google provider is on, and only a
// clear "off" hides the button.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { googleProviderOn, googleSignInOn } from '@/app/_shared/lib/auth/googleSignIn';

const settings = (google: unknown, ok = true) =>
  vi.fn(async () => new Response(JSON.stringify({ external: { email: true, google } }), { status: ok ? 200 : 500 }));

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
});
afterEach(() => vi.unstubAllEnvs());

describe('googleSignInOn', () => {
  it('is hidden for the beta, even with Google turned on in Supabase', async () => {
    const fetcher = settings(true);
    expect(await googleSignInOn(fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('googleProviderOn', () => {
  it("asks the project's public auth settings, with the public key", async () => {
    const fetcher = settings(true);
    expect(await googleProviderOn(fetcher)).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/auth/v1/settings');
    expect(new Headers(init.headers).get('apikey')).toBe('anon-key');
  });

  it("is off when Supabase says Google isn't turned on", async () => {
    expect(await googleProviderOn(settings(false))).toBe(false);
  });

  it("keeps the button when the settings can't be read: a hiccup mustn't hide a working sign-in", async () => {
    expect(await googleProviderOn(settings(false, false))).toBe(true);
    expect(await googleProviderOn(vi.fn(async () => Promise.reject(new Error('offline'))))).toBe(true);
    expect(await googleProviderOn(vi.fn(async () => new Response('not json')))).toBe(true);
  });
});
