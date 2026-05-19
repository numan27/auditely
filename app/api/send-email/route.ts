// app/api/send-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
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

  const business = audit.businesses as {
    name: string;
    website: string | null;
    address: string;
    phone: string | null;
    email: string | null;
  };

  if (!business.email) {
    return NextResponse.json({ error: 'Business has no email address' }, { status: 400 });
  }

  // Fetch AI report
  const { data: aiReport } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .maybeSingle();

  if (!aiReport) {
    return NextResponse.json({ error: 'Generate the AI report first' }, { status: 400 });
  }

  // Build top issues for PDF attachment
  type KeyAudit = { score: number | null; title: string; displayValue?: string };
  type RawJson = { mobile?: { keyAudits?: Record<string, KeyAudit> } };
  const rawJson = audit.raw_json as RawJson | null;
  const topIssues = Object.values(rawJson?.mobile?.keyAudits ?? {})
    .filter((a): a is KeyAudit & { score: number } => typeof a.score === 'number' && a.score < 0.9)
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map((a) => ({ title: a.title, ...(a.displayValue && { displayValue: a.displayValue }) }));

  const auditDate = new Date(audit.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(createElement(PdfDocument, {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
  } catch {
    return NextResponse.json({ error: 'Failed to generate PDF attachment' }, { status: 500 });
  }

  // Send via Resend
  const resend = new Resend(apiKey);
  const safeName = business.name
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-');

  try {
    await resend.emails.send({
      from: fromEmail,
      to: business.email,
      subject: `Free Website Audit Report — ${business.name}`,
      text: aiReport.cold_email,
      attachments: [
        {
          filename: `audit-${safeName}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
