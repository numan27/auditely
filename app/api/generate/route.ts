// app/api/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabase } from '@/app/_shared/lib/supabase/client';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auditId: string = body.audit_id ?? '';

  if (!auditId) {
    return NextResponse.json({ error: 'audit_id is required' }, { status: 400 });
  }

  // Cache check
  const { data: existing } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('audit_id', auditId)
    .maybeSingle();

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

  const biz = audit.businesses as { name: string; website: string } | null;
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }
  const businessName = biz.name;
  const website = biz.website;

  type RawJson = {
    mobile?: { keyAudits?: Record<string, { score: number | null; title: string; displayValue?: string }> };
  };
  const rawJson = audit.raw_json as RawJson | null;
  const mobileAudits = rawJson?.mobile?.keyAudits ?? {};
  const topIssues = Object.values(mobileAudits)
    .filter((a): a is { score: number; title: string; displayValue?: string } =>
      typeof a.score === 'number' && a.score < 0.9
    )
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map(a => `- ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`)
    .join('\n') || 'No specific issues identified.';

  const prompt = `Analyze this website audit and respond in JSON only.

Business: ${businessName}
Website: ${website}
Performance Score: ${audit.performance_score}/100
SEO Score: ${audit.seo_score}/100
Mobile Score: ${audit.mobile_score}/100
SSL Valid: ${audit.ssl_valid}

Specific Issues Found:
${topIssues}

Instructions:
1. Write a 2-3 sentence summary referencing 1-2 of the specific issues above in plain business language
2. List exactly 4 actionable improvements directly tied to the issues above
3. Write a personalized cold email exactly 2 paragraphs long:
   - Paragraph 1: Introduce yourself briefly, mention you audited their website, and call out 2-3 specific issues found (reference the actual issue names and impact, e.g. slow load time, missing SSL, poor SEO).
   - Paragraph 2: Explain the value of fixing these issues for their business (more customers, better Google ranking, faster site), offer a free consultation or quick call, and end with a clear call to action.
   - Include a subject line at the very top prefixed with "Subject: "
   - Do NOT use bullet points inside the email — flowing prose only.

Tone: professional, warm, specific, value-focused. Never generic. Never pushy.

Respond with ONLY valid JSON in this exact format:
{
  "summary": "...",
  "improvements": ["...", "...", "...", "..."],
  "cold_email": "..."
}`;

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1536,
    });
  } catch {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 });
  }

  const content = completion.choices[0]?.message?.content ?? '{}';
  let parsed: { summary?: string; improvements?: string[]; cold_email?: string } = {};

  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
  }

  const { data: aiReport, error } = await supabase
    .from('ai_reports')
    .insert({
      audit_id: auditId,
      summary: parsed.summary ?? '',
      improvements: parsed.improvements ?? [],
      cold_email: parsed.cold_email ?? '',
    })
    .select()
    .single();

  if (error || !aiReport) {
    return NextResponse.json({ error: 'Failed to store AI report' }, { status: 500 });
  }

  return NextResponse.json({ ai_report: aiReport });
}
