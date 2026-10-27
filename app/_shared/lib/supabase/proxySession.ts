// app/_shared/lib/supabase/proxySession.ts

// The session check for proxy.ts, which has no cookies() store: it reads the
// request's cookies and writes any refreshed ones onto the response it returns
// (the @supabase/ssr middleware pattern). Server-only.

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const CACHE_HEADERS = ['cache-control', 'expires', 'pragma'];

/** The email in the request's session, and the response that carries its refreshed cookies */
export async function readProxySession(request: NextRequest): Promise<{ response: NextResponse; email: string | null }> {
  let response = NextResponse.next({ request });
  const db = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  const { data } = await db.auth.getClaims();
  const email = data?.claims?.email;
  return { response, email: typeof email === 'string' && email ? email : null };
}

/** Copies the refreshed session cookies, and the no-store headers that came with them, onto a redirect or JSON response */
export function withSessionCookies(target: NextResponse, from: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  // Responses that set auth cookies must not be cached, or one user's session could reach another
  CACHE_HEADERS.forEach((name) => {
    const value = from.headers.get(name);
    if (value !== null) target.headers.set(name, value);
  });
  return target;
}
