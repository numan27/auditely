// app/_shared/lib/audit/auditPdf.ts

// An audit's PDF report, built from its stored data and newest AI report. Used
// by the download (/api/pdf) and the private report link (/report/{token}).
// Server-only.

import { supabase } from '@/app/_shared/lib/supabase/client';
import { pdfFileName, renderPdf, type PdfBusiness } from '@/app/_shared/lib/audit/pdfRender';
import { reportContact } from '@/app/_shared/lib/config/reportContact';

export type AuditPdfResult =
  | { ok: true; pdf: Buffer; filename: string }
  | { ok: false; status: 404 | 500; error: string };

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

  const business = audit.businesses as PdfBusiness;
  try {
    const pdf = await renderPdf(audit, business, aiReport, reportContact());
    return { ok: true, pdf, filename: pdfFileName(business.name) };
  } catch {
    return { ok: false, status: 500, error: 'Failed to generate PDF' };
  }
}
