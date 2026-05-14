import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isProtectedRoute, isAuthRoute } from "@/app/_shared/lib/config/routes";

// This proxy handles authentication and route protection
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the token from cookies
  const token = request.cookies.get("token")?.value;
  const isLoggedIn = !!token;

  // Handle protected routes
  if (isProtectedRoute(pathname)) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Handle auth routes (login, register, etc.)
  // Redirect logged-in users away from auth pages
  if (isAuthRoute(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (we handle auth separately in API routes)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
};
