// app/api/pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';
import type { PdfVariant } from '@/app/_shared/lib/types/auditely';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auditId: string = body.audit_id ?? '';
  const variant: PdfVariant = body.variant === 'upwork' ? 'upwork' : 'full';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  const result = await renderAuditPdf(auditId, variant);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new Response(new Uint8Array(result.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    },
  });
}
