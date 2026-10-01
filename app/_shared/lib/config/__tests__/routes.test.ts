import { describe, it, expect } from 'vitest';
import { isProtectedRoute, isPublicRoute, ROUTES } from '@/app/_shared/lib/config/routes';

describe('route access', () => {
  it('opens report links without a login, and nothing else new', () => {
    expect(isPublicRoute(`${ROUTES.REPORT}/abc.def`)).toBe(true);
    expect(isPublicRoute('/reports')).toBe(false);
    expect(isProtectedRoute('/api/crm')).toBe(true);
    expect(isProtectedRoute('/api/pdf')).toBe(true);
    expect(isProtectedRoute(ROUTES.DASHBOARD)).toBe(true);
  });
});
