import { describe, it, expect } from 'vitest';
import {
  API_ROUTES,
  demoReportPath,
  INBOUND_ROUTES,
  isAuthRoute,
  isHomeAlias,
  isProtectedRoute,
  isPublicRoute,
  BOTID_PATH,
  ROUTES,
  safeCallbackUrl,
} from '@/app/_shared/lib/config/routes';

describe('route access', () => {
  it('opens report links without a login, and nothing else new', () => {
    expect(isPublicRoute(`${ROUTES.REPORT}/abc.def`)).toBe(true);
    expect(isPublicRoute('/reports')).toBe(false);
    expect(isProtectedRoute('/api/crm')).toBe(true);
    expect(isProtectedRoute('/api/pdf')).toBe(true);
    expect(isProtectedRoute(ROUTES.DASHBOARD)).toBe(true);
  });

  it('lets a visitor reach the free audit without signing in', () => {
    expect(isPublicRoute(API_ROUTES.FREE_AUDIT)).toBe(true);
    expect(API_ROUTES.FREE_AUDIT).toBe('/api/free-audit');
    expect(isPublicRoute('/api/free-audits')).toBe(false);
  });

  // withBotId (next.config.ts) rewrites BotID's challenge script and its calls to Vercel
  it("lets BotID's challenge through, so a signed-out visitor can pass it", () => {
    expect(isPublicRoute(`${BOTID_PATH}/2d206a39-8ed7-437e-a3be-862e0f06eea3/a-4-a/c.js`)).toBe(true);
    expect(BOTID_PATH).toBe('/149e9513-01fa-4fb0-aad4-566afd725d1b');
  });

  it('treats /home as another address for the home page, and nothing else', () => {
    expect(isHomeAlias('/home')).toBe(true);
    expect(isHomeAlias(ROUTES.HOME)).toBe(false);
    expect(isHomeAlias('/home/extra')).toBe(false);
    expect(isHomeAlias(ROUTES.SEARCHES)).toBe(false);
  });

  it('opens the demo and its reports, and no API route but signing in, the free audit and the contact form', () => {
    expect(isPublicRoute(ROUTES.DEMO)).toBe(true);
    expect(demoReportPath('demo-a1')).toBe('/demo/report/demo-a1');
    expect(isPublicRoute(demoReportPath('demo-a1'))).toBe(true);
    expect(isPublicRoute('/demos')).toBe(false);
    const open: string[] = [API_ROUTES.AUTH, API_ROUTES.AUTH_PASSWORD, API_ROUTES.FREE_AUDIT, API_ROUTES.CONTACT];
    for (const path of Object.values(API_ROUTES)) expect(isProtectedRoute(path)).toBe(!open.includes(path));
    expect(isProtectedRoute('/api/autocomplete')).toBe(true);
  });

  // devartventures.com's server has no session: the route checks the shared secret itself
  it('opens the inbound audit request route, and not the Requests tab behind it', () => {
    expect(isPublicRoute(INBOUND_ROUTES.AUDIT_REQUEST)).toBe(true);
    expect(isProtectedRoute(API_ROUTES.AUDIT_REQUESTS)).toBe(true);
    expect(isProtectedRoute('/api/inbound')).toBe(true);
    expect(isProtectedRoute('/api/inbound/other')).toBe(true);
  });

  it('keeps buying, managing billing and the return from Checkout behind a sign-in', () => {
    expect(isProtectedRoute(ROUTES.PLANS_DONE)).toBe(true);
    expect(isProtectedRoute(API_ROUTES.BILLING_CHECKOUT)).toBe(true);
    expect(isProtectedRoute(API_ROUTES.BILLING_PORTAL)).toBe(true);
  });

  // Stripe has no session either: the route checks Stripe's signature itself
  it("lets Stripe's webhook through without a session, and nothing else under /api/stripe", () => {
    expect(isPublicRoute(INBOUND_ROUTES.STRIPE_WEBHOOK)).toBe(true);
    expect(isPublicRoute('/api/stripe/webhook')).toBe(true);
    expect(isProtectedRoute('/api/stripe')).toBe(true);
  });

  // The sign-in link and Google both come back here before there is a session; a
  // signed-in user isn't bounced away, so a second sign-in still finishes
  it('keeps signup, Terms and Privacy public', () => {
    expect([ROUTES.SIGNUP, ROUTES.TERMS, ROUTES.PRIVACY]).toEqual(['/signup', '/terms', '/privacy']);
    for (const path of [ROUTES.SIGNUP, ROUTES.TERMS, ROUTES.PRIVACY]) expect(isPublicRoute(path), path).toBe(true);
    // A signed-in user is sent home from the sign-up page, as from the login
    expect(isAuthRoute(ROUTES.SIGNUP)).toBe(true);
    expect(isAuthRoute(ROUTES.TERMS)).toBe(false);
  });

  // The form checks BotID and its own limit, like the free audit
  it('opens the contact page and the route its form sends to', () => {
    expect([ROUTES.CONTACT, API_ROUTES.CONTACT]).toEqual(['/contact', '/api/contact']);
    expect(isPublicRoute(ROUTES.CONTACT)).toBe(true);
    expect(isPublicRoute(API_ROUTES.CONTACT)).toBe(true);
    expect(isAuthRoute(ROUTES.CONTACT)).toBe(false);
    expect(isProtectedRoute('/contacts')).toBe(true);
  });

  // Search engines read these without an account
  it('lets anyone read robots.txt and the sitemap', () => {
    expect(isPublicRoute('/robots.txt')).toBe(true);
    expect(isPublicRoute('/sitemap.xml')).toBe(true);
  });

  // Link previews fetch it without an account
  it('lets anyone load the share image', () => {
    expect(isPublicRoute('/opengraph-image')).toBe(true);
  });

  it('opens the sign-in callback and the Google start without a login', () => {
    expect(ROUTES.AUTH_CALLBACK).toBe('/auth/callback');
    expect(ROUTES.AUTH_GOOGLE).toBe('/auth/google');
    for (const path of [ROUTES.AUTH_CALLBACK, ROUTES.AUTH_GOOGLE]) {
      expect(isPublicRoute(path)).toBe(true);
      expect(isAuthRoute(path)).toBe(false);
    }
    expect(isProtectedRoute('/auth')).toBe(true);
  });
});

describe('safeCallbackUrl', () => {
  // A browser strips tabs and newlines and reads a backslash as a slash, so each of
  // these leads to evil.com
  it('sends every way off the site to the home page', () => {
    for (const value of ['//evil.com', 'https://evil.com', '/\\evil.com', '/\t/evil.com', '/\n/evil.com', '/.//evil.com', '/%2e//evil.com', 'javascript:alert(1)']) {
      expect(safeCallbackUrl(value), JSON.stringify(value)).toBe('/');
    }
  });

  it('keeps a path on the site, with its query', () => {
    expect(safeCallbackUrl('/search/abc?x=1')).toBe('/search/abc?x=1');
    expect(safeCallbackUrl('/requests/r1#reply')).toBe('/requests/r1#reply');
  });

  it('falls back to the home page without a value', () => {
    for (const value of [undefined, null, '', 'searches']) expect(safeCallbackUrl(value)).toBe('/');
  });
});
