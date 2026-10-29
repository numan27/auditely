// app/api/auth/signup/resend/route.ts

// A new code for an account whose email isn't confirmed yet (POST): the first one
// expired or went astray, or the tab closed before it was typed. Supabase allows
// one a minute.

import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { userDb } from '@/app/_shared/lib/supabase/server';
import { canSignIn } from '@/app/_shared/lib/auth/account';
import { ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });

// Code emailed → { sent: true }
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email)) return refuse(400, 'Enter your email address');

  if ((await checkBotId()).isBot) return refuse(403, "Couldn't send a code from this browser. Try again in another browser.");
  if (!canSignIn(email)) return refuse(403, 'Auditely is invite-only for now. Use the email you were invited with.');

  const next = safeCallbackUrl(typeof body.callbackUrl === 'string' ? body.callbackUrl : undefined);
  const { origin } = new URL(request.url);
  const db = await userDb();
  const { error } = await db.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${origin}${ROUTES.AUTH_CALLBACK}?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    if (error.status === 429) return refuse(429, 'Wait a minute before asking for another code.');
    console.error('[auth] Sending a new sign-up code failed:', error.message);
    return refuse(502, "Couldn't send a new code. Try again in a minute.");
  }
  return NextResponse.json({ sent: true });
}
