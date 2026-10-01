// app/_shared/lib/audit/auditPdf.ts

// An audit's PDF report, built from its stored data and newest AI report. Used
// by the download (/api/pdf) and the private report link (/report/{token}).
// Server-only.

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { PdfDocument } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { buildPdfProps } from '@/app/_shared/lib/audit/reportData';
import { reportContact } from '@/app/_shared/lib/config/reportContact';

export type AuditPdfResult =
  | { ok: true; pdf: Buffer; filename: string }
  | { ok: false; status: 404 | 500; error: string };

const fileName = (businessName: string) =>
  `audit-${businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().replace(/-+/g, '-')}.pdf`;

export async function renderAuditPdf(auditId: string): Promise<AuditPdfResult> {
  const { data: audit } = await supabase.from('audits').select('*, businesses(*)').eq('id', auditId).single();
  if (!audit) return { ok: false, status: 404, error: 'Audit not found' };

  const { data: aiReport } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!aiReport) return { ok: false, status: 404, error: 'AI report not found — generate the report first' };

  const business = audit.businesses as { name: string; website: string | null; address: string; phone: string | null };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdf = await renderToBuffer(createElement(PdfDocument, buildPdfProps(audit, business, aiReport, reportContact())) as any);
    return { ok: true, pdf, filename: fileName(business.name) };
  } catch {
    return { ok: false, status: 500, error: 'Failed to generate PDF' };
  }
}
