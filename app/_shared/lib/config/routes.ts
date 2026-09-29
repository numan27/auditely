// Named route constants — always use these instead of hardcoding strings
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SEARCHES: '/searches',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
} as const;

// API route paths. Only AUTH is public (see PUBLIC_ROUTES below).
export const API_ROUTES = {
  AUTH: '/api/auth',
  AUDIT: '/api/audit',
  AUDIT_URL: '/api/audit-url',
  GENERATE: '/api/generate',
  PDF: '/api/pdf',
  SEARCH: '/api/search',
  SEARCHES: '/api/searches',
  RESULTS: '/api/results',
  FIND_EMAILS: '/api/find-emails',
} as const;

// Everything is private (single-admin tool) except these
export const PUBLIC_ROUTES = [ROUTES.LOGIN, API_ROUTES.AUTH] as const;

// Pages a logged-in user should be bounced away from
export const AUTH_ROUTES = [ROUTES.LOGIN] as const;

export const DEFAULT_LOGIN_REDIRECT = ROUTES.HOME;
export const DEFAULT_LOGOUT_REDIRECT = ROUTES.LOGIN;

// Create Sets for O(1) exact match lookups
const PUBLIC_SET = new Set<string>(PUBLIC_ROUTES);
const AUTH_SET = new Set<string>(AUTH_ROUTES);

// Generic route matcher helper
const matchesRoute = (pathname: string, exactSet: Set<string>, prefixes: readonly string[]): boolean => {
  if (exactSet.has(pathname)) return true;
  return prefixes.some(route => pathname.startsWith(`${route}/`));
};

// Check if a route is public (no session required)
export const isPublicRoute = (pathname: string): boolean =>
  matchesRoute(pathname, PUBLIC_SET, PUBLIC_ROUTES);

// Check if a route is protected (session required)
export const isProtectedRoute = (pathname: string): boolean => !isPublicRoute(pathname);

// Check if a route is an auth route
export const isAuthRoute = (pathname: string): boolean =>
  matchesRoute(pathname, AUTH_SET, AUTH_ROUTES);

export const isApiRoute = (pathname: string): boolean =>
  pathname === '/api' || pathname.startsWith('/api/');

// Only allow same-origin relative redirects ("/foo"), never "//evil.com" or absolute URLs
export const safeCallbackUrl = (value: string | null | undefined): string =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : DEFAULT_LOGIN_REDIRECT;
