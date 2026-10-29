// app/_shared/lib/auth/signupRequests.ts

// The browser's side of signing up with an email and a password: making the
// account, confirming it with the code Supabase emails, and asking for a new
// code. Every answer, a failed or unreadable one included, comes back as
// something the form can show.

import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { postJson } from '@/app/_shared/lib/utils/jsonRequest';

type Refused = { ok: false; error: string };
type Answer = { error?: unknown; next?: unknown; sent?: unknown; field?: unknown } | null;

// The route's own message when it sent one, else the fallback
const errorOf = (data: Answer, fallback: string) => (typeof data?.error === 'string' ? data.error : fallback);
const nextOf = (data: Answer) => (typeof data?.next === 'string' ? data.next : null);

/** Makes the account. The code is on its way ({ sent }), or Supabase signed it straight in ({ next }). */
export async function requestSignup(
  email: string,
  password: string,
  next: string
): Promise<{ ok: true; sent: true } | { ok: true; next: string } | (Refused & { field?: 'password' })> {
  const { ok, data } = await postJson(API_ROUTES.AUTH_SIGNUP, { email, password, callbackUrl: next });
  const answer = data as Answer;
  const signedIn = ok ? nextOf(answer) : null;
  if (signedIn) return { ok: true, next: signedIn };
  if (ok && answer?.sent === true) return { ok: true, sent: true };
  const error = errorOf(ok ? null : answer, "Couldn't create your account. Try again in a minute.");
  return !ok && answer?.field === 'password' ? { ok: false, error, field: 'password' } : { ok: false, error };
}

/** Confirms the email with its code, which signs the new account in */
export async function confirmCode(email: string, password: string, code: string, next: string): Promise<{ ok: true; next: string } | Refused> {
  const { ok, data } = await postJson(API_ROUTES.AUTH_SIGNUP_CODE, { email, password, code, callbackUrl: next });
  const answer = data as Answer;
  const signedIn = ok ? nextOf(answer) : null;
  if (signedIn) return { ok: true, next: signedIn };
  return { ok: false, error: errorOf(ok ? null : answer, "Couldn't confirm your email. Try again in a minute.") };
}

/** Emails a new code */
export async function resendCode(email: string, next: string): Promise<{ ok: true } | Refused> {
  const { ok, data } = await postJson(API_ROUTES.AUTH_SIGNUP_RESEND, { email, callbackUrl: next });
  if (ok) return { ok: true };
  return { ok: false, error: errorOf(data as Answer, "Couldn't send a new code. Try again in a minute.") };
}
