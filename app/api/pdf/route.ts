// app/api/pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import type { PdfDocumentProps } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  // Fetch audit + business
  const { data: audit } = await supabase
    .from('audits')
    .select('*, businesses(*)')
    .eq('id', auditId)
    .single();

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  // Fetch AI report
  const { data: aiReport } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .maybeSingle();

  if (!aiReport) {
    return NextResponse.json(
      { error: 'AI report not found — generate the report first' },
      { status: 404 }
    );
  }

  const business = audit.businesses as {
    name: string;
    website: string | null;
    address: string;
    phone: string | null;
  };

  const auditDate = new Date(audit.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  type KeyAudit = { score: number | null; title: string; displayValue?: string };
  type RawJson = { mobile?: { keyAudits?: Record<string, KeyAudit> } };
  const rawJson = audit.raw_json as RawJson | null;
  const mobileAudits = rawJson?.mobile?.keyAudits ?? {};
  const topIssues = Object.values(mobileAudits)
    .filter((a): a is KeyAudit & { score: number } => typeof a.score === 'number' && a.score < 0.9)
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map((a) => ({ title: a.title, ...(a.displayValue && { displayValue: a.displayValue }) }));

  const props: PdfDocumentProps = {
    businessName: business.name,
    website: business.website ?? '',
    address: business.address,
    phone: business.phone,
    auditDate,
    performanceScore: audit.performance_score,
    seoScore: audit.seo_score,
    mobileScore: audit.mobile_score,
    sslValid: audit.ssl_valid,
    topIssues: topIssues.length > 0 ? topIssues : undefined,
    summary: aiReport.summary,
    improvements: aiReport.improvements as string[],
  };

  let buffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buffer = await renderToBuffer(createElement(PdfDocument, props) as any);
  } catch {
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }

  const safeFilename = `audit-${business.name
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
    },
  });
}
