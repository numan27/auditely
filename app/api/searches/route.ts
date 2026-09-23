// app/api/searches/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';

export async function GET() {
  const { data, error } = await supabase
    .from('searches')
    .select('*, businesses(count)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[searches] Failed to load searches:', error.message);
    return NextResponse.json({ error: 'Failed to load searches' }, { status: 500 });
  }

  const searches = (data ?? []).map((s) => ({
    id: s.id,
    niche: s.niche,
    location: s.location,
    created_at: s.created_at,
    business_count: (s.businesses as unknown as { count: number }[])[0]?.count ?? 0,
  }));

  return NextResponse.json({ searches });
}
