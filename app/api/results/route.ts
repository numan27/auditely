// app/api/results/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const searchId = searchParams.get('search_id');

  if (!searchId) {
    return NextResponse.json({ error: 'search_id query parameter is required' }, { status: 400 });
  }

  const { data: businesses, error } = await supabase
    .from('businesses')
    .select(`
      *,
      audits (
        *,
        ai_reports (*)
      )
    `)
    .eq('search_id', searchId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ businesses: businesses ?? [] });
}
