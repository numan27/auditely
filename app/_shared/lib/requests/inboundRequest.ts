// app/_shared/lib/requests/inboundRequest.ts

// What devartventures.com sends when a visitor requests a free audit, checked
// before anything is stored. The site signs in with AUDITELY_INBOUND_SECRET as a
// bearer token; the same value is set on both projects. Server-only.

import { safeEqual } from '@/app/_shared/lib/auth/signing';
import { normalizeWebsiteUrl } from '@/app/_shared/lib/utils/websiteUrl';
import type { AuditRequest } from '@/app/_shared/lib/types/auditely';

// As long as AUTH_SECRET: `openssl rand -hex 32`
const MIN_SECRET = 32;
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i;
const SOURCE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_CHOICE = 120;

/** The shared secret when it's long enough to trust */
export function inboundSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.AUDITELY_INBOUND_SECRET?.trim();
  return secret && secret.length >= MIN_SECRET ? secret : null;
}

/** True when the Authorization header carries the secret */
export function hasInboundSecret(authorization: string | null, secret: string): boolean {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1].trim() ?? '';
  return safeEqual(token, secret);
}

export interface InboundAuditRequest {
  website: string;
  /** The website without "www.": the card's name, as for a site added by URL */
  host: string;
  email: string;
  request: AuditRequest;
}

export type InboundParse = { ok: true; value: InboundAuditRequest } | { ok: false; error: string };

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// An optional choice from the site's form: empty becomes null
function choice(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  const chosen = text(value);
  if (chosen.length > MAX_CHOICE) return undefined;
  return chosen || null;
}

export function parseInboundRequest(body: unknown): InboundParse {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  const sourceId = text(input.id);
  if (!SOURCE_ID.test(sourceId)) return { ok: false, error: 'id is required' };

  const name = text(input.name);
  if (!name || name.length > MAX_NAME) return { ok: false, error: 'name is required' };

  const email = text(input.email).toLowerCase();
  if (email.length > MAX_EMAIL || !EMAIL.test(email)) return { ok: false, error: 'email must be a single email address' };

  const website = normalizeWebsiteUrl(text(input.website));
  if (!website.ok) return { ok: false, error: website.error };

  const businessType = choice(input.businessType);
  const mainConcern = choice(input.mainConcern);
  if (businessType === undefined || mainConcern === undefined) return { ok: false, error: 'businessType and mainConcern are short choices' };

  const requestedAt = new Date(text(input.requestedAt));
  if (Number.isNaN(requestedAt.getTime())) return { ok: false, error: 'requestedAt must be a date' };

  return {
    ok: true,
    value: {
      website: website.url,
      host: website.host,
      email,
      request: {
        source_id: sourceId,
        name,
        business_type: businessType,
        main_concern: mainConcern,
        requested_at: requestedAt.toISOString(),
      },
    },
  };
}
