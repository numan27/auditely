// app/api/results/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { isUrlOnlySearch } from '@/app/_shared/lib/config/auditRequests';
import { placeDataFresh } from '@/app/_shared/lib/places/placeData';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// More than one search returns; a longer request isn't from the app
const MAX_REMOVED = 500;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db, account } = session;

  const { searchParams } = new URL(request.url);
  const searchId = searchParams.get('search_id');

  if (!searchId) {
    return NextResponse.json({ error: 'search_id query parameter is required' }, { status: 400 });
  }

  const searchQuery = db.from('searches').select('niche, location, created_at').eq('id', searchId).maybeSingle();
  const businessQuery = db
    .from('businesses')
    .select(`
      *,
      audits (
        *,
        ai_reports (*)
      )
    `)
    .eq('search_id', searchId)
    // A second lock: Row Level Security already shows only this account's businesses
    .eq('user_id', account.id)
    .order('created_at', { ascending: true })
    // Newest first, so the client's audits[0] / ai_reports[0] is the latest even with duplicates
    .order('created_at', { referencedTable: 'audits', ascending: false })
    .order('created_at', { referencedTable: 'audits.ai_reports', ascending: false });
  const [{ data: search }, { data: businesses, error }] = await Promise.all([searchQuery, businessQuery]);

  if (error) {
    console.error('[results] Failed to load businesses:', error.message);
    return NextResponse.json({ error: "Couldn't open this search. Try again in a minute." }, { status: 500 });
  }

  if (!search) return NextResponse.json({ search: null, businesses: businesses ?? [] });
  const { niche, location, created_at } = search;
  const rows = businesses ?? [];

  // Websites added by URL and audit requests aren't from Google, so they're kept as they are
  if (isUrlOnlySearch(search)) return NextResponse.json({ search: { niche, location }, businesses: rows });

  // Google's terms keep its place details 30 days. A search older than that shows
  // how many leads it had until it's run again (/api/search refreshes it), and a
  // refreshed one leaves out the leads Google didn't send again.
  if (!placeDataFresh(created_at)) {
    return NextResponse.json({ search: { niche, location }, expired: { count: rows.length }, businesses: [] });
  }
  return NextResponse.json({ search: { niche, location }, businesses: rows.filter((b) => placeDataFresh(b.created_at)) });
}

// Takes leads out of one saved search for good: their audits and reports go with
// them (ON DELETE CASCADE), and the same search run again reuses this one, so they
// don't come back. Websites added by URL and audit requests have their own lists.
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db } = session;

  const body = await request.json().catch(() => ({}));
  const searchId: unknown = body?.search_id;
  const ids: unknown = body?.ids;
  const valid =
    typeof searchId === 'string' &&
    UUID.test(searchId) &&
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= MAX_REMOVED &&
    ids.every((id) => typeof id === 'string' && UUID.test(id));
  if (!valid) return NextResponse.json({ error: 'Choose the businesses to remove' }, { status: 400 });

  const { data: search } = await db.from('searches').select('niche, location').eq('id', searchId).maybeSingle();
  if (!search) return NextResponse.json({ removed: [] });
  if (isUrlOnlySearch(search)) {
    return NextResponse.json({ error: 'Remove these from their own tab' }, { status: 400 });
  }

  const { data, error } = await db
    .from('businesses')
    .delete()
    .eq('search_id', searchId)
    .in('id', ids as string[])
    .select('id');
  if (error) {
    console.error('[results] Failed to remove businesses:', error.message);
    return NextResponse.json({ error: "Couldn't remove them. Try again in a minute." }, { status: 500 });
  }
  return NextResponse.json({ removed: (data ?? []).map((row) => row.id as string) });
}
