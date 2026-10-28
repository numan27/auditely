// app/auth/callback/route.ts

// Where a sign-in finishes. Google, and an emailed link opened in the browser that
// asked for it, bring ?code= (traded for a session with the PKCE cookie). The link
// the sign-in email sends brings ?token_hash=&type=email: opening it signs nobody
// in, because email scanners (Outlook's Safe Links and others) open links before
// the person does and would use it up. It goes to /auth/continue, whose Continue
// posts it back here from this site. The new session must belong to someone who
// may sign in, or it is signed straight back out. A visitor who ran the landing
// page's free audit keeps it (from keep=, put in the emailed link, or their
// cookie) and lands on it, and the cookie is cleared. Then the user goes to
// next=, kept on this site.

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
// What the session is made from: Google's or a same-browser link's code, or the emailed token hash
type Credential = { code: string } | { tokenHash: string };

/** Turns the code or token hash into a session; false when it failed */
async function startSession(db: Db, credential: Credential): Promise<boolean> {
  if ('code' in credential) return !(await db.auth.exchangeCodeForSession(credential.code)).error;
  return !(await db.auth.verifyOtp({ token_hash: credential.tokenHash, type: 'email' })).error;
}

/** Signs the user in: their client and id, or what went wrong */
async function finishSignIn(credential: Credential | null): Promise<SignIn> {
  if (!credential) return { ok: false, error: 'link' };
  const db = await userDb();
  if (!(await startSession(db, credential))) return { ok: false, error: 'link' };
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

/** Signs in with the credential, then sends the user on: where next= says, or the kept free audit */
async function signInAndGo(request: NextRequest, params: URLSearchParams, credential: Credential | null, status?: number) {
  const signIn = await finishSignIn(credential).catch((err: unknown): SignIn => {
    console.error('[auth] Sign-in callback failed:', err instanceof Error ? err.message : err);
    return { ok: false, error: 'link' };
  });
  if (!signIn.ok) return NextResponse.redirect(new URL(`${ROUTES.LOGIN}?error=${signIn.error}`, request.url), status);

  const next = safeCallbackUrl(params.get('next'));
  const keep = params.get('keep') || request.cookies.get(FREE_AUDIT_COOKIE)?.value;
  const kept = keep ? await keepFreeAudit(signIn.db, signIn.userId, keep) : false;
  // Kept, and not headed anywhere in particular: straight to the audit. The cookie's
  // done its work once the audit is the account's; one that wasn't kept can try again
  const res = NextResponse.redirect(new URL(kept && next === ROUTES.HOME ? ROUTES.AUDIT : next, request.url), status);
  if (kept) res.cookies.delete(FREE_AUDIT_COOKIE);
  return res;
}

export async function GET(request: NextRequest) {
  const { searchParams, search } = new URL(request.url);
  const code = searchParams.get('code');
  // The emailed link: Continue signs in, not opening it
  if (!code && searchParams.get('token_hash') && searchParams.get('type') === 'email') {
    return NextResponse.redirect(new URL(`${ROUTES.AUTH_CONTINUE}${search}`, request.url));
  }
  return signInAndGo(request, searchParams, code ? { code } : null);
}

// Continue on /auth/continue. Only from this site: a form on another site could
// otherwise sign this browser into someone else's account. Answered with 303, so
// the browser asks for the next page instead of posting again.
export async function POST(request: NextRequest) {
  const params = new URLSearchParams(await request.text().catch(() => ''));
  const fromHere = request.headers.get('origin') === request.nextUrl.origin;
  const tokenHash = params.get('token_hash');
  const credential = fromHere && tokenHash && params.get('type') === 'email' ? { tokenHash } : null;
  return signInAndGo(request, params, credential, 303);
}
