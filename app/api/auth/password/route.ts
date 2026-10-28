// app/api/auth/password/route.ts

// Sign in with an email and a password (POST), for an account that has set one in
// Settings. The same people may sign in as with an emailed link, and BotID turns
// bots away before Supabase is asked. A visitor who ran the landing page's free
// audit keeps it and lands on it, as /auth/callback does for a link.

import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { userDb } from '@/app/_shared/lib/supabase/server';
import { canSignIn } from '@/app/_shared/lib/auth/account';
import { ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';
import { FREE_AUDIT_COOKIE } from '@/app/_shared/lib/freeAudit/freeAuditRules';
import { keepFreeAudit } from '@/app/_shared/lib/freeAudit/keepFreeAudit';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });

// What Supabase's refusal means for the person signing in
function signInError(error: { status?: number; code?: string }) {
  if (error.status === 429) return refuse(429, 'Too many tries. Wait a few minutes, or email yourself a sign-in link.');
  if (error.code === 'email_not_confirmed') return refuse(400, 'Confirm your email first: email yourself a sign-in link.');
  if (error.status === 400) return refuse(400, "That email and password don't match. Try again, or email yourself a sign-in link.");
  return refuse(502, "Couldn't sign you in. Try again in a minute.");
}

// Signed in → { next }, where the browser goes now
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL.test(email)) return refuse(400, 'Enter your email address');
  if (!password) return refuse(400, 'Enter your password');

  if ((await checkBotId()).isBot) return refuse(403, "Couldn't sign you in from this browser. Email yourself a sign-in link instead.");
  if (!canSignIn(email)) return refuse(403, 'Auditely is invite-only for now. Use the email you were invited with.');

  const db = await userDb();
  const signIn = await db.auth.signInWithPassword({ email, password }).catch((err: unknown) => {
    console.error('[auth] Password sign-in failed:', err instanceof Error ? err.message : err);
    return null;
  });
  if (!signIn) return refuse(502, "Couldn't sign you in. Try again in a minute.");
  const userId = signIn.data?.user?.id;
  if (signIn.error || !userId) {
    if (signIn.error && signIn.error.status !== 400) console.error('[auth] Password sign-in refused:', signIn.error.message);
    return signInError(signIn.error ?? {});
  }

  const next = safeCallbackUrl(typeof body.callbackUrl === 'string' ? body.callbackUrl : undefined);
  const kept = await keepFreeAudit(db, userId, request.cookies.get(FREE_AUDIT_COOKIE)?.value);
  const res = NextResponse.json({ next: kept && next === ROUTES.HOME ? ROUTES.AUDIT : next });
  if (kept) res.cookies.delete(FREE_AUDIT_COOKIE);
  return res;
}
