// app/_shared/lib/auth/session.ts

// Single-admin session: a signed, expiring token stored in an httpOnly cookie.
// Token format: `${expMs}.${base64url(HMAC-SHA256(AUTH_SECRET, expMs))}`.
// Uses Web Crypto only, so it runs in both proxy.ts and route handlers.

import { getSecret, safeEqual, sign } from '@/app/_shared/lib/auth/signing';

export const SESSION_COOKIE = 'auditely_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function isAuthConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD && !!getSecret();
}

export async function createSessionToken(): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error('AUTH_SECRET is missing or shorter than 32 characters');
  const exp = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  return `${exp}.${await sign(exp, secret)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token) return false;

  const [exp, signature] = token.split('.');
  if (!exp || !signature || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;

  return safeEqual(signature, await sign(exp, secret));
}
