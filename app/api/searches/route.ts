// app/api/searches/route.ts

import { NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { isUrlOnlySearch } from '@/app/_shared/lib/config/auditRequests';
import { placeDataCutoff, placeDataFresh } from '@/app/_shared/lib/places/placeData';

type Count = { count: number }[] | null;
const countOf = (rows: unknown) => (rows as Count)?.[0]?.count ?? 0;

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  // This account's own searches. The user_id filter is a second lock: Row Level
  // Security already shows only their own. Google's terms keep its place details 30
  // days, so `fresh` counts the leads still shown: a refreshed search leaves out the
  // ones Google didn't send again.
  const { data, error } = await session.db
    .from('searches')
    .select('id, niche, location, created_at, businesses(count), fresh:businesses(count)')
    .eq('user_id', session.account.id)
    .gte('fresh.created_at', placeDataCutoff())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[searches] Failed to load searches:', error.message);
    return NextResponse.json({ error: "Couldn't load your saved searches. Try again in a minute." }, { status: 500 });
  }

  // Websites added by URL and requested audits live on the home page's tabs, not here
  // An out-of-date search shows how many leads it had, until it's run again
  const searches = (data ?? []).filter((s) => !isUrlOnlySearch(s)).map((s) => {
    const expired = !placeDataFresh(s.created_at);
    return {
      id: s.id,
      niche: s.niche,
      location: s.location,
      created_at: s.created_at,
      business_count: countOf(expired ? s.businesses : s.fresh),
      expired,
    };
  });

  return NextResponse.json({ searches });
}
