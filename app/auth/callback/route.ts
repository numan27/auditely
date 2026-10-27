// app/auth/callback/route.ts

// Where a sign-in finishes. Google, and an emailed link opened in the browser that
// asked for it, bring ?code= (traded for a session with the PKCE cookie); the link
// opened anywhere else brings ?token_hash=&type=email. The new session must belong
// to someone who may sign in, or it is signed straight back out. Then the user goes
// to ?next=, kept on this site.

import { NextRequest, NextResponse } from 'next/server';
import { userDb } from '@/app/_shared/lib/supabase/server';
import { canSignIn } from '@/app/_shared/lib/auth/account';
import { ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';
import type { Db } from '@/app/_shared/lib/supabase/client';

// The login page's ?error=: the link didn't work, or the account may not sign in
type SignInError = 'link' | 'closed';

/** Turns the code or token hash into a session; false when there is neither, or it failed */
async function startSession(db: Db, params: URLSearchParams): Promise<boolean> {
  const code = params.get('code');
  if (code) return !(await db.auth.exchangeCodeForSession(code)).error;
  const tokenHash = params.get('token_hash');
  if (tokenHash && params.get('type') === 'email') {
    return !(await db.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })).error;
  }
  return false;
}

/** Signs the user in; null when they're in, or what went wrong */
async function finishSignIn(params: URLSearchParams): Promise<SignInError | null> {
  const db = await userDb();
  if (!(await startSession(db, params))) return 'link';
  const { data } = await db.auth.getClaims();
  const email = data?.claims?.email;
  if (typeof email !== 'string' || !email) return 'link';
  if (!canSignIn(email)) {
    await db.auth.signOut();
    return 'closed';
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const error = await finishSignIn(searchParams).catch((err: unknown): SignInError => {
    console.error('[auth] Sign-in callback failed:', err instanceof Error ? err.message : err);
    return 'link';
  });
  if (error) return NextResponse.redirect(new URL(`${ROUTES.LOGIN}?error=${error}`, request.url));
  return NextResponse.redirect(new URL(safeCallbackUrl(searchParams.get('next')), request.url));
}
