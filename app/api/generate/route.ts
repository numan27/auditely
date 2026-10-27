// app/api/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { generateAiReport } from '@/app/_shared/lib/audit/generateAiReport';
import { rewriteAllowed } from '@/app/_shared/lib/usage/rateLimit';

// Writes an audit's summary and first email, or serves the saved ones. With
// `rewrite: true` it writes them again in place ("Write again"), at most 10 times
// an hour per account; the owner is never capped.

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => null)) ?? {};
  const auditId: string = typeof body.audit_id === 'string' ? body.audit_id : '';
  const rewrite = body.rewrite === true;

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  const { account } = session;
  if (rewrite && !account.isOwner && !rewriteAllowed(account.id)) {
    return NextResponse.json({ error: 'You can write a summary again 10 times an hour. Try again later.' }, { status: 429 });
  }

  const result = await generateAiReport(session.db, auditId, { rewrite });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ai_report: result.ai_report });
}
