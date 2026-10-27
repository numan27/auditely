import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { readProxySession, withSessionCookies } from '@/app/_shared/lib/supabase/proxySession';

// A real @supabase/ssr client, with Supabase's auth API faked through fetch: the
// request's session has expired, so reading it refreshes it and writes new cookies.
const COOKIE = 'sb-example-auth-token';
const base64url = (value: string) => Buffer.from(value).toString('base64url');
const jwt = (claims: Record<string, unknown>) => `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}.c2ln`;
const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'owner@example.com', app_metadata: {}, user_metadata: {} };
const now = () => Math.floor(Date.now() / 1000);
const token = (exp: number) => jwt({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp });

function expiredSessionRequest() {
  const session = { access_token: token(now() - 60), refresh_token: 'old-refresh', expires_at: now() - 60, expires_in: 3600, token_type: 'bearer', user };
  return new NextRequest('http://localhost/', { headers: { cookie: `${COOKIE}=base64-${base64url(JSON.stringify(session))}` } });
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
function fakeAuthApi(input: RequestInfo | URL) {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes('/auth/v1/token')) {
    return json({ access_token: token(now() + 3600), refresh_token: 'new-refresh', expires_in: 3600, token_type: 'bearer', user });
  }
  if (url.endsWith('/auth/v1/user')) return json(user);
  throw new Error(`Unexpected request: ${url}`);
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => fakeAuthApi(input)));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('readProxySession', () => {
  it('writes the refreshed session cookies HttpOnly, so no script can read the refresh token', async () => {
    const { response, email } = await readProxySession(expiredSessionRequest());
    expect(email).toBe('owner@example.com');

    const written = response.cookies.getAll();
    expect(written.map((cookie) => cookie.name)).toContain(COOKIE);
    for (const cookie of written) expect(cookie, cookie.name).toMatchObject({ httpOnly: true });
    const headers = response.headers.getSetCookie();
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) expect(header).toMatch(/; HttpOnly/i);
  });

  it('marks them Secure in production only', async () => {
    const dev = await readProxySession(expiredSessionRequest());
    expect(dev.response.cookies.get(COOKIE)?.secure).toBeFalsy();

    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const fresh = await import('@/app/_shared/lib/supabase/proxySession');
    const prod = await fresh.readProxySession(expiredSessionRequest());
    expect(prod.response.cookies.get(COOKIE)).toMatchObject({ httpOnly: true, secure: true });
  });
});

describe('withSessionCookies', () => {
  it('carries the session cookies and their no-store headers onto the target', () => {
    const from = NextResponse.next();
    from.cookies.set('sb-token', 'abc');
    from.headers.set('cache-control', 'private, no-cache, no-store, must-revalidate, max-age=0');
    from.headers.set('expires', '0');
    from.headers.set('pragma', 'no-cache');

    const target = withSessionCookies(NextResponse.redirect('http://localhost/'), from);
    expect(target.cookies.get('sb-token')?.value).toBe('abc');
    expect(target.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
    expect(target.headers.get('expires')).toBe('0');
    expect(target.headers.get('pragma')).toBe('no-cache');
  });
});
