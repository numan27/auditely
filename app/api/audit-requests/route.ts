// app/api/audit-requests/route.ts

// The Requests tab: free audits requested on devartventures.com. GET lists
// them newest first, with their audits; DELETE removes the ones named. They
// arrive through /api/inbound/audit-request.

import { NextRequest, NextResponse } from 'next/server';
import { serviceDb } from '@/app/_shared/lib/supabase/client';
import { ownerUserId } from '@/app/_shared/lib/supabase/server';
import { requestSearchIds } from '@/app/_shared/lib/requests/requestSearch';
import { BUSINESS_WITH_AUDIT, withAuditData, type BusinessRow } from '@/app/_shared/lib/utils/businessRows';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// More than the list will hold; a longer request isn't from the app
const MAX_REMOVED = 500;

export async function GET() {
  const ownerId = await ownerUserId();
  if (!ownerId) return NextResponse.json({ error: 'Audit requests are not set up' }, { status: 503 });

  const searchIds = await requestSearchIds(serviceDb, ownerId);
  if (searchIds.length === 0) return NextResponse.json({ businesses: [] });

  const { data, error } = await serviceDb
    .from('businesses')
    .select(BUSINESS_WITH_AUDIT)
    .in('search_id', searchIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[audit-requests] Failed to load requests:', error.message);
    return NextResponse.json({ error: 'Failed to load the audit requests' }, { status: 500 });
  }
  return NextResponse.json({ businesses: (data as BusinessRow[]).map(withAuditData) });
}

// Removes requests for good: their audits and reports go with them (ON DELETE
// CASCADE). Only requests: a lead's or a URL audit's id is left alone.
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ids: unknown = body?.ids;
  const valid =
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= MAX_REMOVED &&
    ids.every((id) => typeof id === 'string' && UUID.test(id));
  if (!valid) return NextResponse.json({ error: 'Choose the requests to remove' }, { status: 400 });

  const ownerId = await ownerUserId();
  if (!ownerId) return NextResponse.json({ error: 'Audit requests are not set up' }, { status: 503 });

  const searchIds = await requestSearchIds(serviceDb, ownerId);
  if (searchIds.length === 0) return NextResponse.json({ removed: [] });

  const { data, error } = await serviceDb
    .from('businesses')
    .delete()
    .in('search_id', searchIds)
    .in('id', ids as string[])
    .select('id');
  if (error) {
    console.error('[audit-requests] Failed to remove requests:', error.message);
    return NextResponse.json({ error: 'Failed to remove the request' }, { status: 500 });
  }
  return NextResponse.json({ removed: (data ?? []).map((row) => row.id as string) });
}
