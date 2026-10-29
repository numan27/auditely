// app/api/auth/route.ts

// Sign in with an emailed link (POST) and sign out (DELETE). The link goes only to
// the owner and the allowlist while sign-ups are closed, and leads back to
// /auth/callback on the site that asked for it, which finishes the sign-in. It signs
// in an account that exists: accounts are made on the sign-up page, with a password
// and an emailed code (/api/auth/signup).

import { NextRequest, NextResponse } from 'next/server';
import { userDb } from '@/app/_shared/lib/supabase/server';
import { canSignIn } from '@/app/_shared/lib/auth/account';
import { ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';
import { FREE_AUDIT_COOKIE } from '@/app/_shared/lib/freeAudit/freeAuditRules';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Email a sign-in link → { sent: true }
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'Enter your email address' }, { status: 400 });

  // Refused here, so a stranger is never emailed. Google can't be stopped this early: Supabase
  // creates the auth.users and profiles rows for a stranger before /auth/callback signs them
  // straight back out.
  if (!canSignIn(email)) {
    return NextResponse.json(
      { error: 'Auditely is invite-only for now. Use the email you were invited with.' },
      { status: 403 }
    );
  }

  const next = safeCallbackUrl(typeof body.callbackUrl === 'string' ? body.callbackUrl : undefined);
  const { origin } = new URL(request.url);
  // The free audit rides in the link, so it's kept in whichever browser opens it
  const freeAudit = request.cookies.get(FREE_AUDIT_COOKIE)?.value;
  const keepParam = freeAudit ? `&keep=${encodeURIComponent(freeAudit)}` : '';
  const db = await userDb();
  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}${ROUTES.AUTH_CALLBACK}?next=${encodeURIComponent(next)}${keepParam}`,
    },
  });
  if (error) {
    // Supabase's answer for an address with no account, when the link may not make one
    if (error.code === 'otp_disabled') {
      return NextResponse.json({ error: "There's no account with this email yet. Create one first." }, { status: 404 });
    }
    console.error('[auth] Failed to send a sign-in link:', error.message);
    return NextResponse.json({ error: "Couldn't send the link. Try again in a minute." }, { status: 502 });
  }
  return NextResponse.json({ sent: true });
}

// Sign out → ends this browser's session and clears its cookies. Only this one:
// the account stays signed in on its other devices.
export async function DELETE() {
  const db = await userDb();
  await db.auth.signOut({ scope: 'local' });
  return NextResponse.json({ success: true });
}
