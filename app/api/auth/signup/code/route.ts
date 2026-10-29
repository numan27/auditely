// app/api/auth/signup/code/route.ts

// Confirming a new account's email with the code Supabase sent (POST), which signs
// it in. Then the password chosen with it is set again: Supabase's sign-up leaves an
// unconfirmed account's first password as it was, so an account someone else made
// for this address, never confirmed, would otherwise keep their password. A visitor
// who ran the landing page's free audit keeps it, as the other sign-ins do.

import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { userDb } from '@/app/_shared/lib/supabase/server';
import { canSignIn } from '@/app/_shared/lib/auth/account';
import { CODE_LENGTH, passwordProblem, readCode } from '@/app/_shared/lib/auth/passwordRules';
import { ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';
import { FREE_AUDIT_COOKIE } from '@/app/_shared/lib/freeAudit/freeAuditRules';
import { keepFreeAudit } from '@/app/_shared/lib/freeAudit/keepFreeAudit';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });

// Confirmed and signed in → { next }, where the browser goes now
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const code = readCode(body.code);
  if (!EMAIL.test(email)) return refuse(400, 'Enter your email address');
  if (!code) return refuse(400, `Enter the ${CODE_LENGTH}-digit code from the email.`);
  const problem = passwordProblem(password);
  if (problem) return refuse(400, problem);

  if ((await checkBotId()).isBot) return refuse(403, "Couldn't confirm your email from this browser. Try again in another browser.");
  if (!canSignIn(email)) return refuse(403, 'Auditely is invite-only for now. Use the email you were invited with.');

  const db = await userDb();
  const { data, error } = await db.auth.verifyOtp({ email, token: code, type: 'email' });
  const userId = data?.user?.id;
  if (error || !userId) {
    if (error?.status === 429) return refuse(429, 'Too many tries. Wait a few minutes and try again.');
    return refuse(400, 'That code is wrong or has expired. Check it, or send yourself a new one.');
  }

  const set = await db.auth.updateUser({ password });
  if (set.error && set.error.code !== 'same_password') {
    console.error("[auth] Couldn't set the new account's password:", set.error.message);
  }

  const next = safeCallbackUrl(typeof body.callbackUrl === 'string' ? body.callbackUrl : undefined);
  const kept = await keepFreeAudit(db, userId, request.cookies.get(FREE_AUDIT_COOKIE)?.value);
  const res = NextResponse.json({ next: kept && next === ROUTES.HOME ? ROUTES.AUDIT : next });
  if (kept) res.cookies.delete(FREE_AUDIT_COOKIE);
  return res;
}
