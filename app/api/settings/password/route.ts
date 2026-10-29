// app/api/settings/password/route.ts

// Sets or changes the signed-in account's password, so it can sign in without an
// emailed link (/api/auth/password). A forgotten password is replaced the same way:
// sign in with a link, then set a new one here. Supabase keeps the password hashed.

import { NextRequest, NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { passwordProblem } from '@/app/_shared/lib/auth/passwordRules';

const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => null)) ?? {};
  const password = typeof body.password === 'string' ? body.password : '';
  const problem = passwordProblem(password);
  if (problem) return refuse(400, problem);

  const { error } = await session.db.auth.updateUser({ password });
  if (error) {
    if (error.code === 'same_password') return refuse(400, "That's already your password.");
    if (error.code === 'weak_password') return refuse(400, 'Choose a stronger password: this one is too easy to guess.');
    console.error('[settings] Failed to set the password:', error.message);
    return refuse(500, "Your password wasn't saved. Try again.");
  }
  return NextResponse.json({ saved: true });
}
