// app/api/audit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { auditBusiness } from '@/app/_shared/lib/audit/auditBusiness';
import { meterFor } from '@/app/_shared/lib/usage/usage';

// PageSpeed can be slow; runAudit keeps PageSpeed inside a 240 s budget.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const businessId: string = typeof body.business_id === 'string' ? body.business_id : '';
  const force = body.force === true;

  if (!businessId) {
    return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
  }

  // Each audit that runs counts against the plan; a cached one is free
  const result = await auditBusiness(session.db, businessId, force, meterFor(session.account));
  if (!result.ok) return NextResponse.json({ error: result.error, limit: result.limit }, { status: result.status });
  return NextResponse.json({ audit: result.audit, email: result.email });
}
