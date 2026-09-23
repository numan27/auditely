// app/_shared/lib/auth/session.ts

// Single-admin session: a signed, expiring token stored in an httpOnly cookie.
// Token format: `${expMs}.${base64url(HMAC-SHA256(AUTH_SECRET, expMs))}`.
// Uses Web Crypto only, so it runs in both proxy.ts and route handlers.

export const SESSION_COOKIE = 'auditely_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const encoder = new TextEncoder();

function getSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function base64url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

// Constant-time string compare (length leak only, which is fixed for signatures)
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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
