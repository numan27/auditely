// app/_shared/lib/freeAudit/freeReport.ts

// A free audit's plain-English summary, in Auditely's own neutral voice (the
// visitor has no account, so no brand of theirs). The fixes come from the impact
// library, like every report's. Without Groq the audit still shows, just without
// a summary. Server-only.

import { reportFixes, writeReport } from '@/app/_shared/lib/audit/aiReport';
import { groqComplete } from '@/app/_shared/lib/audit/groqComplete';
import { rankedProblems } from '@/app/_shared/lib/audit/impact';
import type { AuditRow } from '@/app/_shared/lib/audit/types';
import { AUDITELY_WRITER } from '@/app/_shared/lib/brand/brandRules';
import type { FreeReport } from '@/app/_shared/lib/freeAudit/freeAuditStore';

/** The summary, fixes and outreach email; null without GROQ_API_KEY or when it couldn't be written */
export async function writeFreeReport(
  audit: AuditRow,
  website: string,
  env: Record<string, string | undefined> = process.env
): Promise<FreeReport | null> {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) return null;
  try {
    // A free audit has no saved row; the ranking never reads its date
    const problems = rankedProblems({ ...audit, created_at: new Date().toISOString() });
    const written = await writeReport(groqComplete(apiKey), {
      businessName: new URL(website).hostname,
      website,
      problems,
      writer: AUDITELY_WRITER,
    });
    return { summary: written.summary, cold_email: written.cold_email, improvements: reportFixes(problems) };
  } catch (err) {
    console.error(`[free-audit] Summary skipped: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
