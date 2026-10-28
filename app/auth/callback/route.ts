// app/auth/callback/route.ts

// Where a sign-in finishes. Google, and an emailed link opened in the browser that
// asked for it, bring ?code= (traded for a session with the PKCE cookie); the link
// opened anywhere else brings ?token_hash=&type=email. The new session must belong
// to someone who may sign in, or it is signed straight back out. A visitor who ran
// the landing page's free audit keeps it (from ?keep=, put in the emailed link, or
// their cookie) and lands on it. Then the user goes to ?next=, kept on this site.

import { NextRequest, NextResponse } from 'next/server';
import { userDb } from '@/app/_shared/lib/supabase/server';
import { canSignIn } from '@/app/_shared/lib/auth/account';
import { ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';
import type { Db } from '@/app/_shared/lib/supabase/client';
import { FREE_AUDIT_COOKIE } from '@/app/_shared/lib/freeAudit/freeAuditRules';
import { keepFreeAudit } from '@/app/_shared/lib/freeAudit/keepFreeAudit';

// The login page's ?error=: the link didn't work, or the account may not sign in
type SignInError = 'link' | 'closed';
type SignIn = { ok: true; db: Db; userId: string } | { ok: false; error: SignInError };

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

/** Signs the user in: their client and id, or what went wrong */
async function finishSignIn(params: URLSearchParams): Promise<SignIn> {
  const db = await userDb();
  if (!(await startSession(db, params))) return { ok: false, error: 'link' };
  const { data } = await db.auth.getClaims();
  const email = data?.claims?.email;
  const userId = data?.claims?.sub;
  if (typeof email !== 'string' || !email || typeof userId !== 'string' || !userId) return { ok: false, error: 'link' };
  if (!canSignIn(email)) {
    await db.auth.signOut();
    return { ok: false, error: 'closed' };
  }
  return { ok: true, db, userId };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const signIn = await finishSignIn(searchParams).catch((err: unknown): SignIn => {
    console.error('[auth] Sign-in callback failed:', err instanceof Error ? err.message : err);
    return { ok: false, error: 'link' };
  });
  if (!signIn.ok) return NextResponse.redirect(new URL(`${ROUTES.LOGIN}?error=${signIn.error}`, request.url));

  const next = safeCallbackUrl(searchParams.get('next'));
  const keep = searchParams.get('keep') || request.cookies.get(FREE_AUDIT_COOKIE)?.value;
  const kept = keep ? await keepFreeAudit(signIn.db, signIn.userId, keep) : false;
  // Kept, and not headed anywhere in particular: straight to the audit
  return NextResponse.redirect(new URL(kept && next === ROUTES.HOME ? ROUTES.AUDIT : next, request.url));
}
