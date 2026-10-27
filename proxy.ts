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
import { canSignIn } from "@/app/_shared/lib/auth/account";
import { readProxySession, withSessionCookies } from "@/app/_shared/lib/supabase/proxySession";

// This proxy handles authentication and route protection.
// The whole app is private except the login page, the sign-in routes, report links, the demo and
// the route devartventures.com sends audit requests to (it checks its own secret).
// It also refreshes the Supabase session: every answer carries the refreshed cookies.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // "/home" isn't a page: forward it to the home page before anything remembers it as the login destination
  if (isHomeAlias(pathname)) {
    return NextResponse.redirect(new URL(`${ROUTES.HOME}${search}`, request.url));
  }

  // Verify the Supabase session (refreshing it when due); an email that may not sign in counts as logged out
  const { response, email } = await readProxySession(request);
  const isLoggedIn = !!email && canSignIn(email);

  // The home page shows a visitor who isn't logged in the public demo, not a sign-in form
  if (pathname === ROUTES.HOME && !isLoggedIn) {
    return withSessionCookies(NextResponse.redirect(new URL(LOGGED_OUT_HOME, request.url)), response);
  }

  // Handle protected routes
  if (isProtectedRoute(pathname) && !isLoggedIn) {
    if (isApiRoute(pathname)) {
      return withSessionCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), response);
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
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
