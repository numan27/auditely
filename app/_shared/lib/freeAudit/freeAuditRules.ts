// app/_shared/lib/freeAudit/freeAuditRules.ts

// The free audit on the landing page: one per visitor's network in the window,
// a signed cookie that brings back the one they ran, and a daily cap across
// everyone. Visitors are counted by a salted hash of their address, never the
// address itself; an IPv6 visitor is counted by their /64.

import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { safeEqual, sign } from '@/app/_shared/lib/auth/signing';
import type { AuditFields } from '@/app/_shared/lib/types/auditely';
import { PLANS } from '@/app/_shared/lib/usage/plans';

type Env = Record<string, string | undefined>;

export const FREE_AUDIT_COOKIE = 'auditely_free_audit';

export interface FreeAuditConfig {
  /** Free audits a day across everyone; 0 pauses them */
  dailyCap: number;
  /** Days before a visitor's network can have another */
  windowDays: number;
  salt: string;
  secret: string;
}

export type FreeAuditSetup =
  | { state: 'off' }
  | { state: 'unavailable'; missing: string[] }
  | { state: 'on'; config: FreeAuditConfig };

function wholeNumber(value: string | undefined, min: number, fallback: number): number {
  if (!value || !/^\d+$/.test(value.trim())) return fallback;
  const n = Number(value.trim());
  return n >= min ? n : fallback;
}

/** Whether free audits are on, and what's missing when they're on but can't run */
export function freeAuditSetup(env: Env = process.env): FreeAuditSetup {
  if (env.FREE_AUDIT_ENABLED !== 'true') return { state: 'off' };
  const salt = env.FREE_AUDIT_IP_SALT ?? '';
  const secret = env.AUTH_SECRET ?? '';
  const missing: string[] = [];
  if (salt.length < 16) missing.push('FREE_AUDIT_IP_SALT');
  // The same rule as getSecret()
  if (secret.length < 32) missing.push('AUTH_SECRET');
  if (!env.GOOGLE_PAGESPEED_API_KEY) missing.push('GOOGLE_PAGESPEED_API_KEY');
  if (missing.length) return { state: 'unavailable', missing };
  return {
    state: 'on',
    config: {
      dailyCap: wholeNumber(env.FREE_AUDIT_DAILY_CAP, 0, 200),
      windowDays: wholeNumber(env.FREE_AUDIT_WINDOW_DAYS, 1, 30),
      salt,
      secret,
    },
  };
}

/** The visitor's address: the first forwarded one, else x-real-ip; 'unknown' when neither is an IP */
export function visitorIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded && isIP(forwarded)) return forwarded;
  const real = headers.get('x-real-ip')?.trim();
  if (real && isIP(real)) return real;
  return 'unknown';
}

// All eight hextets, four digits each, lower case
function expandIpv6(ip: string): string[] {
  const parts = (s: string) =>
    s
      ? s.split(':').flatMap((p) => {
          if (!p.includes('.')) return [p];
          const [a, b, c, d] = p.split('.').map(Number);
          return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
        })
      : [];
  const [head, tail] = ip.toLowerCase().split('::');
  const before = parts(head);
  const after = tail === undefined ? [] : parts(tail);
  const zeros = tail === undefined ? [] : Array(8 - before.length - after.length).fill('0');
  return [...before, ...zeros, ...after].map((h) => h.padStart(4, '0'));
}

/** What a visitor is counted by: an IPv4 address, or an IPv6 /64 */
export function visitorKey(ip: string): string {
  const address = ip.split('%')[0];
  const version = isIP(address);
  if (version === 4) return address;
  if (version !== 6) return ip;
  const hextets = expandIpv6(address);
  // ::ffff:a.b.c.d is an IPv4 visitor
  if (hextets.slice(0, 5).every((h) => h === '0000') && hextets[5] === 'ffff') {
    const v4 = [hextets[6], hextets[7]].map((h) => parseInt(h, 16));
    return [v4[0] >> 8, v4[0] & 255, v4[1] >> 8, v4[1] & 255].join('.');
  }
  return `${hextets.slice(0, 4).join(':')}::/64`;
}

export function visitorHash(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${visitorKey(ip)}`).digest('hex');
}

// Free audit ids are UUIDs. Signing "free-audit:<id>" keeps a report link's
// signature from ever passing for this cookie's.
const FREE_AUDIT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const signed = (id: string) => `free-audit:${id}`;

export async function signFreeAuditCookie(id: string, secret: string): Promise<string> {
  return `${id}.${await sign(signed(id), secret)}`;
}

/** The free audit id a cookie is for; null for a missing, malformed or changed cookie */
export async function readFreeAuditCookie(value: string | undefined | null, secret: string): Promise<string | null> {
  const dot = value ? value.indexOf('.') : -1;
  if (!value || dot === -1) return null;
  const id = value.slice(0, dot);
  if (!FREE_AUDIT_ID.test(id)) return null;
  return safeEqual(value.slice(dot + 1), await sign(signed(id), secret)) ? id : null;
}

export function freeAuditCookieOptions(windowDays: number, env: Env = process.env) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: windowDays * 86_400,
  };
}

/** Midnight UTC on the day `now` falls in */
export function dayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function windowStart(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

export type FreeAuditReason = 'off' | 'unavailable' | 'invalid' | 'notPublic' | 'bot' | 'visitor' | 'cap' | 'failed';

export interface FreeAuditView {
  website: string;
  host: string;
  createdAt: string;
  audit: AuditFields;
  report: { summary: string; improvements: string[] } | null;
}

export type FreeAuditResponse =
  | { ok: true; result: FreeAuditView; again: boolean }
  | { ok: false; reason: FreeAuditReason; error: string };

const n = PLANS.free.limits.audit;

export const FREE_AUDIT_COPY = {
  again: `You've had your free audit, so here's the one you ran. Sign up free to keep it and run ${n} audits a month.`,
  visitor: `Someone on this network has already had the free audit. Sign up free to run ${n} audits a month.`,
  cap: 'Free audits are paused for today. Sign up free to run your own now, or try again tomorrow.',
  notPublic: "That isn't a public website. Enter the site's address, like example.com.",
  notFound: (host: string) => `${host} wasn't found. Check the address and try again.`,
  lookupFailed: (host: string) => `Couldn't look up ${host}. Try again in a minute.`,
  bot: "Your browser didn't pass our automated check. Reload the page and try again.",
  off: 'Sign up to audit a website.',
  unavailable: "Free audits aren't available right now. Sign up free to run your own.",
  failed: (host: string, reason: string) =>
    `Couldn't audit ${host}: ${reason.trim().replace(/\.+$/, '')}. Check the address and try again. This didn't use your free audit.`,
  keepTitle: 'Keep this audit',
  keepText: `Sign up free and it's saved to your account, with a PDF to send and ${n} more audits every month.`,
  used: `Your free audit is used. Sign up free to run ${n} audits a month, or audit a whole city's businesses on Pro.`,
};
