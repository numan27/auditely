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

  const businessName = (audit.businesses as { name: string; website: string }).name;
  const website = (audit.businesses as { name: string; website: string }).website;

  const prompt = `Analyze this website audit and respond in JSON only.

Business: ${businessName}
Website: ${website}
Performance Score: ${audit.performance_score}/100
SEO Score: ${audit.seo_score}/100
Mobile Score: ${audit.mobile_score}/100
SSL Valid: ${audit.ssl_valid}

Instructions:
1. Write a 2-3 sentence summary of key issues in simple business language
2. List exactly 4 specific, actionable improvements
3. Write a short personalized cold email offering web development services

Tone: professional, concise, value-focused, not salesy.

Respond with ONLY valid JSON in this exact format:
{
  "summary": "...",
  "improvements": ["...", "...", "...", "..."],
  "cold_email": "..."
}`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 1024,
  });

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
