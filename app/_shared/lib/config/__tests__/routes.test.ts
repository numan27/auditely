import { describe, it, expect } from 'vitest';
import { API_ROUTES, demoReportPath, isHomeAlias, isProtectedRoute, isPublicRoute, ROUTES } from '@/app/_shared/lib/config/routes';

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
});
