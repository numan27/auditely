// app/_shared/lib/audit/generateAiReport.ts

// One audit's AI report (summary, fixes and the first outreach email), written
// once and then served from the database, unless "Write again" asks for a new
// one in its place. It's written as the brand of the account that owns the
// business. Used by "Run audit" once the audit is in (api/generate) and by free
// audits requested on devartventures.com (api/inbound/audit-request). Server-only.

import type { Db } from '@/app/_shared/lib/supabase/client';
import { groqComplete } from '@/app/_shared/lib/audit/groqComplete';
import { rankedProblems } from '@/app/_shared/lib/audit/impact';
import { InvalidReplyError, reportFixes, writeReport, type WrittenReport } from '@/app/_shared/lib/audit/aiReport';
import { BRAND_UNAVAILABLE, BrandUnavailable, brandFor } from '@/app/_shared/lib/brand/brand';
import type { Brand } from '@/app/_shared/lib/brand/brandRules';
import type { AiReport } from '@/app/_shared/lib/types/auditely';

export type AiReportResult = { ok: true; ai_report: AiReport } | { ok: false; status: number; error: string };

export async function generateAiReport(db: Db, auditId: string, options: { rewrite?: boolean } = {}): Promise<AiReportResult> {
  // Newest report for this audit. Ordered + limited so it still works if
  // duplicate rows exist (maybeSingle() errors on more than one row).
  const findLatestReport = async () => {
    const { data } = await db
      .from('ai_reports')
      .select('*')
      .eq('audit_id', auditId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };

  // Cache check; a rewrite replaces the saved report instead
  const existing = await findLatestReport();

  if (existing && !options.rewrite) {
    return { ok: true, ai_report: existing };
  }

  // Fetch audit + business name/website via join
  const { data: audit } = await db
    .from('audits')
    .select('*, businesses(name, website, user_id)')
    .eq('id', auditId)
    .single();

  if (!audit) {
    return { ok: false, status: 404, error: 'Audit not found' };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 503, error: 'GROQ_API_KEY is not configured' };
  }

  const biz = audit.businesses as { name: string; website: string | null; user_id: string | null } | null;
  if (!biz) {
    return { ok: false, status: 404, error: 'Business not found' };
  }

  // Never written under the wrong name: a profile that can't be read stops here
  let brand: Brand;
  try {
    brand = await brandFor(biz.user_id);
  } catch (err) {
    if (!(err instanceof BrandUnavailable)) throw err;
    console.error('[generate]', err.message);
    return { ok: false, status: 503, error: BRAND_UNAVAILABLE };
  }

  // The model only sees the impact library's facts; the fixes come from the library
  const problems = rankedProblems(audit);
  const complete = groqComplete(apiKey);

  let written: WrittenReport;
  try {
    written = await writeReport(complete, {
      businessName: biz.name,
      website: biz.website ?? '',
      problems,
      writer: brand.writer,
    });
  } catch (err) {
    if (err instanceof InvalidReplyError) {
      return { ok: false, status: 500, error: 'AI returned invalid JSON' };
    }
    console.error('[generate] Groq request failed:', err instanceof Error ? err.message : err);
    return { ok: false, status: 503, error: 'AI service unavailable' };
  }

  const report = { summary: written.summary, improvements: reportFixes(problems), cold_email: written.cold_email };

  // Written again: the same row, so it keeps its id and when it was first written
  if (existing) {
    const { data: rewritten, error } = await db.from('ai_reports').update(report).eq('id', existing.id).select().single();
    if (error || !rewritten) return { ok: false, status: 500, error: 'Failed to store AI report' };
    return { ok: true, ai_report: rewritten };
  }

  const { data: aiReport, error } = await db
    .from('ai_reports')
    .insert({ audit_id: auditId, ...report })
    .select()
    .single();

  // Unique violation → a concurrent request stored this audit's report first
  if (error?.code === '23505') {
    const stored = await findLatestReport();
    if (stored) return { ok: true, ai_report: stored };
  }

  if (error || !aiReport) {
    return { ok: false, status: 500, error: 'Failed to store AI report' };
  }

  return { ok: true, ai_report: aiReport };
}
