import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LOGGED_OUT_HOME,
  ROUTES,
  isApiRoute,
  isAuthRoute,
  isHomeAlias,
  isProtectedRoute,
} from "@/app/_shared/lib/config/routes";
import { canSignIn, signupsOpen } from "@/app/_shared/lib/auth/account";
import { readProxySession, withSessionCookies } from "@/app/_shared/lib/supabase/proxySession";

// This proxy handles authentication and route protection.
// The whole app is private except the login and sign-up pages, the sign-in routes, Terms and
// Privacy, report links, the demo, the free audit, the route devartventures.com sends audit
// requests to (it checks its own secret), and Stripe's webhook (it checks Stripe's signature).
// Once sign-ups are open, the home page is the landing page for a visitor who isn't signed in.
// It also refreshes the Supabase session: every answer carries the refreshed cookies.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // "/home" and the template's "/dashboard" aren't pages: forward them home before anything remembers one as the login destination
  if (isHomeAlias(pathname)) {
    return NextResponse.redirect(new URL(`${ROUTES.HOME}${search}`, request.url));
  }

  // Verify the Supabase session (refreshing it when due); an email that may not sign in counts as logged out
  const { response, email } = await readProxySession(request);
  const isLoggedIn = !!email && canSignIn(email);

  // The home page shows a visitor who isn't logged in the landing page once sign-ups are
  // open, and the public demo until then, never a sign-in form
  if (pathname === ROUTES.HOME && !isLoggedIn) {
    if (signupsOpen()) return response;
    return withSessionCookies(NextResponse.redirect(new URL(LOGGED_OUT_HOME, request.url)), response);
  }

  // Handle protected routes
  if (isProtectedRoute(pathname) && !isLoggedIn) {
    if (isApiRoute(pathname)) {
      return withSessionCookies(NextResponse.json({ error: "Sign in to continue" }, { status: 401 }), response);
    }
    const loginUrl = new URL(ROUTES.LOGIN, request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return withSessionCookies(NextResponse.redirect(loginUrl), response);
  }

  // Redirect logged-in users away from auth pages
  if (isAuthRoute(pathname) && isLoggedIn) {
    return withSessionCookies(NextResponse.redirect(new URL(ROUTES.HOME, request.url)), response);
  }

  return response;
}

// Configure which routes the proxy should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - _vercel (Vercel's own paths: the analytics script and the visits it reports)
     * - media/ (public/media: the landing page's walkthrough, for everyone, so no session check)
     * - brand/ (public/brand: Google's Maps logos, which the signed-out demo shows too)
     */
    "/((?!_next/static|_next/image|favicon.ico|_vercel|media/|brand/).*)",
  ],
};
