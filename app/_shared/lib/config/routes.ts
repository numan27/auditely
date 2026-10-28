// Named route constants — always use these instead of hardcoding strings
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  // Making an account; while sign-ups are closed it forwards to the login
  SIGNUP: '/signup',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  SEARCHES: '/searches',
  // The workspace's other views, so a refresh or a bookmark opens the same one (workspacePath.ts)
  AUDIT: '/audit',
  REQUESTS: '/requests',
  SEARCH: '/search',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  // The plans and this month's allowances; Checkout comes back to /plans/done
  PLANS: '/plans',
  PLANS_DONE: '/plans/done',
  // Private PDF report links (/report/{signed token}) — public, the token is the key
  REPORT: '/report',
  // The public demo: the workspace on a saved sample, with nothing live behind it
  DEMO: '/demo',
  // Sign-in: the emailed link and Google come back to the callback; /auth/google starts Google
  AUTH_CALLBACK: '/auth/callback',
  AUTH_GOOGLE: '/auth/google',
} as const;

// API route paths. Only AUTH and FREE_AUDIT are public (see PUBLIC_ROUTES below).
export const API_ROUTES = {
  AUTH: '/api/auth',
  // The landing page's free audit: one per visitor's network, behind BotID
  FREE_AUDIT: '/api/free-audit',
  AUDIT: '/api/audit',
  AUDIT_URL: '/api/audit-url',
  GENERATE: '/api/generate',
  PDF: '/api/pdf',
  SEARCH: '/api/search',
  SEARCHES: '/api/searches',
  RESULTS: '/api/results',
  FIND_EMAILS: '/api/find-emails',
  CRM: '/api/crm',
  SEND_EMAIL: '/api/send-email',
  VERIFY_EMAIL: '/api/verify-email',
  AUDIT_REQUESTS: '/api/audit-requests',
  NOTIFICATIONS: '/api/notifications',
  USAGE: '/api/usage',
  // Settings: the profile reports are signed with, and the mailbox and HubSpot connections
  SETTINGS_PROFILE: '/api/settings/profile',
  SETTINGS_MAILBOX: '/api/settings/mailbox',
  SETTINGS_HUBSPOT: '/api/settings/hubspot',
  // Buying a plan (Stripe Checkout) and managing it (Stripe's billing portal)
  BILLING_CHECKOUT: '/api/billing/checkout',
  BILLING_PORTAL: '/api/billing/portal',
} as const;

// Called by other servers, not by the app: no session, each checks its own secret
export const INBOUND_ROUTES = {
  // devartventures.com sends each free audit request here (AUDITELY_INBOUND_SECRET)
  AUDIT_REQUEST: '/api/inbound/audit-request',
  // Stripe sends each subscription change here; its signature (STRIPE_WEBHOOK_SECRET) is the key
  STRIPE_WEBHOOK: '/api/stripe/webhook',
} as const;

// BotID's challenge script and the calls it makes, which withBotId (next.config.ts)
// rewrites to Vercel. A signed-out visitor has to reach it to pass the bot check.
export const BOTID_PATH = '/149e9513-01fa-4fb0-aad4-566afd725d1b';

// What search engines read (app/robots.ts, app/sitemap.ts)
export const SEO_FILES = { ROBOTS: '/robots.txt', SITEMAP: '/sitemap.xml' } as const;

// Everything needs a signed-in account except these; the sign-in and sign-up pages
// run before there is a session, Terms, Privacy and the search engines' files are
// for everyone, /report/{token} is checked by its signature, /demo shows only
// the sample checked into the repo, the free audit checks BotID and its own limits,
// the inbound route checks its secret, and Stripe's webhook checks Stripe's signature
export const PUBLIC_ROUTES = [
  ROUTES.LOGIN,
  ROUTES.SIGNUP,
  ROUTES.TERMS,
  ROUTES.PRIVACY,
  SEO_FILES.ROBOTS,
  SEO_FILES.SITEMAP,
  API_ROUTES.AUTH,
  API_ROUTES.FREE_AUDIT,
  BOTID_PATH,
  ROUTES.AUTH_CALLBACK,
  ROUTES.AUTH_GOOGLE,
  ROUTES.REPORT,
  ROUTES.DEMO,
  INBOUND_ROUTES.AUDIT_REQUEST,
  INBOUND_ROUTES.STRIPE_WEBHOOK,
] as const;

// Pages a logged-in user should be bounced away from (not the callback: a second
// sign-in has to finish)
export const AUTH_ROUTES = [ROUTES.LOGIN, ROUTES.SIGNUP] as const;

// Addresses people type or bookmark for the home page; they forward to it instead of a 404
export const HOME_ALIASES = ['/home'] as const;

export const DEFAULT_LOGIN_REDIRECT = ROUTES.HOME;
export const DEFAULT_LOGOUT_REDIRECT = ROUTES.LOGIN;

// Where the home page sends a visitor who isn't logged in, while sign-ups are
// closed; once they're open, the home page is the landing page
export const LOGGED_OUT_HOME = ROUTES.DEMO;

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

export const isHomeAlias = (pathname: string): boolean =>
  (HOME_ALIASES as readonly string[]).includes(pathname);

export const isApiRoute = (pathname: string): boolean =>
  pathname === '/api' || pathname.startsWith('/api/');

// Resolving against a fixed origin reads the value the way a browser will: it drops tabs
// and newlines and reads "\" as "/", so "/\t/evil.com" is caught as another site
const CALLBACK_ORIGIN = 'http://auditely.invalid';

// Only allow a path on this site ("/foo?x=1"), never "//evil.com" or an absolute URL
export const safeCallbackUrl = (value: string | null | undefined): string => {
  if (!value?.startsWith('/')) return DEFAULT_LOGIN_REDIRECT;
  let url: URL;
  try {
    url = new URL(value, CALLBACK_ORIGIN);
  } catch {
    return DEFAULT_LOGIN_REDIRECT;
  }
  // "/.//evil.com" stays on the origin but resolves to the path "//evil.com", another site again
  if (url.origin !== CALLBACK_ORIGIN || url.pathname.startsWith('//')) return DEFAULT_LOGIN_REDIRECT;
  return `${url.pathname}${url.search}${url.hash}`;
};

/** A sample audit's PDF report in the demo */
export const demoReportPath = (auditId: string): string => `${ROUTES.DEMO}/report/${encodeURIComponent(auditId)}`;
