// app/report/[token]/route.ts

// The private link to one audit's PDF report, sent with HubSpot leads. Public:
// the signed token is the only key (see lib/auth/reportLink.ts).

import { NextRequest, NextResponse } from 'next/server';
import { verifyReportToken } from '@/app/_shared/lib/auth/reportLink';
import { serviceDb } from '@/app/_shared/lib/supabase/client';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';

const notFound = () => new NextResponse('Report not found', { status: 404 });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const auditId = await verifyReportToken(token);
  if (!auditId) return notFound();

  const result = await renderAuditPdf(serviceDb, auditId);
  if (!result.ok) return result.status === 404 ? notFound() : new NextResponse('Report unavailable', { status: 500 });

  return new Response(new Uint8Array(result.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
