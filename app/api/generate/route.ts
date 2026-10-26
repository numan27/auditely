// app/api/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateAiReport } from '@/app/_shared/lib/audit/generateAiReport';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  const result = await generateAiReport(auditId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ai_report: result.ai_report });
}
