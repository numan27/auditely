// app/_shared/lib/supabase/cookieOptions.ts

// How the Supabase session cookies are written, by both the server client
// (server.ts) and the proxy (proxySession.ts). They hold the refresh token and no
// browser code reads them (there is no browser Supabase client), so they are
// HttpOnly, and Secure in production. @supabase/ssr lays these over its own
// defaults each time it sets or clears one.

import type { CookieOptionsWithName } from '@supabase/ssr';

export const SESSION_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
};
