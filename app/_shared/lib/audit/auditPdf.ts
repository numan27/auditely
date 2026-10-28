// app/_shared/lib/audit/auditPdf.ts

// An audit's PDF report, built from its stored data and newest AI report, in
// the brand of the account that owns the business. Used by the download
// (/api/pdf) and the private report link (/report/{token}). Only the download
// offers the Upwork version. Server-only.

import type { Db } from '@/app/_shared/lib/supabase/client';
import { pdfFileName, renderPdf, renderUpworkPdf, type PdfBusiness } from '@/app/_shared/lib/audit/pdfRender';
import { BRAND_UNAVAILABLE, BrandUnavailable, brandFor } from '@/app/_shared/lib/brand/brand';
import type { Brand } from '@/app/_shared/lib/brand/brandRules';
import type { PdfVariant } from '@/app/_shared/lib/types/auditely';

export type AuditPdfResult =
  | { ok: true; pdf: Buffer; filename: string }
  | { ok: false; status: 404 | 500 | 503; error: string };

export async function renderAuditPdf(db: Db, auditId: string, variant: PdfVariant = 'full'): Promise<AuditPdfResult> {
  const { data: audit } = await db.from('audits').select('*, businesses(*)').eq('id', auditId).single();
  if (!audit) return { ok: false, status: 404, error: "Couldn't find this audit. Refresh the page and try again." };

  const { data: aiReport } = await db
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!aiReport) return { ok: false, status: 404, error: "The summary isn't written yet. Download the PDF once it shows." };

  const business = audit.businesses as PdfBusiness & { user_id: string | null };
  // Never drawn under the wrong name: a profile that can't be read stops here
  let brand: Brand;
  try {
    brand = await brandFor(business.user_id);
  } catch (err) {
    if (!(err instanceof BrandUnavailable)) throw err;
    console.error('[pdf]', err.message);
    return { ok: false, status: 503, error: BRAND_UNAVAILABLE };
  }
  try {
    const pdf =
      variant === 'upwork'
        ? await renderUpworkPdf(audit, business, aiReport, brand)
        : await renderPdf(audit, business, aiReport, brand);
    return { ok: true, pdf, filename: pdfFileName(business.name, variant) };
  } catch (err) {
    console.error('[pdf] drawing failed:', err);
    return { ok: false, status: 500, error: "Couldn't make the PDF. Try again in a minute." };
  }
}
