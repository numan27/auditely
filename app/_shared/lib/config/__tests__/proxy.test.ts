import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { createSessionToken, SESSION_COOKIE } from '@/app/_shared/lib/auth/session';
import { API_ROUTES, demoReportPath, ROUTES } from '@/app/_shared/lib/config/routes';

const visit = (path: string, session?: string) =>
  proxy(new NextRequest(`http://localhost${path}`, session ? { headers: { cookie: `${SESSION_COOKIE}=${session}` } } : undefined));

// Where a redirect leads (path and query); null when the request passes
const sentTo = (res: Response) => {
  const location = res.headers.get('location');
  if (!location) return null;
  const url = new URL(location);
  return `${url.pathname}${url.search}`;
};

beforeEach(() => vi.stubEnv('AUTH_SECRET', 'a'.repeat(40)));
afterEach(() => vi.unstubAllEnvs());

describe('proxy', () => {
  it('shows a logged-out visitor the demo instead of the home page', async () => {
    expect(sentTo(await visit(ROUTES.HOME))).toBe(ROUTES.DEMO);
    expect(sentTo(await visit('/?load=abc'))).toBe(ROUTES.DEMO);
  });

  it('treats an expired or forged session as logged out', async () => {
    expect(sentTo(await visit(ROUTES.HOME, '1.not-a-signature'))).toBe(ROUTES.DEMO);
    expect(sentTo(await visit(ROUTES.HOME, `${Date.now() + 60_000}.forged`))).toBe(ROUTES.DEMO);
  });

  it('lets a logged-out visitor open the demo and its reports', async () => {
    expect(sentTo(await visit(ROUTES.DEMO))).toBeNull();
    expect(sentTo(await visit(demoReportPath('demo-a1')))).toBeNull();
  });

  it('still sends every other private page to the login, remembering where to return', async () => {
    expect(sentTo(await visit(ROUTES.SEARCHES))).toBe(`${ROUTES.LOGIN}?callbackUrl=%2Fsearches`);
  });

  it('still answers 401 to a logged-out call of any API route but the login', async () => {
    for (const path of Object.values(API_ROUTES).filter((p) => p !== API_ROUTES.AUTH)) {
      expect((await visit(path)).status).toBe(401);
    }
  });

  it('gives a logged-in user the real home page, and the demo when asked for', async () => {
    const session = await createSessionToken();
    expect(sentTo(await visit(ROUTES.HOME, session))).toBeNull();
    expect(sentTo(await visit(ROUTES.DEMO, session))).toBeNull();
  });
});
