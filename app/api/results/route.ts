// app/api/results/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const searchId = searchParams.get('search_id');

  if (!searchId) {
    return NextResponse.json({ error: 'search_id query parameter is required' }, { status: 400 });
  }

  const searchQuery = supabase.from('searches').select('niche, location').eq('id', searchId).maybeSingle();
  const businessQuery = supabase
    .from('businesses')
    .select(`
      *,
      audits (
        *,
        ai_reports (*)
      )
    `)
    .eq('search_id', searchId)
    .order('created_at', { ascending: true })
    // Newest first, so the client's audits[0] / ai_reports[0] is the latest even with duplicates
    .order('created_at', { referencedTable: 'audits', ascending: false })
    .order('created_at', { referencedTable: 'audits.ai_reports', ascending: false });
  const [{ data: search }, { data: businesses, error }] = await Promise.all([searchQuery, businessQuery]);

  if (error) {
    console.error('[results] Failed to load businesses:', error.message);
    return NextResponse.json({ error: 'Failed to load results' }, { status: 500 });
  }

  return NextResponse.json({ search: search ?? null, businesses: businesses ?? [] });
}
