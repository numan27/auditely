import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { proxy } from '@/proxy';
import { API_ROUTES, BOTID_PATH, demoReportPath, INBOUND_ROUTES, ROUTES } from '@/app/_shared/lib/config/routes';

// The Supabase session the proxy reads: who is signed in, and a refreshed cookie on
// the response it hands back, so each test can see whether that cookie survives
const session = vi.hoisted(() => ({ email: null as string | null }));
vi.mock('@/app/_shared/lib/supabase/proxySession', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/proxySession')>()),
  readProxySession: async (request: NextRequest) => {
    const response = NextResponse.next({ request });
    response.cookies.set('sb-test-auth-token', 'refreshed', { path: '/' });
    response.headers.set('cache-control', 'private, no-cache, no-store, must-revalidate, max-age=0');
    return { response, email: session.email };
  },
}));

const visit = (path: string, email?: string) => {
  session.email = email ?? null;
  return proxy(new NextRequest(`http://localhost${path}`));
};

// Where a redirect leads (path and query); null when the request passes
const sentTo = (res: Response) => {
  const location = res.headers.get('location');
  if (!location) return null;
  const url = new URL(location);
  return `${url.pathname}${url.search}`;
};

const keepsSession = (res: Response) =>
  (res.headers.get('set-cookie') ?? '').includes('sb-test-auth-token=refreshed') &&
  (res.headers.get('cache-control') ?? '').includes('no-store');

const OWNER = 'owner@example.com';
const TESTER = 'tester@example.com';
const STRANGER = 'stranger@example.com';

beforeEach(() => {
  vi.stubEnv('OWNER_EMAIL', 'Owner@Example.com');
  vi.stubEnv('ALLOWED_EMAILS', TESTER);
  vi.stubEnv('SIGNUPS_OPEN', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('proxy', () => {
  it('shows a logged-out visitor the demo instead of the home page', async () => {
    expect(sentTo(await visit(ROUTES.HOME))).toBe(ROUTES.DEMO);
    expect(sentTo(await visit('/?load=abc'))).toBe(ROUTES.DEMO);
  });

  it('shows a signed-out visitor the landing page once sign-ups are open', async () => {
    vi.stubEnv('SIGNUPS_OPEN', 'true');
    for (const path of [ROUTES.HOME, '/?ref=hn']) {
      const res = await visit(path);
      expect(sentTo(res), path).toBeNull();
      expect(res.status, path).toBe(200);
    }
    expect(sentTo(await visit(ROUTES.SIGNUP))).toBeNull();
    expect(sentTo(await visit(ROUTES.SIGNUP, STRANGER))).toBe(ROUTES.HOME);
  });

  it('still sends a signed-out visitor to the demo while sign-ups are closed', async () => {
    expect(sentTo(await visit(ROUTES.HOME))).toBe(ROUTES.DEMO);
    expect(sentTo(await visit(ROUTES.TERMS))).toBeNull();
    expect(sentTo(await visit(ROUTES.PRIVACY))).toBeNull();
  });

  it("answers an API call without a session with 'Sign in to continue'", async () => {
    const res = await visit(API_ROUTES.SEARCHES);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sign in to continue' });
  });

  // Sign-ups are closed: a session for anyone off the list opens nothing
  it('treats a session for an email that may not sign in as logged out', async () => {
    expect(sentTo(await visit(ROUTES.HOME, STRANGER))).toBe(ROUTES.DEMO);
    expect(sentTo(await visit(ROUTES.SEARCHES, STRANGER))).toBe(`${ROUTES.LOGIN}?callbackUrl=%2Fsearches`);
    expect((await visit(API_ROUTES.SEARCHES, STRANGER)).status).toBe(401);
    expect(sentTo(await visit(ROUTES.LOGIN, STRANGER))).toBeNull();
  });

  it('lets a logged-out visitor open the demo and its reports', async () => {
    expect(sentTo(await visit(ROUTES.DEMO))).toBeNull();
    expect(sentTo(await visit(demoReportPath('demo-a1')))).toBeNull();
  });

  it('still sends every other private page to the login, remembering where to return', async () => {
    expect(sentTo(await visit(ROUTES.SEARCHES))).toBe(`${ROUTES.LOGIN}?callbackUrl=%2Fsearches`);
    expect(sentTo(await visit(`${ROUTES.REQUESTS}/r-42`))).toBe(`${ROUTES.LOGIN}?callbackUrl=%2Frequests%2Fr-42`);
  });

  it('still answers 401 to a logged-out call of any API route but the login', async () => {
    for (const path of Object.values(API_ROUTES).filter((p) => p !== API_ROUTES.AUTH && p !== API_ROUTES.FREE_AUDIT)) {
      expect((await visit(path)).status).toBe(401);
    }
  });

  it('lets a signed-out visitor run the free audit and pass its bot check', async () => {
    for (const path of [API_ROUTES.FREE_AUDIT, `${BOTID_PATH}/2d206a39-8ed7-437e-a3be-862e0f06eea3/a-4-a/c.js`]) {
      const res = await visit(path);
      expect(res.status).not.toBe(401);
      expect(sentTo(res)).toBeNull();
    }
  });

  it('lets devartventures.com send audit requests without a session', async () => {
    const res = await visit(INBOUND_ROUTES.AUDIT_REQUEST);
    expect(res.status).not.toBe(401);
    expect(sentTo(res)).toBeNull();
  });

  // The emailed link and Google land here before there is a session
  it('lets a logged-out visitor finish signing in', async () => {
    expect(sentTo(await visit(`${ROUTES.AUTH_CALLBACK}?token_hash=h1&type=email&next=%2F`))).toBeNull();
    expect(sentTo(await visit(`${ROUTES.AUTH_GOOGLE}?next=%2F`))).toBeNull();
    expect(sentTo(await visit(API_ROUTES.AUTH))).toBeNull();
  });

  it('gives a logged-in user the real home page, and the demo when asked for', async () => {
    expect(sentTo(await visit(ROUTES.HOME, OWNER))).toBeNull();
    expect(sentTo(await visit(ROUTES.DEMO, OWNER))).toBeNull();
    expect(sentTo(await visit(ROUTES.SEARCHES, TESTER))).toBeNull();
    expect((await visit(API_ROUTES.SEARCHES, TESTER)).status).not.toBe(401);
  });

  it('sends a logged-in user from the login page home, but lets a callback finish', async () => {
    expect(sentTo(await visit(ROUTES.LOGIN, OWNER))).toBe(ROUTES.HOME);
    expect(sentTo(await visit(`${ROUTES.AUTH_CALLBACK}?code=c1&next=%2Fsearches`, OWNER))).toBeNull();
  });

  // A dropped refresh would sign the user out on the next request; a cached one could
  // hand their session to someone else
  it('keeps the refreshed session cookie, uncached, on every answer', async () => {
    const answers = [
      await visit(ROUTES.HOME),
      await visit(ROUTES.SEARCHES),
      await visit(API_ROUTES.SEARCHES),
      await visit(ROUTES.LOGIN, OWNER),
      await visit(ROUTES.HOME, OWNER),
      await visit(ROUTES.DEMO),
    ];
    for (const res of answers) expect(keepsSession(res)).toBe(true);
  });
});
