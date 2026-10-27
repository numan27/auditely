// app/auth/google/route.ts

// "Continue with Google": asks Supabase for Google's consent page and sends the
// browser there. Google comes back to /auth/callback on this site with a code,
// carrying where the user was going; the PKCE verifier for that code is set as a
// cookie on this redirect. Whether the account may sign in is checked there.

import { NextRequest, NextResponse } from 'next/server';
import { userDb } from '@/app/_shared/lib/supabase/server';
import { ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeCallbackUrl(url.searchParams.get('next'));
  const db = await userDb();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${url.origin}${ROUTES.AUTH_CALLBACK}?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    console.error('[auth] Failed to start Google sign-in:', error?.message ?? 'no URL returned');
    return NextResponse.redirect(new URL(`${ROUTES.LOGIN}?error=google`, request.url));
  }
  return NextResponse.redirect(data.url);
}
