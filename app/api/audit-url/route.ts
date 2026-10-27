// app/api/audit-url/route.ts

// "Audit a website": sites entered by URL rather than found by a search.
// GET lists them newest first, with their audits; POST adds one (or returns
// the same site if it was added before); DELETE removes the ones named.

import { NextRequest, NextResponse } from 'next/server';
import type { Db } from '@/app/_shared/lib/supabase/client';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { DIRECT_AUDIT_SEARCH } from '@/app/_shared/lib/config/directAudits';
import { normalizeWebsiteUrl, websiteKey } from '@/app/_shared/lib/utils/websiteUrl';
import { BUSINESS_WITH_AUDIT, withAuditData, type BusinessRow } from '@/app/_shared/lib/utils/businessRows';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// More than the list will hold; a longer request isn't from the app
const MAX_REMOVED = 500;

// This account's reserved search: Row Level Security shows only its own
async function findDirectSearchId(db: Db): Promise<string | null> {
  const { data } = await db
    .from('searches')
    .select('id')
    .eq('niche', DIRECT_AUDIT_SEARCH.niche)
    .eq('location', DIRECT_AUDIT_SEARCH.location)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function loadBusiness(db: Db, id: string) {
  const { data } = await db.from('businesses').select(BUSINESS_WITH_AUDIT).eq('id', id).single();
  return data ? withAuditData(data as BusinessRow) : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db } = session;

  const searchId = await findDirectSearchId(db);
  if (!searchId) return NextResponse.json({ businesses: [] });

  const { data, error } = await db
    .from('businesses')
    .select(BUSINESS_WITH_AUDIT)
    .eq('search_id', searchId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[audit-url] Failed to load audits:', error.message);
    return NextResponse.json({ error: 'Failed to load website audits' }, { status: 500 });
  }
  return NextResponse.json({ businesses: (data as BusinessRow[]).map(withAuditData) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db } = session;

  const body = await request.json().catch(() => ({}));
  const parsed = normalizeWebsiteUrl(typeof body.url === 'string' ? body.url : '');
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let searchId = await findDirectSearchId(db);
  if (!searchId) {
    const { data, error } = await db.from('searches').insert(DIRECT_AUDIT_SEARCH).select('id').single();
    if (error || !data) {
      console.error('[audit-url] Failed to create search:', error?.message);
      return NextResponse.json({ error: 'Failed to save the website' }, { status: 500 });
    }
    searchId = data.id as string;
  }

  // Added before → return it with its audit, so it isn't audited twice
  const { data: sites } = await db.from('businesses').select('id, website').eq('search_id', searchId);
  const key = websiteKey(parsed.url);
  const match = sites?.find((b) => b.website && websiteKey(b.website) === key);
  if (match) {
    const business = await loadBusiness(db, match.id);
    if (business) return NextResponse.json({ business, existing: true });
  }

  const { data, error } = await db
    .from('businesses')
    .insert({ search_id: searchId, name: parsed.host, address: '', website: parsed.url })
    .select()
    .single();
  if (error || !data) {
    console.error('[audit-url] Failed to store website:', error?.message);
    return NextResponse.json({ error: 'Failed to save the website' }, { status: 500 });
  }
  return NextResponse.json({ business: data, existing: false });
}

// Removes sites from the list for good: their audits and reports go with them
// (ON DELETE CASCADE). Only websites added by URL: a lead's id is left alone.
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db } = session;

  const body = await request.json().catch(() => ({}));
  const ids: unknown = body?.ids;
  const valid =
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= MAX_REMOVED &&
    ids.every((id) => typeof id === 'string' && UUID.test(id));
  if (!valid) return NextResponse.json({ error: 'Choose the websites to remove' }, { status: 400 });

  const searchId = await findDirectSearchId(db);
  if (!searchId) return NextResponse.json({ removed: [] });

  const { data, error } = await db
    .from('businesses')
    .delete()
    .eq('search_id', searchId)
    .in('id', ids as string[])
    .select('id');
  if (error) {
    console.error('[audit-url] Failed to remove websites:', error.message);
    return NextResponse.json({ error: 'Failed to remove the website' }, { status: 500 });
  }
  return NextResponse.json({ removed: (data ?? []).map((row) => row.id as string) });
}
