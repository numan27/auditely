// app/api/send-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps } from '@/app/_shared/lib/audit/reportData';
import { reportContact } from '@/app/_shared/lib/config/reportContact';

// The AI writes "Subject: ..." as the first line of cold_email. Use it as the
// real subject and strip it from the body; fall back to a default subject.
function splitSubject(coldEmail: string, fallback: string): { subject: string; body: string } {
  const [firstLine, ...rest] = coldEmail.trimStart().split('\n');
  const match = firstLine?.match(/^\s*subject:\s*(.+)$/i);
  if (!match) return { subject: fallback, body: coldEmail };
  return { subject: match[1].trim(), body: rest.join('\n').trimStart() };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
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
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!aiReport) {
    return NextResponse.json({ error: 'Generate the AI report first' }, { status: 400 });
  }

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(createElement(PdfDocument, buildPdfProps(audit, business, aiReport, reportContact())) as any);
  } catch {
    return NextResponse.json({ error: 'Failed to generate PDF attachment' }, { status: 500 });
  }

  // Send via Resend
  const resend = new Resend(apiKey);
  const safeName = business.name
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-');

  const { subject, body: text } = splitSubject(
    aiReport.cold_email,
    `Free Website Audit Report — ${business.name}`
  );

  try {
    await resend.emails.send({
      from: fromEmail,
      to: business.email,
      subject,
      text,
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
