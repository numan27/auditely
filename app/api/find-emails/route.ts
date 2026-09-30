// app/api/find-emails/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { contactsUpdate, discoverContacts, emailLookupUpdate } from '@/app/_shared/lib/utils/contactDiscovery';
import { lookupEmailViaApis } from '@/app/_shared/lib/utils/emailApis';
import type { Socials } from '@/app/_shared/lib/utils/contactChannels';

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

async function save(b: BusinessRow, update: Partial<BusinessRow>): Promise<FindResult> {
  if (Object.keys(update).length === 0) return toResult(b);
  const { error } = await supabase.from('businesses').update(update).eq('id', b.id);
  if (error) {
    console.error('[find-emails] update failed:', error.message);
    return toResult(b);
  }
  return toResult({ ...b, ...update });
}

// Scrape the site for email, phone, contact page and socials (+ the paid APIs
// when apiFallback). A manual lookup also counts as the one-time API lookup.
async function discover(b: BusinessRow, apiFallback: boolean): Promise<FindResult> {
  // Nothing to scrape, or email found and channels already checked → skip.
  if (!b.website || (b.email && b.contacts_checked_at)) return toResult(b);
  const now = new Date().toISOString();
  const found = await discoverContacts(b.website, { apiFallback });
  return save(b, { ...contactsUpdate(b, found, now), ...(apiFallback ? { email_lookup_at: now } : {}) });
}

// The automatic after-search pass: the paid APIs once per business, in 'auto'
// mode (Hunter, then Snov, each only when its free count says it has an email).
async function lookupOnce(b: BusinessRow): Promise<FindResult> {
  if (!b.website || b.email || b.email_lookup_at) return toResult(b);
  const domain = new URL(b.website).hostname.replace(/^www\./, '');
  const email = await lookupEmailViaApis(domain, 'auto');
  return save(b, emailLookupUpdate(email, new Date().toISOString()));
}

// Batch contact discovery. Called three ways:
//   - Bulk background discovery (no flags) → scrape-only, quota-safe.
//   - Automatic API pass after it (apiLookup: 'auto') → paid APIs once per
//     business; Hunter then Snov, each only when it has an email for the domain.
//   - On-demand single business (apiFallback: true) → scrape + full API cascade.
// Never overwrites an email or phone already on file. Always returns 200.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const businessIds: string[] = Array.isArray(body.business_ids)
    ? body.business_ids.filter((id: unknown) => typeof id === 'string')
    : [];
  const apiFallback: boolean = body.apiFallback === true;
  const autoLookup: boolean = body.apiLookup === 'auto';

  if (businessIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, website, email, phone, contact_page, socials, contacts_checked_at, email_lookup_at')
    .in('id', businessIds);

  const rows: BusinessRow[] = businesses ?? [];

  const results: FindResult[] = await Promise.all(
    rows.map(async (b): Promise<FindResult> => {
      try {
        return autoLookup ? await lookupOnce(b) : await discover(b, apiFallback);
      } catch {
        return toResult(b);
      }
    })
  );

  return NextResponse.json({ results });
}
