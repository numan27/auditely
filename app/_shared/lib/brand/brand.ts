// app/_shared/lib/brand/brand.ts

// The brand on an account's reports and emails, read from its profile and its
// subscription with the service role: a signed report link has no session, and
// the report's owner, not whoever opens it, decides whose name is on it. A profile
// that can't be read stops the report rather than drawing the owner's work as
// Auditely's; a subscription that can't be read counts as none. Server-only.

import { isOwnerEmail } from '@/app/_shared/lib/auth/account';
import { subscriptionOf } from '@/app/_shared/lib/billing/subscription';
import { resolveBrand, type Brand, type Profile } from '@/app/_shared/lib/brand/brandRules';
import { brandLogo } from '@/app/_shared/lib/email/brandLogo';
import { serviceDb } from '@/app/_shared/lib/supabase/client';
import { planFor } from '@/app/_shared/lib/usage/plans';

export const SETTINGS_MIGRATION = 'docs/migrations/2026-10-29-settings.sql';
export const STUDIO_MIGRATION = 'docs/migrations/2026-11-02-brand-studio.sql';
export const BRAND_UNAVAILABLE = "Couldn't load this account's branding. Try again in a minute.";

export class BrandUnavailable extends Error {
  constructor(reason?: string) {
    super(reason ? `Couldn't read the profile: ${reason}` : "Couldn't read the profile");
    this.name = 'BrandUnavailable';
  }
}

/** What Settings says when the settings migration hasn't run: the fix for the owner, a plain note for anyone else */
export function settingsUnavailable(isOwner: boolean): string {
  return isOwner
    ? `Settings need the latest database update: run ${SETTINGS_MIGRATION} in Supabase.`
    : "Settings can't be saved right now. Try again later.";
}

/** What the Brand studio says when its migration hasn't run */
export function studioUnavailable(isOwner: boolean): string {
  return isOwner
    ? `The Brand studio needs the latest database update: run ${STUDIO_MIGRATION} in Supabase.`
    : "Your brand can't be saved right now. Try again later.";
}

const AUDITELY = (): Brand => resolveBrand({ profile: null, isOwner: false, plan: 'free' });

/** The brand for the account that owns a row; null (a row from before accounts) gets Auditely's */
export async function brandFor(userId: string | null): Promise<Brand> {
  if (!userId) return AUDITELY();
  // '*' rather than a column list: before the settings migration the new columns
  // simply aren't there, and read as blank
  const [{ data, error }, subscription] = await Promise.all([
    serviceDb.from('profiles').select('*').eq('id', userId).maybeSingle(),
    subscriptionOf(serviceDb, userId),
  ]);
  if (error) throw new BrandUnavailable(error.message);
  if (!data) return AUDITELY();
  const profile = data as Profile;
  const isOwner = isOwnerEmail(profile.email);
  return resolveBrand({ profile, isOwner, plan: planFor({ email: profile.email, isOwner, subscription }).id });
}

/** The logo the outreach email attaches: the profile's own, else today's DevArtVentures file for the owner */
export async function emailLogo(
  brand: Brand
): Promise<{ content: Buffer; contentType: 'image/png' | 'image/jpeg'; filename: string } | null> {
  if (brand.logo) {
    const { contentType, dataUrl } = brand.logo;
    return {
      content: Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'),
      contentType,
      filename: contentType === 'image/png' ? 'brand-logo.png' : 'brand-logo.jpg',
    };
  }
  if (brand.kind !== 'owner') return null;
  const content = await brandLogo();
  return content ? { content, contentType: 'image/png', filename: 'brand-logo.png' } : null;
}
