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
import { SESSION_COOKIE, verifySessionToken } from "@/app/_shared/lib/auth/session";

// This proxy handles authentication and route protection.
// The whole app is private except the login page, the login API, report links, the demo and
// the route devartventures.com sends audit requests to (it checks its own secret).
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // "/home" isn't a page: forward it to the home page before anything remembers it as the login destination
  if (isHomeAlias(pathname)) {
    return NextResponse.redirect(new URL(`${ROUTES.HOME}${search}`, request.url));
  }

  // Verify the signed session cookie (not just its presence)
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isLoggedIn = await verifySessionToken(token);

  // The home page shows a visitor who isn't logged in the public demo, not a password form
  if (pathname === ROUTES.HOME && !isLoggedIn) {
    return NextResponse.redirect(new URL(LOGGED_OUT_HOME, request.url));
  }

  // Handle protected routes
  if (isProtectedRoute(pathname) && !isLoggedIn) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL(ROUTES.LOGIN, request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from auth pages
  if (isAuthRoute(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL(ROUTES.HOME, request.url));
  }

  return NextResponse.next();
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
