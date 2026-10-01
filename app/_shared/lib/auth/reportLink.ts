// app/_shared/lib/auth/reportLink.ts

// Private links to one audit's PDF report: `${auditId}.${signature}`, signed with
// AUTH_SECRET. Signing "report:<id>" keeps them from ever matching a session
// signature. Rotating AUTH_SECRET turns every link off.

import { getSecret, safeEqual, sign } from '@/app/_shared/lib/auth/signing';

// Audit ids are UUIDs
const AUDIT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const signed = (auditId: string) => `report:${auditId}`;

/** The token for an audit's report link; null when AUTH_SECRET isn't set */
export async function reportToken(auditId: string): Promise<string | null> {
  const secret = getSecret();
  return secret ? `${auditId}.${await sign(signed(auditId), secret)}` : null;
}

/** The audit id a valid token is for; null for a missing, malformed or changed token */
export async function verifyReportToken(token: string): Promise<string | null> {
  const secret = getSecret();
  const dot = token.indexOf('.');
  if (!secret || dot === -1) return null;
  const auditId = token.slice(0, dot);
  if (!AUDIT_ID.test(auditId)) return null;
  return safeEqual(token.slice(dot + 1), await sign(signed(auditId), secret)) ? auditId : null;
}
