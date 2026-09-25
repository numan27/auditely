// app/api/find-emails/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { contactsUpdate, discoverContacts } from '@/app/_shared/lib/utils/contactDiscovery';
import type { Socials } from '@/app/_shared/lib/utils/contactChannels';

interface BusinessRow {
  id: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  contact_page: string | null;
  socials: Socials | null;
  contacts_checked_at: string | null;
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

// Batch contact discovery (email, phone, contact page, social profiles). Called two ways:
//   - Bulk background discovery (no apiFallback) → scrape-only, quota-safe.
//   - On-demand single business (apiFallback: true) → full cascade incl. Hunter.
// Never overwrites an email or phone already on file. Always returns 200.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const businessIds: string[] = Array.isArray(body.business_ids)
    ? body.business_ids.filter((id: unknown) => typeof id === 'string')
    : [];
  const apiFallback: boolean = body.apiFallback === true;

  if (businessIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, website, email, phone, contact_page, socials, contacts_checked_at')
    .in('id', businessIds);

  const rows: BusinessRow[] = businesses ?? [];

  const results: FindResult[] = await Promise.all(
    rows.map(async (b): Promise<FindResult> => {
      // Nothing to scrape, or email found and channels already checked → skip.
      if (!b.website || (b.email && b.contacts_checked_at)) return toResult(b);

      try {
        const found = await discoverContacts(b.website, { apiFallback });
        const update = contactsUpdate(b, found, new Date().toISOString());
        if (Object.keys(update).length === 0) return toResult(b);

        const { error } = await supabase.from('businesses').update(update).eq('id', b.id);
        if (error) {
          console.error('[find-emails] update failed:', error.message);
          return toResult(b);
        }
        return toResult({ ...b, ...update });
      } catch {
        return toResult(b);
      }
    })
  );

  return NextResponse.json({ results });
}
