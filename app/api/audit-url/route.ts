// app/api/audit-url/route.ts

// "Audit a website": sites entered by URL rather than found by a search.
// GET lists them newest first, with their audits; POST adds one (or returns
// the same site if it was added before).

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { DIRECT_AUDIT_SEARCH } from '@/app/_shared/lib/config/directAudits';
import { normalizeWebsiteUrl, websiteKey } from '@/app/_shared/lib/utils/websiteUrl';
import { BUSINESS_WITH_AUDIT, withAuditData, type BusinessRow } from '@/app/_shared/lib/utils/businessRows';

async function findDirectSearchId(): Promise<string | null> {
  const { data } = await supabase
    .from('searches')
    .select('id')
    .eq('niche', DIRECT_AUDIT_SEARCH.niche)
    .eq('location', DIRECT_AUDIT_SEARCH.location)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function loadBusiness(id: string) {
  const { data } = await supabase.from('businesses').select(BUSINESS_WITH_AUDIT).eq('id', id).single();
  return data ? withAuditData(data as BusinessRow) : null;
}

export async function GET() {
  const searchId = await findDirectSearchId();
  if (!searchId) return NextResponse.json({ businesses: [] });

  const { data, error } = await supabase
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
  const body = await request.json().catch(() => ({}));
  const parsed = normalizeWebsiteUrl(typeof body.url === 'string' ? body.url : '');
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let searchId = await findDirectSearchId();
  if (!searchId) {
    const { data, error } = await supabase.from('searches').insert(DIRECT_AUDIT_SEARCH).select('id').single();
    if (error || !data) {
      console.error('[audit-url] Failed to create search:', error?.message);
      return NextResponse.json({ error: 'Failed to save the website' }, { status: 500 });
    }
    searchId = data.id as string;
  }

  // Added before → return it with its audit, so it isn't audited twice
  const { data: sites } = await supabase.from('businesses').select('id, website').eq('search_id', searchId);
  const key = websiteKey(parsed.url);
  const match = sites?.find((b) => b.website && websiteKey(b.website) === key);
  if (match) {
    const business = await loadBusiness(match.id);
    if (business) return NextResponse.json({ business, existing: true });
  }

  const { data, error } = await supabase
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
