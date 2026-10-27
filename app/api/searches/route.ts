// app/api/searches/route.ts

import { NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { isUrlOnlySearch } from '@/app/_shared/lib/config/auditRequests';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  // This account's own searches. The user_id filter is a second lock: Row Level
  // Security already shows only their own.
  const { data, error } = await session.db
    .from('searches')
    .select('*, businesses(count)')
    .eq('user_id', session.account.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[searches] Failed to load searches:', error.message);
    return NextResponse.json({ error: 'Failed to load searches' }, { status: 500 });
  }

  // Websites added by URL and requested audits live on the home page's tabs, not here
  const searches = (data ?? []).filter((s) => !isUrlOnlySearch(s)).map((s) => ({
    id: s.id,
    niche: s.niche,
    location: s.location,
    created_at: s.created_at,
    business_count: (s.businesses as unknown as { count: number }[])[0]?.count ?? 0,
  }));

  return NextResponse.json({ searches });
}
