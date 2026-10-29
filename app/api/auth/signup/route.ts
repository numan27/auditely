// app/api/auth/signup/route.ts

// Making an account with an email and a password (POST). Supabase emails the new
// account a code (/api/auth/signup/code confirms it, which signs it in), so nobody
// can claim an address they can't read. The same people may sign up as may sign in,
// and BotID turns bots away before Supabase is asked.

import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { userDb } from '@/app/_shared/lib/supabase/server';
import { canSignIn } from '@/app/_shared/lib/auth/account';
import { passwordProblem } from '@/app/_shared/lib/auth/passwordRules';
import { ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';
import { FREE_AUDIT_COOKIE } from '@/app/_shared/lib/freeAudit/freeAuditRules';
import { keepFreeAudit } from '@/app/_shared/lib/freeAudit/keepFreeAudit';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `field: 'password'` puts the message under the password, not the email
const refuse = (status: number, error: string, extra: { field?: 'password' } = {}) =>
  NextResponse.json({ error, ...extra }, { status });

// What Supabase's refusal means for the person signing up
function signUpError(error: { status?: number; code?: string; message: string }) {
  if (error.code === 'weak_password') return refuse(400, 'Choose a stronger password: this one is too easy to guess.', { field: 'password' });
  if (error.status === 429) return refuse(429, 'Too many tries. Wait a few minutes and try again.');
  console.error('[auth] Sign-up failed:', error.message);
  return refuse(502, "Couldn't create your account. Try again in a minute.");
}

// Code emailed → { sent: true }; signed straight in (Supabase set to confirm nobody) → { next }
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL.test(email)) return refuse(400, 'Enter your email address');
  const problem = passwordProblem(password);
  if (problem) return refuse(400, problem, { field: 'password' });

  if ((await checkBotId()).isBot) return refuse(403, "Couldn't create an account from this browser. Try again in another browser.");
  if (!canSignIn(email)) return refuse(403, 'Auditely is invite-only for now. Use the email you were invited with.');

  const next = safeCallbackUrl(typeof body.callbackUrl === 'string' ? body.callbackUrl : undefined);
  const { origin } = new URL(request.url);
  const db = await userDb();
  const { data, error } = await db.auth.signUp({
    email,
    password,
    // The code is what's typed; the email's link (if its template has one) still comes back here
    options: { emailRedirectTo: `${origin}${ROUTES.AUTH_CALLBACK}?next=${encodeURIComponent(next)}` },
  });
  if (error) return signUpError(error);

  // An address that already has an account gets a user with no identities, and no email
  if (data.user && data.user.identities?.length === 0) return refuse(409, 'This email already has an account. Sign in instead.');

  if (data.session && data.user) {
    const kept = await keepFreeAudit(db, data.user.id, request.cookies.get(FREE_AUDIT_COOKIE)?.value);
    const res = NextResponse.json({ next: kept && next === ROUTES.HOME ? ROUTES.AUDIT : next });
    if (kept) res.cookies.delete(FREE_AUDIT_COOKIE);
    return res;
  }
  return NextResponse.json({ sent: true });
}
