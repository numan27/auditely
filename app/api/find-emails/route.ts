// app/api/find-emails/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { findEmail } from '@/app/_shared/lib/utils/emailFinder';

interface FindResult {
  business_id: string;
  email: string | null;
}

interface BusinessRow {
  id: string;
  website: string | null;
  email: string | null;
}

// Batch email discovery. Called two ways:
//   - Bulk background discovery (no apiFallback) → scrape-only, quota-safe.
//   - On-demand single business (apiFallback: true) → full cascade incl. Hunter.
// Never overwrites an email that is already on file. Always returns 200.
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
    .select('id, website, email')
    .in('id', businessIds);

  const rows: BusinessRow[] = businesses ?? [];

  const results: FindResult[] = await Promise.all(
    rows.map(async (b): Promise<FindResult> => {
      // Already have an email, or nothing to scrape → skip discovery.
      if (b.email) return { business_id: b.id, email: b.email };
      if (!b.website) return { business_id: b.id, email: null };

      try {
        const found = await findEmail(b.website, { apiFallback });
        if (found) {
          await supabase.from('businesses').update({ email: found }).eq('id', b.id);
        }
        return { business_id: b.id, email: found };
      } catch {
        return { business_id: b.id, email: null };
      }
    })
  );

  return NextResponse.json({ results });
}
