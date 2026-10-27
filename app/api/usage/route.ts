// app/api/usage/route.ts

// This month's use of each allowance for the signed-in account: the header meter
// and the plans page read it.

import { NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { usageSummary } from '@/app/_shared/lib/usage/usage';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const summary = await usageSummary(session.db, session.account);
  if (!summary) return NextResponse.json({ error: "Couldn't load this month's usage." }, { status: 503 });
  return NextResponse.json(summary);
}
