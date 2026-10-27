// app/api/find-emails/route.ts

import { NextRequest, NextResponse } from 'next/server';
import type { Db } from '@/app/_shared/lib/supabase/client';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { contactsUpdate, discoverContacts, emailLookupUpdate } from '@/app/_shared/lib/utils/contactDiscovery';
import { lookupEmailViaApis } from '@/app/_shared/lib/utils/emailApis';
import type { Socials } from '@/app/_shared/lib/utils/contactChannels';
import { meterFor } from '@/app/_shared/lib/usage/usage';
import type { LimitReached } from '@/app/_shared/lib/usage/plans';

// Asked before a lookup spends its first credit: true to go ahead
type Gate = () => Promise<boolean>;

interface BusinessRow {
  id: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  contact_page: string | null;
  socials: Socials | null;
  contacts_checked_at: string | null;
  email_lookup_at: string | null;
}

export interface FindResult {
  business_id: string;
  email: string | null;
  phone: string | null;
  contact_page: string | null;
  socials: Socials;
}

const toResult = (b: BusinessRow): FindResult => ({
  business_id: b.id,
  email: b.email,
  phone: b.phone,
  contact_page: b.contact_page,
  socials: b.socials ?? {},
});

async function save(db: Db, b: BusinessRow, update: Partial<BusinessRow>): Promise<FindResult> {
  if (Object.keys(update).length === 0) return toResult(b);
  const { error } = await db.from('businesses').update(update).eq('id', b.id);
  if (error) {
    console.error('[find-emails] update failed:', error.message);
    return toResult(b);
  }
  return toResult({ ...b, ...update });
}

const domainOf = (website: string) => new URL(website).hostname.replace(/^www\./, '');

// Scrape the site for email, phone, contact page and socials, then the paid APIs
// when there's a gate and still no email. A paid lookup that ran also counts as
// the one-time API lookup; a refused one doesn't.
async function discover(db: Db, b: BusinessRow, gate: Gate | null): Promise<FindResult> {
  // Nothing to scrape, or email found and channels already checked → skip.
  if (!b.website || (b.email && b.contacts_checked_at)) return toResult(b);
  const now = new Date().toISOString();
  const found = await discoverContacts(b.website);
  const lookup = gate && !b.email && !found.email ? await lookupEmailViaApis(domainOf(b.website), 'all', gate) : null;
  const contacts = contactsUpdate(b, { ...found, email: found.email ?? lookup?.email ?? null }, now);
  return save(db, b, { ...contacts, ...(lookup && !lookup.refused ? emailLookupUpdate(lookup.email, now) : {}) });
}

// The automatic after-search pass: the paid APIs once per business, in 'auto'
// mode (Hunter, then Snov, each only when its free count says it has an email).
// A refused lookup saves nothing, so email_lookup_at stays empty and the business
// is looked up again once the allowance is back.
async function lookupOnce(db: Db, b: BusinessRow, gate: Gate): Promise<FindResult> {
  if (!b.website || b.email || b.email_lookup_at) return toResult(b);
  const lookup = await lookupEmailViaApis(domainOf(b.website), 'auto', gate);
  if (lookup.refused) return toResult(b);
  return save(db, b, emailLookupUpdate(lookup.email, new Date().toISOString()));
}

// Batch contact discovery. Called three ways:
//   - Bulk background discovery (no flags) → scrape-only, quota-safe.
//   - Automatic API pass after it (apiLookup: 'auto') → paid APIs once per
//     business; Hunter then Snov, each only when it has an email for the domain.
//   - On-demand single business (apiFallback: true) → scrape + full API cascade.
// The paid APIs follow the plan's allowance: each business a credit is spent on
// claims one email lookup first. A plan without lookups only scrapes, and the
// answer's `limit` says which allowance stopped them. The owner is never counted.
// Never overwrites an email or phone already on file. Always returns 200.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db, account } = session;

  const body = await request.json().catch(() => ({}));
  const businessIds: string[] = Array.isArray(body.business_ids)
    ? body.business_ids.filter((id: unknown) => typeof id === 'string')
    : [];
  const autoLookup: boolean = body.apiLookup === 'auto';
  const wantsLookup: boolean = autoLookup || body.apiFallback === true;

  const meter = meterFor(account);
  let limit: LimitReached | undefined = (wantsLookup && meter.notOnPlan('email_lookup')) || undefined;
  // One gate per business: it claims a lookup, and keeps the first limit it meets
  const gate = (): Gate => async () => {
    const claim = await meter.claim('email_lookup');
    if (claim.ok) return true;
    if (claim.limit) limit ??= claim.limit;
    return false;
  };
  const canLookUp = wantsLookup && !limit;

  if (businessIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const { data: businesses } = await db
    .from('businesses')
    .select('id, website, email, phone, contact_page, socials, contacts_checked_at, email_lookup_at')
    .in('id', businessIds);

  const rows: BusinessRow[] = businesses ?? [];

  const results: FindResult[] = await Promise.all(
    rows.map(async (b): Promise<FindResult> => {
      try {
        if (autoLookup) return canLookUp ? await lookupOnce(db, b, gate()) : toResult(b);
        return await discover(db, b, canLookUp ? gate() : null);
      } catch {
        return toResult(b);
      }
    })
  );

  return NextResponse.json({ results, limit });
}
