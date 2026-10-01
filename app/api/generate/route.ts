// app/api/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { rankedProblems } from '@/app/_shared/lib/audit/impact';
import { InvalidReplyError, reportFixes, writeReport, type WrittenReport } from '@/app/_shared/lib/audit/aiReport';
import { reportContact } from '@/app/_shared/lib/config/reportContact';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  // Newest report for this audit. Ordered + limited so it still works if
  // duplicate rows exist (maybeSingle() errors on more than one row).
  const findLatestReport = async () => {
    const { data } = await supabase
      .from('ai_reports')
      .select('*')
      .eq('audit_id', auditId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };

  // Cache check
  const existing = await findLatestReport();

  if (existing) {
    return NextResponse.json({ ai_report: existing });
  }

  // Fetch audit + business name/website via join
  const { data: audit } = await supabase
    .from('audits')
    .select('*, businesses(name, website)')
    .eq('id', auditId)
    .single();

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 503 });
  }

  const groq = new Groq({ apiKey });

  const biz = audit.businesses as { name: string; website: string | null } | null;
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  // The model only sees the impact library's facts; the fixes come from the library
  const problems = rankedProblems(audit);
  const complete = async (prompt: string): Promise<string> => {
    const completion = await groq.chat.completions.create({
      // llama-3.3-70b-versatile is no longer served by Groq (model_not_found)
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      // gpt-oss reasons before answering and those tokens count against
      // max_tokens: at default effort it used up to ~1.5k and got cut off
      // mid-JSON (json_validate_failed). Low effort uses ~50; 4096 is headroom.
      reasoning_effort: 'low',
      max_tokens: 4096,
    });
    return completion.choices[0]?.message?.content ?? '{}';
  };

  let written: WrittenReport;
  try {
    written = await writeReport(complete, {
      businessName: biz.name,
      website: biz.website ?? '',
      problems,
      sender: reportContact().name,
    });
  } catch (err) {
    if (err instanceof InvalidReplyError) {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }
    console.error('[generate] Groq request failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 });
  }

  const { data: aiReport, error } = await supabase
    .from('ai_reports')
    .insert({
      audit_id: auditId,
      summary: written.summary,
      improvements: reportFixes(problems),
      cold_email: written.cold_email,
    })
    .select()
    .single();

  // Unique violation → a concurrent request stored this audit's report first
  if (error?.code === '23505') {
    const stored = await findLatestReport();
    if (stored) return NextResponse.json({ ai_report: stored });
  }

  if (error || !aiReport) {
    return NextResponse.json({ error: 'Failed to store AI report' }, { status: 500 });
  }

  return NextResponse.json({ ai_report: aiReport });
}
