// Route configuration
export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/about',
  '/contact',
  '/pricing',
] as const;

export const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile',
  '/settings',
  '/projects',
] as const;

export const AUTH_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
] as const;

export const DEFAULT_LOGIN_REDIRECT = '/dashboard';
export const DEFAULT_LOGOUT_REDIRECT = '/login';

// Create Sets for O(1) exact match lookups
const PUBLIC_SET = new Set(PUBLIC_ROUTES);
const PROTECTED_SET = new Set(PROTECTED_ROUTES);
const AUTH_SET = new Set(AUTH_ROUTES);

// Generic route matcher helper
const matchesRoute = (pathname: string, exactSet: Set<string>, prefixes: readonly string[]): boolean => {
  if (exactSet.has(pathname)) return true;
  return prefixes.some(route => pathname.startsWith(`${route}/`));
};

// Check if a route is public
export const isPublicRoute = (pathname: string): boolean =>
  matchesRoute(pathname, PUBLIC_SET, PUBLIC_ROUTES);

// Check if a route is protected
export const isProtectedRoute = (pathname: string): boolean =>
  matchesRoute(pathname, PROTECTED_SET, PROTECTED_ROUTES);

// Check if a route is an auth route
export const isAuthRoute = (pathname: string): boolean =>
  matchesRoute(pathname, AUTH_SET, AUTH_ROUTES);
