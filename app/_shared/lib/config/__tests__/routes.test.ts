import { describe, it, expect } from 'vitest';
import {
  API_ROUTES,
  demoReportPath,
  INBOUND_ROUTES,
  isAuthRoute,
  isHomeAlias,
  isProtectedRoute,
  isPublicRoute,
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

  it('treats /home as another address for the home page, and nothing else', () => {
    expect(isHomeAlias('/home')).toBe(true);
    expect(isHomeAlias(ROUTES.HOME)).toBe(false);
    expect(isHomeAlias('/home/extra')).toBe(false);
    expect(isHomeAlias(ROUTES.SEARCHES)).toBe(false);
  });

  it('opens the demo and its reports, and no API route', () => {
    expect(isPublicRoute(ROUTES.DEMO)).toBe(true);
    expect(demoReportPath('demo-a1')).toBe('/demo/report/demo-a1');
    expect(isPublicRoute(demoReportPath('demo-a1'))).toBe(true);
    expect(isPublicRoute('/demos')).toBe(false);
    for (const path of Object.values(API_ROUTES)) expect(isProtectedRoute(path)).toBe(path !== API_ROUTES.AUTH);
    expect(isProtectedRoute('/api/autocomplete')).toBe(true);
  });

  // devartventures.com's server has no session: the route checks the shared secret itself
  it('opens the inbound audit request route, and not the Requests tab behind it', () => {
    expect(isPublicRoute(INBOUND_ROUTES.AUDIT_REQUEST)).toBe(true);
    expect(isProtectedRoute(API_ROUTES.AUDIT_REQUESTS)).toBe(true);
    expect(isProtectedRoute('/api/inbound')).toBe(true);
    expect(isProtectedRoute('/api/inbound/other')).toBe(true);
  });

  // The sign-in link and Google both come back here before there is a session; a
  // signed-in user isn't bounced away, so a second sign-in still finishes
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
