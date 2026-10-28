// Named route constants — always use these instead of hardcoding strings
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  // Making an account; while sign-ups are closed it forwards to the login
  SIGNUP: '/signup',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  // The contact form, emailed to the team (OWNER_EMAIL)
  CONTACT: '/contact',
  SEARCHES: '/searches',
  // The workspace's other views, so a refresh or a bookmark opens the same one (workspacePath.ts)
  AUDIT: '/audit',
  REQUESTS: '/requests',
  SEARCH: '/search',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  // The plans and the current allowances; Checkout comes back to /plans/done
  PLANS: '/plans',
  PLANS_DONE: '/plans/done',
  // Private PDF report links (/report/{signed token}) — public, the token is the key
  REPORT: '/report',
  // The public demo: the workspace on a saved sample, with nothing live behind it
  DEMO: '/demo',
  // Sign-in: the emailed link and Google come back to the callback; /auth/google starts Google
  AUTH_CALLBACK: '/auth/callback',
  // The emailed link's Continue, which posts it to the callback (an email scanner only opens it)
  AUTH_CONTINUE: '/auth/continue',
  AUTH_GOOGLE: '/auth/google',
} as const;

// API route paths. Only AUTH (and AUTH_PASSWORD under it), FREE_AUDIT and CONTACT are public (see PUBLIC_ROUTES below).
export const API_ROUTES = {
  AUTH: '/api/auth',
  // Signing in with the password an account set in Settings, behind BotID
  AUTH_PASSWORD: '/api/auth/password',
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
  // Settings: the profile reports are signed with, the mailbox and HubSpot connections, the password, and
  // deleting the account
  SETTINGS_PROFILE: '/api/settings/profile',
  // The saved logo as an image, for the header's profile menu
  SETTINGS_PROFILE_LOGO: '/api/settings/profile/logo',
  SETTINGS_MAILBOX: '/api/settings/mailbox',
  SETTINGS_HUBSPOT: '/api/settings/hubspot',
  SETTINGS_PASSWORD: '/api/settings/password',
  SETTINGS_ACCOUNT: '/api/settings/account',
  // Buying a plan (Stripe Checkout) and managing it (Stripe's billing portal)
  BILLING_CHECKOUT: '/api/billing/checkout',
  BILLING_PORTAL: '/api/billing/portal',
  // A tester's note to the owner, from the header's Feedback button
  FEEDBACK: '/api/feedback',
  // The public contact form's messages, behind BotID and a per-network limit
  CONTACT: '/api/contact',
} as const;

// Called by other servers, not by the app: no session, each checks its own secret
export const INBOUND_ROUTES = {
  // devartventures.com sends each free audit request here (AUDITELY_INBOUND_SECRET)
  AUDIT_REQUEST: '/api/inbound/audit-request',
  // Stripe sends each subscription change here; its signature (STRIPE_WEBHOOK_SECRET) is the key
  STRIPE_WEBHOOK: '/api/stripe/webhook',
  // Vercel's cron, once a day (vercel.json), with CRON_SECRET: Google's 30-day limit on place details
  PLACE_DATA_CRON: '/api/cron/place-data',
} as const;

// BotID's challenge script and the calls it makes, which withBotId (next.config.ts)
// rewrites to Vercel. A signed-out visitor has to reach it to pass the bot check.
export const BOTID_PATH = '/149e9513-01fa-4fb0-aad4-566afd725d1b';

// What search engines read (app/robots.ts, app/sitemap.ts), and the image a shared
// link shows (app/opengraph-image.tsx), which link previews fetch without an account
export const SEO_FILES = { ROBOTS: '/robots.txt', SITEMAP: '/sitemap.xml', SHARE_IMAGE: '/opengraph-image' } as const;

// Files in public/media, served straight from the CDN: the proxy doesn't run on them
export const MEDIA_FILES = { WALKTHROUGH: '/media/walkthrough.mp4', WALKTHROUGH_POSTER: '/media/walkthrough-poster.jpg' } as const;

// Everything needs a signed-in account except these; the sign-in and sign-up pages
// run before there is a session, Terms, Privacy, Contact and the search engines' files
// are for everyone, /report/{token} is checked by its signature, /demo shows only
// the sample checked into the repo, the free audit and the contact form check BotID
// and their own limits,
// the inbound route checks its secret, Stripe's webhook checks Stripe's signature,
// and the daily place-data job checks CRON_SECRET
export const PUBLIC_ROUTES = [
  ROUTES.LOGIN,
  ROUTES.SIGNUP,
  ROUTES.TERMS,
  ROUTES.PRIVACY,
  ROUTES.CONTACT,
  SEO_FILES.ROBOTS,
  SEO_FILES.SITEMAP,
  SEO_FILES.SHARE_IMAGE,
  API_ROUTES.AUTH,
  API_ROUTES.FREE_AUDIT,
  API_ROUTES.CONTACT,
  BOTID_PATH,
  ROUTES.AUTH_CALLBACK,
  ROUTES.AUTH_CONTINUE,
  ROUTES.AUTH_GOOGLE,
  ROUTES.REPORT,
  ROUTES.DEMO,
  INBOUND_ROUTES.AUDIT_REQUEST,
  INBOUND_ROUTES.STRIPE_WEBHOOK,
  INBOUND_ROUTES.PLACE_DATA_CRON,
] as const;

// Pages a logged-in user should be bounced away from (not the callback: a second
// sign-in has to finish)
export const AUTH_ROUTES = [ROUTES.LOGIN, ROUTES.SIGNUP] as const;

// Addresses people type or bookmark for the home page; they forward to it instead of a 404.
// The template's dashboard (its page is kept, with made-up numbers) forwards too.
export const HOME_ALIASES = ['/home', ROUTES.DASHBOARD] as const;

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

/** The plans page with monthly or yearly prices chosen */
export const plansPath = (interval: 'month' | 'year'): string => (interval === 'year' ? `${ROUTES.PLANS}?billing=yearly` : ROUTES.PLANS);

/** A sample audit's PDF report in the demo */
export const demoReportPath = (auditId: string): string => `${ROUTES.DEMO}/report/${encodeURIComponent(auditId)}`;
